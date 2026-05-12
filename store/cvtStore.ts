/**
 * CVT Calculator store.
 * Holds the active CVT project, computed results, and sweep data.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CVTProject, CVTOperatingPoint, CVTSummary } from '@/types/cvt';
import { defaultBajaCVT, cloneCVTProject } from '@/engine/cvt/cvtDefaults';
import { sweepRPM, computeSummary } from '@/engine/cvt/cvtCalculator';

export interface CVTStore {
  project: CVTProject;
  points: CVTOperatingPoint[];
  summary: CVTSummary | null;

  // Actions — individual field setters to avoid full-object replacement
  setProject: (p: CVTProject) => void;
  loadPreset: (p: CVTProject) => void;

  // Nested setters
  setEngineName:        (v: string)  => void;
  setEngineDisplacement:(v: number)  => void;
  setEngineMaxPower:    (v: number)  => void;
  setEngineMaxPowerRPM: (v: number)  => void;
  setEngineMaxTorque:   (v: number)  => void;
  setEngineMaxTorqueRPM:(v: number)  => void;
  setEngineIdleRPM:     (v: number)  => void;
  setEngineMaxRPM:      (v: number)  => void;

  setClutchEngagementRPM:    (v: number) => void;
  setClutchFullEngageRPM:    (v: number) => void;
  setClutchShiftStartRPM:    (v: number) => void;
  setClutchShiftOutRPM:      (v: number) => void;
  setClutchMaxRatio:         (v: number) => void;
  setClutchMinRatio:         (v: number) => void;
  setClutchShiftExponent:    (v: number) => void;
  setClutchHelixAngle:       (v: number) => void;
  setClutchSpringPreload:    (v: number) => void;

  setGearboxRatio:       (v: number) => void;
  setGearboxEfficiency:  (v: number) => void;
  setChainRatio:         (v: number) => void;
  setChainEfficiency:    (v: number) => void;
  setBeltEfficiency:     (v: number) => void;

  setVehicleMass:        (v: number) => void;
  setTireRadius:         (v: number) => void;
  setRollingResistance:  (v: number) => void;
  setDragCoefficient:    (v: number) => void;
  setFrontalArea:        (v: number) => void;
  setGradePercent:       (v: number) => void;

  recalculate: () => void;
}

function doRecalculate(state: { project: CVTProject; points: CVTOperatingPoint[]; summary: CVTSummary | null }) {
  const { engine, clutch, drivetrain, vehicle } = state.project;
  state.points  = sweepRPM(engine, clutch, drivetrain, vehicle);
  state.summary = computeSummary(state.points, engine, clutch, drivetrain, vehicle);
}

const initial = cloneCVTProject(defaultBajaCVT);

export const useCVTStore = create<CVTStore>()(
  immer((set) => {
    const calc = () => set(doRecalculate);

    // Helper: set a field on project.engine, then recalculate
    const E = <K extends keyof CVTProject['engine']>(key: K) =>
      (v: CVTProject['engine'][K]) =>
        set((s) => { s.project.engine[key] = v; doRecalculate(s); });

    const C = <K extends keyof CVTProject['clutch']>(key: K) =>
      (v: CVTProject['clutch'][K]) =>
        set((s) => { s.project.clutch[key] = v; doRecalculate(s); });

    const D = <K extends keyof CVTProject['drivetrain']>(key: K) =>
      (v: CVTProject['drivetrain'][K]) =>
        set((s) => { s.project.drivetrain[key] = v; doRecalculate(s); });

    const V = <K extends keyof CVTProject['vehicle']>(key: K) =>
      (v: CVTProject['vehicle'][K]) =>
        set((s) => { s.project.vehicle[key] = v; doRecalculate(s); });

    // Compute initial results
    const initPoints  = sweepRPM(initial.engine, initial.clutch, initial.drivetrain, initial.vehicle);
    const initSummary = computeSummary(initPoints, initial.engine, initial.clutch, initial.drivetrain, initial.vehicle);

    return {
      project: initial,
      points:  initPoints,
      summary: initSummary,

      setProject: (p) => set((s) => { s.project = p; doRecalculate(s); }),

      loadPreset: (p) => set((s) => {
        s.project = cloneCVTProject(p);
        doRecalculate(s);
      }),

      setEngineName:         E('name'),
      setEngineDisplacement: E('displacement'),
      setEngineMaxPower:     E('maxPower'),
      setEngineMaxPowerRPM:  E('maxPowerRPM'),
      setEngineMaxTorque:    E('maxTorque'),
      setEngineMaxTorqueRPM: E('maxTorqueRPM'),
      setEngineIdleRPM:      E('idleRPM'),
      setEngineMaxRPM:       E('maxRPM'),

      setClutchEngagementRPM:  C('engagementRPM'),
      setClutchFullEngageRPM:  C('fullEngageRPM'),
      setClutchShiftStartRPM:  C('shiftStartRPM'),
      setClutchShiftOutRPM:    C('shiftOutRPM'),
      setClutchMaxRatio:       C('maxRatio'),
      setClutchMinRatio:       C('minRatio'),
      setClutchShiftExponent:  C('shiftCurveExponent'),
      setClutchHelixAngle:     C('helixAngle'),
      setClutchSpringPreload:  C('secondarySpringPreload'),

      setGearboxRatio:      D('gearboxRatio'),
      setGearboxEfficiency: D('gearboxEfficiency'),
      setChainRatio:        D('chainSprocketRatio'),
      setChainEfficiency:   D('chainEfficiency'),
      setBeltEfficiency:    D('beltEfficiency'),

      setVehicleMass:       V('totalMass'),
      setTireRadius:        V('tireRadius'),
      setRollingResistance: V('rollingResistanceCoeff'),
      setDragCoefficient:   V('dragCoefficient'),
      setFrontalArea:       V('frontalArea'),
      setGradePercent:      V('gradePercent'),

      recalculate: calc,
    };
  })
);
