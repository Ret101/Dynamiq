/**
 * Project store: vehicle spec, simulation settings, computed kinematic results.
 * Persisted to IndexedDB via idb.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import type { VehicleSpec } from '@/types/suspension';
import type { KinematicSweep, VehicleKinematics } from '@/types/kinematics';
import type { SimulationSettings, ProjectMetadata } from '@/types/project';
import type { OptimizationResult } from '@/types/optimization';
import { defaultFSAEVehicle } from '@/engine/suspension/defaults/fsaeTemplate';
import { defaultBajaSimSettings } from '@/engine/suspension/defaults/bajaTemplate';
import { nanoid } from '@/engine/suspension/nanoid';
import { validateVehicle, type ValidationResult } from '@/engine/math/modelValidator';

const MAX_HISTORY = 50;

const defaultSettings: SimulationSettings = {
  travelSteps: 41,
  travelMin: -50,
  travelMax: 50,
  steerSteps: 11,
  steerMin: -30,
  steerMax: 30,
  useNonlinearSolver: true,
  convergenceTol: 1e-6,
  maxIterations: 100,
};

const defaultMetadata: ProjectMetadata = {
  id: nanoid(),
  name: 'New FSAE Vehicle',
  description: 'Formula SAE suspension project — Dynamiq',
  author: '',
  organization: '',
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  version: '1.0.0',
  tags: [],
  series: 'FSAE',
};

export interface ProjectStore {
  // State
  metadata: ProjectMetadata;
  vehicle: VehicleSpec;
  simulationSettings: SimulationSettings;
  frontSweep: KinematicSweep | null;
  rearSweep:  KinematicSweep | null;
  currentKinematics: VehicleKinematics | null;
  optimizationRuns: OptimizationResult[];
  isDirty: boolean;
  isSimulating: boolean;
  simulationError: string | null;
  validation: ValidationResult | null;

  // Undo/redo
  history: VehicleSpec[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setVehicle: (vehicle: VehicleSpec) => void;
  updateHardpoint: (id: string, axis: 'x' | 'y' | 'z', value: number, mirror?: boolean) => void;
  updateActuationType: (axle: 'front' | 'rear', type: 'direct' | 'pushrod' | 'pullrod') => void;
  updateMetadata: (metadata: Partial<ProjectMetadata>) => void;
  updateSettings: (settings: Partial<SimulationSettings>) => void;
  setFrontSweep: (sweep: KinematicSweep) => void;
  setRearSweep:  (sweep: KinematicSweep) => void;
  setCurrentKinematics: (k: VehicleKinematics) => void;
  addOptimizationResult: (result: OptimizationResult) => void;
  setSimulating: (simulating: boolean, error?: string | null) => void;
  resetToDefault: () => void;
  loadProject: (vehicle: VehicleSpec, metadata: ProjectMetadata, settings: SimulationSettings) => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  runValidation: () => void;
}

function cloneVehicle(v: VehicleSpec): VehicleSpec {
  return JSON.parse(JSON.stringify(v)) as VehicleSpec;
}

interface HistoryState {
  history: VehicleSpec[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}

function pushHistory(state: HistoryState, vehicle: VehicleSpec): void {
  // Drop any future entries beyond current index
  state.history.splice(state.historyIndex + 1);
  state.history.push(cloneVehicle(vehicle));
  // Trim oldest entry if over limit (index stays at end)
  if (state.history.length > MAX_HISTORY) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
  state.canUndo = state.historyIndex > 0;
  state.canRedo = false;
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    immer((set) => ({
      metadata: defaultMetadata,
      vehicle: defaultFSAEVehicle,
      simulationSettings: defaultSettings,
      frontSweep: null,
      rearSweep: null,
      currentKinematics: null,
      optimizationRuns: [],
      isDirty: false,
      isSimulating: false,
      simulationError: null,
      validation: null,
      history: [cloneVehicle(defaultFSAEVehicle)],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,

      setVehicle: (vehicle) =>
        set((state) => {
          pushHistory(state, vehicle);
          state.vehicle = vehicle;
          // Auto-adjust simulation travel range for vehicle series
          if (vehicle.series === 'Baja') {
            Object.assign(state.simulationSettings, defaultBajaSimSettings);
          }
          state.isDirty = true;
          state.metadata.modified = new Date().toISOString();
        }),

      updateHardpoint: (id, axis, value, mirror = false) =>
        set((state) => {
          const mirroredId = mirror
            ? findMirroredHardpointId(state.vehicle.allHardpoints, id)
            : null;

          // Update all instances of a given id throughout the vehicle tree
          // (same hardpoint stored in suspension corners AND allHardpoints).
          const updateById = (obj: unknown, targetId: string, targetValue: number): void => {
            if (typeof obj !== 'object' || obj === null) return;
            const record = obj as Record<string, unknown>;
            if ('id' in record && record.id === targetId && 'position' in record) {
              (record.position as Record<string, number>)[axis] = targetValue;
              return;
            }
            for (const v of Object.values(record)) updateById(v, targetId, targetValue);
          };

          updateById(state.vehicle, id, value);
          if (mirroredId) {
            // Y is lateral: negate it for the mirror side; X and Z carry across unchanged
            const mirrorValue = axis === 'y' ? -value : value;
            updateById(state.vehicle, mirroredId, mirrorValue);
          }

          pushHistory(state, state.vehicle);
          state.isDirty = true;
          state.metadata.modified = new Date().toISOString();
        }),

      updateActuationType: (axle, type) =>
        set((state) => {
          if (axle === 'front') state.vehicle.frontSuspension.actuationType = type;
          else state.vehicle.rearSuspension.actuationType = type;
          pushHistory(state, state.vehicle);
          state.isDirty = true;
          state.metadata.modified = new Date().toISOString();
        }),

      updateMetadata: (metadata) =>
        set((state) => {
          Object.assign(state.metadata, metadata);
          state.isDirty = true;
        }),

      updateSettings: (settings) =>
        set((state) => {
          Object.assign(state.simulationSettings, settings);
        }),

      setFrontSweep: (sweep) =>
        set((state) => { state.frontSweep = sweep; }),

      setRearSweep: (sweep) =>
        set((state) => { state.rearSweep = sweep; }),

      setCurrentKinematics: (k) =>
        set((state) => { state.currentKinematics = k; }),

      addOptimizationResult: (result) =>
        set((state) => {
          state.optimizationRuns.unshift(result);
          if (state.optimizationRuns.length > 10) state.optimizationRuns.pop();
          state.isDirty = true;
        }),

      setSimulating: (simulating, error = null) =>
        set((state) => {
          state.isSimulating = simulating;
          state.simulationError = error ?? null;
        }),

      resetToDefault: () =>
        set((state) => {
          const fresh = cloneVehicle(defaultFSAEVehicle);
          state.vehicle = fresh;
          state.metadata = { ...defaultMetadata, id: nanoid(), created: new Date().toISOString() };
          state.simulationSettings = defaultSettings;
          state.frontSweep = null;
          state.rearSweep = null;
          state.currentKinematics = null;
          state.optimizationRuns = [];
          state.isDirty = false;
          state.history = [cloneVehicle(fresh)];
          state.historyIndex = 0;
          state.canUndo = false;
          state.canRedo = false;
          state.validation = null;
        }),

      loadProject: (vehicle, metadata, settings) =>
        set((state) => {
          state.vehicle = vehicle;
          state.metadata = metadata;
          state.simulationSettings = settings;
          state.frontSweep = null;
          state.rearSweep = null;
          state.currentKinematics = null;
          state.isDirty = false;
          state.history = [cloneVehicle(vehicle)];
          state.historyIndex = 0;
          state.canUndo = false;
          state.canRedo = false;
          state.validation = null;
        }),

      markSaved: () =>
        set((state) => { state.isDirty = false; }),

      undo: () =>
        set((state) => {
          if (state.historyIndex <= 0) return;
          state.historyIndex -= 1;
          state.vehicle = cloneVehicle(state.history[state.historyIndex]);
          state.canUndo = state.historyIndex > 0;
          state.canRedo = true;
          state.isDirty = true;
          state.metadata.modified = new Date().toISOString();
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex >= state.history.length - 1) return;
          state.historyIndex += 1;
          state.vehicle = cloneVehicle(state.history[state.historyIndex]);
          state.canRedo = state.historyIndex < state.history.length - 1;
          state.canUndo = true;
          state.isDirty = true;
          state.metadata.modified = new Date().toISOString();
        }),

      runValidation: () =>
        set((state) => {
          state.validation = validateVehicle(state.vehicle);
        }),
    })),
    { name: 'ProjectStore' }
  )
);

// ─── Mirror helper ────────────────────────────────────────────────────────────
// Given a hardpoint id, find the corresponding hardpoint id on the opposite
// side of the vehicle (FL↔FR, RL↔RR, rackLeft↔rackRight).

function findMirroredHardpointId(
  allHp: Record<string, unknown>,
  id: string,
): string | null {
  type HpId  = { id: string };
  type Corner = Record<string, HpId>;
  const ap = allHp as {
    frontLeft: Corner; frontRight: Corner;
    rearLeft: Corner;  rearRight: Corner;
    frontRackLeft?: HpId; frontRackRight?: HpId;
  };

  const pairs: [Corner, Corner][] = [
    [ap.frontLeft, ap.frontRight],
    [ap.rearLeft,  ap.rearRight],
  ];
  for (const [left, right] of pairs) {
    for (const key of Object.keys(left)) {
      if (left[key]?.id === id)  return right[key]?.id ?? null;
      if (right[key]?.id === id) return left[key]?.id  ?? null;
    }
  }
  if (ap.frontRackLeft?.id  === id) return ap.frontRackRight?.id ?? null;
  if (ap.frontRackRight?.id === id) return ap.frontRackLeft?.id  ?? null;
  return null;
}
