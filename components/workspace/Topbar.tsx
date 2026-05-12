'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { exportJSON, exportHardpointsCSV, exportMATLAB, downloadFile } from '@/lib/importExport';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { vehicle, metadata, simulationSettings, isDirty, markSaved, undo, redo, canUndo, canRedo } = useProjectStore();
  const { heave, roll, pitch, steerAngle, setHeave, setRoll, setPitch, setSteerAngle } = useUIStore();

  const handleSave = () => {
    const json = exportJSON(vehicle, metadata, simulationSettings);
    downloadFile(json, `${metadata.name.replace(/\s+/g, '_')}.lso.json`, 'application/json');
    markSaved();
  };

  return (
    <header className="h-10 bg-surface-1 border-b border-border flex items-center gap-0 px-3 shrink-0 overflow-x-auto">
      {/* Project name */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
          {metadata.name}
        </span>
        {isDirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" title="Unsaved changes" />
        )}
        <span className="badge badge-brand text-2xs ml-1">{vehicle.series}</span>
      </div>

      <div className="w-px h-5 bg-border mx-3 shrink-0" />

      {/* Vehicle stats */}
      <div className="flex items-center gap-3 text-2xs text-muted-foreground font-mono shrink-0">
        <span>{vehicle.wheelbase}mm</span>
        <span>{vehicle.mass}kg</span>
      </div>

      <div className="flex-1 min-w-4" />

      {/* ── Ride group ── */}
      <ScrubberGroup label="Ride">
        <CompactScrubber
          label="H" value={heave} min={-80} max={80} step={1} unit="mm"
          onChange={setHeave}
        />
        <CompactScrubber
          label="R" value={roll}  min={-8}  max={8}  step={0.1} unit="°"
          onChange={setRoll}
        />
        <CompactScrubber
          label="P" value={pitch} min={-8}  max={8}  step={0.1} unit="°"
          onChange={setPitch}
        />
      </ScrubberGroup>

      <div className="w-px h-5 bg-border mx-2 shrink-0" />

      {/* ── Steer group ── */}
      <ScrubberGroup label="Steer">
        <CompactScrubber
          label="δ" value={steerAngle} min={-30} max={30} step={0.5} unit="°"
          onChange={setSteerAngle}
        />
      </ScrubberGroup>

      <div className="flex-1 min-w-2" />

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className={cn('btn-ghost text-xs px-1.5', !canUndo && 'opacity-30 cursor-not-allowed')}
        >
          ↺
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className={cn('btn-ghost text-xs px-1.5', !canRedo && 'opacity-30 cursor-not-allowed')}
        >
          ↻
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={handleSave} className="btn-ghost text-2xs">
          ↓ Save
        </button>
        <ExportMenu />
      </div>
    </header>
  );
}

// ─── Scrubber group wrapper ───────────────────────────────────────────────────

function ScrubberGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className="text-2xs font-semibold text-muted-foreground/50 uppercase tracking-wider w-8 text-right shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Compact scrubber with numeric input ─────────────────────────────────────

interface CompactScrubberProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function CompactScrubber({ label, value, min, max, step, unit, onChange }: CompactScrubberProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = value !== 0;

  const decimals = step < 1 ? 1 : 0;
  const displayStr = value.toFixed(decimals);

  const startEdit = () => {
    setEditText(displayStr);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = useCallback(() => {
    const n = parseFloat(editText);
    if (!isNaN(n)) {
      onChange(Math.max(min, Math.min(max, n)));
    }
    setEditing(false);
  }, [editText, min, max, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const n = parseFloat(editText || displayStr);
      if (!isNaN(n)) setEditText(String(parseFloat((n + step).toFixed(decimals + 1))));
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = parseFloat(editText || displayStr);
      if (!isNaN(n)) setEditText(String(parseFloat((n - step).toFixed(decimals + 1))));
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Label */}
      <span className={cn(
        'text-2xs font-mono font-medium w-3 text-right shrink-0',
        isActive ? 'text-brand' : 'text-muted-foreground/60'
      )}>
        {label}
      </span>

      {/* Slider */}
      <div className="relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onDoubleClick={() => onChange(0)}
          className="w-14 h-1 accent-brand cursor-pointer"
          title={`${label}: ${displayStr}${unit} — double-click to reset`}
        />
      </div>

      {/* Numeric display / editor */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={editText}
          min={min}
          max={max}
          step={step}
          onChange={e => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-12 bg-surface-2 border border-brand rounded px-1 py-0 text-2xs font-mono text-center focus:outline-none tabular-nums"
        />
      ) : (
        <button
          onClick={startEdit}
          title="Click to type exact value · ↑↓ keys to step · double-click slider to reset"
          className={cn(
            'w-12 text-right text-2xs font-mono tabular-nums rounded px-0.5 transition-colors',
            'hover:bg-surface-2 hover:text-foreground',
            isActive ? 'text-foreground' : 'text-muted-foreground/60'
          )}
        >
          {value >= 0 && <span className="text-muted-foreground/40">+</span>}{displayStr}
          <span className="text-muted-foreground/40 ml-0.5">{unit}</span>
        </button>
      )}
    </div>
  );
}

// ─── Export menu ─────────────────────────────────────────────────────────────

function ExportMenu() {
  const { vehicle: v, metadata: m, simulationSettings: s } = useProjectStore();

  const exports = [
    { label: 'JSON (.lso.json)', action: () => downloadFile(exportJSON(v, m, s), `${m.name}.lso.json`, 'application/json') },
    { label: 'CSV Hardpoints',   action: () => downloadFile(exportHardpointsCSV(v), `${m.name}_hardpoints.csv`, 'text/csv') },
    { label: 'MATLAB (.m)',      action: () => downloadFile(exportMATLAB(v), `${m.name}.m`, 'text/plain') },
  ];

  return (
    <div className="relative group">
      <button className="btn-ghost text-2xs">↗ Export ▾</button>
      <div className="absolute right-0 top-full mt-1 w-44 bg-surface-2 border border-border rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {exports.map(ex => (
          <button
            key={ex.label}
            onClick={ex.action}
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-surface-3 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}
