'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type PlotlyType from 'react-plotly.js';
import { useGearboxStore } from '@/store/gearboxStore';
import { engineTorqueAtRPM } from '@/engine/gearbox/gearboxCalc';
import { cn } from '@/lib/utils';
import type { GearboxResult, GearboxProject } from '@/types/gearbox';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as unknown as React.ComponentType<React.ComponentProps<typeof PlotlyType>>;

const GEAR_COLORS = ['#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#fb923c','#38bdf8','#4ade80'];

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: '#111114',
  plot_bgcolor:  '#111114',
  font: { family: 'JetBrains Mono, monospace', size: 10, color: '#94a3b8' },
  xaxis: { gridcolor: '#1e2a3a', zerolinecolor: '#334155', tickfont: { size: 9 } },
  yaxis: { gridcolor: '#1e2a3a', zerolinecolor: '#334155', tickfont: { size: 9 } },
  margin: { t: 28, r: 12, b: 44, l: 54 },
  showlegend: true,
  legend: { bgcolor: 'rgba(17,17,20,0.8)', bordercolor: '#1e293b', borderwidth: 1, font: { size: 9 } },
};
const PLOTLY_CONFIG: Partial<Plotly.Config> = {
  displayModeBar: false,
  responsive: true,
};

// ─── Main page ────────────────────────────────────────────────────────────────

