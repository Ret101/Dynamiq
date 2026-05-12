'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { VehicleSpec } from '@/types/suspension';
import type { CornerHardpoints } from '@/types/hardpoint';
import type { CornerKinematics } from '@/types/kinematics';
import { useUIStore } from '@/store/uiStore';
import { ChassisWireframe } from './ChassisWireframe';
import { VehicleKinematicSolver } from '@/engine/kinematics/vehicleKinematics';

const MM = 0.001; // render in meters

interface SuspensionGeometryProps {
  vehicle: VehicleSpec;
  heave?: number;
  roll?: number;
  pitch?: number;
  steerAngle?: number;
}

export function SuspensionGeometry({ vehicle, heave = 0, roll = 0, pitch = 0, steerAngle = 0 }: SuspensionGeometryProps) {
  const { showArmLines, showInstantCenters, showRollCenter, showWheels, showGround, showContactPatches, showChassis } = useUIStore();
  const { allHardpoints } = vehicle;

  // Solver — stable reference unless vehicle changes
  const solver = useMemo(() => new VehicleKinematicSolver(vehicle), [vehicle]);

  // Run kinematics at current chassis state
  const kin = useMemo(() => {
    try { return solver.solve(heave, roll, pitch, steerAngle); }
    catch { return null; }
  }, [solver, heave, roll, pitch, steerAngle]);

  // Build solved hardpoint sets — chassis-fixed points stay static, upright-attached points move
  const hpFL = useMemo(() => applyKin(allHardpoints.frontLeft,  kin?.frontLeft  ?? null), [allHardpoints.frontLeft,  kin?.frontLeft]);
  const hpFR = useMemo(() => applyKin(allHardpoints.frontRight, kin?.frontRight ?? null), [allHardpoints.frontRight, kin?.frontRight]);
  const hpRL = useMemo(() => applyKin(allHardpoints.rearLeft,   kin?.rearLeft   ?? null), [allHardpoints.rearLeft,   kin?.rearLeft]);
  const hpRR = useMemo(() => applyKin(allHardpoints.rearRight,  kin?.rearRight  ?? null), [allHardpoints.rearRight,  kin?.rearRight]);

  // Instant centers from solved kinematics
  const icFL: IC2D | null = kin ? { y: kin.frontLeft.instantCenter.y,  z: kin.frontLeft.instantCenter.z  } : null;
  const icFR: IC2D | null = kin ? { y: kin.frontRight.instantCenter.y, z: kin.frontRight.instantCenter.z } : null;
  const icRL: IC2D | null = kin ? { y: kin.rearLeft.instantCenter.y,   z: kin.rearLeft.instantCenter.z   } : null;
  const icRR: IC2D | null = kin ? { y: kin.rearRight.instantCenter.y,  z: kin.rearRight.instantCenter.z  } : null;

  // Roll centers from solved kinematics
  const frontRC: IC2D | null = kin ? { y: kin.frontLeft.rollCenter.y, z: kin.frontLeft.rollCenterHeight } : null;
  const rearRC:  IC2D | null = kin ? { y: kin.rearLeft.rollCenter.y,  z: kin.rearLeft.rollCenterHeight  } : null;

  return (
    <group>
      {showGround && <GroundPlane />}

      <CornerGeometry
        hardpoints={hpFL}
        color="#60a5fa"
        showWheels={showWheels}
        showContactPatches={showContactPatches}
        showArmLines={showArmLines}
        wheelRadius={vehicle.frontTire.unloadedRadius * MM}
        ic={icFL}
        showIC={showInstantCenters}
      />
      <CornerGeometry
        hardpoints={hpFR}
        color="#f472b6"
        showWheels={showWheels}
        showContactPatches={showContactPatches}
        showArmLines={showArmLines}
        wheelRadius={vehicle.frontTire.unloadedRadius * MM}
        ic={icFR}
        showIC={showInstantCenters}
      />
      <CornerGeometry
        hardpoints={hpRL}
        color="#34d399"
        showWheels={showWheels}
        showContactPatches={showContactPatches}
        showArmLines={showArmLines}
        wheelRadius={vehicle.rearTire.unloadedRadius * MM}
        ic={icRL}
        showIC={showInstantCenters}
      />
      <CornerGeometry
        hardpoints={hpRR}
        color="#fb923c"
        showWheels={showWheels}
        showContactPatches={showContactPatches}
        showArmLines={showArmLines}
        wheelRadius={vehicle.rearTire.unloadedRadius * MM}
        ic={icRR}
        showIC={showInstantCenters}
      />

      {/* Roll center rings */}
      {showRollCenter && frontRC && (
        <RollCenterMarker rcY={frontRC.y} rcZ={frontRC.z} xPos={hpFL.wheelCenter.position.x * MM} color="#e8622a" />
      )}
      {showRollCenter && rearRC && (
        <RollCenterMarker rcY={rearRC.y} rcZ={rearRC.z} xPos={hpRL.wheelCenter.position.x * MM} color="#e8622a" />
      )}

      {/* Swing arm lines: connect front and rear roll centers */}
      {showRollCenter && frontRC && rearRC && (
        <SwingAxisLine frontRC={frontRC} rearRC={rearRC}
          frontX={hpFL.wheelCenter.position.x * MM}
          rearX={hpRL.wheelCenter.position.x * MM}
        />
      )}

      {showChassis && (
        <ChassisWireframe
          wheelbase={vehicle.wheelbase}
          frontTrack={vehicle.frontTrack}
          rearTrack={vehicle.rearTrack}
          series={vehicle.series}
          rideHeight={vehicle.frontSuspension.rideHeight}
        />
      )}
    </group>
  );
}

