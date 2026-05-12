/**
 * Suspension-specific optimization orchestrator.
 * Wraps GA + gradient descent with suspension-aware objective functions.
 */

import type { VehicleSpec } from '@/types/suspension';
import type { OptimizationConfig, OptimizationResult, OptimizationCandidate } from '@/types/optimization';
import type { SimulationSettings } from '@/types/project';
import { GeneticAlgorithmOptimizer, type FitnessFunction } from './geneticAlgorithm';
import { adamOptimize } from './gradientDescent';
import { CornerKinematicSolver } from '../kinematics/cornerSolver';
import { sweepCorner } from '../kinematics/sweepSolver';
import { nanoid } from '../suspension/nanoid';

export class SuspensionOptimizer {
  private readonly vehicle: VehicleSpec;
  private readonly settings: SimulationSettings;

  constructor(vehicle: VehicleSpec, settings: SimulationSettings) {
    this.vehicle = vehicle;
    this.settings = settings;
  }

  /** Run the full optimization. */
  async run(
    config: OptimizationConfig,
    onProgress?: (gen: number, best: number) => void
  ): Promise<OptimizationResult> {
    const startedAt = new Date().toISOString();

    const fitnessFunction = this.buildFitnessFunction(config);

    const ga = new GeneticAlgorithmOptimizer(config, fitnessFunction);

    const history: OptimizationResult['history'] = [];
    const gaResult = ga.run((gen) => {
      history.push({
        generation: gen.generation,
        bestFitness: gen.bestFitness,
        meanFitness: gen.meanFitness,
        diversity: gen.diversity,
      });
      onProgress?.(gen.generation, gen.bestFitness);
    });

    // Polish with gradient descent
    const gaBest = gaResult.genes;
    const bounds = config.variables.map(v => ({ min: v.min, max: v.max }));
    const gdResult = adamOptimize(gaBest, (x) => -fitnessFunction(x).fitness, bounds, {
      learningRate: 0.001,
      maxIter: 100,
      convergenceTol: 1e-8,
    });

    const finalGenes = gdResult.solution;
    const { objectiveValues, constraintViolations, fitness } = fitnessFunction(finalGenes);

    const paretoFront = ga.getParetoFront();

    // Build hardpoint map from final genes
    const hardpoints: Record<string, { x: number; y: number; z: number }> = {};
    config.variables.forEach((v, i) => {
      if (!hardpoints[v.hardpointId]) hardpoints[v.hardpointId] = { x: 0, y: 0, z: 0 };
      (hardpoints[v.hardpointId] as Record<string, number>)[v.axis] = finalGenes[i];
    });

    const best: OptimizationCandidate = {
      generation: config.maxGenerations,
      variables: finalGenes,
      objectiveValues,
      constraintViolations,
      fitness,
      hardpoints,
    };

    return {
      id: nanoid(),
      config,
      startedAt,
      completedAt: new Date().toISOString(),
      generations: config.maxGenerations,
      evaluations: config.maxEvaluations,
      best,
      history,
      paretoFront: paretoFront.solutions.length > 1 ? paretoFront : undefined,
      converged: gdResult.converged,
      terminationReason: gdResult.converged ? 'converged' : 'max_evaluations',
    };
  }

  private buildFitnessFunction(config: OptimizationConfig): FitnessFunction {
    return (genes: number[]) => {
      // Apply genes to a cloned vehicle
      const vehicleClone = this.applyGenes(genes, config);

      try {
        // Run kinematic sweep
        const sweep = sweepCorner(vehicleClone.frontSuspension, this.settings);

        // Compute objective values
        const objectiveValues = config.objectives.map(obj =>
          this.computeObjective(obj, sweep)
        );

        // Compute constraint violations (penalty method)
        const constraintViolations = config.constraints.map(c =>
          this.computeConstraintViolation(c, vehicleClone, sweep)
        );

        // Weighted sum fitness + constraint penalty
        const objectiveFitness = config.objectives.reduce((sum, obj, i) =>
          sum + obj.weight * objectiveValues[i], 0
        );
        const penalty = constraintViolations.reduce((sum, v, i) =>
          sum + config.constraints[i].weight * Math.max(0, v) ** 2, 0
        );

        return {
          objectiveValues,
          constraintViolations,
          fitness: objectiveFitness - penalty,
        };
      } catch {
        return {
          objectiveValues: config.objectives.map(() => -1e6),
          constraintViolations: config.constraints.map(() => 1e6),
          fitness: -1e9,
        };
      }
    };
  }

