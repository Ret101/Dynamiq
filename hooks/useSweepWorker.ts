'use client';

/**
 * Hook: runs the kinematic sweep in a Web Worker.
 * Falls back to inline computation if workers aren't available.
 * Uses debouncing to avoid excessive re-computation on fast edits.
 */

import { useRef, useCallback } from 'react';
import type { SuspensionCorner } from '@/types/suspension';
import type { SimulationSettings } from '@/types/project';
import type { KinematicSweep } from '@/types/kinematics';
import { sweepCorner } from '@/engine/kinematics/sweepSolver';

export function useSweepWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<AbortController | null>(null);

  const runSweep = useCallback((
    corner: SuspensionCorner,
    settings: SimulationSettings,
    onResult: (sweep: KinematicSweep) => void,
    onError: (msg: string) => void
  ): () => void => {
    // Cancel any previous in-flight computation
    pendingRef.current?.abort();
    const abort = new AbortController();
    pendingRef.current = abort;

    // Try Web Worker first
    if (typeof Worker !== 'undefined') {
      try {
        workerRef.current?.terminate();
        const worker = new Worker(new URL('../workers/sweepWorker.ts', import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (e) => {
          if (abort.signal.aborted) return;
          if (e.data.type === 'result') {
            onResult(e.data.sweep as KinematicSweep);
          } else if (e.data.type === 'error') {
            onError(e.data.message);
          }
          worker.terminate();
        };

        worker.onerror = (err) => {
          if (abort.signal.aborted) return;
          // Worker failed — fall through to inline
          inlineSweep(corner, settings, onResult, onError, abort);
        };

        worker.postMessage({ type: 'sweep', corner, settings });
      } catch {
        // Worker construction failed — run inline
        inlineSweep(corner, settings, onResult, onError, abort);
      }
    } else {
      // No worker support — run inline with setTimeout to yield UI
      inlineSweep(corner, settings, onResult, onError, abort);
    }

    return () => { abort.abort(); workerRef.current?.terminate(); };
  }, []);

  return { runSweep };
}

function inlineSweep(
  corner: SuspensionCorner,
  settings: SimulationSettings,
  onResult: (s: KinematicSweep) => void,
  onError: (msg: string) => void,
  abort: AbortController
) {
  // Run inline but yield to the browser before starting
  setTimeout(() => {
    if (abort.signal.aborted) return;
    try {
      const sweep = sweepCorner(corner, settings);
      if (!abort.signal.aborted) onResult(sweep);
    } catch (err) {
      if (!abort.signal.aborted) onError(err instanceof Error ? err.message : String(err));
    }
  }, 0);
}
