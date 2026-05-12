export type OptimizationObjective =
  | 'maximize_camber_gain'
  | 'target_camber_gain'
  | 'minimize_bump_steer'
  | 'minimize_rc_migration'
  | 'target_rc_height'
  | 'target_motion_ratio'
  | 'target_ackermann'
  | 'minimize_scrub_radius'
  | 'minimize_track_change'
  | 'custom';

export type OptimizationAlgorithm =
  | 'gradient_descent'
  | 'genetic_algorithm'
  | 'simulated_annealing'
  | 'particle_swarm'
  | 'nelder_mead';

export interface OptimizationVariable {
  hardpointId: string;
  axis: 'x' | 'y' | 'z';
  min: number;      // mm
  max: number;      // mm
  step: number;     // resolution / mutation step
  description: string;
}

export interface OptimizationConstraint {
  type:
    | 'min_ground_clearance'
    | 'max_scrub_radius'
    | 'packaging_box'
    | 'min_caster'
    | 'max_kpi'
    | 'motion_ratio_range'
    | 'custom';
  value: number;
  tolerance: number;
  weight: number;   // penalty weight
}

export interface OptimizationObjectiveSpec {
  objective: OptimizationObjective;
  weight: number;
  target?: number;
  customExpression?: string;
}

export interface OptimizationConfig {
  name: string;
  algorithm: OptimizationAlgorithm;
  objectives: OptimizationObjectiveSpec[];
  variables: OptimizationVariable[];
  constraints: OptimizationConstraint[];

  // Algorithm parameters
  maxGenerations: number;    // GA / PSO
  populationSize: number;    // GA / PSO
  mutationRate: number;      // GA
  crossoverRate: number;     // GA
  learningRate: number;      // GD
  convergenceTol: number;
  maxEvaluations: number;
}

export interface OptimizationCandidate {
  generation: number;
  variables: number[];        // flat array matching config.variables order
  objectiveValues: number[];  // per objective
  constraintViolations: number[];
  fitness: number;            // weighted aggregate
  hardpoints: Record<string, { x: number; y: number; z: number }>;
}

export interface ParetoFront {
  solutions: OptimizationCandidate[];
  objectiveNames: string[];
}

export interface OptimizationResult {
  id: string;
  config: OptimizationConfig;
  startedAt: string;
  completedAt: string;
  generations: number;
  evaluations: number;
  best: OptimizationCandidate;
  history: Array<{
    generation: number;
    bestFitness: number;
    meanFitness: number;
    diversity: number;
  }>;
  paretoFront?: ParetoFront;
  converged: boolean;
  terminationReason: string;
}
