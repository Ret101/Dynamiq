'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { MultiLineChart } from './TireModelPanel';
import { Tip } from '@/components/ui/Tooltip';

export function LoadTransferPanel() {
  const { vehicle, currentKinematics } = useProjectStore();
  const { steerAngle } = useUIStore();

  const {
    mass, sprungMass, frontWeightDist, cgHeight, wheelbase, frontTrack, rearTrack,
    frontSuspension: fS, rearSuspension: rS,
  } = vehicle;

  // Lateral load transfer breakdown (per g of lateral acceleration)
  const lateralLT = useMemo(() => {
    const g = 9.81;
    const W  = mass * g;
    const Ws = sprungMass * g;

    // Sprung CG height above roll axis (approximate)
    const h_sprung = cgHeight; // mm
    const h_roll_f = 0; // approximation: roll axis at ground
    const h_roll_r = 0;
    const h_roll   = h_roll_f + (h_roll_r - h_roll_f) * frontWeightDist;
    const h_cg_above_roll = h_sprung - h_roll;

    // Roll stiffness from springs + ARB (N·mm/deg → N·mm/rad)
    const k_phi_f_spring = (fS.spring.rate * (frontTrack / 2) * (frontTrack / 2)) / 2; // N·mm/rad approx
    const k_phi_r_spring = (rS.spring.rate * (rearTrack  / 2) * (rearTrack  / 2)) / 2;
    const k_phi_f_arb    = fS.arb ? fS.arb.stiffness * 1000 : 0; // N·mm/rad
    const k_phi_r_arb    = rS.arb ? rS.arb.stiffness * 1000 : 0;
    const k_phi_f_total  = k_phi_f_spring + k_phi_f_arb;
    const k_phi_r_total  = k_phi_r_spring + k_phi_r_arb;
    const k_phi_total    = k_phi_f_total + k_phi_r_total;

    // Per unit lateral acceleration (ay = 1 g)
    const ay = 1.0;

    // Geometric load transfer (from IC height / track)
    // Approximated from front-view IC at design ride height
    const RC_height = 50; // mm — would come from solver in reality
    const LT_geom_f = (W * ay / 1000) * (RC_height / frontTrack); // kN
    const LT_geom_r = (W * ay / 1000) * (RC_height / rearTrack);

    // Elastic load transfer (spring + ARB)
    const phi = (Ws * ay * h_cg_above_roll) / (k_phi_total || 1); // rad
    const LT_elastic_f = k_phi_f_total * phi / (frontTrack * 1000); // kN
    const LT_elastic_r = k_phi_r_total * phi / (rearTrack  * 1000);

    // Unsprung load transfer
    const m_unsprung = mass - sprungMass;
    const h_unsprung = 100; // mm approximate
    const LT_unsprung_f = (m_unsprung * g * ay * h_unsprung) / (frontTrack * 2 * 1000);
    const LT_unsprung_r = (m_unsprung * g * ay * h_unsprung) / (rearTrack  * 2 * 1000);

    const total_f = LT_geom_f + LT_elastic_f + LT_unsprung_f;
    const total_r = LT_geom_r + LT_elastic_r + LT_unsprung_r;

    return {
      front: { geom: LT_geom_f, elastic: LT_elastic_f, unsprung: LT_unsprung_f, total: total_f },
      rear:  { geom: LT_geom_r, elastic: LT_elastic_r, unsprung: LT_unsprung_r, total: total_r },
      phi_deg: phi * 180 / Math.PI,
    };
  }, [vehicle, frontTrack, rearTrack, mass, sprungMass, cgHeight, frontWeightDist, fS, rS]);

  // Longitudinal weight transfer (braking/acceleration)
  const longLT = useMemo(() => {
    const g    = 9.81;
    const W    = mass * g / 1000; // kN
    const h    = cgHeight / 1000; // m
    const L    = wheelbase / 1000; // m

    // Per g deceleration
    const ax = 1.0;
    const ΔFz = W * ax * h / L;
    return { front: ΔFz, rear: -ΔFz }; // kN; front gains, rear loses
  }, [mass, cgHeight, wheelbase]);

  // LT vs Ay curve
  const ltCurve = useMemo(() => {
    const pts_f: [number, number][] = [];
    const pts_r: [number, number][] = [];
    for (let ay = 0; ay <= 2; ay += 0.1) {
      pts_f.push([ay, lateralLT.front.total * ay]);
      pts_r.push([ay, lateralLT.rear.total  * ay]);
    }
    return { f: pts_f, r: pts_r };
  }, [lateralLT]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-foreground">Load Transfer Analysis</span>
      </div>

      <div className="px-3 py-3 flex flex-col gap-4">
        {/* LT vs Ay curve */}
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-foreground mb-2">
            Lateral Load Transfer vs Ay
            <Tip title="Lateral Load Transfer" body="How much vertical load transfers from the inside wheel to the outside wheel during cornering. Higher LLT reduces total tire grip because tires are nonlinear — the overloaded outer tire can't compensate fully for the unloaded inner tire." formula="ΔFz = (Geometric + Elastic + Unsprung) × ay" range="FSAE: 0.2–0.5 kN/g per axle" />
          </div>
          <MultiLineChart
            datasets={[
              { points: ltCurve.f, color: '#60a5fa', label: 'Front' },
              { points: ltCurve.r, color: '#f472b6', label: 'Rear' },
            ]}
            width={256} height={120}
            xLabel="Lateral accel (g)" yLabel="ΔFz (kN)"
          />
          <div className="flex gap-3 mt-1 text-2xs">
            <LegendDot color="#60a5fa" label="Front axle" />
            <LegendDot color="#f472b6" label="Rear axle" />
          </div>
        </div>

        {/* Breakdown @ 1g */}
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-foreground mb-2">
            Breakdown @ 1g lateral
            <Tip title="LLT Components" body="Three independent mechanisms contribute to lateral load transfer. Geometric (from roll center height) acts instantly with no body roll. Elastic (from springs + ARB) depends on body roll and stiffness ratio. Unsprung (wheel/upright mass) is proportional to unsprung CG height." />
          </div>
          <div className="grid grid-cols-3 gap-1 text-2xs mb-2">
            <div className="text-muted-foreground">Component</div>
            <div className="text-muted-foreground text-right">Front</div>
            <div className="text-muted-foreground text-right">Rear</div>
            <LTRow label="Geometric" f={lateralLT.front.geom}    r={lateralLT.rear.geom} />
            <LTRow label="Elastic"   f={lateralLT.front.elastic} r={lateralLT.rear.elastic} />
            <LTRow label="Unsprung"  f={lateralLT.front.unsprung} r={lateralLT.rear.unsprung} />
            <div className="col-span-3 border-t border-border my-0.5" />
            <div className="font-medium text-foreground">Total</div>
            <div className="font-mono text-brand text-right">{lateralLT.front.total.toFixed(3)} kN</div>
            <div className="font-mono text-brand text-right">{lateralLT.rear.total.toFixed(3)} kN</div>
          </div>
          <div className="text-2xs text-muted-foreground">
            Roll angle: {lateralLT.phi_deg.toFixed(3)}°/g
          </div>
        </div>

        {/* Longitudinal */}
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-foreground mb-2">
            Longitudinal ΔFz @ 1g
            <Tip title="Longitudinal Load Transfer" body="Under braking/acceleration, weight shifts front-to-rear (braking) or rear-to-front (acceleration). This affects available traction per axle and brake bias requirements." formula="ΔFz = W × ax × h / L" range="Braking: front gains ~0.3–0.5 kN/g for typical FSAE" />
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-2xs">
            <Spec label="Front gain (braking)" val={`+${longLT.front.toFixed(3)} kN`} />
            <Spec label="Rear loss (braking)"  val={`${longLT.rear.toFixed(3)} kN`} />
          </div>
          <div className="text-2xs text-muted-foreground mt-1">
            ΔFz = W·ax·h / L — no aerodynamic contribution
          </div>
        </div>

        {/* Weight distribution */}
        <div className="pt-2 border-t border-border">
          <div className="text-xs font-medium text-foreground mb-2">Static Weight Distribution</div>
          <div className="grid grid-cols-2 gap-y-1 text-2xs">
            <Spec label="Front" val={`${(frontWeightDist * 100).toFixed(1)}%`} />
            <Spec label="Rear"  val={`${((1 - frontWeightDist) * 100).toFixed(1)}%`} />
            <Spec label="Total mass" val={`${mass} kg`} />
            <Spec label="CG height"  val={`${cgHeight} mm`} />
            <Spec label="Sprung mass" val={`${sprungMass} kg`} />
            <Spec label="Unsprung" val={`${mass - sprungMass} kg`} />
          </div>
        </div>
      </div>
    </div>
  );
}

const LT_ROW_TIPS: Record<string, string> = {
  Geometric: 'Comes directly from roll center height. ΔFz = W × ay × RC_height / track. Zero if roll center is at ground.',
  Elastic:   'Springs and ARBs resist body roll. Load transferred = roll stiffness × roll angle / track. Controlled by spring rates and ARB stiffness.',
  Unsprung:  'Wheel, upright, and hub mass centrifugally loaded by lateral acceleration. Small but not zero. Height ≈ 100mm above ground.',
};

function LTRow({ label, f, r }: { label: string; f: number; r: number }) {
  return (
    <>
      <span className="text-muted-foreground flex items-center gap-0.5">
        {label}
        {LT_ROW_TIPS[label] && <Tip title={label} body={LT_ROW_TIPS[label]} />}
      </span>
      <span className="font-mono text-foreground text-right">{f.toFixed(3)}</span>
      <span className="font-mono text-foreground text-right">{r.toFixed(3)}</span>
    </>
  );
}

function Spec({ label, val }: { label: string; val: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
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