// Apply solved kinematic positions to a corner's hardpoints.
// Chassis-fixed points remain static; upright-attached points are replaced.
function applyKin(hp: CornerHardpoints, kin: CornerKinematics | null): CornerHardpoints {
  if (!kin?.movedPositions) return hp;
  const mp = kin.movedPositions;
  return {
    ...hp,
    ucaUpright:    { ...hp.ucaUpright,    position: mp.ucaBallJoint },
    lcaUpright:    { ...hp.lcaUpright,    position: mp.lcaBallJoint },
    tieRodUpright: { ...hp.tieRodUpright, position: mp.tieRodUprightEnd },
    shockUpright:  { ...hp.shockUpright,  position: mp.shockUprightMount },
    wheelCenter:   { ...hp.wheelCenter,   position: kin.wheelCenter },
    contactPatch:  { ...hp.contactPatch,  position: kin.contactPatch },
  };
}

// ─── Instant center type (front-view 2D, SAE Y-Z coords, mm) ─────────────────

interface IC2D { y: number; z: number }

// ─── Corner renderer ──────────────────────────────────────────────────────────

interface CornerGeometryProps {
  hardpoints: CornerHardpoints;
  color: string;
  showWheels: boolean;
  showContactPatches: boolean;
  showArmLines: boolean;
  wheelRadius: number;
  ic: IC2D | null;
  showIC: boolean;
}

