'use client';

import { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Stats, Environment } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { SuspensionGeometry } from './SuspensionGeometry';
import { CameraController } from './CameraController';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import type { VehicleSpec } from '@/types/suspension';
import type { Hardpoint } from '@/types/hardpoint';
import { cn } from '@/lib/utils';

interface Viewer3DProps {
  className?: string;
  showStats?: boolean;
}

export function Viewer3D({ className = '', showStats = false }: Viewer3DProps) {
  const { vehicle } = useProjectStore();
  const { heave, roll, pitch, steerAngle, showGround, viewerMode } = useUIStore();
  const orbitRef = useRef<OrbitControlsImpl>(null);

  // Global arrow-key hardpoint editing
  useHardpointKeyboard();

  return (
    <div className={`relative bg-surface-1 rounded-lg overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [-0.4, 1.4, 3.2], fov: 42, near: 0.005, far: 200 }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#0d0b09' }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.28} color="#e8d8c4" />
          <directionalLight
            position={[3, 6, 4]} intensity={1.4} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-camera-near={0.1} shadow-camera-far={20}
            shadow-camera-left={-3} shadow-camera-right={3}
            shadow-camera-top={3} shadow-camera-bottom={-3}
          />
          <directionalLight position={[-4, 2, -3]} intensity={0.30} color="#806040" />
          <pointLight position={[0.762, 1.5, 0]} intensity={0.5} color="#e8622a" distance={5} />
          <hemisphereLight args={['#201408', '#0d0b09', 0.45]} />

          <SuspensionGeometry
            vehicle={vehicle}
            heave={heave}
            roll={roll}
            pitch={pitch}
            steerAngle={steerAngle}
          />

          {showGround && (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.762, -0.001, 0]} receiveShadow>
                <planeGeometry args={[12, 8]} />
                <meshStandardMaterial color="#0b0e14" roughness={1} />
              </mesh>
              <Grid
                position={[0, 0, 0]}
                args={[12, 8]}
                cellSize={0.1} cellThickness={0.5} cellColor="#162030"
                sectionSize={0.5} sectionThickness={1.0} sectionColor="#1e3050"
                fadeDistance={10} fadeStrength={1.5} infiniteGrid
              />
            </>
          )}

          <ViewModeOverlay viewerMode={viewerMode} />
          <CameraController viewerMode={viewerMode} orbitRef={orbitRef} />

          <OrbitControls
            ref={orbitRef}
            target={[0.762, 0.25, 0]}
            enableDamping dampingFactor={0.06}
            minDistance={0.3} maxDistance={25}
            minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.15}
            zoomSpeed={0.8} panSpeed={0.8} rotateSpeed={0.6}
          />

          <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
            <GizmoViewport
              axisColors={['#ef4444', '#4ade80', '#60a5fa']}
              labelColor="white"
              hideNegativeAxes
            />
          </GizmoHelper>
        </Suspense>

        {showStats && <Stats />}
      </Canvas>

      <ViewerOverlay />
    </div>
  );
}

// ─── Arrow-key hardpoint editing ─────────────────────────────────────────────

function useHardpointKeyboard() {
  const { vehicle, updateHardpoint } = useProjectStore();
  const { selectedHardpointId, hardpointMoveStep, selectHardpoint } = useUIStore();

  // Keep latest mutable values in a ref — listener set up once, reads from ref
  const state = useRef({ selectedHardpointId, hardpointMoveStep, vehicle, updateHardpoint, selectHardpoint });
  useEffect(() => {
    state.current = { selectedHardpointId, hardpointMoveStep, vehicle, updateHardpoint, selectHardpoint };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { selectedHardpointId, hardpointMoveStep, vehicle, updateHardpoint, selectHardpoint } = state.current;

      // Escape deselects
      if (e.key === 'Escape') { selectHardpoint(null); return; }

      if (!selectedHardpointId) return;

      // Don't steal keys from form inputs
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;

      // Arrow key → axis/direction mapping
      // Plain arrows: Y (lateral) and Z (vertical) — the most common edits
      // Shift+arrows: X (longitudinal)
      let axis: 'x' | 'y' | 'z' | null = null;
      let sign = 0;

      if (e.shiftKey) {
        if (e.key === 'ArrowRight') { axis = 'x'; sign = +1; }
        else if (e.key === 'ArrowLeft')  { axis = 'x'; sign = -1; }
      } else {
        if      (e.key === 'ArrowLeft')  { axis = 'y'; sign = -1; }
        else if (e.key === 'ArrowRight') { axis = 'y'; sign = +1; }
        else if (e.key === 'ArrowUp')    { axis = 'z'; sign = +1; }
        else if (e.key === 'ArrowDown')  { axis = 'z'; sign = -1; }
      }

      if (!axis) return;
      e.preventDefault();
      e.stopPropagation();

      const hp = findHardpointById(vehicle, selectedHardpointId);
      if (!hp) return;

      const newValue = hp.position[axis] + sign * hardpointMoveStep;
      updateHardpoint(selectedHardpointId, axis, newValue);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Recursively find a Hardpoint by id inside VehicleSpec.allHardpoints. */
function findHardpointById(vehicle: VehicleSpec, id: string): Hardpoint | null {
  const search = (obj: unknown): Hardpoint | null => {
    if (typeof obj !== 'object' || obj === null) return null;
    const rec = obj as Record<string, unknown>;
    if ('id' in rec && rec.id === id && 'position' in rec) return rec as unknown as Hardpoint;
    for (const v of Object.values(rec)) {
      const found = search(v);
      if (found) return found;
    }
    return null;
  };
  return search(vehicle.allHardpoints);
}

// ─── View-mode overlay ────────────────────────────────────────────────────────

function ViewModeOverlay({ viewerMode }: { viewerMode: string }) {
  if (viewerMode === '3d') return null;
  return null;
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function ViewerOverlay() {
  const { vehicle } = useProjectStore();
  const {
    viewerMode, heave, roll, pitch, steerAngle,
    showArmLines, showInstantCenters, showRollCenter,
    showWheels, showContactPatches, showGround, showChassis,
    toggleVisibility,
    selectedHardpointId, selectHardpoint,
    hardpointMoveStep, setHardpointMoveStep,
  } = useUIStore();

  const viewLabels: Record<string, string> = {
    '3d': '3D Perspective', front: 'Front View (Y-Z)', side: 'Side View (X-Z)', top: 'Top View (X-Y)',
  };

  // Find the selected hardpoint for the edit HUD
  const selectedHP = selectedHardpointId
    ? findHardpointById(vehicle, selectedHardpointId)
    : null;

  return (
    <>
      {/* Top-left: vehicle name + view */}
      <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground bg-surface-2/80 backdrop-blur px-2 py-0.5 rounded">
          {vehicle.name}
        </span>
        <span className="text-xs font-mono text-brand/80 bg-surface-2/80 backdrop-blur px-2 py-0.5 rounded">
          {viewLabels[viewerMode]}
        </span>
      </div>

      {/* Top-right: live state readout */}
      <div className="absolute top-2.5 right-3 pointer-events-none">
        <div className="text-2xs font-mono text-muted-foreground bg-surface-2/80 backdrop-blur px-2 py-1 rounded space-y-0.5">
          <div>H: <span className="text-foreground">{heave.toFixed(0)}mm</span></div>
          <div>R: <span className="text-foreground">{roll.toFixed(1)}°</span></div>
          <div>P: <span className="text-foreground">{pitch.toFixed(1)}°</span></div>
          <div>δ: <span className="text-foreground">{steerAngle.toFixed(0)}°</span></div>
        </div>
      </div>

      {/* Bottom-left: overlay toggles */}
      <div className="absolute bottom-2.5 left-3 flex flex-col gap-1 items-start">
        <div className="flex items-center gap-1">
          <OverlayToggle label="Arms"   active={showArmLines}       onClick={() => toggleVisibility('showArmLines')}       title="Control arm lines"          color="#60a5fa" />
          <OverlayToggle label="IC"     active={showInstantCenters} onClick={() => toggleVisibility('showInstantCenters')} title="Instant centers"            color="#a78bfa" />
          <OverlayToggle label="RC"     active={showRollCenter}     onClick={() => toggleVisibility('showRollCenter')}     title="Roll center height"         color="#e8622a" />
          <OverlayToggle label="Wheels" active={showWheels}         onClick={() => toggleVisibility('showWheels')}         title="Tire and rim geometry"      color="#94a3b8" />
        </div>
        <div className="flex items-center gap-1">
          <OverlayToggle label="CP"     active={showContactPatches} onClick={() => toggleVisibility('showContactPatches')} title="Contact patch markers"      color="#fbbf24" />
          <OverlayToggle label="Chassis" active={showChassis}       onClick={() => toggleVisibility('showChassis')}        title="Chassis tube-frame"         color="#b88a5a" />
          <OverlayToggle label="Gnd"    active={showGround}         onClick={() => toggleVisibility('showGround')}         title="Ground plane"               color="#4ade80" />
        </div>
      </div>

      {/* Bottom-right: hardpoint edit HUD */}
      {selectedHP ? (
        <HardpointEditHUD
          hardpoint={selectedHP}
          step={hardpointMoveStep}
          onStepChange={setHardpointMoveStep}
          onClose={() => selectHardpoint(null)}
        />
      ) : (
        <div className="absolute bottom-2.5 right-3 pointer-events-none">
          <span className="text-2xs font-mono text-muted-foreground/50 bg-surface-2/60 backdrop-blur px-2 py-1 rounded">
            Click a point to edit
          </span>
        </div>
      )}
    </>
  );
}

// ─── Hardpoint edit HUD ───────────────────────────────────────────────────────

const STEP_OPTIONS = [0.1, 0.5, 1, 2, 5, 10] as const;

function HardpointEditHUD({
  hardpoint, step, onStepChange, onClose,
}: {
  hardpoint: Hardpoint;
  step: number;
  onStepChange: (v: number) => void;
  onClose: () => void;
}) {
  const { x, y, z } = hardpoint.position;

  return (
    <div className="absolute bottom-2.5 right-3 select-none" style={{ minWidth: 200 }}>
      <div className="bg-surface-1/92 backdrop-blur border border-border rounded-lg px-3 py-2.5 shadow-xl">

        {/* Header: label + close */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-xs font-medium text-foreground leading-tight">{hardpoint.label}</div>
            <div className="text-2xs text-muted-foreground capitalize">{hardpoint.component} · {hardpoint.side}</div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-none pt-0.5 shrink-0"
            title="Deselect (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Position readout */}
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          <CoordBadge axis="X" value={x} color="#ef4444" />
          <CoordBadge axis="Y" value={y} color="#4ade80" />
          <CoordBadge axis="Z" value={z} color="#60a5fa" />
        </div>

        {/* Step size selector */}
        <div className="mb-2.5">
          <div className="text-2xs text-muted-foreground mb-1">Step (mm)</div>
          <div className="flex gap-1 flex-wrap">
            {STEP_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => onStepChange(s)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-2xs font-mono transition-colors',
                  step === s
                    ? 'bg-brand/25 text-brand border border-brand/40'
                    : 'bg-surface-2 text-muted-foreground border border-border hover:text-foreground hover:border-border/80'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Key guide */}
        <div className="border-t border-border pt-2 space-y-0.5">
          <KeyGuideRow keys="← / →" action="Y axis (lateral)" />
          <KeyGuideRow keys="↑ / ↓" action="Z axis (vertical)" />
          <KeyGuideRow keys="⇧ + ← / →" action="X axis (longitudinal)" />
          <KeyGuideRow keys="Esc" action="Deselect" />
        </div>

      </div>
    </div>
  );
}

function CoordBadge({ axis, value, color }: { axis: string; value: number; color: string }) {
  return (
    <div className="bg-surface-2 rounded px-1.5 py-1 text-center">
      <div className="text-2xs font-bold mb-0.5" style={{ color }}>{axis}</div>
      <div className="text-2xs font-mono text-foreground leading-none">{value.toFixed(1)}</div>
    </div>
  );
}

function KeyGuideRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <kbd className="text-2xs font-mono bg-surface-2 border border-border rounded px-1 py-0.5 text-muted-foreground whitespace-nowrap">
        {keys}
      </kbd>
      <span className="text-2xs text-muted-foreground">{action}</span>
    </div>
  );
}

// ─── Overlay toggle button ────────────────────────────────────────────────────

function OverlayToggle({ label, active, onClick, title, color }: {
  label: string; active: boolean; onClick: () => void; title: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono transition-all"
      style={{
        background: active ? `${color}22` : 'rgba(15,23,42,0.7)',
        border: `1px solid ${active ? color + '66' : '#334155'}`,
        color: active ? color : '#64748b',
        backdropFilter: 'blur(4px)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? color : '#334155' }} />
      {label}
    </button>
  );
}
