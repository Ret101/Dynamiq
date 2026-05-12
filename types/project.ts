import type { VehicleSpec } from './suspension';
import type { KinematicSweep, VehicleKinematics } from './kinematics';
import type { OptimizationResult } from './optimization';

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  organization: string;
  created: string;     // ISO 8601
  modified: string;
  version: string;
  tags: string[];
  series: string;
  eventYear?: number;
}

export interface SimulationSettings {
  travelSteps: number;      // points in sweep
  travelMin: number;        // mm
  travelMax: number;        // mm
  steerSteps: number;
  steerMin: number;         // mm rack travel
  steerMax: number;
  useNonlinearSolver: boolean;
  convergenceTol: number;
  maxIterations: number;
}

export interface ProjectState {
  metadata: ProjectMetadata;
  vehicle: VehicleSpec;
  simulationSettings: SimulationSettings;

  // Cached results
  frontSweep?: KinematicSweep;
  rearSweep?: KinematicSweep;
  currentKinematics?: VehicleKinematics;

  // Optimization history
  optimizationRuns: OptimizationResult[];

  // UI state (not serialized to file)
  isDirty: boolean;
}

export interface ProjectFile {
  format: 'lotus-shark-online';
  formatVersion: '1.0';
  metadata: ProjectMetadata;
  vehicle: VehicleSpec;
  simulationSettings: SimulationSettings;
}
