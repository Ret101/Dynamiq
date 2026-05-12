/**
 * Default Baja SAE suspension template.
 * All coordinates in mm, SAE J670 (X=forward, Y=left, Z=up).
 * Origin at front axle centerline, vehicle centerline, ground plane.
 *
 * Typical Baja SAE: ~53" WB, ~54" front track, ~56" rear track.
 * Tires: 23x8.5-12 (front), 23x10.5-12 (rear) — radius ≈ 292mm.
 * High ground clearance (~305mm), more suspension travel (±75mm).
 * RWD with CVT, solid rear axle or IRS depending on team.
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

const TRACK_HALF_F = 686;   // 54" / 2 = 27" = 685.8mm ≈ 686
const TRACK_HALF_R = 711;   // 56" / 2 = 28" = 711.2mm ≈ 711
const WHEELBASE    = 1346;  // 53" = 1346.2mm
const RIDE_HEIGHT  = 305;   // 12" — high clearance for off-road
const WHEEL_RADIUS = 292;   // ~23" tire diameter / 2

// Geometry rationale:
//   LCA outboard raised to Z=175 (was 100) so the arm has a meaningful upward slope.
//   This brings the front-view IC from ~3800mm to ~1600mm outboard, moving the RC
//   from −40mm to near 0mm — appropriate for a long-travel off-road vehicle.
//   UCA outboard set to Z=295 (net downward slope from chassis) to produce
//   negative camber gain in jounce (camber goes more negative = correct).
//   Shock inboard moved outward for longer motion-ratio lever arm.

// === FRONT LEFT CORNER ===
const frontLeft = {
  ucaFrontChassis: hp('UCA Front Chassis',   -40,  145,  358, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',     60,  155,  352, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',      0,  622,  295, 'uca'),    // angled down → −camber gain
  lcaFrontChassis: hp('LCA Front Chassis',   -60,  120,  105, 'chassis'), // raised inboard mounts
  lcaChassisRear:  hp('LCA Rear Chassis',     70,  110,   98, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',      0,  638,  175, 'lca'),    // raised outboard → arm slope
  tieRodChassis:   hp('Tie Rod Inner',        30,  128,  120, 'rack'),
  tieRodUpright:   hp('Tie Rod Outer',        30,  622,  145, 'tierod'),
  shockChassis:    hp('Shock Chassis',         0,  265,  490, 'chassis'),
  shockUpright:    hp('Shock Upright',         0,  515,  175, 'shock'),
  wheelCenter:     hp('Wheel Center',          0,  TRACK_HALF_F, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',         0,  TRACK_HALF_F, 0, 'contact'),
};

const frontRight = {
  ucaFrontChassis: hp('UCA Front Chassis',   -40, -145,  358, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',     60, -155,  352, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',      0, -622,  295, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis',   -60, -120,  105, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',     70, -110,   98, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',      0, -638,  175, 'lca',     'right'),
  tieRodChassis:   hp('Tie Rod Inner',        30, -128,  120, 'rack',    'right'),
  tieRodUpright:   hp('Tie Rod Outer',        30, -622,  145, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',         0, -265,  490, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',         0, -515,  175, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',          0, -TRACK_HALF_F, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',         0, -TRACK_HALF_F, 0, 'contact', 'right'),
};

const rearLeft = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 50,  152,  348, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 50,  162,  342, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,        642,  290, 'uca'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 60,  122,  102, 'chassis'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 60,  128,   96, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,        658,  172, 'lca'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 40,  130,  112, 'rack'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 40,  642,  142, 'tierod'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,        245,  480, 'chassis'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,        528,  168, 'shock'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,        TRACK_HALF_R, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,        TRACK_HALF_R, 0, 'contact'),
};

const rearRight = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 50, -152,  348, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 50, -162,  342, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,       -642,  290, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 60, -122,  102, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 60, -128,   96, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,       -658,  172, 'lca',     'right'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 40, -130,  112, 'rack',    'right'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 40, -642,  142, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,       -245,  480, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,       -528,  168, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,       -TRACK_HALF_R, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,       -TRACK_HALF_R, 0, 'contact', 'right'),
};

export const defaultBajaVehicle: VehicleSpec = {
  name: 'Baja SAE Default Vehicle',
  description: 'Baja SAE double wishbone template — 53" WB, 54"/56" track, high clearance',
  series: 'Baja',

  mass: 225,
  sprungMass: 185,
  frontWeightDist: 0.40,
  cgHeight: 450,
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
    hardpoints: frontLeft,
    spring: {
      rate: 10.5,        // N/mm (≈60 lb/in) — softer for rough terrain
      freeLength: 203.2, // mm (8")
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
    hardpoints: rearLeft,
    spring: {
      rate: 12.3,        // N/mm (≈70 lb/in)
      freeLength: 190.5, // mm (7.5")
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
    cg: hp('CG', WHEELBASE * 0.60, 0, 450, 'cg', 'center'),
    frontRackLeft:  hp('Rack Left',  30,  120, 110, 'rack'),
    frontRackRight: hp('Rack Right', 30, -120, 110, 'rack', 'right'),
  },

  steering: {
    type: 'rack_and_pinion',
    rackPosition: { x: 30, y: 0, z: 110 },
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
