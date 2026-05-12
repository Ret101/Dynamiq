'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { PacejkaTireModel } from '@/engine/tire/pacejka';
import { cn } from '@/lib/utils';

const LOADS = [500, 1000, 1500, 2000]; // N
const LOAD_COLORS = ['#60a5fa', '#00d4ff', '#34d399', '#fb923c'];

type Axis = 'lateral' | 'longitudinal';

export function TireModelPanel() {
  const { vehicle } = useProjectStore();
  const [axle, setAxle] = useState<'front' | 'rear'>('front');
  const [axis, setAxis] = useState<Axis>('lateral');

  const tireSpec = axle === 'front' ? vehicle.frontTire : vehicle.rearTire;
  const model = useMemo(() => new PacejkaTireModel(
    tireSpec.pacejka, tireSpec.peakLateralMu, tireSpec.peakLongMu, tireSpec.designLoad
  ), [tireSpec]);

  // Generate curves for each load level
  const curves = useMemo(() => {
    return LOADS.map((fz) => {
      if (axis === 'lateral') {
        const pts = model.lateralCurve(fz, 15, 31);
        return pts.map(p => [p.slipAngle, p.Fy / 1000] as [number, number]);
      } else {
        const pts = model.longitudinalCurve(fz, 0.3, 31);
        return pts.map(p => [p.slipRatio * 100, p.Fx / 1000] as [number, number]);
      }
    });
  }, [model, axis]);

  const xLabel = axis === 'lateral' ? 'Slip angle (°)' : 'Slip ratio (%)';
  const yLabel = 'Force (kN)';
  const title  = axis === 'lateral' ? 'Lateral Force Fy' : 'Longitudinal Force Fx';

  const peak = useMemo(() => {
    const pjk = tireSpec.pacejka;
    if (axis === 'lateral')      return (pjk.D_y * LOADS[2]).toFixed(0) + ' N';
    return (pjk.D_x * LOADS[2]).toFixed(0) + ' N';
  }, [tireSpec, axis]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-surface-1">
        <ToggleGroup
          options={[{ v: 'front', l: 'Front' }, { v: 'rear', l: 'Rear' }]}
          value={axle} onChange={v => setAxle(v as 'front' | 'rear')}
        />
        <div className="w-px h-4 bg-border" />
        <ToggleGroup
          options={[{ v: 'lateral', l: 'Fy' }, { v: 'longitudinal', l: 'Fx' }]}
          value={axis} onChange={v => setAxis(v as Axis)}
        />
        <div className="flex-1" />
        <span className="text-2xs text-muted-foreground font-mono">Peak @1500N: {peak}</span>
      </div>

      {/* Chart */}
      <div className="px-3 pt-3 shrink-0">
        <div className="text-xs font-medium text-foreground mb-2">{title} — Pacejka Magic Formula</div>
        <MultiLineChart
          datasets={curves.map((pts, i) => ({ points: pts, color: LOAD_COLORS[i], label: `${LOADS[i]}N` }))}
          width={256}
          height={140}
          xLabel={xLabel}
          yLabel={yLabel}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-2 shrink-0">
        {LOADS.map((fz, i) => (
          <div key={fz} className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: LOAD_COLORS[i] }} />
            <span className="text-2xs text-muted-foreground">Fz={fz}N</span>
          </div>
        ))}
      </div>

      {/* Pacejka coefficients */}
      <div className="px-3 pt-3 pb-3">
        <div className="text-2xs text-muted-foreground mb-2 uppercase tracking-wide">Pacejka Coefficients ({axle})</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {axis === 'lateral' ? (
            <>
              <CoeffRow label="By (stiffness)" val={tireSpec.pacejka.B_y} />
              <CoeffRow label="Cy (shape)" val={tireSpec.pacejka.C_y} />
              <CoeffRow label="Dy (peak)" val={tireSpec.pacejka.D_y} />
              <CoeffRow label="Ey (curvature)" val={tireSpec.pacejka.E_y} />
            </>
          ) : (
            <>
              <CoeffRow label="Bx (stiffness)" val={tireSpec.pacejka.B_x} />
              <CoeffRow label="Cx (shape)" val={tireSpec.pacejka.C_x} />
              <CoeffRow label="Dx (peak)" val={tireSpec.pacejka.D_x} />
              <CoeffRow label="Ex (curvature)" val={tireSpec.pacejka.E_x} />
            </>
          )}
        </div>
        <div className="mt-3 pt-2 border-t border-border grid grid-cols-2 gap-y-1">
          <CoeffRow label="Tire width" val={tireSpec.width} unit="mm" />
          <CoeffRow label="Unloaded R" val={tireSpec.unloadedRadius} unit="mm" />
          <CoeffRow label="Peak μ_y" val={tireSpec.peakLateralMu} />
          <CoeffRow label="Peak μ_x" val={tireSpec.peakLongMu} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared chart primitives ──────────────────────────────────────────────────

