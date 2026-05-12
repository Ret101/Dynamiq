'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { SuspensionOptimizer } from '@/engine/optimization/suspensionOptimizer';
import type { OptimizationConfig, OptimizationObjective, OptimizationResult } from '@/types/optimization';
import type { VehicleSpec } from '@/types/suspension';
import { cn } from '@/lib/utils';

// ─── Design target types ──────────────────────────────────────────────────────

interface DesignTargets {
  rideHeight: number;        // mm — target ride height
  rollCenterHeight: number;  // mm — target RC height at design position
  camberGainPer100: number;  // ° per 100mm travel (positive = gain in jounce)
  motionRatio: number;       // target spring motion ratio (0–1)
  maxBumpSteer: number;      // max acceptable bump steer °/mm
  maxRCMigration: number;    // max RC height change over ±50mm travel (mm)
  maxScrubRadius: number;    // mm
}

function defaultTargets(vehicle: VehicleSpec): DesignTargets {
  const isBaja = vehicle.series === 'Baja';
  return {
    rideHeight:        vehicle.frontSuspension.rideHeight,
    rollCenterHeight:  isBaja ? 35 : 22,
    camberGainPer100:  isBaja ? 6.0 : 4.5,
    motionRatio:       isBaja ? 0.72 : 0.80,
    maxBumpSteer:      0.06,
    maxRCMigration:    isBaja ? 18 : 12,
    maxScrubRadius:    isBaja ? 35 : 22,
  };
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const SIM_SETTINGS = {
  travelSteps: 21, travelMin: -50, travelMax: 50,
  steerSteps: 11, steerMin: -30, steerMax: 30,
  useNonlinearSolver: true, convergenceTol: 1e-6, maxIterations: 100,
};

export function OptimizationPanel() {
  const { vehicle, addOptimizationResult, optimizationRuns } = useProjectStore();

  // ── Wizard step ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'targets' | 'run'>('targets');

  // ── Design targets ─────────────────────────────────────────────────────────
  const [targets, setTargets] = useState<DesignTargets>(() => defaultTargets(vehicle));
  const setTarget = <K extends keyof DesignTargets>(key: K, val: DesignTargets[K]) =>
    setTargets(t => ({ ...t, [key]: val }));

  // ── Algorithm settings ─────────────────────────────────────────────────────
  const [popSize, setPopSize]         = useState(30);
  const [generations, setGenerations] = useState(35);

  // ── Run state ──────────────────────────────────────────────────────────────
  const [running, setRunning]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog]           = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ── Build config from targets ──────────────────────────────────────────────
  const config = useMemo((): OptimizationConfig => {
    const hp = vehicle.frontSuspension.hardpoints;
    const R  = 15; // ±mm range

    const variables = [
      { hardpointId: hp.ucaUpright.id,    axis: 'y' as const,
        min: hp.ucaUpright.position.y - R, max: hp.ucaUpright.position.y + R,
        step: 1, description: 'UCA ball joint Y' },
      { hardpointId: hp.ucaUpright.id,    axis: 'z' as const,
        min: hp.ucaUpright.position.z - R, max: hp.ucaUpright.position.z + R,
        step: 1, description: 'UCA ball joint Z' },
      { hardpointId: hp.lcaUpright.id,    axis: 'y' as const,
        min: hp.lcaUpright.position.y - R, max: hp.lcaUpright.position.y + R,
        step: 1, description: 'LCA ball joint Y' },
      { hardpointId: hp.lcaUpright.id,    axis: 'z' as const,
        min: hp.lcaUpright.position.z - R, max: hp.lcaUpright.position.z + R,
        step: 1, description: 'LCA ball joint Z' },
      { hardpointId: hp.tieRodChassis.id, axis: 'z' as const,
        min: hp.tieRodChassis.position.z - 22, max: hp.tieRodChassis.position.z + 22,
        step: 1, description: 'Tie rod chassis Z' },
      { hardpointId: hp.tieRodChassis.id, axis: 'y' as const,
        min: hp.tieRodChassis.position.y - R, max: hp.tieRodChassis.position.y + R,
        step: 1, description: 'Tie rod chassis Y' },
      { hardpointId: hp.shockChassis.id,  axis: 'y' as const,
        min: hp.shockChassis.position.y - R, max: hp.shockChassis.position.y + R,
        step: 1, description: 'Shock chassis Y' },
    ];

    const objectives = [
      { objective: 'target_rc_height'    as OptimizationObjective, weight: 2.0, target: targets.rollCenterHeight },
      { objective: 'target_camber_gain'  as OptimizationObjective, weight: 1.5, target: targets.camberGainPer100 / 100 },
      { objective: 'minimize_bump_steer' as OptimizationObjective, weight: 2.0, target: targets.maxBumpSteer },
      { objective: 'target_motion_ratio' as OptimizationObjective, weight: 1.5, target: targets.motionRatio },
      { objective: 'minimize_rc_migration' as OptimizationObjective, weight: 1.0, target: targets.maxRCMigration },
      { objective: 'minimize_scrub_radius' as OptimizationObjective, weight: 0.8, target: targets.maxScrubRadius },
    ];

    const constraints = [
      { type: 'motion_ratio_range' as const, value: targets.motionRatio, tolerance: 0.15, weight: 10 },
    ];

    return {
      name: `Run-${Date.now()}`,
      algorithm: 'genetic_algorithm',
      objectives,
      variables,
      constraints,
      maxGenerations: generations,
      populationSize: popSize,
      mutationRate: 0.12,
      crossoverRate: 0.88,
      learningRate: 0.001,
      convergenceTol: 1e-4,
      maxEvaluations: generations * popSize,
    };
  }, [targets, popSize, generations, vehicle]);

  // ── Run handler ────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (running) {
      abortRef.current?.abort();
      setRunning(false);
      return;
    }

    setRunning(true);
    setProgress(0);
    setLog(['Starting optimisation with design targets…']);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const optimizer = new SuspensionOptimizer(vehicle, SIM_SETTINGS);
      const result = await optimizer.run(config, (gen, best) => {
        if (abort.signal.aborted) throw new Error('Aborted');
        setProgress(Math.round((gen / config.maxGenerations) * 100));
        if (gen % 5 === 0 || gen === config.maxGenerations) {
          setLog(prev => [
            ...prev.slice(-14),
            `Gen ${gen}/${config.maxGenerations} — fitness: ${best.toFixed(5)}`,
          ]);
        }
      });

      addOptimizationResult(result);
      setProgress(100);
      setLog(prev => [...prev, `✓ Done. Best fitness: ${result.best?.fitness?.toFixed(5) ?? '—'}`]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'Aborted') setLog(prev => [...prev, `Error: ${msg}`]);
    } finally {
      setRunning(false);
    }
  }, [running, config, vehicle, addOptimizationResult]);

  const lastResult = optimizationRuns[0];

  // ── Summary card of current targets vs result ──────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs">
      <div className="px-3 py-2 border-b border-border bg-surface-1 shrink-0 flex items-center justify-between">
        <span className="font-medium text-foreground">Suspension Optimizer</span>
        <div className="flex gap-1">
          <StepTab label="Targets" active={step === 'targets'} onClick={() => setStep('targets')} />
          <StepTab label="Run"     active={step === 'run'}     onClick={() => setStep('run')}     />
        </div>
      </div>

      {step === 'targets' && (
        <TargetsStep targets={targets} setTarget={setTarget} vehicle={vehicle} onNext={() => setStep('run')} />
      )}

      {step === 'run' && (
        <RunStep
          targets={targets}
          config={config}
          popSize={popSize} setPopSize={setPopSize}
          generations={generations} setGenerations={setGenerations}
          running={running} progress={progress} log={log}
          lastResult={lastResult}
          optimizationRuns={optimizationRuns}
          onRun={handleRun}
          onBack={() => setStep('targets')}
        />
      )}
    </div>
  );
}

