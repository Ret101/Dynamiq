/**
 * Sweep solver: runs the corner kinematic solver across a travel and steer range,
 * producing full engineering curves for plotting.
 *
 * sweepCornerAsync yields to the UI thread every CHUNK rows so the page stays
 * responsive during long sweeps.
 */

import type { SuspensionCorner } from '@/types/suspension';
import type { KinematicSweep, CornerKinematics } from '@/types/kinematics';
import type { SimulationSettings } from '@/types/project';
import { CornerKinematicSolver } from './cornerSolver';

const CHUNK = 4;        // rows before yielding (no animation)
const CHUNK_ANIM = 1;   // every row when 3D viewer is following

export async function sweepCornerAsync(
  corner: SuspensionCorner,
  settings: SimulationSettings,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
  onFrame?: (travel: number) => void,
): Promise<KinematicSweep> {
  const solver = new CornerKinematicSolver(corner);
  const { travelMin, travelMax, travelSteps, steerMin, steerMax, steerSteps } = settings;
  const travelArr = linspace(travelMin, travelMax, travelSteps);
  const steerArr  = linspace(steerMin,  steerMax,  steerSteps);

  const results: CornerKinematics[][] = [];

  for (let i = 0; i < travelArr.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    results.push(steerArr.map(steer => solver.solve(travelArr[i], steer)));

    const chunk = onFrame ? CHUNK_ANIM : CHUNK;
    if (i % chunk === 0) {
      onProgress?.(Math.round((i / travelArr.length) * 100));
      onFrame?.(travelArr[i]);
      // When animating the 3D view, wait for one paint frame so React renders before continuing.
      await new Promise<void>(r =>
        onFrame ? requestAnimationFrame(() => r()) : setTimeout(r, 0)
      );
    }
  }

  onProgress?.(100);
  return buildSweep(corner, settings, travelArr, steerArr, results);
}

// Synchronous version (kept for compatibility / Web Worker use)
export function sweepCorner(
  corner: SuspensionCorner,
  settings: SimulationSettings,
): KinematicSweep {
  const solver = new CornerKinematicSolver(corner);
  const { travelMin, travelMax, travelSteps, steerMin, steerMax, steerSteps } = settings;
  const travelArr = linspace(travelMin, travelMax, travelSteps);
  const steerArr  = linspace(steerMin,  steerMax,  steerSteps);
  const results: CornerKinematics[][] = travelArr.map(travel =>
    steerArr.map(steer => solver.solve(travel, steer))
  );
  return buildSweep(corner, settings, travelArr, steerArr, results);
}

function buildSweep(
  corner: SuspensionCorner,
  settings: SimulationSettings,
  travelArr: number[],
  steerArr: number[],
  results: CornerKinematics[][],
): KinematicSweep {
  const zeroSteerIdx = Math.floor(steerArr.length / 2);

  const bumpSteerCurve = travelArr.map((travel, i) => ({
    travel,
    toe: results[i][zeroSteerIdx].toe,
  }));

  const camberCurve = travelArr.map((travel, i) => ({
    travel,
    camber: results[i][zeroSteerIdx].camber,
  }));

  const rollCenterMigration = travelArr.map((travel, i) => ({
    travel,
    rcHeight: results[i][zeroSteerIdx].rollCenterHeight,
    rcLateral: results[i][zeroSteerIdx].rollCenter.y,
  }));

  const motionRatioCurve = travelArr.map((travel, i) => ({
    travel,
    motionRatio: results[i][zeroSteerIdx].motionRatio,
  }));

  const wheelRateCurve = travelArr.map((travel, i) => ({
    travel,
    wheelRate: results[i][zeroSteerIdx].wheelRate,
  }));

  return {
    corner: corner.position,
    travelRange: [settings.travelMin, settings.travelMax],
    steerRange:  [settings.steerMin,  settings.steerMax],
    steps: settings.travelSteps,
    results,
    bumpSteerCurve,
    camberCurve,
    rollCenterMigration,
    motionRatioCurve,
    wheelRateCurve,
  };
}

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const arr: number[] = [];
  const step = (end - start) / (n - 1);
  for (let i = 0; i < n; i++) arr.push(start + i * step);
  return arr;
}
