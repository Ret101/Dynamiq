'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { MultiLineChart } from './TireModelPanel';
import { Tip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

export function SpringDamperPanel() {
  const { vehicle } = useProjectStore();
  const [axle, setAxle] = useState<'front' | 'rear'>('front');
  const [view, setView]  = useState<'spring' | 'damper' | 'freq'>('spring');

  const corner = axle === 'front' ? vehicle.frontSuspension : vehicle.rearSuspension;
  const { spring, damper } = corner;

  // Spring curve: Force vs deflection (mm)
  const springCurve = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (let d = -80; d <= 80; d += 4) {
      const F = spring.type === 'progressive' && spring.progressiveCoeff
        ? spring.rate * d + spring.progressiveCoeff * d * Math.abs(d)
        : spring.rate * d;
      pts.push([d, F / 1000]);
    }
    return pts;
  }, [spring]);

  // Damper curve: Force vs velocity (mm/s)
  const damperCurve = useMemo(() => {
    const bump: [number, number][] = [];
    const reb:  [number, number][] = [];
    for (let v = 0; v <= 300; v += 10) {
      const dg = damper.digressiveCoeff ?? 0;
      const Fc = v <= damper.crossoverVelocity
        ? damper.compressionLowSpeed * v
        : damper.compressionHighSpeed * v + (damper.compressionLowSpeed - damper.compressionHighSpeed) * damper.crossoverVelocity;
      const Fr = v <= damper.crossoverVelocity
        ? damper.reboundLowSpeed * v
        : damper.reboundHighSpeed * v + (damper.reboundLowSpeed - damper.reboundHighSpeed) * damper.crossoverVelocity;
      const FcDig = dg > 0 ? Fc / (1 + dg * v) : Fc;
      const FrDig = dg > 0 ? Fr / (1 + dg * v) : Fr;
      bump.push([v, FcDig / 1000]);
      reb.push([v, -FrDig / 1000]);
    }
    return { bump, reb };
  }, [damper]);

  // Ride frequency calculation
  const rideFreq = useMemo(() => {
    const cornerMass = vehicle.sprungMass * (axle === 'front' ? vehicle.frontWeightDist : 1 - vehicle.frontWeightDist) / 2;
    const mr = 0.9; // approximate motion ratio
    const kWheel = spring.rate * mr * mr; // N/mm
    const kN_per_m = kWheel * 1000; // N/m
    const f = (1 / (2 * Math.PI)) * Math.sqrt(kN_per_m / cornerMass);
    return { f, cornerMass, kWheel };
  }, [spring, vehicle, axle]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <ToggleGroup
          opts={[{ v: 'front', l: 'Front' }, { v: 'rear', l: 'Rear' }]}
          value={axle} onChange={v => setAxle(v as 'front' | 'rear')}
        />
        <div className="w-px h-4 bg-border" />
        <ToggleGroup
          opts={[{ v: 'spring', l: 'Spring' }, { v: 'damper', l: 'Damper' }, { v: 'freq', l: 'Freq' }]}
          value={view} onChange={v => setView(v as 'spring' | 'damper' | 'freq')}
        />
      </div>

      {view === 'spring' && (
        <div className="px-3 py-3 flex flex-col gap-3">
          <div className="text-xs font-medium text-foreground">Spring Force vs Deflection</div>
          <MultiLineChart
            datasets={[{ points: springCurve, color: '#facc15', label: 'Spring' }]}
            width={256} height={130}
            xLabel="Deflection (mm)" yLabel="Force (kN)"
          />
          <div className="grid grid-cols-2 gap-y-1 text-2xs">
            <Row label="Rate" val={`${spring.rate} N/mm`}
              tip={{ body: 'Spring rate is the force required to compress the spring by 1mm. Higher = stiffer suspension, more responsive but harsher ride.', formula: 'F = k × δ', range: 'FSAE: 10–20 N/mm; Baja: 8–14 N/mm' }} />
            <Row label="Free length" val={`${spring.freeLength} mm`}
              tip={{ body: 'Unloaded spring length. Determines installed preload when combined with installed length. Does not affect ride rate.', range: 'Typically 125–200mm' }} />
            <Row label="Preload" val={`${spring.preload} N`}
              tip={{ body: 'Pre-compressed spring force at design ride height. Adds static load but does not change dynamic rate. Used to set sag.', range: '0–500 N' }} />
            <Row label="Type" val={spring.type}
              tip={{ body: 'Linear springs have a constant rate. Progressive springs stiffen as they compress. Dual-rate springs use two rates separated by a tender spring.' }} />
            {spring.type === 'dual_rate' && spring.dualRateBreak != null && (
              <>
                <Row label="Dual-rate break" val={`${spring.dualRateBreak} mm`}
                  tip={{ body: 'Deflection at which the tender spring coil binds and the stiffer main spring takes over.' }} />
                <Row label="High rate" val={`${spring.dualRateHigh ?? '—'} N/mm`}
                  tip={{ body: 'Spring rate after the dual-rate break point — the stiffer of the two rates.' }} />
              </>
            )}
          </div>
        </div>
      )}

      {view === 'damper' && (
        <div className="px-3 py-3 flex flex-col gap-3">
          <div className="text-xs font-medium text-foreground">Damper Force vs Velocity</div>
          <MultiLineChart
            datasets={[
              { points: damperCurve.bump, color: '#60a5fa', label: 'Bump' },
              { points: damperCurve.reb,  color: '#f472b6', label: 'Rebound' },
            ]}
            width={256} height={130}
            xLabel="Velocity (mm/s)" yLabel="Force (kN)"
          />
          <div className="flex gap-3 text-2xs mb-1">
            <LegendDot color="#60a5fa" label="Bump" />
            <LegendDot color="#f472b6" label="Rebound" />
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-2xs">
            <Row label="Bump LS" val={`${damper.compressionLowSpeed} N/mm/s`}
              tip={{ body: 'Low-speed compression (bump) damping coefficient. Controls body motion at low shaft velocities — cornering, braking, acceleration weight transfer.', range: 'FSAE: 1.0–2.0; Baja: 1.5–2.5' }} />
            <Row label="Bump HS" val={`${damper.compressionHighSpeed} N/mm/s`}
              tip={{ body: 'High-speed compression coefficient. Controls wheel response over sharp bumps and curbs. Lower than LS to prevent wheel hop.', range: 'Typically 40–60% of LS value' }} />
            <Row label="Reb LS" val={`${damper.reboundLowSpeed} N/mm/s`}
              tip={{ body: 'Low-speed rebound (extension) damping. Controls how quickly the suspension returns after a bump. Typically 1.5–2× the bump value.', range: 'FSAE: 1.8–3.0; Baja: 2.5–3.5' }} />
            <Row label="Reb HS" val={`${damper.reboundHighSpeed} N/mm/s`}
              tip={{ body: 'High-speed rebound coefficient. Controls rapid extension after fast bumps. Prevents wheel from flying up and losing contact.', range: 'Typically 50–70% of LS rebound' }} />
            <Row label="Crossover" val={`${damper.crossoverVelocity} mm/s`}
              tip={{ body: 'Shaft velocity at which the damper transitions from low-speed to high-speed behavior. Below this = LS coefficients, above = HS.', range: '30–100 mm/s' }} />
            <Row label="Type" val={damper.type}
              tip={{ body: 'Damper force model. Linear = constant coefficient. Digressive = decreases at high speed (common with bleed valves). Progressive = increases steeply at high speed.' }} />
          </div>
        </div>
      )}

      {view === 'freq' && (
        <div className="px-3 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
            Ride Frequency Calculator
            <Tip body="Ride frequency is the natural frequency of the sprung mass on the suspension spring. Higher = sportier but harsher. Lower = more compliant. Target depends on application." formula="f = (1/2π) × √(k_wheel / m_corner)" range="FSAE: 1.5–2.5 Hz; Baja: 1.2–2.0 Hz" title="Ride Frequency" />
          </div>
          <div className="rounded border border-border bg-surface-2 p-3 text-center">
            <div className="text-3xl font-mono text-brand">{rideFreq.f.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Hz</div>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-2xs">
            <Row label="Corner mass" val={`${rideFreq.cornerMass.toFixed(1)} kg`}
              tip={{ body: 'Sprung mass per corner, calculated from total sprung mass × weight distribution ÷ 2.', formula: 'm_corner = m_sprung × dist / 2' }} />
            <Row label="Wheel rate" val={`${rideFreq.kWheel.toFixed(2)} N/mm`}
              tip={{ body: 'Effective spring rate at the wheel, after the motion ratio squared reduction.', formula: 'k_wheel = k_spring × MR²' }} />
            <Row label="Spring rate" val={`${spring.rate} N/mm`}
              tip={{ body: 'Raw spring rate at the spring body. Higher than wheel rate by 1/MR².', range: 'FSAE: 10–20 N/mm; Baja: 8–14 N/mm' }} />
            <Row label="Motion ratio" val="0.90 (est.)"
              tip={{ body: 'Ratio of wheel travel to spring travel. MR < 1 means the spring moves less than the wheel. Here estimated at 0.90 — use the actual computed value from the kinematics panel for accuracy.', formula: 'MR = dSpring / dWheel', range: '0.7–1.0 typical' }} />
          </div>
          <div className="text-2xs text-muted-foreground leading-relaxed bg-surface-2 rounded p-2">
            f = (1/2π) √(k_wheel / m_corner)<br />
            Target: FSAE 1.5–2.5 Hz · Baja 1.2–2.0 Hz
          </div>
        </div>
      )}
    </div>
  );
}

interface TipContent { body: string; formula?: string; range?: string; }

function Row({ label, val, tip }: { label: string; val: string; tip?: TipContent }) {
  return (
    <>
      <span className="text-muted-foreground flex items-center gap-0.5">
        {label}
        {tip && <Tip body={tip.body} formula={tip.formula} range={tip.range} title={label} />}
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

function ToggleGroup<T extends string>({
  opts, value, onChange,
}: { opts: { v: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded border border-border overflow-hidden">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cn(
            'px-2 py-0.5 text-2xs transition-colors',
            value === o.v ? 'bg-brand/20 text-brand' : 'text-muted-foreground hover:text-foreground'
          )}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
