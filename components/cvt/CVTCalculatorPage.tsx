'use client';

import { useMemo } from 'react';
import { useCVTStore } from '@/store/cvtStore';
import { CVT_PRESETS } from '@/engine/cvt/cvtDefaults';
import { engineTorque, enginePower } from '@/engine/cvt/cvtCalculator';
import { TipInput, SectionHead, Tip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import type { CVTProject } from '@/types/cvt';

// ─── Main page ────────────────────────────────────────────────────────────────

export function CVTCalculatorPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-0">
      <CVTToolbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: engine + vehicle */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <EngineSection />
          <VehicleSection />
        </div>
        {/* Center: CVT + drivetrain */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <ClutchSection />
          <DrivetrainSection />
        </div>
        {/* Right: results + charts */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ResultsSummary />
          <CVTCharts />
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function CVTToolbar() {
  const { loadPreset, project } = useCVTStore();
  return (
    <div className="shrink-0 h-10 border-b border-border bg-surface-1 flex items-center px-3 gap-3">
      <span className="text-xs font-semibold text-brand">CVT Calculator</span>
      <div className="w-px h-4 bg-border" />
      <span className="text-2xs text-muted-foreground">Preset:</span>
      <div className="flex gap-1">
        {CVT_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => loadPreset(p)}
            className={cn(
              'px-2 py-0.5 rounded text-2xs font-mono transition-colors',
              project.series === p.series && project.name === p.name
                ? 'bg-brand/20 text-brand border border-brand/40'
                : 'bg-surface-2 text-muted-foreground border border-border hover:text-foreground'
            )}
          >
            {p.series === 'Baja' ? 'Baja SAE' : p.series === 'GoKart' ? 'Go-Kart' : 'Custom'}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <span className="text-2xs text-muted-foreground font-mono">{project.name}</span>
    </div>
  );
}

// ─── Column sections ──────────────────────────────────────────────────────────

function EngineSection() {
  const s = useCVTStore();
  const { engine } = s.project;

  // Live torque and power curve data
  const { torqueCurve, powerCurve } = useMemo(() => {
    const torqueCurve: [number, number][] = [];
    const powerCurve:  [number, number][] = [];
    for (let rpm = engine.idleRPM; rpm <= engine.maxRPM; rpm += 100) {
      torqueCurve.push([rpm, engineTorque(rpm, engine)]);
      powerCurve.push([rpm, enginePower(rpm, engine)]);
    }
    return { torqueCurve, powerCurve };
  }, [engine]);

  return (
    <ColumnSection title="Engine">
      <TipInput
        label="Max Power" unit="hp"
        tip={{ body: 'Peak brake horsepower at the crankshaft. For Baja SAE, the rules limit this to 10 hp per the B&S Intek 305cc engine.', range: 'Baja: 10 hp, GX390: 13 hp, Rotax: 35 hp' }}
        value={engine.maxPower}
        onChange={s.setEngineMaxPower}
        min={1} max={200} step={0.5}
      />
      <TipInput
        label="Max Power RPM" unit="RPM"
        tip={{ body: 'RPM at which peak horsepower occurs. Governor-limited engines (Baja SAE) hit this at their governed speed.', range: '3600 RPM (governed engines)' }}
        value={engine.maxPowerRPM}
        onChange={s.setEngineMaxPowerRPM}
        min={1000} max={12000} step={100}
      />
      <TipInput
        label="Max Torque" unit="ft·lb"
        tip={{ body: 'Peak torque output at the crankshaft. Torque × ratio = pulling force. Off-road vehicles benefit from high low-speed torque.', formula: 'T (ft·lb) = P (hp) × 5252 / RPM', range: 'B&S 10hp: 18.4 ft·lb at 2200 RPM' }}
        value={engine.maxTorque}
        onChange={s.setEngineMaxTorque}
        min={1} max={500} step={0.5}
      />
      <TipInput
        label="Max Torque RPM" unit="RPM"
        tip={{ body: 'RPM at which peak torque occurs. Below this RPM, torque is rising. Above it, the engine is past its torque peak.', range: '2000–2500 RPM for small single-cylinders' }}
        value={engine.maxTorqueRPM}
        onChange={s.setEngineMaxTorqueRPM}
        min={800} max={8000} step={100}
      />
      <TipInput
        label="Idle RPM" unit="RPM"
        tip={{ body: 'Engine idle speed. Below engagement RPM, the CVT clutch is open and no torque is transmitted.', range: '1000–1400 RPM' }}
        value={engine.idleRPM}
        onChange={s.setEngineIdleRPM}
        min={500} max={3000} step={50}
      />
      <TipInput
        label="Max RPM" unit="RPM"
        tip={{ body: 'Governed or physical rev limit. The calculator clips results above this RPM. For Baja SAE the governor caps at 3600 RPM.', range: '3600 RPM (governed), 4000–7000 (ungoverned)' }}
        value={engine.maxRPM}
        onChange={s.setEngineMaxRPM}
        min={1000} max={15000} step={100}
      />
      {/* Mini torque/power chart */}
      <div className="mt-2">
        <div className="text-2xs text-muted-foreground mb-1">Torque / Power Curve</div>
        <MiniDualChart
          series1={torqueCurve}
          series2={powerCurve}
          label1="Torque (ft·lb)"
          label2="Power (hp)"
          color1="#facc15"
          color2="#e8622a"
          width={220} height={90}
        />
      </div>
    </ColumnSection>
  );
}

function ClutchSection() {
  const s = useCVTStore();
  const { clutch } = s.project;

  return (
    <ColumnSection title="CVT Clutch">
      <div className="text-2xs text-brand/70 mb-2">Primary (Drive) Clutch</div>
      <TipInput
        label="Engagement RPM" unit="RPM"
        tip={{ body: 'RPM at which the primary clutch flyweights begin to engage the belt, creeping the vehicle forward. Below this RPM the clutch is open.', range: 'Comet 780: 1600–2200 RPM' }}
        value={clutch.engagementRPM}
        onChange={s.setClutchEngagementRPM}
        min={500} max={4000} step={50}
      />
      <TipInput
        label="Full Engage RPM" unit="RPM"
        tip={{ body: 'RPM at which the primary clutch is fully clamped on the belt. The transition from engagement to full engagement is the "engagement zone" where clutch slip occurs.', range: '200–500 RPM above engagement RPM' }}
        value={clutch.fullEngageRPM}
        onChange={s.setClutchFullEngageRPM}
        min={800} max={5000} step={50}
      />
      <TipInput
        label="Shift Start RPM" unit="RPM"
        tip={{ body: 'RPM at which the primary sheave starts to open, pushing the belt outward and increasing the drive radius — beginning the upshift in ratio.', range: 'Usually same as or just above full engage RPM' }}
        value={clutch.shiftStartRPM}
        onChange={s.setClutchShiftStartRPM}
        min={800} max={6000} step={50}
      />
      <TipInput
        label="Shift-Out RPM" unit="RPM"
        tip={{ body: 'RPM at which the CVT reaches its minimum (overdrive) ratio. Above this RPM, the CVT belt ratio is fixed at the minimum value.', range: 'Typically near governed max RPM' }}
        value={clutch.shiftOutRPM}
        onChange={s.setClutchShiftOutRPM}
        min={1000} max={8000} step={50}
      />
      <TipInput
        label="Max Ratio (Low)" unit=":1"
        tip={{ body: 'CVT belt ratio at low speed / engagement. A larger ratio multiplies torque more but limits top speed. This is the "first gear equivalent."', formula: 'ratio = r_driven / r_drive (sheave radii)', range: 'Comet 780: 3.0–4.0:1' }}
        value={clutch.maxRatio}
        onChange={s.setClutchMaxRatio}
        min={0.5} max={8} step={0.05}
      />
      <TipInput
        label="Min Ratio (High)" unit=":1"
        tip={{ body: 'CVT belt ratio at full shift-out / top speed. Values below 1.0 are overdrive (belt spins driven sheave faster than drive sheave). Lower = higher top speed.', range: 'Comet 780: 0.75–1.0:1' }}
        value={clutch.minRatio}
        onChange={s.setClutchMinRatio}
        min={0.3} max={2.5} step={0.05}
      />
      <TipInput
        label="Shift Curve Exponent"
        tip={{ body: 'Controls the shape of the ratio-vs-RPM shift curve. 1.0 = linear. < 1.0 = aggressive early shift (drops quickly from max ratio at low RPM). > 1.0 = late lazy shift (stays in low ratio longer, then shifts quickly).', range: '0.7–1.5' }}
        value={clutch.shiftCurveExponent}
        onChange={s.setClutchShiftExponent}
        min={0.3} max={3} step={0.05}
      />

      <div className="text-2xs text-brand/70 mt-3 mb-2">Secondary (Driven) Clutch</div>
      <TipInput
        label="Helix Cam Angle" unit="°"
        tip={{ body: 'The angle of the secondary clutch cam ramps. Higher angle = more aggressive back-shift under load (keeps engine in power band on hills). Lower angle = smoother shifting.', range: '28°–45°; steeper for off-road' }}
        value={clutch.helixAngle}
        onChange={s.setClutchHelixAngle}
        min={10} max={60} step={1}
      />
      <TipInput
        label="Spring Preload" unit="N"
        tip={{ body: 'Force preloaded into the secondary clutch spring. Higher preload delays down-shifting, keeping ratio higher longer. Lower preload allows easier back-shift.', range: '30–60 N' }}
        value={clutch.secondarySpringPreload}
        onChange={s.setClutchSpringPreload}
        min={5} max={200} step={1}
      />

      {/* Ratio spread badge */}
      <div className="mt-3 bg-surface-2 rounded px-2 py-1.5 flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">Ratio Spread</span>
        <span className="text-xs font-mono text-brand">
          {(clutch.maxRatio / clutch.minRatio).toFixed(2)}:1
        </span>
        <Tip
          body="Ratio spread = max ratio ÷ min ratio. Larger spread = wider range between low and high gear. Baja and off-road vehicles benefit from large spread (>3:1) for both hill climbing and top speed."
          range="Baja: 3.5–5:1"
        />
      </div>
    </ColumnSection>
  );
}

function DrivetrainSection() {
  const s = useCVTStore();
  const { drivetrain } = s.project;

  return (
    <ColumnSection title="Drivetrain">
      <TipInput
        label="Gearbox Ratio" unit=":1"
        tip={{ body: 'Fixed gear reduction after the CVT secondary clutch. This multiplies both torque and ratio. Common: Polaris gearbox = 3.36:1, custom chain reduction = 3–6:1.', range: 'Baja: 3.0–5.0:1; Go-kart: 5.0–8.0:1' }}
        value={drivetrain.gearboxRatio}
        onChange={s.setGearboxRatio}
        min={1} max={20} step={0.1}
      />
      <TipInput
        label="Gearbox Efficiency" unit="%"
        tip={{ body: 'Mechanical efficiency of the gearbox (friction, windage losses). Multiply by 100 for percentage display. Spur gears are typically 95–98%.', range: '0.93–0.97' }}
        value={drivetrain.gearboxEfficiency}
        onChange={s.setGearboxEfficiency}
        min={0.5} max={1} step={0.01}
      />
      <TipInput
        label="Chain/Sprocket Ratio" unit=":1"
        tip={{ body: 'Driven sprocket teeth ÷ drive sprocket teeth. Provides final speed reduction to the axle. Example: 50T driven / 20T drive = 2.5:1.', formula: 'ratio = N_driven / N_drive', range: 'Baja: 2.0–3.5:1' }}
        value={drivetrain.chainSprocketRatio}
        onChange={s.setChainRatio}
        min={0.5} max={10} step={0.05}
      />
      <TipInput
        label="Chain Efficiency" unit="%"
        tip={{ body: 'Roller chain efficiency including lubrication and alignment. Well-maintained chains run 97–99%. Off-road exposure reduces this.', range: '0.96–0.99' }}
        value={drivetrain.chainEfficiency}
        onChange={s.setChainEfficiency}
        min={0.5} max={1} step={0.01}
      />
      <TipInput
        label="CVT Belt Efficiency" unit="%"
        tip={{ body: 'Belt CVT power transmission efficiency, accounting for belt flex losses, sheave friction, and slip. This is the dominant loss in the drivetrain.', range: 'Comet belt: 0.85–0.92; best case dry 0.88' }}
        value={drivetrain.beltEfficiency}
        onChange={s.setBeltEfficiency}
        min={0.5} max={1} step={0.01}
      />

      {/* Total ratio display */}
      <div className="mt-2 space-y-1">
        <TotalRatioBadge label="Total Ratio (Low)"
          value={s.project.clutch.maxRatio * drivetrain.gearboxRatio * drivetrain.chainSprocketRatio}
          tip="Overall drivetrain reduction at engagement / low speed. Larger = more pulling force but lower top speed."
        />
        <TotalRatioBadge label="Total Ratio (High)"
          value={s.project.clutch.minRatio * drivetrain.gearboxRatio * drivetrain.chainSprocketRatio}
          tip="Overall drivetrain reduction at shift-out / top speed. Smaller = faster top speed."
        />
        <TotalRatioBadge label="Combined Efficiency"
          value={drivetrain.beltEfficiency * drivetrain.gearboxEfficiency * drivetrain.chainEfficiency}
          isPercent
          tip="Total drivetrain efficiency = belt × gearbox × chain. This is the fraction of engine power that reaches the wheels."
        />
      </div>
    </ColumnSection>
  );
}

function VehicleSection() {
  const s = useCVTStore();
  const { vehicle } = s.project;

  return (
    <ColumnSection title="Vehicle">
      <TipInput
        label="Total Mass" unit="kg"
        tip={{ body: 'Total vehicle mass including driver and full fuel. Used for acceleration and hill-climbing calculations.', range: 'Baja: 220–280 kg, Go-kart: 130–180 kg' }}
        value={vehicle.totalMass}
        onChange={s.setVehicleMass}
        min={20} max={2000} step={5}
      />
      <TipInput
        label="Tire Radius" unit="mm"
        tip={{ body: 'Loaded (under static weight) tire radius from axle centerline to ground. Larger radius = higher top speed, less tractive force. Measure from hub to ground with vehicle at rest.', formula: 'Speed = ω_axle × r_tire', range: 'Baja 23" tire: 280–295mm; Go-kart: 175–210mm' }}
        value={vehicle.tireRadius}
        onChange={s.setTireRadius}
        min={50} max={600} step={1}
      />
      <TipInput
        label="Rolling Resistance"
        tip={{ body: 'Coefficient of rolling resistance (Crr). Higher on soft ground, lower on pavement. Baja race courses with dirt/grass/mud require 0.04–0.08. Road vehicles: 0.010–0.015.', range: 'Asphalt: 0.01–0.02; Dirt: 0.03–0.06; Mud/sand: 0.06–0.12' }}
        value={vehicle.rollingResistanceCoeff}
        onChange={s.setRollingResistance}
        min={0.005} max={0.2} step={0.005}
      />
      <TipInput
        label="Drag Coefficient"
        tip={{ body: 'Aerodynamic drag coefficient (Cd). Lower is more aerodynamic. At Baja speeds (<40 mph) aero drag is small compared to rolling resistance and grade resistance.', range: 'Baja: 0.7–1.2; Go-kart: 0.5–0.8; Car: 0.25–0.45' }}
        value={vehicle.dragCoefficient}
        onChange={s.setDragCoefficient}
        min={0.1} max={3} step={0.05}
      />
      <TipInput
        label="Frontal Area" unit="m²"
        tip={{ body: 'Projected frontal cross-sectional area of the vehicle. Used in aerodynamic drag force calculation: F_drag = ½ρCdA·v².', formula: 'F_aero = 0.5 × 1.225 × Cd × A × v²', range: 'Baja: 0.9–1.3 m²; Go-kart: 0.5–0.8 m²' }}
        value={vehicle.frontalArea}
        onChange={s.setFrontalArea}
        min={0.1} max={5} step={0.05}
      />
      <TipInput
        label="Grade" unit="%"
        tip={{ body: 'Slope grade for hill-climbing analysis. 0% = flat. 10% = 1m rise per 10m horizontal (≈5.7°). The results show maximum gradeability at peak tractive force.', formula: 'F_grade = m × g × sin(arctan(grade/100))' }}
        value={vehicle.gradePercent}
        onChange={s.setGradePercent}
        min={0} max={100} step={1}
      />
    </ColumnSection>
  );
}

// ─── Results summary ──────────────────────────────────────────────────────────

function ResultsSummary() {
  const { summary, project } = useCVTStore();
  if (!summary) return null;

  return (
    <div className="shrink-0 border-b border-border bg-surface-1 px-4 py-3">
      <div className="text-2xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">
        Performance Results
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Max Speed"
          value={`${summary.maxSpeed.toFixed(1)} mph`}
          sub={`${(summary.maxSpeed * 1.609).toFixed(1)} km/h`}
          color="#60a5fa"
          tip="Top speed at governed RPM with minimum CVT ratio."
        />
        <StatCard
          label="Engagement Speed"
          value={`${summary.engagementSpeed.toFixed(1)} mph`}
          sub="clutch starts moving"
          color="#4ade80"
          tip="Vehicle speed when the primary clutch first begins engaging the belt."
        />
        <StatCard
          label="Peak Tractive Force"
          value={`${(summary.peakTractiveForce / 1000).toFixed(2)} kN`}
          sub={`${summary.peakTractiveForce.toFixed(0)} N`}
          color="#facc15"
          tip="Maximum force at the contact patches, at the engine's peak torque RPM."
        />
        <StatCard
          label="Peak Acceleration"
          value={`${summary.peakAcceleration.toFixed(2)} m/s²`}
          sub={`${(summary.peakAcceleration / 9.81).toFixed(2)} g`}
          color="#e8622a"
          tip="Maximum acceleration accounting for rolling resistance and drivetrain losses."
        />
        <StatCard
          label="Ratio Spread"
          value={`${summary.ratioSpread.toFixed(2)}:1`}
          sub="CVT range"
          color="#a78bfa"
          tip="CVT ratio spread = max / min ratio. Larger spread = more versatile (good for off-road)."
        />
        <StatCard
          label="Total Reduction (Low)"
          value={`${summary.totalReductionLow.toFixed(1)}:1`}
          sub="at engagement"
          color="#94a3b8"
          tip="Overall drivetrain reduction at low speed."
        />
        <StatCard
          label="Max Gradeability"
          value={`${summary.maxGradeability.toFixed(1)}%`}
          sub={`≈${(Math.atan(summary.maxGradeability / 100) * 180 / Math.PI).toFixed(1)}°`}
          color="#fb923c"
          tip="Maximum climbable grade at peak tractive effort, accounting for rolling resistance."
        />
        <StatCard
          label="¼-Mile Estimate"
          value={`${summary.quarterMileTime.toFixed(1)} s`}
          sub="0→402m"
          color="#f472b6"
          tip="Estimated quarter-mile time using kinematic integration of the acceleration curve."
        />
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function CVTCharts() {
  const { points } = useCVTStore();

  const speedRPMData    = useMemo(() => points.map(p => [p.rpm, p.speedMph] as [number, number]), [points]);
  const tractiveData    = useMemo(() => points.filter(p => p.isEngaged).map(p => [p.speedMph, p.tractiveForce / 1000] as [number, number]), [points]);
  const ratioRPMData    = useMemo(() => points.map(p => [p.rpm, p.cvtRatio] as [number, number]), [points]);
  const accelSpeedData  = useMemo(() => points.filter(p => p.isEngaged).map(p => [p.speedMph, Math.max(0, p.acceleration)] as [number, number]), [points]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Speed vs Engine RPM" subtitle="mph at each RPM point">
          <LineChart data={speedRPMData} color="#60a5fa" xLabel="Engine RPM" yLabel="Speed (mph)" width={340} height={150} />
        </ChartCard>
        <ChartCard title="CVT Ratio vs RPM" subtitle="belt drive ratio through the shift range">
          <LineChart data={ratioRPMData} color="#a78bfa" xLabel="Engine RPM" yLabel="CVT Ratio" width={340} height={150} />
        </ChartCard>
        <ChartCard title="Tractive Force vs Speed" subtitle="force at contact patch (kN)">
          <LineChart data={tractiveData} color="#facc15" xLabel="Speed (mph)" yLabel="Force (kN)" width={340} height={150} />
        </ChartCard>
        <ChartCard title="Acceleration vs Speed" subtitle="net acceleration (m/s²)">
          <LineChart data={accelSpeedData} color="#e8622a" xLabel="Speed (mph)" yLabel="Accel (m/s²)" width={340} height={150} />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Chart primitives ─────────────────────────────────────────────────────────

function LineChart({
  data, color, xLabel, yLabel, width, height,
}: {
  data: [number, number][];
  color: string;
  xLabel: string;
  yLabel: string;
  width: number;
  height: number;
}) {
  if (!data.length) return null;

  const pad = { top: 8, right: 8, bottom: 28, left: 36 };
  const W = width  - pad.left - pad.right;
  const H = height - pad.top  - pad.bottom;

  const xs = data.map(d => d[0]);
  const ys = data.map(d => d[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys) * 1.05 || 1;

  const px = (x: number) => pad.left + ((x - xMin) / (xMax - xMin || 1)) * W;
  const py = (y: number) => pad.top  + H - ((y - yMin) / (yMax - yMin || 1)) * H;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(d[0]).toFixed(1)},${py(d[1]).toFixed(1)}`).join(' ');

  // Y axis labels (3 ticks)
  const yTicks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  // X axis labels (3 ticks)
  const xTicks = [xMin, xMin + (xMax - xMin) / 2, xMax];

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid */}
      {yTicks.map((y, i) => (
        <line key={i} x1={pad.left} y1={py(y)} x2={pad.left + W} y2={py(y)}
          stroke="#334155" strokeWidth={0.5} strokeDasharray="3 3" />
      ))}
      {/* Zero line */}
      {yMin < 0 && (
        <line x1={pad.left} y1={py(0)} x2={pad.left + W} y2={py(0)}
          stroke="#475569" strokeWidth={1} />
      )}
      {/* Data line */}
      <path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      {/* Y axis labels */}
      {yTicks.map((y, i) => (
        <text key={i} x={pad.left - 4} y={py(y) + 3} textAnchor="end"
          fill="#64748b" fontSize={8} fontFamily="monospace">
          {y >= 1000 ? (y / 1000).toFixed(1) + 'k' : y.toFixed(y < 1 ? 2 : 0)}
        </text>
      ))}
      {/* X axis labels */}
      {xTicks.map((x, i) => (
        <text key={i} x={px(x)} y={pad.top + H + 14} textAnchor="middle"
          fill="#64748b" fontSize={8} fontFamily="monospace">
          {x >= 1000 ? (x / 1000).toFixed(1) + 'k' : x.toFixed(1)}
        </text>
      ))}
      {/* Axis labels */}
      <text x={pad.left + W / 2} y={height - 2} textAnchor="middle"
        fill="#475569" fontSize={8} fontFamily="monospace">{xLabel}</text>
      <text x={8} y={pad.top + H / 2} textAnchor="middle"
        fill="#475569" fontSize={8} fontFamily="monospace"
        transform={`rotate(-90, 8, ${pad.top + H / 2})`}>{yLabel}</text>
    </svg>
  );
}

function MiniDualChart({
  series1, series2, label1, label2, color1, color2, width, height,
}: {
  series1: [number, number][];
  series2: [number, number][];
  label1: string;
  label2: string;
  color1: string;
  color2: string;
  width: number;
  height: number;
}) {
  if (!series1.length) return null;

  const pad = { top: 6, right: 8, bottom: 20, left: 32 };
  const W = width  - pad.left - pad.right;
  const H = height - pad.top  - pad.bottom;

  const allX = [...series1.map(d => d[0]), ...series2.map(d => d[0])];
  const allY1 = series1.map(d => d[1]);
  const allY2 = series2.map(d => d[1]);
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const y1Min = 0, y1Max = Math.max(...allY1) * 1.1 || 1;
  const y2Min = 0, y2Max = Math.max(...allY2) * 1.1 || 1;

  const px  = (x: number) => pad.left + ((x - xMin) / (xMax - xMin || 1)) * W;
  const py1 = (y: number) => pad.top  + H - ((y - y1Min) / (y1Max - y1Min || 1)) * H;
  const py2 = (y: number) => pad.top  + H - ((y - y2Min) / (y2Max - y2Min || 1)) * H;

  const path1 = series1.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(d[0]).toFixed(1)},${py1(d[1]).toFixed(1)}`).join(' ');
  const path2 = series2.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(d[0]).toFixed(1)},${py2(d[1]).toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height}>
      <path d={path1} stroke={color1} strokeWidth={1.5} fill="none" />
      <path d={path2} stroke={color2} strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
      {/* Legend */}
      <line x1={pad.left} y1={H + pad.top + 12} x2={pad.left + 16} y2={H + pad.top + 12} stroke={color1} strokeWidth={1.5} />
      <text x={pad.left + 20} y={H + pad.top + 15} fill="#64748b" fontSize={7} fontFamily="monospace">{label1}</text>
      <line x1={pad.left + 80} y1={H + pad.top + 12} x2={pad.left + 96} y2={H + pad.top + 12} stroke={color2} strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={pad.left + 100} y={H + pad.top + 15} fill="#64748b" fontSize={7} fontFamily="monospace">{label2}</text>
    </svg>
  );
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function ColumnSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3 border-b border-border last:border-b-0 flex flex-col gap-2">
      <div className="text-2xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label, value, sub, color, tip,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  tip: string;
}) {
  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-2xs text-muted-foreground">{label}</span>
        <Tip body={tip} />
      </div>
      <div className="text-sm font-mono font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="text-2xs text-muted-foreground/60 mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-lg p-3 border border-border/50">
      <div className="text-2xs font-semibold text-foreground mb-0.5">{title}</div>
      <div className="text-2xs text-muted-foreground/60 mb-2">{subtitle}</div>
      {children}
    </div>
  );
}

function TotalRatioBadge({ label, value, isPercent, tip }: {
  label: string; value: number; isPercent?: boolean; tip: string;
}) {
  return (
    <div className="flex items-center justify-between bg-surface-2 rounded px-2 py-1">
      <div className="flex items-center gap-1">
        <span className="text-2xs text-muted-foreground">{label}</span>
        <Tip body={tip} />
      </div>
      <span className="text-xs font-mono text-foreground">
        {isPercent ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(2)}:1`}
      </span>
    </div>
  );
}