export function GearboxCalculatorPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-0">
      <GearboxToolbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <EngineSection />
          <VehicleSection />
        </div>
        <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <GearboxSection />
        </div>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ResultsSummary />
          <GearboxCharts />
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function GearboxToolbar() {
  const { loadPreset, activeGearPreset } = useGearboxStore();
  const presets: { id: 'fsae_cbr600' | 'baja_bs' | 'formula_zytek'; label: string }[] = [
    { id: 'fsae_cbr600',   label: 'FSAE CBR600' },
    { id: 'baja_bs',       label: 'Baja SAE' },
    { id: 'formula_zytek', label: 'Formula' },
  ];
  return (
    <div className="shrink-0 h-10 border-b border-border bg-surface-1 flex items-center px-3 gap-3">
      <span className="text-xs font-semibold text-brand">Gearbox Calculator</span>
      <div className="w-px h-4 bg-border" />
      <span className="text-2xs text-muted-foreground">Preset:</span>
      <div className="flex gap-1">
        {presets.map(p => (
          <button key={p.id} onClick={() => loadPreset(p.id)}
            className={cn('px-2 py-0.5 rounded text-2xs font-mono transition-colors',
              activeGearPreset === p.id
                ? 'bg-brand/20 text-brand border border-brand/40'
                : 'bg-surface-2 text-muted-foreground border border-border hover:text-foreground'
            )}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 bg-surface-2 border-b border-border text-2xs font-semibold text-brand uppercase tracking-wider shrink-0">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40">
      <span className="text-2xs text-muted-foreground w-28 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 0.001, unit }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="input-sm flex-1 min-w-0" />
      {unit && <span className="text-2xs text-muted-foreground/60 shrink-0">{unit}</span>}
    </div>
  );
}

// ─── Engine Section ───────────────────────────────────────────────────────────

function EngineSection() {
  const { project, updateEngine } = useGearboxStore();
  const { engine } = project;
  const u = (k: keyof typeof engine) => (v: number) => updateEngine({ [k]: v });

  const curveData = useMemo(() => {
    const tq: number[] = [], pw: number[] = [], rpms: number[] = [];
    for (let rpm = engine.idleRPM; rpm <= engine.redlineRPM; rpm += 200) {
      const t = engineTorqueAtRPM(rpm, engine);
      rpms.push(rpm);
      tq.push(Math.round(t * 10) / 10);
      pw.push(Math.round(t * rpm * Math.PI / 30 / 100) / 10);
    }
    return { rpms, tq, pw };
  }, [project.engine]);

  return (
    <div className="shrink-0">
      <SectionHead>Engine</SectionHead>
      <div className="px-3 py-1.5 border-b border-border/40">
        <input value={engine.name} onChange={e => updateEngine({ name: e.target.value })}
          className="input-sm w-full text-2xs" placeholder="Engine name" />
      </div>
      <Row label="Idle RPM"><NumInput value={engine.idleRPM} onChange={u('idleRPM')} min={500} max={5000} step={100} unit="rpm" /></Row>
      <Row label="Redline RPM"><NumInput value={engine.redlineRPM} onChange={u('redlineRPM')} min={3000} max={20000} step={100} unit="rpm" /></Row>
      <Row label="Peak Torque"><NumInput value={engine.peakTorque} onChange={u('peakTorque')} min={1} max={1000} step={0.5} unit="N·m" /></Row>
      <Row label="Peak Tq @ RPM"><NumInput value={engine.peakTorqueRPM} onChange={u('peakTorqueRPM')} min={500} max={15000} step={100} unit="rpm" /></Row>
      <Row label="Peak Power"><NumInput value={engine.peakPower} onChange={u('peakPower')} min={1} max={1000} step={0.5} unit="kW" /></Row>
      <Row label="Peak Pwr @ RPM"><NumInput value={engine.peakPowerRPM} onChange={u('peakPowerRPM')} min={500} max={15000} step={100} unit="rpm" /></Row>
      <Row label="Torque @ Idle"><NumInput value={engine.torqueAtIdle} onChange={u('torqueAtIdle')} min={0} max={500} step={0.5} unit="N·m" /></Row>
      <Row label="Torque @ Red"><NumInput value={engine.torqueAtRedline} onChange={u('torqueAtRedline')} min={0} max={500} step={0.5} unit="N·m" /></Row>

      <div className="border-b border-border/40 h-28">
        <Plot
          data={[
            { x: curveData.rpms, y: curveData.tq, type: 'scatter', mode: 'lines', name: 'Torque N·m', line: { color: '#60a5fa', width: 1.5 } },
            { x: curveData.rpms, y: curveData.pw, type: 'scatter', mode: 'lines', name: 'Power ×100kW', line: { color: '#34d399', width: 1.5 } },
          ]}
          layout={{ ...DARK_LAYOUT, margin: { t: 4, r: 4, b: 24, l: 36 }, showlegend: false,
            xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'RPM', font: { size: 8 } } } }}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}

// ─── Vehicle Section ──────────────────────────────────────────────────────────

function VehicleSection() {
  const { project, updateVehicle } = useGearboxStore();
  const { vehicle } = project;
  const u = (k: keyof typeof vehicle) => (v: number) => updateVehicle({ [k]: v });

  return (
    <div>
      <SectionHead>Vehicle</SectionHead>
      <Row label="Total Mass"><NumInput value={vehicle.mass} onChange={u('mass')} min={50} max={5000} step={5} unit="kg" /></Row>
      <Row label="Tire Radius"><NumInput value={vehicle.tireRadius} onChange={u('tireRadius')} min={100} max={600} step={1} unit="mm" /></Row>
      <Row label="Frontal Area"><NumInput value={vehicle.frontalArea} onChange={u('frontalArea')} min={0.1} max={10} step={0.05} unit="m²" /></Row>
      <Row label="Aero Cd"><NumInput value={vehicle.cdAero} onChange={u('cdAero')} min={0.1} max={3} step={0.05} /></Row>
      <Row label="Roll Resist Crr"><NumInput value={vehicle.rollResistCoeff} onChange={u('rollResistCoeff')} min={0.001} max={0.2} step={0.001} /></Row>
      <Row label="Grade"><NumInput value={vehicle.gradePercent} onChange={u('gradePercent')} min={0} max={100} step={1} unit="%" /></Row>
    </div>
  );
}

// ─── Gearbox Section ──────────────────────────────────────────────────────────

function GearboxSection() {
  const { project, updateGearbox, updateGear, setNumGears, result } = useGearboxStore();
  const { gearbox } = project;

  return (
    <div>
      <SectionHead>Gearbox</SectionHead>
      <Row label="Num Gears">
        <select value={gearbox.numGears} onChange={e => setNumGears(parseInt(e.target.value))} className="input-sm flex-1">
          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </Row>
      <Row label="Final Drive"><NumInput value={gearbox.finalDrive} onChange={v => updateGearbox({ finalDrive: v })} min={0.5} max={20} step={0.01} /></Row>
      <Row label="Efficiency"><NumInput value={gearbox.efficiency} onChange={v => updateGearbox({ efficiency: v })} min={0.5} max={1} step={0.01} /></Row>
      <Row label="Shift Time"><NumInput value={gearbox.shiftTime} onChange={v => updateGearbox({ shiftTime: v })} min={0} max={1} step={0.01} unit="s" /></Row>

      <div className="px-3 py-1 bg-surface-2/60 border-b border-border">
        <span className="text-2xs font-semibold text-muted-foreground">Gear Ratios</span>
      </div>
      {gearbox.gears.slice(0, gearbox.numGears).map((g, i) => {
        const gr = result?.gears[i];
        return (
          <div key={i} className="flex items-center gap-2 px-3 py-1 border-b border-border/40">
            <span className="text-2xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: GEAR_COLORS[i % GEAR_COLORS.length] }} />
            <input type="number" value={g.ratio} min={0.1} max={10} step={0.001}
              onChange={e => updateGear(i, parseFloat(e.target.value) || 1)}
              className="input-sm flex-1 min-w-0" />
            <span className="text-2xs text-muted-foreground/60 w-14 text-right shrink-0 font-mono">
              {gr ? `${gr.speedAtRedlineKph.toFixed(0)}kph` : '—'}
            </span>
          </div>
        );
      })}

      {result && result.optimalShiftRPMs.length > 0 && (
        <>
          <div className="px-3 py-1 bg-surface-2/60 border-b border-border">
            <span className="text-2xs font-semibold text-muted-foreground">Optimal Shift Points</span>
          </div>
          {result.optimalShiftRPMs.map((rpm, i) => (
            <div key={i} className="flex justify-between text-2xs font-mono px-3 py-1 border-b border-border/30">
              <span className="text-muted-foreground">G{i + 1}→G{i + 2}</span>
              <span className="text-foreground">{rpm.toFixed(0)} rpm</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Results Summary ──────────────────────────────────────────────────────────

function ResultsSummary() {
  const { result } = useGearboxStore();
  if (!result) return null;

  const stats = [
    { label: 'Top Speed',    value: `${result.topSpeedKph.toFixed(1)} km/h`, sub: `${(result.topSpeedKph / 1.609).toFixed(1)} mph` },
    { label: '0–60 km/h',   value: `${result.time060Kph.toFixed(2)} s` },
    { label: '0–100 km/h',  value: `${result.time0100Kph.toFixed(2)} s` },
    { label: 'Gradeability', value: `${result.gradeability.toFixed(1)}%`, sub: 'max grade in 1st' },
  ];

  return (
    <div className="shrink-0 border-b border-border bg-surface-1 flex">
      {stats.map(s => (
        <div key={s.label} className="flex-1 px-3 py-2 border-r border-border last:border-r-0">
          <div className="text-2xs text-muted-foreground">{s.label}</div>
          <div className="text-sm font-semibold text-foreground font-mono">{s.value}</div>
          {s.sub && <div className="text-2xs text-muted-foreground/60 font-mono">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

type ChartTab = 'tractive' | 'acceleration' | 'power' | 'gear_table';

function GearboxCharts() {
  const [tab, setTab] = useState<ChartTab>('tractive');
  const { result, project } = useGearboxStore();
  if (!result) return null;

  const tabs: { id: ChartTab; label: string }[] = [
    { id: 'tractive',     label: 'Tractive Force' },
    { id: 'acceleration', label: 'Acceleration' },
    { id: 'power',        label: 'Power / Torque' },
    { id: 'gear_table',   label: 'Gear Table' },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex border-b border-border bg-surface-1 px-2 gap-1 pt-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-3 py-1 text-2xs rounded-t transition-colors border-b-2',
              tab === t.id ? 'text-brand border-brand bg-brand/5' : 'text-muted-foreground border-transparent hover:text-foreground'
            )}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'tractive'     && <TractiveForceChart result={result} />}
        {tab === 'acceleration' && <AccelerationChart result={result} />}
        {tab === 'power'        && <PowerTorqueChart project={project} />}
        {tab === 'gear_table'   && <GearTable result={result} project={project} />}
      </div>
    </div>
  );
}

function TractiveForceChart({ result }: { result: GearboxResult }) {
  const traces: Plotly.Data[] = result.gears.map((g, i) => ({
    x: g.curve.map(p => p.speedKph),
    y: g.curve.map(p => p.tractiveForce),
    type: 'scatter', mode: 'lines',
    name: `Gear ${g.gearIndex}`,
    line: { color: GEAR_COLORS[i % GEAR_COLORS.length], width: 2 },
  }));

  // Add drag curve from last gear
  const lastG = result.gears[result.gears.length - 1];
  if (lastG) {
    traces.push({
      x: lastG.curve.map(p => p.speedKph),
      y: lastG.curve.map(p => p.dragForce),
      type: 'scatter', mode: 'lines',
      name: 'Drag + Roll',
      line: { color: '#475569', width: 1.5, dash: 'dash' },
    });
  }

  return (
    <Plot data={traces}
      layout={{ ...DARK_LAYOUT,
        title: { text: 'Tractive Force vs Speed', font: { size: 11, color: '#e2e8f0' } },
        xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'Speed (km/h)' } },
        yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Force (N)' } },
      }}
      config={PLOTLY_CONFIG}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function AccelerationChart({ result }: { result: GearboxResult }) {
  const traces: Plotly.Data[] = result.gears.map((g, i) => ({
    x: g.curve.map(p => p.speedKph),
    y: g.curve.map(p => p.accelerationG),
    type: 'scatter', mode: 'lines',
    name: `Gear ${g.gearIndex}`,
    line: { color: GEAR_COLORS[i % GEAR_COLORS.length], width: 2 },
  }));

  return (
    <Plot data={traces}
      layout={{ ...DARK_LAYOUT,
        title: { text: 'Acceleration vs Speed', font: { size: 11, color: '#e2e8f0' } },
        xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'Speed (km/h)' } },
        yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Acceleration (g)' } },
        shapes: [{ type: 'line', x0: 0, x1: 1, y0: 0, y1: 0, xref: 'paper', yref: 'y', line: { color: '#475569', width: 1 } }],
      }}
      config={PLOTLY_CONFIG}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function PowerTorqueChart({ project }: { project: GearboxProject }) {
  const { rpms, tq, pw } = useMemo(() => {
    const { engine } = project;
    const rpms: number[] = [], tq: number[] = [], pw: number[] = [];
    for (let rpm = engine.idleRPM; rpm <= engine.redlineRPM; rpm += 100) {
      const t = engineTorqueAtRPM(rpm, engine);
      rpms.push(rpm);
      tq.push(Math.round(t * 10) / 10);
      pw.push(Math.round(t * rpm * Math.PI / 30 / 100) / 10);
    }
    return { rpms, tq, pw };
  }, [project.engine]);

  return (
    <Plot
      data={[
        { x: rpms, y: tq, type: 'scatter', mode: 'lines', name: 'Torque (N·m)', line: { color: '#60a5fa', width: 2 } },
        { x: rpms, y: pw, type: 'scatter', mode: 'lines', name: 'Power (kW)',    line: { color: '#34d399', width: 2 }, yaxis: 'y2' },
      ]}
      layout={{ ...DARK_LAYOUT,
        title: { text: 'Engine Power & Torque Curve', font: { size: 11, color: '#e2e8f0' } },
        xaxis: { ...DARK_LAYOUT.xaxis, title: { text: 'RPM' } },
        yaxis: { ...DARK_LAYOUT.yaxis, title: { text: 'Torque (N·m)' } },
        yaxis2: { overlaying: 'y', side: 'right', title: { text: 'Power (kW)' }, gridcolor: 'transparent', tickfont: { size: 9, color: '#34d399' }, titlefont: { color: '#34d399' } },
        shapes: [
          { type: 'line', x0: project.engine.peakTorqueRPM, x1: project.engine.peakTorqueRPM, y0: 0, y1: 1, xref: 'x', yref: 'paper', line: { color: '#60a5fa', width: 1, dash: 'dot' } },
          { type: 'line', x0: project.engine.peakPowerRPM,  x1: project.engine.peakPowerRPM,  y0: 0, y1: 1, xref: 'x', yref: 'paper', line: { color: '#34d399', width: 1, dash: 'dot' } },
        ],
      }}
      config={PLOTLY_CONFIG}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function GearTable({ result, project }: { result: GearboxResult; project: GearboxProject }) {
  const th = 'text-left text-2xs text-muted-foreground font-semibold px-3 py-2 border-b border-border bg-surface-2 whitespace-nowrap';
  const td = 'text-2xs font-mono px-3 py-1.5 border-b border-border/40';

  return (
    <div className="overflow-auto p-2">
      <table className="w-full border-collapse text-foreground">
        <thead>
          <tr>
            <th className={th}>Gear</th>
            <th className={th}>Ratio</th>
            <th className={th}>× Final</th>
            <th className={th}>Speed @ Peak Tq</th>
            <th className={th}>Speed @ Redline</th>
            <th className={th}>Max Trac Force</th>
            <th className={th}>Shift @ RPM</th>
          </tr>
        </thead>
        <tbody>
          {result.gears.map((g, i) => (
            <tr key={i} className="hover:bg-surface-2/40 transition-colors">
              <td className={td}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: GEAR_COLORS[i % GEAR_COLORS.length] }} />
                  {g.gearIndex}
                </div>
              </td>
              <td className={td}>{g.ratio.toFixed(3)}</td>
              <td className={td}>{g.totalRatio.toFixed(3)}</td>
              <td className={td}>{g.speedAtPeakTorqueKph.toFixed(1)} km/h</td>
              <td className={td}>{g.speedAtRedlineKph.toFixed(1)} km/h</td>
              <td className={td}>{g.maxTractiveForce.toFixed(0)} N</td>
              <td className={td}>
                {result.optimalShiftRPMs[i] != null ? `${result.optimalShiftRPMs[i].toFixed(0)} rpm` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="px-3 py-2 text-2xs text-muted-foreground border-t border-border">
              {project.engine.name} &nbsp;·&nbsp; Final drive: {project.gearbox.finalDrive} &nbsp;·&nbsp;
              Efficiency: {(project.gearbox.efficiency * 100).toFixed(0)}% &nbsp;·&nbsp; Mass: {project.vehicle.mass} kg
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