// ─── Step: Design Targets ─────────────────────────────────────────────────────

function TargetsStep({
  targets, setTarget, vehicle, onNext,
}: {
  targets: DesignTargets;
  setTarget: <K extends keyof DesignTargets>(k: K, v: DesignTargets[K]) => void;
  vehicle: VehicleSpec;
  onNext: () => void;
}) {
  const isBaja = vehicle.series === 'Baja';

  return (
    <div className="px-3 py-3 flex flex-col gap-4">
      <div className="text-2xs text-muted-foreground leading-relaxed">
        Define your suspension design goals. The optimizer will automatically
        weight objectives and select hardpoints to move in order to hit these targets.
      </div>

      {/* ── Ride & balance ──────────────────────────────────────── */}
      <Section label="Ride & Balance">
        <TargetRow
          label="Ride height target"
          hint="Distance from ground to belly at rest"
          value={targets.rideHeight}
          unit="mm"
          min={isBaja ? 200 : 25}
          max={isBaja ? 450 : 120}
          onChange={v => setTarget('rideHeight', v)}
        />
        <TargetRow
          label="Roll center height"
          hint="RC height above ground at static position (positive = above ground)"
          value={targets.rollCenterHeight}
          unit="mm"
          min={-30}
          max={100}
          onChange={v => setTarget('rollCenterHeight', v)}
        />
        <TargetRow
          label="Max RC migration"
          hint="Max roll center height change over full bump/droop travel"
          value={targets.maxRCMigration}
          unit="mm"
          min={2}
          max={60}
          onChange={v => setTarget('maxRCMigration', v)}
        />
      </Section>

      {/* ── Kinematics ──────────────────────────────────────────── */}
      <Section label="Kinematics">
        <TargetRow
          label="Camber gain"
          hint="Camber change per 100mm jounce travel — keeps tyre contact in cornering"
          value={targets.camberGainPer100}
          unit="°/100mm"
          min={1}
          max={15}
          step={0.5}
          onChange={v => setTarget('camberGainPer100', v)}
        />
        <TargetRow
          label="Motion ratio"
          hint="Spring travel / wheel travel — affects wheel rate and ride frequency"
          value={targets.motionRatio}
          unit=""
          min={0.40}
          max={1.00}
          step={0.01}
          onChange={v => setTarget('motionRatio', v)}
        />
        <TargetRow
          label="Max bump steer"
          hint="Max toe change per mm of wheel travel — zero is ideal"
          value={targets.maxBumpSteer}
          unit="°/mm"
          min={0.01}
          max={0.30}
          step={0.01}
          onChange={v => setTarget('maxBumpSteer', v)}
        />
        <TargetRow
          label="Max scrub radius"
          hint="Lateral distance from kingpin ground intercept to contact patch"
          value={targets.maxScrubRadius}
          unit="mm"
          min={5}
          max={80}
          onChange={v => setTarget('maxScrubRadius', v)}
        />
      </Section>

      {/* Series context note */}
      <div className="rounded border border-brand/20 bg-brand/5 p-2.5 text-2xs text-muted-foreground">
        <span className="text-brand font-medium">{vehicle.series}</span>
        {' '}targets pre-loaded.
        {isBaja
          ? ' Baja: higher RC, more travel tolerance, lower MR for soft ride.'
          : ' FSAE: low RC, stiff springs, high MR for responsive handling.'}
      </div>

      <button
        onClick={onNext}
        className="w-full py-2 rounded text-xs font-medium bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition-colors"
      >
        Configure &amp; Run →
      </button>
    </div>
  );
}