function CornerGeometry({ hardpoints: hp, color, showWheels, showContactPatches, showArmLines, wheelRadius, ic, showIC }: CornerGeometryProps) {
  const { selectedHardpointId, selectHardpoint, hoverHardpoint } = useUIStore();

  const allPoints = [
    hp.ucaFrontChassis, hp.ucaChassisRear, hp.ucaUpright,
    hp.lcaFrontChassis, hp.lcaChassisRear, hp.lcaUpright,
    hp.tieRodChassis,   hp.tieRodUpright,
    hp.shockChassis,    hp.shockUpright,
    hp.wheelCenter,
  ];

  // X position of wheel center (same for IC markers in this corner)
  const wcX = hp.wheelCenter.position.x * MM;

  return (
    <group>
      {/* Hardpoint spheres */}
      {allPoints.map((pt) => {
        const pos = sv(pt.position);
        const isSelected = selectedHardpointId === pt.id;
        return (
          <mesh
            key={pt.id}
            position={[pos.x, pos.z, -pos.y]}
            onClick={() => selectHardpoint(isSelected ? null : pt.id)}
            onPointerOver={() => hoverHardpoint(pt.id)}
            onPointerOut={() => hoverHardpoint(null)}
          >
            <sphereGeometry args={[isSelected ? 0.012 : 0.008, 16, 12]} />
            <meshStandardMaterial
              color={isSelected ? '#ffffff' : getComponentColor(pt.component)}
              emissive={isSelected ? getComponentColor(pt.component) : '#000000'}
              emissiveIntensity={isSelected ? 0.5 : 0}
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
        );
      })}

      {/* Control arm lines */}
      {showArmLines && (
        <>
          <ArmLine from={sv(hp.ucaFrontChassis.position)} to={sv(hp.ucaUpright.position)} color="#60a5fa" radius={0.004} />
          <ArmLine from={sv(hp.ucaChassisRear.position)}  to={sv(hp.ucaUpright.position)} color="#60a5fa" radius={0.004} />
          <ArmLine from={sv(hp.lcaFrontChassis.position)} to={sv(hp.lcaUpright.position)} color="#f472b6" radius={0.004} />
          <ArmLine from={sv(hp.lcaChassisRear.position)}  to={sv(hp.lcaUpright.position)} color="#f472b6" radius={0.004} />
          <ArmLine from={sv(hp.ucaUpright.position)} to={sv(hp.lcaUpright.position)} color="#fb923c" radius={0.006} />
          <ArmLine from={sv(hp.tieRodChassis.position)} to={sv(hp.tieRodUpright.position)} color="#a78bfa" radius={0.003} />
          <ArmLine from={sv(hp.shockChassis.position)} to={sv(hp.shockUpright.position)} color="#facc15" radius={0.005} />
        </>
      )}

      {/* Wheel */}
      {showWheels && (
        <Wheel center={sv(hp.wheelCenter.position)} radius={wheelRadius} color={color} />
      )}

      {/* Contact patch */}
      {showContactPatches && (
        <ContactPatchMarker position={sv(hp.contactPatch.position)} />
      )}

      {/* Instant center + swing arm */}
      {showIC && ic && (
        <InstantCenterOverlay
          ic={ic}
          wcX={wcX}
          contactPatch={sv(hp.contactPatch.position)}
          color={color}
        />
      )}
    </group>
  );
}

// ─── Instant center overlay ───────────────────────────────────────────────────

