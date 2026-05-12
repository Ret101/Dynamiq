'use client';

import { Fragment, useState, useCallback } from 'react';
import type { CornerHardpoints, Hardpoint } from '@/types/hardpoint';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { Tip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

// ─── Subsystem definitions ────────────────────────────────────────────────────

interface SubsystemDef {
  id: string;
  label: string;
  accentColor: string;
  icon: string;
  points: { key: keyof CornerHardpoints; label: string }[];
}

const SUBSYSTEMS: SubsystemDef[] = [
  {
    id: 'uca',
    label: 'Upper Control Arm',
    accentColor: '#60a5fa',
    icon: '⌒',
    points: [
      { key: 'ucaFrontChassis', label: 'Front Chassis' },
      { key: 'ucaChassisRear',  label: 'Rear Chassis' },
      { key: 'ucaUpright',      label: 'Upright Ball Joint' },
    ],
  },
  {
    id: 'lca',
    label: 'Lower Control Arm',
    accentColor: '#f472b6',
    icon: '⌣',
    points: [
      { key: 'lcaFrontChassis', label: 'Front Chassis' },
      { key: 'lcaChassisRear',  label: 'Rear Chassis' },
      { key: 'lcaUpright',      label: 'Upright Ball Joint' },
    ],
  },
  {
    id: 'steering',
    label: 'Steering / Tie Rod',
    accentColor: '#a78bfa',
    icon: '↔',
    points: [
      { key: 'tieRodChassis',  label: 'Inner (Rack)' },
      { key: 'tieRodUpright',  label: 'Outer (Upright)' },
    ],
  },
  {
    id: 'damper',
    label: 'Damper',
    accentColor: '#facc15',
    icon: '↕',
    points: [
      { key: 'shockChassis',  label: 'Chassis Mount' },
      { key: 'shockUpright',  label: 'Upright Mount' },
    ],
  },
  {
    id: 'wheel',
    label: 'Wheel Assembly',
    accentColor: '#94a3b8',
    icon: '○',
    points: [
      { key: 'wheelCenter',  label: 'Wheel Center' },
      { key: 'contactPatch', label: 'Contact Patch' },
    ],
  },
];

type CornerKey = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';
const CORNERS: { key: CornerKey; label: string; short: string }[] = [
  { key: 'frontLeft',  label: 'Front Left',  short: 'FL' },
  { key: 'frontRight', label: 'Front Right', short: 'FR' },
  { key: 'rearLeft',   label: 'Rear Left',   short: 'RL' },
  { key: 'rearRight',  label: 'Rear Right',  short: 'RR' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function HardpointEditor() {
  const { vehicle, updateHardpoint } = useProjectStore();
  const { selectedHardpointId, selectHardpoint } = useUIStore();
  const [activeCorner, setActiveCorner] = useState<CornerKey>('frontLeft');
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(
    new Set(['uca', 'lca', 'steering', 'damper', 'wheel'])
  );
  const [search, setSearch] = useState('');

  const toggleSub = (id: string) =>
    setExpandedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allHardpoints = vehicle.allHardpoints as unknown as Record<CornerKey, CornerHardpoints>;
  const cornerHPs = allHardpoints[activeCorner];

  const filteredSubs = search
    ? SUBSYSTEMS.map(s => ({
        ...s,
        points: s.points.filter(p =>
          p.label.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.points.length > 0)
    : SUBSYSTEMS;

  const handleUpdate = useCallback(
    (id: string, axis: 'x' | 'y' | 'z', value: number) =>
      updateHardpoint(id, axis, value),
    [updateHardpoint]
  );

  return (
    <div className="flex flex-col h-full text-xs">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0 bg-surface-1">
        <span className="text-2xs text-muted-foreground/50 uppercase tracking-wider mr-1">View</span>
        {(['tree', 'table'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'px-2.5 py-1 rounded text-2xs font-medium transition-colors capitalize',
              viewMode === mode
                ? 'bg-brand/15 text-brand border border-brand/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-3 border border-transparent'
            )}
          >
            {mode === 'tree' ? '⊞ Tree' : '⊡ Table'}
          </button>
        ))}
      </div>

      {/* Corner tabs */}
      <div className="flex border-b border-border shrink-0">
        {CORNERS.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveCorner(c.key)}
            title={c.label}
            className={cn(
              'flex-1 py-1.5 text-xs font-mono font-medium transition-colors border-b-2',
              activeCorner === c.key
                ? 'text-brand border-brand bg-brand/5'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-surface-2'
            )}
          >
            {c.short}
          </button>
        ))}
      </div>

      {/* Tree: search bar */}
      {viewMode === 'tree' && (
        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <input
            type="text"
            placeholder="Search hardpoints…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs placeholder-muted-foreground focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      )}

      {/* Content */}
      {viewMode === 'tree' ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredSubs.map(sub => (
            <SubsystemGroup
              key={sub.id}
              sub={sub}
              corner={cornerHPs}
              expanded={expandedSubs.has(sub.id)}
              onToggle={() => toggleSub(sub.id)}
              selectedId={selectedHardpointId}
              onSelect={selectHardpoint}
              onUpdate={handleUpdate}
            />
          ))}
          <VehicleSection vehicle={vehicle} onSelect={selectHardpoint} selectedId={selectedHardpointId} />
        </div>
      ) : (
        <HardpointTable
          cornerHPs={cornerHPs}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function HardpointTable({
  cornerHPs,
  onUpdate,
}: {
  cornerHPs: CornerHardpoints;
  onUpdate: (id: string, axis: 'x' | 'y' | 'z', value: number) => void;
}) {
  const [editCell, setEditCell] = useState<{ id: string; axis: 'x' | 'y' | 'z' } | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (hp: Hardpoint, axis: 'x' | 'y' | 'z') => {
    if (!hp.editable) return;
    setEditCell({ id: hp.id, axis });
    setEditVal(hp.position[axis].toFixed(2));
  };

  const commit = useCallback(() => {
    if (!editCell) return;
    const n = parseFloat(editVal);
    if (!isNaN(n)) onUpdate(editCell.id, editCell.axis, n);
    setEditCell(null);
  }, [editCell, editVal, onUpdate]);

  const cancel = () => setEditCell(null);

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full border-collapse text-xs">
        {/* Sticky header */}
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-2 border-b-2 border-border">
            <th className="text-left px-3 py-2 text-muted-foreground font-medium text-2xs uppercase tracking-wider">
              Point
            </th>
            <th className="text-right px-2 py-2 font-mono text-2xs w-[68px] text-red-400">
              <span className="flex items-center justify-end gap-0.5">
                X
                <Tip body="X axis — longitudinal (fore/aft). Positive = forward. Origin at front axle centerline." title="X — Longitudinal" range="0mm = front axle, 1524mm = rear axle (FSAE)" />
                <span className="text-muted-foreground/50 font-normal">mm</span>
              </span>
            </th>
            <th className="text-right px-2 py-2 font-mono text-2xs w-[68px] text-green-400">
              <span className="flex items-center justify-end gap-0.5">
                Y
                <Tip body="Y axis — lateral (left/right). Positive = left side (driver's right in SAE convention). Origin at vehicle centerline." title="Y — Lateral" range="0mm = centerline, ±609mm = FSAE track half" />
                <span className="text-muted-foreground/50 font-normal">mm</span>
              </span>
            </th>
            <th className="text-right px-2 py-2 font-mono text-2xs w-[68px] text-blue-400">
              <span className="flex items-center justify-end gap-0.5">
                Z
                <Tip body="Z axis — vertical (up/down). Positive = up. Origin at ground plane (bottom of tire at design ride height)." title="Z — Vertical" range="0mm = ground, 254mm = wheel center (FSAE), 292mm (Baja)" />
                <span className="text-muted-foreground/50 font-normal">mm</span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          {SUBSYSTEMS.map(sub => {
            const pts = sub.points
              .map(p => ({
                def: p,
                hp: (cornerHPs as unknown as Record<string, Hardpoint>)[p.key as string],
              }))
              .filter(p => p.hp);

            if (pts.length === 0) return null;

            return (
              <Fragment key={sub.id}>
                {/* Subsystem header row */}
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-1 bg-surface-1/90 border-y border-border/40"
                  >
                    <span
                      className="text-2xs font-semibold uppercase tracking-wider"
                      style={{ color: sub.accentColor }}
                    >
                      {sub.icon}&nbsp;&nbsp;{sub.label}
                    </span>
                  </td>
                </tr>

                {/* Hardpoint rows */}
                {pts.map(({ def, hp }) => (
                  <tr
                    key={hp.id}
                    className="border-b border-border/20 hover:bg-surface-2/50 group"
                  >
                    {/* Point label */}
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.accentColor }}
                        />
                        <span className="text-foreground/90 truncate">{def.label}</span>
                        {!hp.editable && (
                          <span className="text-2xs text-yellow-500/60 ml-1">lock</span>
                        )}
                      </div>
                    </td>

                    {/* X / Y / Z cells */}
                    {(['x', 'y', 'z'] as const).map(axis => {
                      const isEditing = editCell?.id === hp.id && editCell?.axis === axis;
                      const axisColor =
                        axis === 'x' ? 'text-red-400'
                        : axis === 'y' ? 'text-green-400'
                        : 'text-blue-400';

                      return (
                        <td key={axis} className="px-1 py-0.5 w-[68px]">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.1"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onBlur={commit}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  e.preventDefault();
                                  commit();
                                }
                                if (e.key === 'Escape') cancel();
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setEditVal(v => String(parseFloat(v || '0') + 1));
                                }
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setEditVal(v => String(parseFloat(v || '0') - 1));
                                }
                              }}
                              className="w-full bg-surface-0 border border-brand rounded px-1.5 py-0.5 text-xs font-mono text-right focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(hp, axis)}
                              disabled={!hp.editable}
                              title={hp.editable ? 'Click to edit · ↑↓ step · Enter commit · Esc cancel' : 'Locked'}
                              className={cn(
                                'w-full text-right px-1.5 py-0.5 rounded font-mono text-xs tabular-nums transition-colors',
                                hp.editable
                                  ? `${axisColor} hover:bg-surface-3 cursor-text`
                                  : 'text-muted-foreground/30 cursor-default'
                              )}
                            >
                              {hp.position[axis].toFixed(1)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Footer hint */}
      <div className="px-3 py-2 text-2xs text-muted-foreground/50 border-t border-border/30">
        Click any value to edit · ↑↓ step 1 mm · Enter / Tab commit · Esc cancel
      </div>
    </div>
  );
}

// ─── Tree: Subsystem group ────────────────────────────────────────────────────

interface SubsystemGroupProps {
  sub: SubsystemDef;
  corner: CornerHardpoints;
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, axis: 'x' | 'y' | 'z', value: number) => void;
}

function SubsystemGroup({ sub, corner, expanded, onToggle, selectedId, onSelect, onUpdate }: SubsystemGroupProps) {
  const pts = sub.points
    .map(p => ({
      def: p,
      hp: (corner as unknown as Record<string, Hardpoint>)[p.key as string],
    }))
    .filter(p => p.hp);

  if (pts.length === 0) return null;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-surface-2 transition-colors text-left group"
        style={{ borderLeft: `2px solid ${sub.accentColor}22` }}
      >
        <span className="text-muted-foreground text-2xs w-3 shrink-0">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="text-2xs" style={{ color: sub.accentColor }}>{sub.icon}</span>
        <span className="text-xs font-medium text-foreground">{sub.label}</span>
        <span className="ml-auto text-2xs text-muted-foreground">{pts.length}</span>
      </button>

      {expanded && pts.map(({ def, hp }) => (
        <HardpointRow
          key={hp.id}
          hp={hp}
          label={def.label}
          accentColor={sub.accentColor}
          selected={selectedId === hp.id}
          onSelect={() => onSelect(selectedId === hp.id ? null : hp.id)}
          onUpdate={(axis, value) => onUpdate(hp.id, axis, value)}
        />
      ))}
    </div>
  );
}

// ─── Tree: individual hardpoint row ──────────────────────────────────────────

interface HardpointRowProps {
  hp: Hardpoint;
  label: string;
  accentColor: string;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (axis: 'x' | 'y' | 'z', value: number) => void;
}

function HardpointRow({ hp, label, accentColor, selected, onSelect, onUpdate }: HardpointRowProps) {
  const [editing, setEditing] = useState<'x' | 'y' | 'z' | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (axis: 'x' | 'y' | 'z') => {
    if (!hp.editable) return;
    setEditing(axis);
    setEditVal(hp.position[axis].toFixed(2));
  };

  const commit = useCallback(() => {
    if (!editing) return;
    const n = parseFloat(editVal);
    if (!isNaN(n)) onUpdate(editing, n);
    setEditing(null);
  }, [editing, editVal, onUpdate]);

  return (
    <div
      className={cn(
        'border-b border-border/30 cursor-pointer transition-colors',
        selected ? 'bg-brand/8' : 'hover:bg-surface-2'
      )}
      style={{ borderLeft: selected ? `2px solid ${accentColor}` : `2px solid transparent` }}
      onClick={onSelect}
    >
      {/* Point name + compact xyz */}
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <span className="text-xs text-foreground flex-1 truncate">{label}</span>
        <div className="flex gap-2 font-mono text-2xs text-muted-foreground">
          <span className="text-red-400/70">{hp.position.x.toFixed(0)}</span>
          <span className="text-green-400/70">{hp.position.y.toFixed(0)}</span>
          <span className="text-blue-400/70">{hp.position.z.toFixed(0)}</span>
        </div>
      </div>

      {/* Expanded edit row */}
      {selected && (
        <div className="px-3 pb-2.5">
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {(['x', 'y', 'z'] as const).map(axis => (
              <CoordField
                key={axis}
                axis={axis}
                value={hp.position[axis]}
                editing={editing === axis}
                editVal={editVal}
                disabled={!hp.editable}
                onStartEdit={() => startEdit(axis)}
                onChange={setEditVal}
                onCommit={commit}
                onCancel={() => setEditing(null)}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-2xs text-muted-foreground/60">
            <span>{hp.component}</span>
            <span>·</span>
            <span>{hp.units}</span>
            {!hp.editable && <span className="text-yellow-500/70 ml-1">locked</span>}
            {hp.symmetry && <span className="ml-auto">⇔ mirrored</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Coordinate input field ───────────────────────────────────────────────────

interface CoordFieldProps {
  axis: 'x' | 'y' | 'z';
  value: number;
  editing: boolean;
  editVal: string;
  disabled: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function CoordField({ axis, value, editing, editVal, disabled, onStartEdit, onChange, onCommit, onCancel }: CoordFieldProps) {
  const axisColor = { x: 'text-red-400', y: 'text-green-400', z: 'text-blue-400' }[axis];

  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-2xs font-mono font-bold', axisColor)}>{axis.toUpperCase()}</span>
      {editing ? (
        <input
          autoFocus
          type="number"
          step="0.1"
          value={editVal}
          onChange={e => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') onCancel();
            if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(String(parseFloat(editVal || '0') + 1)); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange(String(parseFloat(editVal || '0') - 1)); }
          }}
          className="w-full bg-surface-1 border border-brand rounded px-1 py-0.5 text-xs font-mono focus:outline-none"
        />
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onStartEdit(); }}
          disabled={disabled}
          className={cn(
            'w-full text-left px-1.5 py-0.5 rounded text-xs font-mono transition-colors',
            'bg-surface-2 border border-border',
            disabled
              ? 'text-muted-foreground/50 cursor-default'
              : 'text-foreground hover:border-brand/40 cursor-text'
          )}
        >
          {value.toFixed(1)}
        </button>
      )}
    </div>
  );
}

// ─── Vehicle-level section ────────────────────────────────────────────────────

function VehicleSection({ vehicle, onSelect, selectedId }: {
  vehicle: { allHardpoints: unknown };
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}) {
  const hp = vehicle.allHardpoints as Record<string, Hardpoint | undefined>;
  const pts = [hp.cg, hp.frontRackLeft, hp.frontRackRight].filter(Boolean) as Hardpoint[];

  if (pts.length === 0) return null;

  return (
    <div>
      <div className="px-2 py-1.5 flex items-center gap-2" style={{ borderLeft: '2px solid #ef444420' }}>
        <span className="text-2xs text-muted-foreground">▾</span>
        <span className="text-2xs" style={{ color: '#ef4444' }}>⊕</span>
        <span className="text-xs font-medium text-foreground">Vehicle</span>
        <span className="ml-auto text-2xs text-muted-foreground">{pts.length}</span>
      </div>
      {pts.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(selectedId === p.id ? null : p.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-1 border-b border-border/30 cursor-pointer hover:bg-surface-2 text-xs',
            selectedId === p.id && 'bg-brand/8'
          )}
          style={{ borderLeft: selectedId === p.id ? '2px solid #ef4444' : '2px solid transparent' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400/70 shrink-0" />
          <span className="text-foreground flex-1">{p.label}</span>
          <span className="font-mono text-2xs text-muted-foreground">
            {p.position.x.toFixed(0)}, {p.position.y.toFixed(0)}, {p.position.z.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}
