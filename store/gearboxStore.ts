/**
 * Gearbox calculator store.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GearboxProject, GearboxResult, GearEntry } from '@/types/gearbox';
import { computeGearbox } from '@/engine/gearbox/gearboxCalc';

const defaultProject: GearboxProject = {
  engine: {
    name: 'Honda CBR600RR (FSAE)',
    idleRPM: 2000,
    redlineRPM: 14000,
    peakTorque: 65,
    peakTorqueRPM: 9000,
    peakPower: 89,
    peakPowerRPM: 12500,
    torqueAtIdle: 20,
    torqueAtRedline: 40,
  },
  gearbox: {
    numGears: 6,
    gears: [
      { ratio: 2.600 },
      { ratio: 1.789 },
      { ratio: 1.409 },
      { ratio: 1.160 },
      { ratio: 1.000 },
      { ratio: 0.897 },
    ],
    finalDrive: 3.933,
    efficiency: 0.92,
    shiftTime: 0.15,
  },
  vehicle: {
    mass: 290,
    tireRadius: 228,
    frontalArea: 1.1,
    cdAero: 1.2,
    rollResistCoeff: 0.015,
    gradePercent: 0,
  },
};

export interface GearboxStore {
  project: GearboxProject;
  result: GearboxResult | null;
  activeGearPreset: string;

  updateEngine: (patch: Partial<GearboxProject['engine']>) => void;
  updateGearbox: (patch: Partial<GearboxProject['gearbox']>) => void;
  updateGear: (index: number, ratio: number) => void;
  setNumGears: (n: number) => void;
  updateVehicle: (patch: Partial<GearboxProject['vehicle']>) => void;
  loadPreset: (preset: 'fsae_cbr600' | 'baja_bs' | 'formula_zytek' | 'custom') => void;
  recalculate: () => void;
}

function calculate(project: GearboxProject): GearboxResult {
  return computeGearbox(project);
}

const PRESETS: Record<string, GearboxProject> = {
  fsae_cbr600: defaultProject,

  baja_bs: {
    engine: {
      name: 'Briggs & Stratton 10HP (Baja)',
      idleRPM: 1800,
      redlineRPM: 3600,
      peakTorque: 19.4,
      peakTorqueRPM: 2400,
      peakPower: 7.5,
      peakPowerRPM: 3200,
      torqueAtIdle: 8,
      torqueAtRedline: 12,
    },
    gearbox: {
      numGears: 1,
      gears: [{ ratio: 1.0 }],
      finalDrive: 8.0,
      efficiency: 0.88,
      shiftTime: 0,
    },
    vehicle: {
      mass: 230,
      tireRadius: 290,
      frontalArea: 1.8,
      cdAero: 0.7,
      rollResistCoeff: 0.04,
      gradePercent: 0,
    },
  },

  formula_zytek: {
    engine: {
      name: 'Zytek/Renault 2.0L (Formula)',
      idleRPM: 3000,
      redlineRPM: 8000,
      peakTorque: 185,
      peakTorqueRPM: 5500,
      peakPower: 145,
      peakPowerRPM: 7500,
      torqueAtIdle: 60,
      torqueAtRedline: 100,
    },
    gearbox: {
      numGears: 6,
      gears: [
        { ratio: 3.077 },
        { ratio: 2.118 },
        { ratio: 1.600 },
        { ratio: 1.286 },
        { ratio: 1.083 },
        { ratio: 0.923 },
      ],
      finalDrive: 4.200,
      efficiency: 0.93,
      shiftTime: 0.05,
    },
    vehicle: {
      mass: 620,
      tireRadius: 295,
      frontalArea: 1.3,
      cdAero: 1.4,
      rollResistCoeff: 0.012,
      gradePercent: 0,
    },
  },
};

export const useGearboxStore = create<GearboxStore>()(
  immer((set, get) => ({
    project: defaultProject,
    result: calculate(defaultProject),
    activeGearPreset: 'fsae_cbr600',

    updateEngine: (patch) =>
      set((state) => {
        Object.assign(state.project.engine, patch);
        state.result = calculate(state.project);
      }),

    updateGearbox: (patch) =>
      set((state) => {
        Object.assign(state.project.gearbox, patch);
        state.result = calculate(state.project);
      }),

    updateGear: (index, ratio) =>
      set((state) => {
        if (index < state.project.gearbox.gears.length) {
          state.project.gearbox.gears[index].ratio = ratio;
        }
        state.result = calculate(state.project);
      }),

    setNumGears: (n) =>
      set((state) => {
        const current = state.project.gearbox.gears;
        // Pad with extrapolated ratios or trim
        while (current.length < n) {
          const last = current[current.length - 1]?.ratio ?? 1;
          const secondLast = current[current.length - 2]?.ratio ?? last * 1.25;
          const step = last / secondLast;
          current.push({ ratio: Math.max(0.5, last * step) });
        }
        state.project.gearbox.gears = current.slice(0, n);
        state.project.gearbox.numGears = n;
        state.result = calculate(state.project);
      }),

    updateVehicle: (patch) =>
      set((state) => {
        Object.assign(state.project.vehicle, patch);
        state.result = calculate(state.project);
      }),

    loadPreset: (preset) =>
      set((state) => {
        const p = PRESETS[preset];
        if (p) {
          state.project = JSON.parse(JSON.stringify(p));
          state.activeGearPreset = preset;
          state.result = calculate(state.project);
        }
      }),

    recalculate: () =>
      set((state) => {
        state.result = calculate(state.project);
      }),
  }))
);
