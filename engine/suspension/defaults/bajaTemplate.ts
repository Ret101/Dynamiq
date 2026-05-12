/**
 * Default Baja SAE suspension template.
 * All coordinates in mm, SAE J670 (X=forward, Y=left, Z=up).
 * Origin at front axle centerline, vehicle centerline, ground plane.
 *
 * Baja SAE geometry rationale:
 *   Ride height 305mm (12") — the chassis BELLY sits 305mm above the ground.
 *   Wheel radius 292mm (~23" tire) — wheel center is at Z=292mm.
 *   LCA inboard pivots AT the belly rail (Z=305), Y=270–280mm from CL.
 *   LCA outboard (lower ball joint) drops to Z=200 — arm angles DOWN ~15°.
 *   UCA inboard on upper frame node (Z=490), arms slope down to UBJ at Z=385.
 *   Direct coilover: bottom mounts on LCA mid-outboard area, top on chassis apex.
 *   NO pushrod/pullrod — shock mounts directly.
 */

import type { VehicleSpec } from '@/types/suspension';
import type { Hardpoint } from '@/types/hardpoint';
import { nanoid } from '@/engine/suspension/nanoid';

function hp(
  label: string,
  x: number, y: number, z: number,
  component: Hardpoint['component'],
  side: Hardpoint['side'] = 'left'
): Hardpoint {
  return {
    id: nanoid(),
    label,
    position: { x, y, z },
    component,
    side,
    constraints: [],
    symmetry: side === 'left',
    editable: true,
    units: 'mm',
    tags: [],
  };
}

const TRACK_HALF_F = 686;   // 54" / 2 = 27" = 685.8mm
const TRACK_HALF_R = 711;   // 56" / 2 = 28" = 711.2mm
const WHEELBASE    = 1400;  // 55" = 1397mm
const RIDE_HEIGHT  = 305;   // 12" — belly floor above ground
const WHEEL_RADIUS = 292;   // ~23" tire diameter / 2

// ── FRONT LEFT CORNER ──────────────────────────────────────────────────────────
// UCA inboard at upper frame nodes (Z=490), outboard drops to UBJ (Z=385)
// LCA inboard AT chassis belly rail (Z=305, Y=270–280 — outside ~190mm frame rail)
// LCA outboard at lower ball joint (Z=200) — arm slopes DOWN ~15° from belly to wheel
// Coilover top at chassis apex (Z=555), bottom on LCA outboard section (Y=510, Z=255)
const frontLeft = {
  ucaFrontChassis: hp('UCA Front Chassis',   -40,  230,  490, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',     60,  240,  485, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',      0,  610,  385, 'uca'),
  lcaFrontChassis: hp('LCA Front Chassis',   -60,  270,  305, 'chassis'),
  lcaChassisRear:  hp('LCA Rear Chassis',     70,  280,  305, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',      0,  650,  200, 'lca'),
  tieRodChassis:   hp('Tie Rod Inner',        30,  230,  285, 'rack'),
  tieRodUpright:   hp('Tie Rod Outer',        30,  635,  215, 'tierod'),
  shockChassis:    hp('Shock Chassis',         0,  190,  555, 'chassis'),
  shockUpright:    hp('Shock Upright',         0,  510,  255, 'shock'),
  wheelCenter:     hp('Wheel Center',          0,  TRACK_HALF_F, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',         0,  TRACK_HALF_F, 0, 'contact'),
};

const frontRight = {
  ucaFrontChassis: hp('UCA Front Chassis',   -40, -230,  490, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',     60, -240,  485, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',      0, -610,  385, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis',   -60, -270,  305, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',     70, -280,  305, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',      0, -650,  200, 'lca',     'right'),
  tieRodChassis:   hp('Tie Rod Inner',        30, -230,  285, 'rack',    'right'),
  tieRodUpright:   hp('Tie Rod Outer',        30, -635,  215, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',         0, -190,  555, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',         0, -510,  255, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',          0, -TRACK_HALF_F, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',         0, -TRACK_HALF_F, 0, 'contact', 'right'),
};

// ── REAR LEFT CORNER ──────────────────────────────────────────────────────────
const rearLeft = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 50,  230,  485, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 50,  240,  480, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,        625,  380, 'uca'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 60,  270,  305, 'chassis'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 60,  280,  305, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,        665,  195, 'lca'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 40,  235,  280, 'rack'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 40,  648,  210, 'tierod'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,        185,  548, 'chassis'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,        525,  248, 'shock'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,        TRACK_HALF_R, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,        TRACK_HALF_R, 0, 'contact'),
};

const rearRight = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 50, -230,  485, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 50, -240,  480, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,       -625,  380, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 60, -270,  305, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 60, -280,  305, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,       -665,  195, 'lca',     'right'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 40, -235,  280, 'rack',    'right'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 40, -648,  210, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,       -185,  548, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,       -525,  248, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,       -TRACK_HALF_R, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,       -TRACK_HALF_R, 0, 'contact', 'right'),
};

