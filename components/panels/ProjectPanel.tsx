'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { dbSave, dbLoad, dbList, dbDelete } from '@/lib/db';
import { defaultFSAEVehicle } from '@/engine/suspension/defaults/fsaeTemplate';
import { defaultBajaVehicle } from '@/engine/suspension/defaults/bajaTemplate';
import { nanoid } from '@/engine/suspension/nanoid';
import type { ProjectFile, ProjectMetadata, SimulationSettings } from '@/types/project';
import type { VehicleSpec } from '@/types/suspension';
import { cn } from '@/lib/utils';

const SERIES_TEMPLATES: Record<string, () => VehicleSpec> = {
  FSAE:   () => ({ ...defaultFSAEVehicle }),
  Baja:   () => ({ ...defaultBajaVehicle }),
  Custom: () => ({ ...defaultFSAEVehicle, name: 'Custom Vehicle', series: 'Custom' }),
};

const SERIES_OPTIONS = [
  { key: 'FSAE',   label: 'Formula SAE', color: 'text-brand' },
  { key: 'Baja',   label: 'Baja SAE',    color: 'text-[#fb923c]' },
  { key: 'Custom', label: 'Custom',      color: 'text-muted-foreground' },
];

export function ProjectPanel() {
  const { vehicle, metadata, simulationSettings, loadProject, markSaved, isDirty } = useProjectStore();
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState<'open' | 'new'>('open');
  const [selectedSeries, setSelectedSeries] = useState<string>('FSAE');

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await dbList());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const project: ProjectFile = {
        format: 'lotus-shark-online',
        formatVersion: '1.0',
        metadata: { ...metadata, modified: new Date().toISOString() },
        vehicle,
        simulationSettings,
      };
      await dbSave(project);
      markSaved();
      await refreshList();
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    const project = await dbLoad(id);
    if (!project) return;
    loadProject(project.vehicle, project.metadata, project.simulationSettings);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    await dbDelete(id);
    await refreshList();
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const template = (SERIES_TEMPLATES[selectedSeries] ?? SERIES_TEMPLATES.FSAE)();
    const now = new Date().toISOString();
    const meta: ProjectMetadata = {
      id: nanoid(),
      name: newName.trim(),
      description: '',
      author: '',
      organization: '',
      created: now,
      modified: now,
      version: '1.0.0',
      tags: [],
      series: selectedSeries,
    };
    const settings: SimulationSettings = {
      travelSteps: 41, travelMin: -50, travelMax: 50,
      steerSteps: 11, steerMin: -30, steerMax: 30,
      useNonlinearSolver: true, convergenceTol: 1e-6, maxIterations: 100,
    };
    template.name = newName.trim();
    template.series = selectedSeries as VehicleSpec['series'];
    loadProject(template, meta, settings);
    setNewName('');
    setTab('open');
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        <TabBtn active={tab === 'open'} onClick={() => setTab('open')}>Projects</TabBtn>
        <TabBtn active={tab === 'new'}  onClick={() => setTab('new')}>New</TabBtn>
      </div>

      {tab === 'open' && (
        <>
          {/* Current project save bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-1 shrink-0">
            <span className="text-muted-foreground truncate flex-1 font-mono">{metadata.name}</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-ghost text-2xs shrink-0"
            >
              {saving ? '…' : '↓ Save'}
            </button>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="text-muted-foreground text-center py-8 text-2xs">Loading…</div>
            )}
            {!loading && projects.length === 0 && (
              <div className="text-muted-foreground text-center py-8 px-4 text-2xs leading-relaxed">
                No saved projects yet.<br />Save the current project or create a new one.
              </div>
            )}
            {projects.map(p => (
              <ProjectRow
                key={p.metadata.id}
                project={p}
                isCurrent={p.metadata.id === metadata.id}
                onLoad={() => handleLoad(p.metadata.id)}
                onDelete={(e) => handleDelete(p.metadata.id, e)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'new' && (
        <div className="flex flex-col gap-3 p-3">
          <div>
            <label className="text-muted-foreground text-2xs block mb-1">Vehicle Series</label>
            <div className="grid grid-cols-3 gap-1">
              {SERIES_OPTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSeries(s.key)}
                  className={cn(
                    'py-1.5 px-2 rounded border text-2xs transition-colors',
                    selectedSeries === s.key
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-2xs block mb-1">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="e.g. MY25 Front Suspension"
              className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand"
            />
          </div>

          <SeriesInfo series={selectedSeries} />

          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className={cn(
              'w-full py-2 rounded text-xs font-medium transition-colors',
              newName.trim()
                ? 'bg-brand text-black hover:bg-brand/80'
                : 'bg-surface-2 text-muted-foreground cursor-not-allowed'
            )}
          >
            Create Project
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project, isCurrent, onLoad, onDelete,
}: {
  project: ProjectFile;
  isCurrent: boolean;
  onLoad: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const modDate = new Date(project.metadata.modified);
  const ago = formatAgo(modDate);
  const seriesColor: Record<string, string> = {
    FSAE: 'text-brand', Baja: 'text-[#fb923c]', Custom: 'text-muted-foreground',
  };

  return (
    <button
      onClick={onLoad}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors group',
        isCurrent && 'bg-brand/5 border-l-2 border-l-brand'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground text-xs truncate">{project.metadata.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('text-2xs font-mono', seriesColor[project.metadata.series] ?? 'text-muted-foreground')}>
              {project.metadata.series}
            </span>
            <span className="text-muted-foreground text-2xs">·</span>
            <span className="text-muted-foreground text-2xs">{ago}</span>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 text-xs transition-all px-1"
          title="Delete project"
        >
          ✕
        </button>
      </div>
    </button>
  );
}

function SeriesInfo({ series }: { series: string }) {
  const info: Record<string, { specs: string[]; color: string }> = {
    FSAE: {
      color: 'border-brand/30 bg-brand/5',
      specs: ['60" wheelbase · 48" track', '10" wheels · FSAE tires', 'DW/pushrod · RWD', '270kg total'],
    },
    Baja: {
      color: 'border-[#fb923c]/30 bg-[#fb923c]/5',
      specs: ['53" wheelbase · 54"/56" track', '12" wheels · 23×10.5 tires', 'DW/IRS · RWD CVT', '225kg total'],
    },
    Custom: {
      color: 'border-border bg-surface-2',
      specs: ['FSAE geometry base', 'Fully editable', 'All series rules off', 'Start from scratch'],
    },
  };
  const d = info[series] ?? info.Custom;
  return (
    <div className={cn('rounded border p-2.5', d.color)}>
      {d.specs.map(s => (
        <div key={s} className="text-2xs text-muted-foreground">· {s}</div>
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-1.5 text-xs transition-colors border-b-2',
        active
          ? 'text-foreground border-brand'
          : 'text-muted-foreground border-transparent hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30)   return `${d}d ago`;
  return date.toLocaleDateString();
}