interface Dataset { points: [number, number][]; color: string; label: string; }

function MultiLineChart({ datasets, width, height, xLabel, yLabel }: {
  datasets: Dataset[]; width: number; height: number; xLabel: string; yLabel: string;
}) {
  const pad = { top: 8, right: 8, bottom: 22, left: 36 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  const allX = datasets.flatMap(d => d.points.map(p => p[0]));
  const allY = datasets.flatMap(d => d.points.map(p => p[1]));
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(0, ...allY), yMax = Math.max(...allY);

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin || 1)) * W;
  const sy = (y: number) => pad.top + H - ((y - yMin) / (yMax - yMin || 1)) * H;

  const zero_y = sy(0);

  return (
    <svg width={width} height={height} className="rounded bg-surface-2 w-full" style={{ maxWidth: width }}>
      {/* Zero line */}
      <line x1={pad.left} y1={zero_y} x2={pad.left + W} y2={zero_y}
        stroke="#334155" strokeWidth={0.5} />
      {/* Y axis */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + H}
        stroke="#334155" strokeWidth={0.5} />

      {/* Data lines */}
      {datasets.map((ds, i) => {
        const d = ds.points.map(([x, y], j) =>
          `${j === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
        ).join(' ');
        return <path key={i} d={d} fill="none" stroke={ds.color} strokeWidth={1.5} />;
      })}

      {/* Axis labels */}
      <text x={pad.left + W / 2} y={height - 2} textAnchor="middle"
        fontSize="8" fill="#64748b">{xLabel}</text>
      <text x={10} y={pad.top + H / 2} textAnchor="middle"
        fontSize="8" fill="#64748b"
        transform={`rotate(-90,10,${pad.top + H / 2})`}>{yLabel}</text>

      {/* Axis tick values */}
      <text x={pad.left - 2} y={pad.top + 4} textAnchor="end"
        fontSize="7" fill="#64748b">{yMax.toFixed(1)}</text>
      <text x={pad.left - 2} y={pad.top + H} textAnchor="end"
        fontSize="7" fill="#64748b">{yMin.toFixed(1)}</text>
      <text x={pad.left} y={height - 10} textAnchor="middle"
        fontSize="7" fill="#64748b">{xMin.toFixed(0)}</text>
      <text x={pad.left + W} y={height - 10} textAnchor="end"
        fontSize="7" fill="#64748b">{xMax.toFixed(0)}</text>
    </svg>
  );
}

export { MultiLineChart };

function CoeffRow({ label, val, unit }: { label: string; val: number; unit?: string }) {
  return (
    <div className="flex justify-between text-2xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{val.toFixed(3)}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function ToggleGroup<T extends string>({
  options, value, onChange,
}: { options: { v: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded border border-border overflow-hidden">
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'px-2 py-0.5 text-2xs transition-colors',
            value === o.v ? 'bg-brand/20 text-brand' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