  private computeObjective(
    objSpec: OptimizationConfig['objectives'][0],
    sweep: ReturnType<typeof sweepCorner>
  ): number {
    const { objective, target } = objSpec;
    switch (objective) {
      case 'maximize_camber_gain': {
        const gains = sweep.camberCurve.map(p => Math.abs(p.camber));
        return gains.length > 1
          ? Math.abs((gains[gains.length - 1] - gains[0]) / (sweep.travelRange[1] - sweep.travelRange[0]))
          : 0;
      }
      case 'target_camber_gain': {
        // Target a specific camber gain rate (°/mm). Default target = 0.05°/mm.
        const t = target ?? 0.05;
        const gains = sweep.camberCurve.map(p => Math.abs(p.camber));
        const rate = gains.length > 1
          ? Math.abs((gains[gains.length - 1] - gains[0]) / (sweep.travelRange[1] - sweep.travelRange[0]))
          : 0;
        return -Math.abs(rate - t);
      }
      case 'minimize_bump_steer': {
        const toeValues = sweep.bumpSteerCurve.map(p => Math.abs(p.toe));
        const max = Math.max(...toeValues, 0);
        const limit = target ?? 0.05; // default: minimize below 0.05°/mm
        return -(max / limit);        // normalised: 0 = perfect, lower is worse
      }
      case 'minimize_rc_migration': {
        const rcHeights = sweep.rollCenterMigration.map(p => p.rcHeight);
        const range = Math.max(...rcHeights) - Math.min(...rcHeights);
        const limit = target ?? 10;
        return -(range / limit);
      }
      case 'target_rc_height': {
        // Target a specific roll center height at design position. Default 20mm.
        const t = target ?? 20;
        const midIdx = Math.floor(sweep.rollCenterMigration.length / 2);
        const rcH = sweep.rollCenterMigration[midIdx]?.rcHeight ?? 0;
        return -Math.abs(rcH - t);
      }
      case 'target_motion_ratio': {
        const t = target ?? 0.75;
        const mrValues = sweep.motionRatioCurve.map(p => p.motionRatio);
        const avgMR = mrValues.reduce((s, v) => s + v, 0) / (mrValues.length || 1);
        return -Math.abs(avgMR - t);
      }
      case 'minimize_scrub_radius': {
        const midIdx = Math.floor(sweep.results.length / 2);
        const scrub = Math.abs(sweep.results[midIdx]?.[0]?.scrubRadius ?? 0);
        const limit = target ?? 30;
        return -(scrub / limit);
      }
      case 'minimize_track_change': {
        const changes = sweep.results.map(r => Math.abs(r[0]?.trackChange ?? 0));
        const max = Math.max(...changes, 0);
        const limit = target ?? 2;
        return -(max / limit);
      }
      default:
        return 0;
    }
  }

  private computeConstraintViolation(
    constraint: OptimizationConfig['constraints'][0],
    _vehicle: VehicleSpec,
    sweep: ReturnType<typeof sweepCorner>
  ): number {
    switch (constraint.type) {
      case 'min_ground_clearance':
        return constraint.value - 25; // simplified
      case 'motion_ratio_range': {
        const mrValues = sweep.motionRatioCurve.map(p => p.motionRatio);
        const avgMR = mrValues.reduce((s, v) => s + v, 0) / mrValues.length;
        return Math.abs(avgMR - constraint.value) - constraint.tolerance;
      }
      default:
        return 0;
    }
  }

  private applyGenes(genes: number[], config: OptimizationConfig): VehicleSpec {
    const clone: VehicleSpec = JSON.parse(JSON.stringify(this.vehicle));

    config.variables.forEach((v, i) => {
      // Find hardpoint in vehicle and update position
      this.updateHardpointInVehicle(clone, v.hardpointId, v.axis, genes[i]);
    });

    return clone;
  }

  private updateHardpointInVehicle(
    vehicle: VehicleSpec,
    hardpointId: string,
    axis: 'x' | 'y' | 'z',
    value: number
  ): void {
    // Search all hardpoints for matching id
    const searchAndUpdate = (obj: unknown): void => {
      if (typeof obj !== 'object' || obj === null) return;
      const record = obj as Record<string, unknown>;
      if ('id' in record && record.id === hardpointId && 'position' in record) {
        const pos = record.position as Record<string, number>;
        pos[axis] = value;
        return;
      }
      for (const v of Object.values(record)) searchAndUpdate(v);
    };
    searchAndUpdate(vehicle);
  }
}
