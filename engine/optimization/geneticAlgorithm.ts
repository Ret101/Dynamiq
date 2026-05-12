/**
 * Real-valued Genetic Algorithm for suspension hardpoint optimization.
 *
 * Encoding: flat array of real-valued design variables (hardpoint coordinates).
 * Selection: tournament selection.
 * Crossover: simulated binary crossover (SBX), η=20.
 * Mutation: polynomial mutation, η=20.
 * Elitism: top elite_count individuals survive each generation.
 * Multi-objective: weighted sum for single-objective; NSGA-II structure for Pareto.
 */

import type { OptimizationConfig, OptimizationCandidate, ParetoFront } from '@/types/optimization';

interface Individual {
  genes: number[];
  fitness: number;
  objectiveValues: number[];
  constraintViolations: number[];
  rank?: number;         // NSGA-II Pareto rank
  crowdingDistance?: number;
}

export class GeneticAlgorithmOptimizer {
  private readonly config: OptimizationConfig;
  private readonly fitnessFunction: FitnessFunction;
  private population: Individual[];
  private generation = 0;
  private evaluations = 0;
  private bestEver: Individual | null = null;

  constructor(config: OptimizationConfig, fitnessFunction: FitnessFunction) {
    this.config = config;
    this.fitnessFunction = fitnessFunction;
    this.population = [];
  }

  initialize(): void {
    const { populationSize, variables } = this.config;
    this.population = Array.from({ length: populationSize }, () => {
      const genes = variables.map(v => v.min + Math.random() * (v.max - v.min));
      return this.evaluate(genes);
    });
    this.updateBest();
  }

  step(): GenerationResult {
    const { populationSize, mutationRate, crossoverRate } = this.config;
    const { variables } = this.config;

    // Tournament selection + reproduction
    const offspring: Individual[] = [];

    while (offspring.length < populationSize) {
      const parent1 = this.tournamentSelect(3);
      const parent2 = this.tournamentSelect(3);

      let child1Genes: number[];
      let child2Genes: number[];

      if (Math.random() < crossoverRate) {
        [child1Genes, child2Genes] = this.sbxCrossover(parent1.genes, parent2.genes, 20);
      } else {
        child1Genes = [...parent1.genes];
        child2Genes = [...parent2.genes];
      }

      // Polynomial mutation
      child1Genes = this.polynomialMutate(child1Genes, mutationRate, 20);
      child2Genes = this.polynomialMutate(child2Genes, mutationRate, 20);

      // Clip to bounds
      child1Genes = child1Genes.map((g, i) => Math.max(variables[i].min, Math.min(variables[i].max, g)));
      child2Genes = child2Genes.map((g, i) => Math.max(variables[i].min, Math.min(variables[i].max, g)));

      offspring.push(this.evaluate(child1Genes));
      if (offspring.length < populationSize) {
        offspring.push(this.evaluate(child2Genes));
      }
    }

    // Elitism: merge parent + offspring, keep best
    const eliteCount = Math.max(1, Math.floor(populationSize * 0.1));
    const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
    const elite = sorted.slice(0, eliteCount);

    // Sort offspring + elite, keep top N
    const combined = [...elite, ...offspring];
    combined.sort((a, b) => b.fitness - a.fitness);
    this.population = combined.slice(0, populationSize);

    this.generation++;
    this.updateBest();

    const fitnesses = this.population.map(i => i.fitness);
    return {
      generation: this.generation,
      bestFitness: this.bestEver?.fitness ?? 0,
      meanFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      diversity: this.computeDiversity(),
      best: this.bestEver!,
    };
  }

  /** Run all generations, calling onProgress each generation. */
  run(onProgress?: (result: GenerationResult) => void): Individual {
    this.initialize();

    for (let g = 0; g < this.config.maxGenerations; g++) {
      if (this.evaluations >= this.config.maxEvaluations) break;
      const result = this.step();
      onProgress?.(result);

      // Convergence check
      if (result.diversity < this.config.convergenceTol) break;
    }

    return this.bestEver!;
  }

  /** Extract Pareto front from current population. */
  getParetoFront(): ParetoFront {
    this.assignParetoRanks();
    const front0 = this.population.filter(i => i.rank === 0);
    return {
      solutions: front0.map(ind => this.individualToCandidate(ind)),
      objectiveNames: this.config.objectives.map(o => o.objective),
    };
  }

  private evaluate(genes: number[]): Individual {
    const { objectiveValues, constraintViolations, fitness } = this.fitnessFunction(genes);
    this.evaluations++;
    return { genes, fitness, objectiveValues, constraintViolations };
  }

  private updateBest(): void {
    const best = this.population.reduce((a, b) => b.fitness > a.fitness ? b : a);
    if (!this.bestEver || best.fitness > this.bestEver.fitness) {
      this.bestEver = { ...best, genes: [...best.genes] };
    }
  }

  private tournamentSelect(k: number): Individual {
    let best: Individual | null = null;
    for (let i = 0; i < k; i++) {
      const candidate = this.population[Math.floor(Math.random() * this.population.length)];
      if (!best || candidate.fitness > best.fitness) best = candidate;
    }
    return best!;
  }

