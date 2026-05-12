'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { KinematicSweep } from '@/types/kinematics';

// Plotly must be loaded client-side only
import type PlotlyType from 'react-plotly.js';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as unknown as React.ComponentType<React.ComponentProps<typeof PlotlyType>>;

import React from 'react';

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: '#111114',
  plot_bgcolor: '#111114',
  font: { family: 'JetBrains Mono, monospace', size: 11, color: '#94a3b8' },
  xaxis: {
    gridcolor: '#1e2a3a',
    zerolinecolor: '#334155',
    tickfont: { size: 10 },
  },
  yaxis: {
    gridcolor: '#1e2a3a',
    zerolinecolor: '#334155',
    tickfont: { size: 10 },
  },
  margin: { t: 36, r: 16, b: 48, l: 56 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(17,17,20,0.8)',
    bordercolor: '#1e293b',
    borderwidth: 1,
    font: { size: 10 },
  },
};

type AxisConfig = { title: string; range?: [number, number] };

function buildLayout(title: string, x: AxisConfig, y: AxisConfig): Partial<Plotly.Layout> {
  return {
    ...DARK_LAYOUT,
    title: { text: title, font: { size: 12, color: '#e2e8f0' } },
    xaxis: { ...DARK_LAYOUT.xaxis, title: x.title, range: x.range },
    yaxis: { ...DARK_LAYOUT.yaxis, title: y.title, range: y.range },
  };
}

const CONFIG: Partial<Plotly.Config> = {
  displayModeBar: true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
  responsive: true,
  displaylogo: false,
  toImageButtonOptions: { format: 'svg', filename: 'lotus-shark-plot' },
};

// ─── Camber vs Travel ─────────────────────────────────────────────────────────

interface CamberPlotProps {
  frontSweep?: KinematicSweep | null;
  rearSweep?: KinematicSweep | null;
}

