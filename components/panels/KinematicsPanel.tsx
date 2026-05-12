'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { sweepCornerAsync } from '@/engine/kinematics/sweepSolver';
import { VehicleKinematicSolver } from '@/engine/kinematics/vehicleKinematics';
import type { CornerKinematics } from '@/types/kinematics';
import { cn } from '@/lib/utils';
import { Tip } from '@/components/ui/Tooltip';

// ─── Semantic color ranges ────────────────────────────────────────────────────
// Returns a Tailwind class based on whether the value is in good/caution/danger zone

interface Range { good: [number, number]; caution: [number, number] }

function semanticClass(v: number | null | undefined, r: Range): string {
  if (v == null || isNaN(v)) return 'text-muted-foreground';
  if (v >= r.good[0] && v <= r.good[1])       return 'text-green-400';
  if (v >= r.caution[0] && v <= r.caution[1]) return 'text-yellow-400';
  return 'text-red-400';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KinematicsPanel() {
  const {
    vehicle, simulationSettings, frontSweep,
    currentKinematics, isSimulating, simulationError,
    setFrontSweep, setRearSweep, setCurrentKinematics, setSimulating,
  } = useProjectStore();

  const { heave, roll, pitch, steerAngle, setHeave } = useUIStore();
  const [corner, setCorner] = useState<'FL' | 'FR' | 'RL' | 'RR'>('FL');
  const [sweepProgress, setSweepProgress] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const previewStartRef = useRef<number>(0);

  // Baseline at zero inputs — recaptured whenever vehicle changes
  const baselineRef = useRef<import('@/types/kinematics').VehicleKinematics | null>(null);
  useEffect(() => {
    try {
      const s = new VehicleKinematicSolver(vehicle);
      baselineRef.current = s.solve(0, 0, 0, 0);
    } catch { }
  }, [vehicle]);

  const stopPreview = useCallback(() => {
    if (previewRafRef.current !== null) cancelAnimationFrame(previewRafRef.current);
    setIsPlayingPreview(false);
    setHeave(0);
  }, [setHeave]);

  const playPreview = useCallback(() => {
    if (isPlayingPreview) { stopPreview(); return; }
    setIsPlayingPreview(true);
    const { travelMin, travelMax } = simulationSettings;
    const halfPeriod = 1800; // ms for one direction
    previewStartRef.current = performance.now();
    let cycles = 0;
    function tick(now: number) {
      const elapsed = now - previewStartRef.current;
      const phase = elapsed % (halfPeriod * 2);
      const t = phase < halfPeriod ? phase / halfPeriod : 1 - (phase - halfPeriod) / halfPeriod;
      setHeave(travelMin + (travelMax - travelMin) * t);
      if (Math.floor(elapsed / (halfPeriod * 2)) > cycles) {
        cycles = Math.floor(elapsed / (halfPeriod * 2));
        if (cycles >= 3) { stopPreview(); return; }
      }
      previewRafRef.current = requestAnimationFrame(tick);
    }
    previewRafRef.current = requestAnimationFrame(tick);
  }, [isPlayingPreview, simulationSettings, setHeave, stopPreview]);

  // Cleanup preview on unmount
  useEffect(() => () => { if (previewRafRef.current !== null) cancelAnimationFrame(previewRafRef.current); }, []);

  const runSweep = useCallback(async () => {
    // Stop any in-progress sweep
    if (isSimulating) {
      abortRef.current?.abort();
      setSimulating(false);
      setHeave(0);
      return;
    }
    stopPreview();
    const abort = new AbortController();
    abortRef.current = abort;
    setSimulating(true, null);
    setSweepProgress(0);
    try {
      const front = await sweepCornerAsync(
        vehicle.frontSuspension, simulationSettings,
        pct => setSweepProgress(Math.round(pct / 2)),
        abort.signal,
        travel => setHeave(travel),
      );
      const rear = await sweepCornerAsync(
        vehicle.rearSuspension, simulationSettings,
        pct => setSweepProgress(50 + Math.round(pct / 2)),
        abort.signal,
        travel => setHeave(travel),
      );
      setFrontSweep(front);
      setRearSweep(rear);
      setSimulating(false);
      setSweepProgress(100);
      // Auto-play one preview cycle so the user sees the full motion
      playPreview();
    } catch (err) {
      setHeave(0);
      if ((err as Error).name !== 'AbortError') {
        setSimulating(false, err instanceof Error ? err.message : 'Unknown error');
      }
    }
  }, [vehicle, simulationSettings, isSimulating, setFrontSweep, setRearSweep, setSimulating, setHeave, stopPreview, playPreview]);

  const runPoint = useCallback(() => {
    try {
      const s = new VehicleKinematicSolver(vehicle);
      setCurrentKinematics(s.solve(heave, roll, pitch, steerAngle));
    } catch { }
  }, [vehicle, heave, roll, pitch, steerAngle, setCurrentKinematics]);

  // Debounced live solve — 40ms after last input change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runPoint, 40);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [runPoint]);

  const cornerKey = { FL: 'frontLeft', FR: 'frontRight', RL: 'rearLeft', RR: 'rearRight' } as const;
  const active   = currentKinematics?.[cornerKey[corner]];
  const baseline = baselineRef.current?.[cornerKey[corner]];

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Run bar */}
      <div className="flex flex-col gap-0 border-b border-border shrink-0">
        <div className="flex gap-1.5 px-2 py-2">
          <button
            onClick={runSweep}
            className={cn(
              'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
              isSimulating
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-brand/90 text-black hover:bg-brand'
            )}
          >
            {isSimulating ? `⏹ Stop (${sweepProgress}%)` : '▶ Run Sweep'}
          </button>
          {frontSweep && !isSimulating && (
            <button
              onClick={playPreview}
              title={isPlayingPreview ? 'Stop preview' : 'Animate suspension through travel range'}
              className={cn(
                'px-2 py-1.5 rounded text-xs transition-colors',
                isPlayingPreview
                  ? 'bg-brand/20 text-brand border border-brand/30'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground'
              )}
            >
              {isPlayingPreview ? '⏹' : '⟳'}
            </button>
          )}
          <button
            onClick={runPoint}
            className="px-2 py-1.5 rounded text-xs bg-surface-2 text-foreground hover:bg-surface-3 transition-colors"
            title="Recompute point solve"
          >
            ↺
          </button>
        </div>
        {isSimulating && (
          <div className="h-0.5 bg-surface-2 mx-2 mb-2 rounded overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-150 rounded"
              style={{ width: `${sweepProgress}%` }}
            />
          </div>
        )}
      </div>

      {simulationError && (
        <div className="mx-2 mt-1 p-1.5 bg-red-500/10 border border-red-500/30 rounded text-2xs text-red-400">
          {simulationError}
        </div>
      )}

      {/* Corner tabs — 2×2 grid so all 4 corners fit cleanly */}
      <div className="grid grid-cols-2 border-b border-border shrink-0">
        {(['FL', 'FR', 'RL', 'RR'] as const).map((c, i) => (
          <button key={c}
            onClick={() => setCorner(c)}
            className={cn(
              'py-1 text-xs font-mono border-b-2 transition-colors',
              i % 2 === 0 ? 'border-r border-border' : '',
              corner === c ? 'text-brand border-brand bg-brand/5' : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {/* State inputs summary */}
        <StateBar heave={heave} roll={roll} pitch={pitch} steer={steerAngle} />

        {/* Geometry group */}
        <Group label="Geometry" icon="◈">
          <KRow label="Camber"      v={active?.camber}         b={baseline?.camber}         u="°"    fmt={2}
            range={{ good: [-3, -0.5], caution: [-5, 0.5] }}
            ref_="RCVD §2.2 p.68 — static −0.5° to −3° for formula cars; FSAE target −1° to −2.5°" />
          <KRow label="Toe"         v={active?.toe}            b={baseline?.toe}            u="°"    fmt={3}
            range={{ good: [-0.2, 0.2], caution: [-0.5, 0.5] }}
            ref_="RCVD §2.3 p.70 — near-neutral; slight toe-in (0–0.1°) reduces high-speed sensitivity" />
          <KRow label="Caster"      v={active?.caster}         b={baseline?.caster}         u="°"    fmt={2}
            range={{ good: [3, 8], caution: [1, 12] }}
            ref_="RCVD §2.5 p.75 — 3°–8° typical formula; adds camber recovery in steering" />
          <KRow label="KPI"         v={active?.kingpin}        b={baseline?.kingpin}        u="°"    fmt={2}
            range={{ good: [8, 16], caution: [5, 20] }}
            ref_="RCVD §2.4 p.72 — keep low to minimise jacking; 8°–14° common for FSAE" />
          <KRow label="Camber gain" v={active?.camberGain}     b={baseline?.camberGain}     u="°/mm" fmt={4}
            range={{ good: [-0.15, -0.04], caution: [-0.35, 0.02] }}
            ref_="RCVD §16.4 p.590 — target −0.05 to −0.15°/mm (neg = gain in jounce); prevents wheel going positive in roll" />
          <KRow label="Toe gain"    v={active?.toeGain}        b={baseline?.toeGain}        u="°/mm" fmt={4}
            range={{ good: [-0.04, 0.04], caution: [-0.12, 0.12] }}
            ref_="Bump steer — FSAE judges prefer <0.05°/25mm travel; RCVD §16.5 p.597" />
        </Group>

        {/* Packaging group */}
        <Group label="Packaging" icon="⊞">
          <KRow label="Scrub radius"    v={active?.scrubRadius}    b={baseline?.scrubRadius}    u="mm"   fmt={1}
            range={{ good: [-30, 30], caution: [-60, 60] }}
            ref_="RCVD §2.6 p.78 — small positive preferred; large values hurt steering feel under braking" />
          <KRow label="Mech. trail"     v={active?.mechanicalTrail} b={baseline?.mechanicalTrail} u="mm" fmt={1}
            range={{ good: [10, 45], caution: [0, 75] }}
            ref_="RCVD §2.5 p.76 — pneumatic + mechanical trail drives self-centering; 15–40mm typical FSAE" />
          <KRow label="Track change"    v={active?.trackChange}    b={baseline?.trackChange}    u="mm"   fmt={2}
            range={{ good: [-3, 3], caution: [-8, 8] }}
            ref_="RCVD §16.3 — minimal track change in bump reduces scrub and tyre wear" />
          <KRow label="WB change"       v={active?.wheelbaseChange} b={baseline?.wheelbaseChange} u="mm" fmt={2}
            range={{ good: [-5, 5], caution: [-15, 15] }}
            ref_="Affects pitch/brake-bias consistency under heave; keep small" />
          <KRow label="RC height"       v={active?.rollCenterHeight} b={baseline?.rollCenterHeight} u="mm" fmt={1}
            range={{ good: [20, 70], caution: [0, 130] }}
            ref_="RCVD §18.2 p.620 — FSAE front 20–50mm, rear 40–90mm; higher RC → more geometric roll resistance but more jacking" />
        </Group>

        {/* Dynamics group */}
        <Group label="Dynamics" icon="⟲">
          <KRow label="Motion ratio"  v={active?.motionRatio}  b={baseline?.motionRatio}  u=""      fmt={3}
            range={{ good: [0.68, 0.95], caution: [0.50, 1.10] }}
            ref_="RCVD §16.7 p.598 — outboard pushrod/pullrod; 0.7–0.9 typical; high ratio → softer effective wheel rate" />
          <KRow label="Wheel rate"    v={active?.wheelRate}    b={baseline?.wheelRate}    u="N/mm"  fmt={2}
            range={{ good: [8, 35], caution: [3, 60] }}
            ref_="RCVD §16.7 — wheel rate = spring rate × motion ratio²; FSAE 15–30 N/mm common; Baja 10–25 N/mm" />
          <KRow label="Anti-dive"     v={active ? active.antiDive * 100 : undefined}    b={baseline ? baseline.antiDive * 100 : undefined}    u="%"     fmt={1}
            range={{ good: [15, 50], caution: [5, 75] }}
            ref_="RCVD §18.5 p.638 — 20–40% anti-dive balances brake feel vs pitch control; too high = harsh braking feel" />
          <KRow label="Anti-squat"    v={active ? active.antiSquat * 100 : undefined}   b={baseline ? baseline.antiSquat * 100 : undefined}   u="%"     fmt={1}
            range={{ good: [30, 65], caution: [10, 85] }}
            ref_="RCVD §18.5 p.640 — 40–60% common; reduces squat under acceleration; Baja higher due to off-road loads" />
          <KRow label="Jacking force" v={active?.jackingForce} b={baseline?.jackingForce} u=""     fmt={3}
            ref_="RCVD §18.2 — N per N lateral force; zero RC = zero jacking; positive = body lifted by cornering load" />
        </Group>

        {/* Vehicle (only when vehicle kinematics are available) */}
        {currentKinematics && (
          <Group label="Vehicle" icon="⊙">
            <KRow label="Ackermann %"  v={currentKinematics.ackermann} b={null} u="%" fmt={1}
              range={{ good: [50, 90], caution: [30, 110] }} />
            <KRow label="Turn radius"  v={currentKinematics.turningRadius ? currentKinematics.turningRadius / 1000 : undefined} b={null} u="m" fmt={2} />
          </Group>
        )}

        {/* Sweep summary */}
        {frontSweep && (
          <Group label="Sweep Summary" icon="↗">
            <KRow label="Peak bump steer"
              v={Math.max(...frontSweep.bumpSteerCurve.map(p => Math.abs(p.toe)))}
              b={null} u="°" fmt={3}
              range={{ good: [0, 0.05], caution: [0, 0.15] }} />
            <KRow label="Camber gain"
              v={frontSweep.camberCurve.length > 1
                ? Math.abs((frontSweep.camberCurve.at(-1)!.camber - frontSweep.camberCurve[0].camber)
                  / (frontSweep.travelRange[1] - frontSweep.travelRange[0]))
                : undefined}
              b={null} u="°/mm" fmt={4}
              range={{ good: [0, 0.15], caution: [0, 0.3] }} />
            <KRow label="RC migration"
              v={(() => {
                const rc = frontSweep.rollCenterMigration.map(p => p.rcHeight);
                return Math.max(...rc) - Math.min(...rc);
              })()}
              b={null} u="mm" fmt={1}
              range={{ good: [0, 20], caution: [0, 50] }} />
            <KRow label="Avg motion ratio"
              v={frontSweep.motionRatioCurve.reduce((s, p) => s + p.motionRatio, 0) / (frontSweep.motionRatioCurve.length || 1)}
              b={null} u="" fmt={3}
              range={{ good: [0.65, 0.95], caution: [0.5, 1.1] }} />
          </Group>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border shrink-0">
        <LegendDot color="text-green-400" label="Good" />
        <LegendDot color="text-yellow-400" label="Caution" />
        <LegendDot color="text-red-400" label="Out of range" />
        <span className="ml-auto text-2xs text-muted-foreground">Δ on hover</span>
      </div>
    </div>
  );
}

// ─── State bar ────────────────────────────────────────────────────────────────

function StateBar({ heave, roll, pitch, steer }: { heave: number; roll: number; pitch: number; steer: number }) {
  const any = heave !== 0 || roll !== 0 || pitch !== 0 || steer !== 0;
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 text-2xs font-mono border-b border-border',
      any ? 'bg-brand/5' : 'bg-transparent'
    )}>
      <StateVal label="H" value={heave} unit="mm" />
      <StateVal label="R" value={roll}  unit="°" />
      <StateVal label="P" value={pitch} unit="°" />
      <StateVal label="δ" value={steer} unit="°" />
      {any && <span className="ml-auto text-brand/60 text-2xs">live</span>}
    </div>
  );
}
function StateVal({ label, value, unit }: { label: string; value: number; unit: string }) {
  const active = value !== 0;
  return (
    <span className={active ? 'text-brand' : 'text-muted-foreground/50'}>
      {label}:{value.toFixed(1)}{unit}
    </span>
  );
}

// ─── Group heading ────────────────────────────────────────────────────────────

function Group({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 transition-colors"
      >
        <span className="text-brand text-2xs">{icon}</span>
        <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="ml-auto text-2xs text-muted-foreground">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

// ─── Kinematic row ────────────────────────────────────────────────────────────

interface KRowProps {
  label: string;
  v: number | undefined | null;
  b: number | undefined | null;
  u: string;
  fmt: number;
  range?: Range;
  ref_?: string;   // RCVD / rulebook citation shown on label hover
}

function KRow({ label, v, b, u, fmt, range, ref_ }: KRowProps) {
  const display = v == null || isNaN(v) ? '—' : v.toFixed(fmt);
  const delta = b != null && v != null && !isNaN(v) && !isNaN(b) ? v - b : null;
  const colorClass = range ? semanticClass(v, range) : (v != null && !isNaN(v) ? 'text-foreground' : 'text-muted-foreground');

  const deltaStr = delta != null
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(fmt)}`
    : null;

  const rangeStr = range ? `Good: ${range.good[0]} to ${range.good[1]} ${u}` : undefined;

  return (
    <div className="flex items-center justify-between px-3 py-0.5 hover:bg-surface-2 group transition-colors rounded-sm mx-1">
      <span className="flex items-center gap-0.5 text-xs w-24 shrink-0 text-muted-foreground">
        <span className="truncate">{label}</span>
        {ref_ && <Tip title={label} body={ref_} range={rangeStr} />}
      </span>
      <div className="flex items-baseline gap-1.5">
        {deltaStr && (
          <span className={cn(
            'text-2xs font-mono opacity-0 group-hover:opacity-100 transition-opacity tabular-nums',
            delta === 0 ? 'text-muted-foreground' : Math.abs(delta ?? 0) > 0.001 ? 'text-[#94a3b8]' : 'text-muted-foreground'
          )}>
            {deltaStr}
          </span>
        )}
        <span className={cn('text-xs font-mono tabular-nums', colorClass)}>
          {display}
        </span>
        {u && <span className="text-2xs text-muted-foreground">{u}</span>}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('text-2xs', color)}>●</span>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </span>
  );
}