function InstantCenterOverlay({
  ic, wcX, contactPatch, color,
}: {
  ic: IC2D;
  wcX: number;
  contactPatch: { x: number; y: number; z: number };
  color: string;
}) {
  // Clamp IC rendering to ±4m from vehicle center to keep it visible
  const icYm = Math.max(-4, Math.min(4, ic.y * MM));
  const icZm = Math.max(-0.1, ic.z * MM);

  // Three.js: [x, z_up, -y_sae]
  const icPos: [number, number, number] = [wcX, icZm, -icYm];

  // Swing arm: line from contact patch through IC, extended outward
  const cpPos: [number, number, number] = [contactPatch.x, contactPatch.z, -contactPatch.y];

  // Direction from IC toward outside (away from centerline)
  const dir = new THREE.Vector3(
    cpPos[0] - icPos[0],
    cpPos[1] - icPos[1],
    cpPos[2] - icPos[2],
  ).normalize();

  // Extend 0.5m beyond contact patch outward
  const swingEnd: [number, number, number] = [
    cpPos[0] + dir.x * 0.5,
    cpPos[1] + dir.y * 0.5,
    cpPos[2] + dir.z * 0.5,
  ];

  return (
    <>
      {/* IC crosshair ring + lines — all in local space of the group */}
      <group position={icPos}>
        <mesh>
          <torusGeometry args={[0.025, 0.003, 8, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
        {/* Crosshair lines in local space (origin = IC position) */}
        <DashedLine from={[0, -0.05, 0]} to={[0,  0.05, 0]} color={color} />
        <DashedLine from={[0,  0,   -0.05]} to={[0,  0,  0.05]} color={color} />
      </group>

      {/* Swing arm: thin line from IC to beyond contact patch */}
      <ThinLine from={icPos} to={swingEnd} color={color} opacity={0.5} />
    </>
  );
}

// ─── Roll center marker ───────────────────────────────────────────────────────

function RollCenterMarker({ rcY, rcZ, xPos, color }: { rcY: number; rcZ: number; xPos: number; color: string }) {
  const rcYm = Math.max(-4, Math.min(4, rcY * MM));
  const rcZm = Math.max(-0.02, rcZ * MM);
  return (
    <group position={[xPos, rcZm, -rcYm]}>
      {/* Diamond ring */}
      <mesh>
        <torusGeometry args={[0.04, 0.005, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.01, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Roll center axis line (connects front and rear roll centers at vehicle centerline)
function SwingAxisLine({ frontRC, rearRC, frontX, rearX }: {
  frontRC: IC2D; rearRC: IC2D; frontX: number; rearX: number;
}) {
  const from: [number, number, number] = [frontX, Math.max(-0.02, frontRC.z * MM), -(Math.max(-4, Math.min(4, frontRC.y * MM)))];
  const to:   [number, number, number] = [rearX,  Math.max(-0.02, rearRC.z  * MM), -(Math.max(-4, Math.min(4, rearRC.y  * MM)))];
  return <ThinLine from={from} to={to} color="#e8622a" opacity={0.35} />;
}

// ─── Arm line (cylinder) ──────────────────────────────────────────────────────

interface ArmLineProps { from: Vec3; to: Vec3; color: string; radius: number; }

function ArmLine({ from, to, color, radius }: ArmLineProps) {
  const { position, quaternion, length } = useMemo(() => {
    const pFrom = new THREE.Vector3(from.x, from.z, -from.y);
    const pTo   = new THREE.Vector3(to.x,   to.z,   -to.y);
    const dir   = pTo.clone().sub(pFrom);
    const len   = dir.length();
    const mid   = pFrom.clone().add(pTo).multiplyScalar(0.5);
    const quat  = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: mid, quaternion: quat, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
    </mesh>
  );
}

// ─── Thin line (LineSegments) ─────────────────────────────────────────────────

function ThinLine({ from, to, color, opacity = 1 }: {
  from: [number, number, number]; to: [number, number, number]; color: string; opacity?: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
    return g;
  }, [from, to]);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    [color, opacity],
  );
  return <primitive object={new THREE.Line(geo, mat)} />;
}

// Small cross hair lines (no cylinder, just thin lines)
function DashedLine({ from, to, color }: {
  from: [number, number, number]; to: [number, number, number]; color: string;
}) {
  return <ThinLine from={from} to={to} color={color} opacity={0.7} />;
}

// ─── Wheel torus ──────────────────────────────────────────────────────────────

function Wheel({ center, radius, color }: { center: Vec3; radius: number; color: string }) {
  const tireWidth = radius * 0.22;
  const rimRadius = radius * 0.62;
  const rimWidth  = radius * 0.38;

  return (
    <group position={[center.x, center.z, -center.y]}>
      <mesh>
        <torusGeometry args={[radius, tireWidth, 24, 48]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.95} metalness={0} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[rimRadius, rimRadius, rimWidth, 32, 1, false]} />
        <meshStandardMaterial color={color} roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[rimRadius * 0.22, rimRadius * 0.22, rimWidth + 0.004, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Contact patch marker ─────────────────────────────────────────────────────

function ContactPatchMarker({ position }: { position: Vec3 }) {
  return (
    <mesh position={[position.x, 0.001, -position.y]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.04, 0.07, 24]} />
      <meshBasicMaterial color="#e8622a" transparent opacity={0.6} />
    </mesh>
  );
}

// ─── Ground plane ─────────────────────────────────────────────────────────────

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <planeGeometry args={[10, 6]} />
      <meshStandardMaterial color="#0d1117" roughness={1} />
    </mesh>
  );
}


// ─── Utilities ────────────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }

function sv(v: { x: number; y: number; z: number }): Vec3 {
  return { x: v.x * MM, y: v.y * MM, z: v.z * MM };
}

function getComponentColor(component: string): string {
  const colors: Record<string, string> = {
    chassis: '#4ade80',
    uca: '#60a5fa',
    lca: '#f472b6',
    upright: '#fb923c',
    tierod: '#a78bfa',
    rack: '#a78bfa',
    shock: '#facc15',
    rocker: '#34d399',
    pushrod: '#34d399',
    pullrod: '#34d399',
    arb: '#6ee7b7',
    wheel: '#94a3b8',
    contact: '#e8622a',
    cg: '#ef4444',
    bellcrank: '#34d399',
    droplink: '#6ee7b7',
  };
  return colors[component] ?? '#94a3b8';
}
