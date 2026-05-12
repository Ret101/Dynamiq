/**
 * Web Worker: runs the full kinematic sweep off the main thread.
 * Input: { type: 'sweep', corner: SuspensionCorner, settings: SimulationSettings }
 * Output: { type: 'result', sweep: KinematicSweep } | { type: 'error', message: string }
 */

import { sweepCorner } from '@/engine/kinematics/sweepSolver';
import type { SuspensionCorner } from '@/types/suspension';
import type { SimulationSettings } from '@/types/project';

self.onmessage = (e: MessageEvent) => {
  const { type, corner, settings } = e.data as {
    type: string;
    corner: SuspensionCorner;
    settings: SimulationSettings;
  };

  if (type !== 'sweep') return;

  try {
    const sweep = sweepCorner(corner, settings);
    self.postMessage({ type: 'result', sweep });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
