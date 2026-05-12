'use client';

import { useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { MultiLineChart } from './TireModelPanel';
import { SteeringGeometrySolver } from '@/engine/kinematics/steeringGeometry';
import { Tip } from '@/components/ui/Tooltip';
import type { BellcrankSpec } from '@/types/suspension';
import { cn } from '@/lib/utils';

export function SteeringPanel() {
  const { vehicle, setVehicle } = useProjectStore();
  const { frontSweep } = useProjectStore();
  const steering = vehicle.steering;

  const solver = useMemo(
    () => new SteeringGeometrySolver(steering, steering.wheelbase, steering.trackFront),
    [steering]
  );

  // ── Ackermann curves ─────────────────────────────────────────────────────────
  const ackermannCurves = useMemo(() => {
    const wb  = steering.wheelbase;
    const tf  = steering.trackFront;
    const pct = steering.ackermann / 100;
    const innerArr:  [number, number][] = [];
    const outerArr:  [number, number][] = [];
    const actualArr: [number, number][] = [];

    for (let rack = -steering.rackTravel / 2; rack <= steering.rackTravel / 2; rack += steering.rackTravel / 20) {
      const avgAngle = (rack / steering.rackTravel) * 30;
      if (Math.abs(avgAngle) < 0.1) {
        innerArr.push([avgAngle, 0]);
        outerArr.push([avgAngle, 0]);
        actualArr.push([avgAngle, 0]);
        continue;
      }
      const R = wb / Math.tan(Math.abs(avgAngle) * Math.PI / 180);
      const innerIdeal = Math.atan(wb / (R - tf / 2)) * 180 / Math.PI;
      const outerIdeal = Math.atan(wb / (R + tf / 2)) * 180 / Math.PI;
      const diff = innerIdeal - outerIdeal;
      const sign = avgAngle > 0 ? 1 : -1;
      innerArr.push([avgAngle, sign * innerIdeal]);
      outerArr.push([avgAngle, sign * outerIdeal]);
      actualArr.push([avgAngle, sign * (outerIdeal + pct * diff)]);
    }
    return { inner: innerArr, outer: outerArr, actual: actualArr };
  }, [steering]);

  // ── Wheel steer angle vs SW angle (linear vs bellcrank) ───────────────────
  const wheelAngleCurve = useMemo<[number, number][]>(() => {
    const pts = solver.generateWheelAngleCurve(60);
    return pts.map(p => [p.swAngle, p.wheelAngle]);
  }, [solver]);

  const linearWheelCurve = useMemo<[number, number][]>(() => {
    // Reference: linear rack wheel angle
    const max = solver.maxSteeringWheelAngle();
    const wb = steering.wheelbase;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const sw = ((i / 60) * 2 - 1) * max;
      const rack = Math.max(-steering.rackTravel / 2,
        Math.min(steering.rackTravel / 2, sw / steering.steeringRatio));
      const angle = Math.atan2(rack, wb) * 180 / Math.PI;
      pts.push([sw, sw >= 0 ? angle : -angle]);
    }
    return pts;
  }, [solver, steering]);

  // ── Ratio curve (only with bellcrank) ────────────────────────────────────
  const ratioCurve = useMemo<[number, number][] | null>(() => {
    const pts = solver.generateRatioCurve(60);
    if (!pts) return null;
    return pts.map(p => [p.swAngle, p.ratio]);
  }, [solver]);

  // ── Bump steer ─────────────────────────────────────────────────────────────
  const bumpSteerCurve = useMemo<[number, number][]>(() => {
    if (!frontSweep) return [];
    return frontSweep.bumpSteerCurve.map(p => [p.travel, p.toe]);
  }, [frontSweep]);

  // ── Turn radii ─────────────────────────────────────────────────────────────
  const turnRadii = useMemo(() => {
    return [10, 15, 20, 25, 30].map(deg => {
      const R = deg > 0 ? steering.wheelbase / Math.tan(deg * Math.PI / 180) : Infinity;
      return { deg, R: R / 1000 };
    });
  }, [steering]);

  // ── Bellcrank update helpers ───────────────────────────────────────────────
  const defaultBellcrank: BellcrankSpec = {
    enabled: false,
    inputArmLength: 65,
    outputArmLength: 75,
    armAngle: 90,
    preloadAngle: 0,
  };

  const bc = steering.bellcrank ?? defaultBellcrank;

  const updateBellcrank = useCallback((patch: Partial<BellcrankSpec>) => {
    setVehicle({
      ...vehicle,
      steering: {
        ...vehicle.steering,
        bellcrank: { ...(vehicle.steering.bellcrank ?? defaultBellcrank), ...patch },
      },
    });
  }, [vehicle, setVehicle]);

  const toggleBellcrank = useCallback(() => {
    updateBellcrank({ enabled: !bc.enabled });
  }, [bc.enabled, updateBellcrank]);

  // ── Max SW angle for display ────────────────────────────────────────────────
  const maxSW = useMemo(() => solver.maxSteeringWheelAngle(), [solver]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-foreground">Steering Geometry</span>
      </div>

      <div className="px-3 py-3 flex flex-col gap-4">

        {/* ── Ackermann ──────────────────────────────────────────────────────── */}
        <div>
          <div className="text-xs font-medium text-foreground mb-2">
            Ackermann — Inner / Outer Wheel Angle
          </div>
          <MultiLineChart
            datasets={[
              { points: ackermannCurves.inner,  color: '#60a5fa', label: 'Inner (ideal)' },
              { points: ackermannCurves.outer,  color: '#f472b6', label: 'Outer (ideal)' },
              { points: ackermannCurves.actual, color: '#00d4ff', label: 'Actual' },
            ]}
            width={256} height={130}
            xLabel="Avg wheel angle (°)" yLabel="Wheel angle (°)"
          />
          <div className="flex gap-3 mt-1 text-2xs">
            <LegendDot color="#60a5fa" label="Inner ideal" />
            <LegendDot color="#f472b6" label="Outer ideal" />
            <LegendDot color="#00d4ff" label="Actual" />
          </div>
        </div>

        {/* Ackermann metric */}
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-1 text-2xs text-muted-foreground mb-1">
            Ackermann %
            <Tip
              title="Ackermann Percentage"
              body="100% Ackermann means inner wheel turns more than outer to trace concentric arcs — eliminates tire scrub in low-speed corners. 0% (parallel) keeps both wheels at the same angle. High-speed cars often use less Ackermann since lateral slip matters more than scrub."
              formula="δ_inner = arctan(WB / (R − T/2)), δ_outer = arctan(WB / (R + T/2))"
              range="FSAE: 60–90%; Baja: 50–75%; Road car: 75–100%"
            />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-mono text-brand">{steering.ackermann.toFixed(0)}%</span>
            <span className="text-2xs text-muted-foreground pb-0.5">
              {steering.ackermann < 50 ? 'Parallel-biased' : steering.ackermann > 80 ? 'Near-ideal' : 'Mixed'}
            </span>
          </div>
          <div className="mt-1 text-2xs text-muted-foreground">
            100% = pure Ackermann · 0% = parallel steer
          </div>
        </div>

        {/* ── Bellcrank section ──────────────────────────────────────────────── */}
        <div className="rounded border border-border bg-surface-1">
          {/* Header row with toggle */}
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
            onClick={toggleBellcrank}
          >
            <span className="text-xs font-medium text-foreground">Bellcrank Steering</span>
            <div className={cn(
              'w-8 h-4 rounded-full relative transition-colors',
              bc.enabled ? 'bg-brand' : 'bg-surface-3'
            )}>
              <span className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow',
                bc.enabled ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
          </div>

          {bc.enabled && (
            <div className="px-3 pb-3 flex flex-col gap-3 border-t border-border">
              <div className="text-2xs text-muted-foreground pt-2">
                Non-linear bellcrank converts column rotation to tie-rod displacement
                through a pivot arm. Creates a progressive (slower center, faster lock)
                or digressive ratio depending on geometry.
              </div>

              {/* Parameters grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <BellcrankInput
                  label="Input arm"
                  value={bc.inputArmLength}
                  unit="mm"
                  min={20} max={200}
                  onChange={v => updateBellcrank({ inputArmLength: v })}
                />
                <BellcrankInput
                  label="Output arm"
                  value={bc.outputArmLength}
                  unit="mm"
                  min={20} max={200}
                  onChange={v => updateBellcrank({ outputArmLength: v })}
                />
                <BellcrankInput
                  label="Arm angle"
                  value={bc.armAngle}
                  unit="°"
                  min={45} max={135}
                  onChange={v => updateBellcrank({ armAngle: v })}
                />
                <BellcrankInput
                  label="Preload angle"
                  value={bc.preloadAngle}
                  unit="°"
                  min={-45} max={45}
                  onChange={v => updateBellcrank({ preloadAngle: v })}
                />
              </div>

              {/* Effective ratio curve */}
              {ratioCurve && (
                <div>
                  <div className="text-2xs font-medium text-foreground mb-1">
                    Effective Ratio vs Steer Angle
                  </div>
                  <MultiLineChart
                    datasets={[{ points: ratioCurve, color: '#fb923c', label: 'Ratio' }]}
                    width={230} height={100}
                    xLabel="SW angle (°)" yLabel="deg/mm"
                  />
                  <div className="text-2xs text-muted-foreground mt-1">
                    Lower = faster steering response at that angle
                  </div>
                </div>
              )}

              {/* Linear vs bellcrank wheel angle comparison */}
              <div>
                <div className="text-2xs font-medium text-foreground mb-1">
                  Wheel Angle vs Steering Wheel Angle
                </div>
                <MultiLineChart
                  datasets={[
                    { points: linearWheelCurve, color: '#64748b', label: 'Linear' },
                    { points: wheelAngleCurve,  color: '#00d4ff', label: 'Bellcrank' },
                  ]}
                  width={230} height={100}
                  xLabel="SW angle (°)" yLabel="Wheel (°)"
                />
                <div className="flex gap-3 mt-1 text-2xs">
                  <LegendDot color="#64748b" label="Linear" />
                  <LegendDot color="#00d4ff" label="Bellcrank" />
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-y-1 text-2xs">
                <Spec label="Max SW angle" val={`±${maxSW.toFixed(0)}°`} />
                <Spec label="Ratio at center" val={`${solver.effectiveRatioAt(0).toFixed(1)} °/mm`} />
                <Spec label="Ratio at ±30°" val={`${solver.effectiveRatioAt(maxSW * 0.5).toFixed(1)} °/mm`} />
                <Spec label="Ratio at lock"  val={`${solver.effectiveRatioAt(maxSW * 0.9).toFixed(1)} °/mm`} />
              </div>
            </div>
          )}
        </div>

        {/* ── Bump steer ─────────────────────────────────────────────────────── */}
        {bumpSteerCurve.length > 0 ? (
          <div>
            <div className="text-xs font-medium text-foreground mb-2">Bump Steer (FL corner)</div>
            <MultiLineChart
              datasets={[{ points: bumpSteerCurve, color: '#a78bfa', label: 'Toe' }]}
              width={256} height={110}
              xLabel="Wheel travel (mm)" yLabel="Toe (°)"
            />
            <div className="text-2xs text-muted-foreground mt-1">
              Run simulation to update bump steer curve.
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed border-border p-3 text-2xs text-muted-foreground text-center">
            Run kinematic sweep to see bump steer curve
          </div>
        )}

        {/* ── Turn radii ─────────────────────────────────────────────────────── */}
        <div>
          <div className="text-xs font-medium text-foreground mb-2">Turn Radius</div>
          <div className="grid grid-cols-2 gap-y-1 text-2xs">
            {turnRadii.map(({ deg, R }) => (
              <div key={deg} className="flex justify-between">
                <span className="text-muted-foreground">{deg}° avg</span>
                <span className="font-mono text-foreground">{R.toFixed(1)} m</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Steering system specs ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-y-1 text-2xs pt-2 border-t border-border">
          <Spec label="Rack travel"   val={`±${(steering.rackTravel / 2).toFixed(0)} mm`}
            tip="Total rack stroke ÷ 2. Larger = more steer angle available but may increase steering effort. FSAE: ±25–40mm, Baja: ±30–50mm." />
          <Spec label="Ratio"         val={`${steering.steeringRatio.toFixed(1)}:1`}
            tip="Degrees of steering wheel rotation per degree of wheel angle. Higher = more effort, less sensitive. Lower = quick but twitchy. FSAE: 3–5:1, Baja: 4–6:1." />
          <Spec label="Wheelbase"     val={`${steering.wheelbase} mm`}
            tip="Distance between front and rear axle centerlines. Longer = more stable, larger turn radius. From the vehicle spec." />
          <Spec label="Track (front)" val={`${steering.trackFront} mm`}
            tip="Lateral distance between left and right front contact patches. Wider = more stability and cornering grip." />
        </div>
      </div>
    </div>
  );
}

// ── Small reusable components ───────────────────────────────────────────────

const BELLCRANK_TIPS: Record<string, string> = {
  'Input arm':    'Length from the bellcrank pivot to the steering column input rod. Controls how much the bellcrank rotates per unit of column rotation.',
  'Output arm':   'Length from the bellcrank pivot to the tie-rod end. Longer output arm = more tie-rod displacement per degree of bellcrank rotation. Ratio of output/input gives mechanical advantage.',
  'Arm angle':    'Angle between the input and output arms. 90° = right-angle bellcrank (most common). Affects the shape of the ratio curve through the steering range.',
  'Preload angle':'Initial angle of the input arm from the neutral position. Positive = biased toward one direction. Shifts where the non-linearity peak occurs in the steering range.',
};

function BellcrankInput({
  label, value, unit, min, max, onChange,
}: {
  label: string; value: number; unit: string;
  min: number; max: number;
  onChange: (v: number) => void;
}) {
  const tip = BELLCRANK_TIPS[label];
  return (
    <div>
      <div className="flex items-center gap-1 text-2xs text-muted-foreground mb-0.5">
        {label}
        {tip && <Tip body={tip} title={label} />}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={unit === 'mm' ? 5 : 1}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-16 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-2xs font-mono text-foreground focus:outline-none focus:border-brand"
        />
        <span className="text-2xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Spec({ label, val, tip }: { label: string; val: string; tip?: string }) {
  return (
    <>
      <span className="text-muted-foreground flex items-center gap-0.5">
        {label}
        {tip && <Tip body={tip} title={label} />}
      </span>
      <span className="font-mono text-foreground">{val}</span>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