  /**
   * Simulated Binary Crossover (SBX).
   * Deb, K. & Agrawal, R.B. (1995).
   */
  private sbxCrossover(p1: number[], p2: number[], eta: number): [number[], number[]] {
    const c1 = [...p1];
    const c2 = [...p2];
    const { variables } = this.config;

    for (let i = 0; i < p1.length; i++) {
      if (Math.random() > 0.5) continue;
      if (Math.abs(p1[i] - p2[i]) < 1e-10) continue;

      const y1 = Math.min(p1[i], p2[i]);
      const y2 = Math.max(p1[i], p2[i]);
      const yl = variables[i].min;
      const yu = variables[i].max;

      const rand = Math.random();
      let beta: number;
      const betaL = 1 + (2 * (y1 - yl) / (y2 - y1));
      const betaR = 1 + (2 * (yu - y2) / (y2 - y1));
      const alphaL = 2 - Math.pow(betaL, -(eta + 1));
      const alphaR = 2 - Math.pow(betaR, -(eta + 1));

      if (rand <= 1 / alphaL) {
        beta = Math.pow(rand * alphaL, 1 / (eta + 1));
      } else {
        beta = Math.pow(1 / (2 - rand * alphaL), 1 / (eta + 1));
      }

      c1[i] = 0.5 * (y1 + y2 - beta * (y2 - y1));
      c2[i] = 0.5 * (y1 + y2 + beta * (y2 - y1));
    }

    return [c1, c2];
  }

  /**
   * Polynomial mutation.
   * Deb, K. (2001). "Multi-Objective Optimization using Evolutionary Algorithms."
   */
  private polynomialMutate(genes: number[], pm: number, eta: number): number[] {
    const { variables } = this.config;
    return genes.map((g, i) => {
      if (Math.random() > pm) return g;
      const yl = variables[i].min;
      const yu = variables[i].max;
      const delta = yu - yl;
      if (delta < 1e-10) return g;

      const u = Math.random();
      let deltaq: number;
      if (u < 0.5) {
        const b = (g - yl) / delta;
        const temp = 2 * u + (1 - 2 * u) * Math.pow(1 - b, eta + 1);
        deltaq = Math.pow(temp, 1 / (eta + 1)) - 1;
      } else {
        const b = (yu - g) / delta;
        const temp = 2 * (1 - u) + (2 * u - 1) * Math.pow(1 - b, eta + 1);
        deltaq = 1 - Math.pow(temp, 1 / (eta + 1));
      }
      return Math.max(yl, Math.min(yu, g + deltaq * delta));
    });
  }

  /** NSGA-II fast non-dominated sort. */
  private assignParetoRanks(): void {
    const n = this.population.length;
    const dominated: Set<number>[] = Array.from({ length: n }, () => new Set());
    const dominationCount: number[] = new Array(n).fill(0);
    const rank: number[] = new Array(n).fill(0);

    const dominates = (a: Individual, b: Individual): boolean =>
      a.objectiveValues.every((v, j) => v >= b.objectiveValues[j]) &&
      a.objectiveValues.some((v, j) => v > b.objectiveValues[j]);

    let front: number[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (dominates(this.population[i], this.population[j])) {
          dominated[i].add(j);
        } else if (dominates(this.population[j], this.population[i])) {
          dominationCount[i]++;
        }
      }
      if (dominationCount[i] === 0) front.push(i);
    }

    let r = 0;
    while (front.length > 0) {
      const nextFront: number[] = [];
      for (const i of front) {
        rank[i] = r;
        for (const j of dominated[i]) {
          dominationCount[j]--;
          if (dominationCount[j] === 0) nextFront.push(j);
        }
      }
      r++;
      front = nextFront;
    }

    this.population.forEach((ind, i) => { ind.rank = rank[i]; });
  }

  private computeDiversity(): number {
    if (this.population.length < 2) return 0;
    const genes = this.population.map(i => i.genes);
    let totalDist = 0;
    let pairs = 0;
    for (let i = 0; i < genes.length; i++) {
      for (let j = i + 1; j < genes.length; j++) {
        const d = genes[i].reduce((sum, g, k) => sum + (g - genes[j][k]) ** 2, 0);
        totalDist += Math.sqrt(d);
        pairs++;
      }
    }
    return pairs > 0 ? totalDist / pairs : 0;
  }

  private individualToCandidate(ind: Individual): OptimizationCandidate {
    const hardpoints: Record<string, { x: number; y: number; z: number }> = {};
    this.config.variables.forEach((v, i) => {
      if (!hardpoints[v.hardpointId]) hardpoints[v.hardpointId] = { x: 0, y: 0, z: 0 };
      (hardpoints[v.hardpointId] as Record<string, number>)[v.axis] = ind.genes[i];
    });
    return {
      generation: this.generation,
      variables: ind.genes,
      objectiveValues: ind.objectiveValues,
      constraintViolations: ind.constraintViolations,
      fitness: ind.fitness,
      hardpoints,
    };
  }
}

export interface FitnessFunction {
  (genes: number[]): {
    objectiveValues: number[];
    constraintViolations: number[];
    fitness: number;
  };
}

export interface GenerationResult {
  generation: number;
  bestFitness: number;
  meanFitness: number;
  diversity: number;
  best: Individual;
}