// ─── Step: Run ────────────────────────────────────────────────────────────────

function RunStep({
  targets, config,
  popSize, setPopSize,
  generations, setGenerations,
  running, progress, log, lastResult, optimizationRuns,
  onRun, onBack,
}: {
  targets: DesignTargets;
  config: OptimizationConfig;
  popSize: number; setPopSize: (v: number) => void;
  generations: number; setGenerations: (v: number) => void;
  running: boolean; progress: number; log: string[];
  lastResult: OptimizationResult | undefined;
  optimizationRuns: OptimizationResult[];
  onRun: () => void;
  onBack: () => void;
}) {
  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* Target summary ─────────────────────────────────────────── */}
      <div className="rounded border border-border bg-surface-2 p-2.5">
        <div className="text-2xs text-muted-foreground mb-1.5 uppercase tracking-wide">Active targets</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs">
          <TargetSummaryRow label="RC height"     val={`${targets.rollCenterHeight} mm`} />
          <TargetSummaryRow label="Max RC mig."   val={`${targets.maxRCMigration} mm`} />
          <TargetSummaryRow label="Camber gain"   val={`${targets.camberGainPer100}°/100mm`} />
          <TargetSummaryRow label="Motion ratio"  val={targets.motionRatio.toFixed(2)} />
          <TargetSummaryRow label="Max bump steer" val={`${targets.maxBumpSteer}°/mm`} />
          <TargetSummaryRow label="Max scrub"     val={`${targets.maxScrubRadius} mm`} />
        </div>
      </div>

      {/* Variables summary ──────────────────────────────────────── */}
      <div className="text-2xs text-muted-foreground bg-surface-2 rounded p-2 leading-relaxed">
        Optimises {config.variables.length} variables: UCA/LCA outboard Y+Z, tie rod chassis Y+Z,
        shock chassis Y — each ±15–22 mm from design.
      </div>

      {/* Algorithm params ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <label className="text-2xs text-muted-foreground block mb-0.5">Population</label>
          <input type="number" value={popSize} min={10} max={200} step={10}
            onChange={e => setPopSize(+e.target.value)}
            className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono" />
        </div>
        <div>
          <label className="text-2xs text-muted-foreground block mb-0.5">Generations</label>
          <input type="number" value={generations} min={5} max={200} step={5}
            onChange={e => setGenerations(+e.target.value)}
            className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono" />
        </div>
      </div>
      <div className="text-2xs text-muted-foreground">
        ~{(popSize * generations).toLocaleString()} evaluations · GA + Adam gradient polish
      </div>

      {/* Run / Stop ─────────────────────────────────────────────── */}
      <button
        onClick={onRun}
        className={cn(
          'w-full py-2 rounded text-xs font-medium transition-colors',
          running
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30'
        )}
      >
        {running ? '⏹ Stop' : '▶ Run Optimisation'}
      </button>

      {/* Progress ───────────────────────────────────────────────── */}
      {(running || progress > 0) && (
        <div>
          <div className="flex justify-between text-2xs text-muted-foreground mb-1">
            <span>{running ? 'Optimising…' : 'Complete'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded overflow-hidden">
            <div className="h-full bg-brand rounded transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Console log ─────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="bg-surface-2 rounded p-2 font-mono text-2xs text-muted-foreground max-h-32 overflow-y-auto">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Last result ─────────────────────────────────────────────── */}
      {lastResult && (
        <div className="rounded border border-border p-2.5">
          <div className="text-2xs text-muted-foreground mb-1">Last Result</div>
          <div className="font-mono text-brand">Fitness: {lastResult.best?.fitness?.toFixed(5) ?? '—'}</div>
          <div className="text-2xs text-muted-foreground mt-0.5">
            {new Date(lastResult.completedAt).toLocaleTimeString()}
            {' · '}{lastResult.generations} gen{' · '}{lastResult.evaluations} evals
            {' · '}{lastResult.converged ? 'converged' : 'max gen'}
          </div>
        </div>
      )}

      {/* History ─────────────────────────────────────────────────── */}
      {optimizationRuns.length > 1 && (
        <div>
          <div className="text-2xs text-muted-foreground mb-1 uppercase tracking-wide">History</div>
          {optimizationRuns.slice(0, 5).map((r: OptimizationResult, i: number) => (
            <div key={i} className="flex justify-between text-2xs py-0.5 border-b border-border last:border-0">
              <span className="text-muted-foreground">Run #{optimizationRuns.length - i}</span>
              <span className="font-mono text-foreground">{r.best?.fitness?.toFixed(5) ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="text-2xs text-muted-foreground hover:text-foreground transition-colors text-left"
      >
        ← Edit targets
      </button>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function TargetRow({
  label, hint, value, unit, min, max, step = 1, onChange,
}: {
  label: string; hint: string;
  value: number; unit: string;
  min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 items-start">
      <div>
        <div className="text-2xs text-foreground">{label}</div>
        <div className="text-2xs text-muted-foreground leading-tight mt-0.5">{hint}</div>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-16 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-2xs font-mono text-foreground focus:outline-none focus:border-brand text-right"
        />
        {unit && <span className="text-2xs text-muted-foreground w-12">{unit}</span>}
      </div>
    </div>
  );
}

function TargetSummaryRow({ label, val }: { label: string; val: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{val}</span>
    </>
  );
}

function StepTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded text-2xs font-medium transition-colors',
        active ? 'bg-brand/20 text-brand' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
