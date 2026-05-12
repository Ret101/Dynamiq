'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/workspace/Sidebar';
import { Topbar } from '@/components/workspace/Topbar';
import { ViewerControls } from '@/components/workspace/ViewerControls';
import { HardpointEditor } from '@/components/panels/HardpointEditor';
import { KinematicsPanel } from '@/components/panels/KinematicsPanel';
import { PlotsPanel } from '@/components/panels/PlotsPanel';
import { ProjectPanel } from '@/components/panels/ProjectPanel';
import { TireModelPanel } from '@/components/panels/TireModelPanel';
import { SpringDamperPanel } from '@/components/panels/SpringDamperPanel';
import { SteeringPanel } from '@/components/panels/SteeringPanel';
import { LoadTransferPanel } from '@/components/panels/LoadTransferPanel';
import { OptimizationPanel } from '@/components/panels/OptimizationPanel';
import { CVTCalculatorPage } from '@/components/cvt/CVTCalculatorPage';
import { GearboxCalculatorPage } from '@/components/gearbox/GearboxCalculatorPage';
import { PartsReferencePage } from '@/components/reference/PartsReferencePage';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { dbSave } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { ProjectFile } from '@/types/project';

// Three.js viewer must be client-only
const Viewer3D = dynamic(
  () => import('@/components/viewer/Viewer3D').then(m => ({ default: m.Viewer3D })),
  { ssr: false, loading: () => <ViewerPlaceholder /> }
);

export default function WorkspacePage() {
  const { activePanel, appMode } = useUIStore();
  const { vehicle, metadata, simulationSettings, isDirty, runValidation } = useProjectStore();

  // Run validation whenever the vehicle changes
  useEffect(() => {
    runValidation();
  }, [vehicle, runValidation]);

  // Autosave to IndexedDB 4s after any vehicle change
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      const file: ProjectFile = {
        format: 'lotus-shark-online',
        formatVersion: '1.0',
        metadata,
        vehicle,
        simulationSettings,
      };
      dbSave(file).catch(() => {/* silent — autosave is best-effort */});
    }, 4000);
    return () => clearTimeout(timer);
  }, [isDirty, vehicle, metadata, simulationSettings]);

  // Global keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      {appMode === 'cvt' ? (
        <div className="flex-1 min-w-0 overflow-hidden">
          <CVTCalculatorPage />
        </div>
      ) : appMode === 'gearbox' ? (
        <div className="flex-1 min-w-0 overflow-hidden">
          <GearboxCalculatorPage />
        </div>
      ) : appMode === 'reference' ? (
        <div className="flex-1 min-w-0 overflow-hidden">
          <PartsReferencePage />
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Topbar with scrubbers */}
          <Topbar />
          <ValidationBanner />

          {/* Workspace body */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left panel */}
            <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
              <PanelContainer activePanel={activePanel} />
            </div>

            {/* Center 3D viewport */}
            <div className="flex-1 min-w-0 relative">
              <Viewer3D className="h-full w-full" />
              <ViewerControls />
            </div>

            {/* Right panel: Kinematics results */}
            <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-hidden">
              <PanelHeader title="Kinematics" />
              <div className="flex-1 min-h-0 overflow-hidden">
                <KinematicsPanel />
              </div>
            </div>
          </div>

          {/* Bottom: Plots */}
          <div className="h-64 shrink-0 border-t border-border">
            <PlotsPanel />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelContainer({ activePanel }: { activePanel: string }) {
  const panels: Record<string, { title: string; component: React.ReactNode }> = {
    project:      { title: 'Projects',       component: <ProjectPanel /> },
    hardpoints:   { title: 'Hardpoints',     component: <HardpointEditor /> },
    kinematics:   { title: 'Kinematics',     component: <KinematicsPanel /> },
    plots:        { title: 'Plots',          component: <PlotsPanel /> },
    tire:         { title: 'Tire Model',     component: <TireModelPanel /> },
    spring_damper:{ title: 'Spring / Damper',component: <SpringDamperPanel /> },
    load_transfer:{ title: 'Load Transfer',  component: <LoadTransferPanel /> },
    optimization: { title: 'Optimization',   component: <OptimizationPanel /> },
    steering:     { title: 'Steering',       component: <SteeringPanel /> },
    export:       { title: 'Export / Import',component: <ExportPlaceholder /> },
  };

  const active = panels[activePanel] ?? panels.hardpoints;

  return (
    <>
      <PanelHeader title={active.title} />
      <div className="flex-1 min-h-0 overflow-hidden">
        {active.component}
      </div>
    </>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="panel-header shrink-0">
      <span className="text-brand text-xs">◈</span>
      <span>{title}</span>
    </div>
  );
}

function ViewerPlaceholder() {
  return (
    <div className="h-full w-full bg-surface-1 flex items-center justify-center">
      <div className="text-muted-foreground text-sm animate-pulse">Loading 3D Viewer…</div>
    </div>
  );
}

function ExportPlaceholder() {
  return <PlaceholderPanel title="Export / Import" description="JSON, CSV, XML, MATLAB, SolidWorks CSV — use the ↗ Export button in the toolbar" />;
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
        <span className="text-brand text-sm">◈</span>
      </div>
      <div>
        <div className="text-sm font-medium text-foreground mb-1">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
      </div>
      <div className="badge badge-brand">Coming Soon</div>
    </div>
  );
}

function ValidationBanner() {
  const { validation } = useProjectStore();
  if (!validation) return null;

  const { errors, warnings } = validation;
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border bg-surface-1 px-3 py-1 flex items-center gap-3 overflow-x-auto">
      {errors.map((e, i) => (
        <span key={`e${i}`} className="text-2xs text-red-400 font-mono whitespace-nowrap">
          ✕ [{e.code}] {e.message}
        </span>
      ))}
      {warnings.map((w, i) => (
        <span key={`w${i}`} className="text-2xs text-yellow-400 font-mono whitespace-nowrap">
          ⚠ [{w.code}] {w.message}
        </span>
      ))}
    </div>
  );
}

function useKeyboardShortcuts() {
  const { setActivePanel } = useUIStore();
  const { undo, redo, canUndo, canRedo } = useProjectStore();

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Ctrl/Cmd + Z = undo, Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
        return;
      }
      return;
    }

    const shortcuts: Record<string, string> = {
      'j': 'project',
      'h': 'hardpoints',
      'k': 'kinematics',
      'p': 'plots',
      't': 'tire',
      'd': 'spring_damper',
      'l': 'load_transfer',
      'o': 'optimization',
      's': 'steering',
      'e': 'export',
    };

    const panel = shortcuts[e.key.toLowerCase()];
    if (panel) {
      e.preventDefault();
      setActivePanel(panel as Parameters<typeof setActivePanel>[0]);
    }
  }, [setActivePanel, undo, redo, canUndo, canRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