export const defaultBajaVehicle: VehicleSpec = {
  name: 'Baja SAE Default Vehicle',
  description: 'Baja SAE double wishbone template — 55" WB, 54"/56" track, 12" clearance, direct coilover',
  series: 'Baja',

  mass: 225,
  sprungMass: 185,
  frontWeightDist: 0.40,
  cgHeight: 500,
  cgLongitudinal: WHEELBASE * 0.60,
  cgLateral: 0,

  wheelbase: WHEELBASE,
  frontTrack: TRACK_HALF_F * 2,
  rearTrack: TRACK_HALF_R * 2,
  frontOverhang: 200,
  rearOverhang: 180,

  frontSuspension: {
    position: 'front_left',
    suspensionType: 'double_wishbone',
    actuationType: 'direct',
    hardpoints: frontLeft,
    spring: {
      rate: 10.5,        // N/mm (≈60 lb/in) — softer for rough terrain
      freeLength: 254.0, // mm (10") — long spring for full coilover
      preload: 0,
      type: 'linear',
    },
    damper: {
      compressionLowSpeed: 1.8,
      compressionHighSpeed: 0.9,
      reboundLowSpeed: 2.8,
      reboundHighSpeed: 1.4,
      crossoverVelocity: 75,
      type: 'digressive',
      digressiveCoeff: 0.008,
    },
    arb: {
      type: 'tubular',
      stiffness: 80,
      motionRatio: 0.85,
    },
    staticCamber: -1.5,
    staticToe: 0.0,
    staticCaster: 6.0,
    rideHeight: RIDE_HEIGHT,
  },

  rearSuspension: {
    position: 'rear_left',
    suspensionType: 'double_wishbone',
    actuationType: 'direct',
    hardpoints: rearLeft,
    spring: {
      rate: 12.3,        // N/mm (≈70 lb/in)
      freeLength: 228.6, // mm (9")
      preload: 0,
      type: 'linear',
    },
    damper: {
      compressionLowSpeed: 2.0,
      compressionHighSpeed: 1.0,
      reboundLowSpeed: 3.0,
      reboundHighSpeed: 1.5,
      crossoverVelocity: 75,
      type: 'digressive',
      digressiveCoeff: 0.008,
    },
    arb: {
      type: 'tubular',
      stiffness: 60,
      motionRatio: 0.80,
    },
    staticCamber: -1.0,
    staticToe: 0.15,
    staticCaster: 0,
    rideHeight: RIDE_HEIGHT,
  },

  allHardpoints: {
    frontLeft,
    frontRight,
    rearLeft,
    rearRight,
    cg: hp('CG', WHEELBASE * 0.60, 0, 500, 'cg', 'center'),
    frontRackLeft:  hp('Rack Left',  30,  230, 285, 'rack'),
    frontRackRight: hp('Rack Right', 30, -230, 285, 'rack', 'right'),
  },

  steering: {
    type: 'rack_and_pinion',
    rackPosition: { x: 30, y: 0, z: 285 },
    rackTravel: 80,
    steeringRatio: 4.0,
    ackermann: 60,
    wheelbase: WHEELBASE,
    trackFront: TRACK_HALF_F * 2,
  },

  frontTire: {
    width: 215,
    aspectRatio: 65,
    rimDiameter: 12,
    unloadedRadius: WHEEL_RADIUS,
    loadedRadius: WHEEL_RADIUS - 15,
    designLoad: 600,
    peakLateralMu: 1.2,
    peakLongMu: 1.15,
    pacejka: {
      B_y: 8.0, C_y: 1.4, D_y: 1.2, E_y: -0.6,
      B_x: 9.0, C_x: 1.6, D_x: 1.15, E_x: -0.4,
      B_z: 6.0, C_z: 2.0, D_z: 0.06, E_z: -0.2,
    },
  },

  rearTire: {
    width: 267,
    aspectRatio: 65,
    rimDiameter: 12,
    unloadedRadius: WHEEL_RADIUS,
    loadedRadius: WHEEL_RADIUS - 15,
    designLoad: 700,
    peakLateralMu: 1.2,
    peakLongMu: 1.15,
    pacejka: {
      B_y: 8.0, C_y: 1.4, D_y: 1.2, E_y: -0.6,
      B_x: 9.0, C_x: 1.6, D_x: 1.15, E_x: -0.4,
      B_z: 6.0, C_z: 2.0, D_z: 0.06, E_z: -0.2,
    },
  },

  drivetrain: 'RWD',
  brakeBias: 0.60,
};

// Baja needs wider travel range and slower, more compliant sweep
export const defaultBajaSimSettings = {
  travelSteps: 51,
  travelMin: -75,
  travelMax:  75,
  steerSteps: 11,
  steerMin: -30,
  steerMax:  30,
  useNonlinearSolver: true,
  convergenceTol: 1e-6,
  maxIterations: 100,
} as const;