export function CamberPlot({ frontSweep, rearSweep }: CamberPlotProps) {
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [];
    if (frontSweep) {
      t.push({
        x: frontSweep.camberCurve.map(p => p.travel),
        y: frontSweep.camberCurve.map(p => p.camber),
        type: 'scatter', mode: 'lines',
        name: 'Front',
        line: { color: '#60a5fa', width: 2 },
      });
    }
    if (rearSweep) {
      t.push({
        x: rearSweep.camberCurve.map(p => p.travel),
        y: rearSweep.camberCurve.map(p => p.camber),
        type: 'scatter', mode: 'lines',
        name: 'Rear',
        line: { color: '#34d399', width: 2 },
      });
    }
    return t;
  }, [frontSweep, rearSweep]);

  return (
    <Plot
      data={traces}
      layout={buildLayout('Camber vs Wheel Travel', { title: 'Wheel Travel (mm)' }, { title: 'Camber (deg)' })}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Bump Steer (Toe) vs Travel ───────────────────────────────────────────────

export function BumpSteerPlot({ frontSweep, rearSweep }: CamberPlotProps) {
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [];
    if (frontSweep) {
      t.push({
        x: frontSweep.bumpSteerCurve.map(p => p.travel),
        y: frontSweep.bumpSteerCurve.map(p => p.toe),
        type: 'scatter', mode: 'lines',
        name: 'Front',
        line: { color: '#a78bfa', width: 2 },
      });
    }
    if (rearSweep) {
      t.push({
        x: rearSweep.bumpSteerCurve.map(p => p.travel),
        y: rearSweep.bumpSteerCurve.map(p => p.toe),
        type: 'scatter', mode: 'lines',
        name: 'Rear',
        line: { color: '#fb923c', width: 2 },
      });
    }
    return t;
  }, [frontSweep, rearSweep]);

  return (
    <Plot
      data={traces}
      layout={buildLayout('Bump Steer (Toe) vs Wheel Travel', { title: 'Wheel Travel (mm)' }, { title: 'Toe Change (deg)' })}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Roll Center Migration ────────────────────────────────────────────────────

export function RollCenterPlot({ frontSweep, rearSweep }: CamberPlotProps) {
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [];
    if (frontSweep) {
      t.push({
        x: frontSweep.rollCenterMigration.map(p => p.travel),
        y: frontSweep.rollCenterMigration.map(p => p.rcHeight),
        type: 'scatter', mode: 'lines',
        name: 'Front RC Height',
        line: { color: '#f59e0b', width: 2 },
      });
      t.push({
        x: frontSweep.rollCenterMigration.map(p => p.rcLateral),
        y: frontSweep.rollCenterMigration.map(p => p.rcHeight),
        type: 'scatter', mode: 'lines',
        name: 'Front RC Path (Y vs Z)',
        line: { color: '#f59e0b', width: 2, dash: 'dot' },
      });
    }
    if (rearSweep) {
      t.push({
        x: rearSweep.rollCenterMigration.map(p => p.travel),
        y: rearSweep.rollCenterMigration.map(p => p.rcHeight),
        type: 'scatter', mode: 'lines',
        name: 'Rear RC Height',
        line: { color: '#10b981', width: 2 },
      });
    }
    return t;
  }, [frontSweep, rearSweep]);

  return (
    <Plot
      data={traces}
      layout={buildLayout('Roll Center Migration', { title: 'Wheel Travel (mm)' }, { title: 'RC Height (mm)' })}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Motion Ratio vs Travel ───────────────────────────────────────────────────

export function MotionRatioPlot({ frontSweep, rearSweep }: CamberPlotProps) {
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [];
    if (frontSweep) {
      t.push({
        x: frontSweep.motionRatioCurve.map(p => p.travel),
        y: frontSweep.motionRatioCurve.map(p => p.motionRatio),
        type: 'scatter', mode: 'lines',
        name: 'Front MR',
        line: { color: '#60a5fa', width: 2 },
      });
      t.push({
        x: frontSweep.wheelRateCurve.map(p => p.travel),
        y: frontSweep.wheelRateCurve.map(p => p.wheelRate),
        type: 'scatter', mode: 'lines',
        name: 'Front Wheel Rate (N/mm)',
        line: { color: '#93c5fd', width: 2, dash: 'dash' },
        yaxis: 'y2',
      });
    }
    return t;
  }, [frontSweep]);

  const layout = {
    ...buildLayout('Motion Ratio & Wheel Rate vs Travel', { title: 'Wheel Travel (mm)' }, { title: 'Motion Ratio' }),
    yaxis2: {
      title: 'Wheel Rate (N/mm)',
      overlaying: 'y',
      side: 'right',
      gridcolor: '#1e2a3a',
      tickfont: { size: 10, color: '#94a3b8' },
    },
  } as Partial<Plotly.Layout>;

  return (
    <Plot
      data={traces}
      layout={layout}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Pacejka lateral force curve ─────────────────────────────────────────────

interface TirePlotProps {
  data: Array<{ slipAngle: number; Fy: number; mu: number }>;
  normalLoad: number;
}

export function TireLateralPlot({ data, normalLoad }: TirePlotProps) {
  const traces: Plotly.Data[] = [
    {
      x: data.map(p => p.slipAngle),
      y: data.map(p => p.Fy),
      type: 'scatter', mode: 'lines',
      name: `Fy @ ${normalLoad.toFixed(0)}N`,
      line: { color: '#00d4ff', width: 2 },
    },
    {
      x: data.map(p => p.slipAngle),
      y: data.map(p => p.mu),
      type: 'scatter', mode: 'lines',
      name: 'μ_y',
      line: { color: '#f59e0b', width: 1.5, dash: 'dot' },
      yaxis: 'y2',
    },
  ];

  const layout = {
    ...buildLayout('Lateral Force vs Slip Angle', { title: 'Slip Angle (deg)' }, { title: 'Lateral Force Fy (N)' }),
    yaxis2: {
      title: 'Friction Coefficient μ',
      overlaying: 'y',
      side: 'right',
      gridcolor: '#1e2a3a',
      tickfont: { size: 10, color: '#94a3b8' },
    },
  } as Partial<Plotly.Layout>;

  return (
    <Plot
      data={traces}
      layout={layout}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Friction ellipse ────────────────────────────────────────────────────────

interface FrictionEllipseProps {
  data: Array<{ Fy: number; Fx: number }>;
}

export function FrictionEllipsePlot({ data }: FrictionEllipseProps) {
  const traces: Plotly.Data[] = [
    {
      x: data.map(p => p.Fy),
      y: data.map(p => p.Fx),
      type: 'scatter', mode: 'lines',
      name: 'Friction Ellipse',
      line: { color: '#00d4ff', width: 2 },
      fill: 'toself',
      fillcolor: 'rgba(0,212,255,0.05)',
    },
  ];

  return (
    <Plot
      data={traces}
      layout={buildLayout('Friction Ellipse', { title: 'Lateral Force Fy (N)' }, { title: 'Longitudinal Force Fx (N)' })}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

// ─── Optimization convergence ─────────────────────────────────────────────────

interface OptimizationPlotProps {
  history: Array<{ generation: number; bestFitness: number; meanFitness: number }>;
}

export function OptimizationConvergencePlot({ history }: OptimizationPlotProps) {
  const traces: Plotly.Data[] = [
    {
      x: history.map(h => h.generation),
      y: history.map(h => h.bestFitness),
      type: 'scatter', mode: 'lines',
      name: 'Best Fitness',
      line: { color: '#4ade80', width: 2 },
    },
    {
      x: history.map(h => h.generation),
      y: history.map(h => h.meanFitness),
      type: 'scatter', mode: 'lines',
      name: 'Mean Fitness',
      line: { color: '#94a3b8', width: 1.5, dash: 'dot' },
    },
  ];

  return (
    <Plot
      data={traces}
      layout={buildLayout('Optimization Convergence', { title: 'Generation' }, { title: 'Fitness' })}
      config={CONFIG}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}
