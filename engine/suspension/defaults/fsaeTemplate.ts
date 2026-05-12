/**
 * Default FSAE double wishbone suspension template.
 * All coordinates in mm, SAE J670 convention (X=forward, Y=left, Z=up).
 * Origin at front axle centerline, centerline of vehicle, ground plane.
 *
 * Represents a competitive 2024-era FSAE steel spaceframe:
 *   WB ≈ 1600mm (63"), track ≈ 1220mm (48"), Hoosier 18x6-10 (r=228mm)
 *   Total mass ~200kg with driver, CG ~290mm above ground
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

const TRACK_HALF   = 610;    // 1220mm total track (~48") — competitive FSAE
const WHEELBASE    = 1600;   // 1600mm (~63") — typical 2024 FSAE car
const RIDE_HEIGHT  = 25;     // 25mm — slick/dry setup
const WHEEL_RADIUS = 228;    // Hoosier 18x6-10: OD ~457mm → r ≈ 228mm

// === FRONT LEFT CORNER (positive Y = left side) ===
const frontLeft = {
  ucaFrontChassis: hp('UCA Front Chassis',   -30,  120,  230, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',     30,  130,  225, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',       0,  550,  210, 'uca'),
  lcaFrontChassis: hp('LCA Front Chassis',   -50,   90,   60, 'chassis'),
  lcaChassisRear:  hp('LCA Rear Chassis',     50,   80,   55, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',       0,  560,   70, 'lca'),
  tieRodChassis:   hp('Tie Rod Inner',         20,  105,   80, 'rack'),
  tieRodUpright:   hp('Tie Rod Outer',          20,  540,   95, 'tierod'),
  shockChassis:    hp('Shock Chassis',          0,  200,  310, 'chassis'),
  shockUpright:    hp('Shock Upright',           0,  440,  115, 'shock'),
  wheelCenter:     hp('Wheel Center',            0,  TRACK_HALF, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',           0,  TRACK_HALF,          0, 'contact'),
};

const frontRight = {
  ucaFrontChassis: hp('UCA Front Chassis',   -30, -120,  230, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',     30, -130,  225, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',       0, -550,  210, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis',   -50,  -90,   60, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',     50,  -80,   55, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',       0, -560,   70, 'lca',     'right'),
  tieRodChassis:   hp('Tie Rod Inner',         20, -105,   80, 'rack',    'right'),
  tieRodUpright:   hp('Tie Rod Outer',          20, -540,   95, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',          0, -200,  310, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',           0, -440,  115, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',            0, -TRACK_HALF, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',           0, -TRACK_HALF,          0, 'contact', 'right'),
};

const rearLeft = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 30,  120,  220, 'chassis'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 20,  130,  218, 'chassis'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,        560,  205, 'uca'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 50,   85,   55, 'chassis'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 40,   90,   52, 'chassis'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,        570,   65, 'lca'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 30,  110,   75, 'rack'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 30,  555,   90, 'tierod'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,        190,  300, 'chassis'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,        450,  110, 'shock'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,        TRACK_HALF, WHEEL_RADIUS, 'wheel'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,        TRACK_HALF,          0, 'contact'),
};

const rearRight = {
  ucaFrontChassis: hp('UCA Front Chassis', WHEELBASE - 30, -120,  220, 'chassis', 'right'),
  ucaChassisRear:  hp('UCA Rear Chassis',  WHEELBASE + 20, -130,  218, 'chassis', 'right'),
  ucaUpright:      hp('UCA Upright Ball',  WHEELBASE,       -560,  205, 'uca',     'right'),
  lcaFrontChassis: hp('LCA Front Chassis', WHEELBASE - 50,   -85,   55, 'chassis', 'right'),
  lcaChassisRear:  hp('LCA Rear Chassis',  WHEELBASE + 40,   -90,   52, 'chassis', 'right'),
  lcaUpright:      hp('LCA Upright Ball',  WHEELBASE,        -570,   65, 'lca',     'right'),
  tieRodChassis:   hp('Toe Link Inner',    WHEELBASE + 30,  -110,   75, 'rack',    'right'),
  tieRodUpright:   hp('Toe Link Outer',    WHEELBASE + 30,  -555,   90, 'tierod',  'right'),
  shockChassis:    hp('Shock Chassis',     WHEELBASE,        -190,  300, 'chassis', 'right'),
  shockUpright:    hp('Shock Upright',     WHEELBASE,        -450,  110, 'shock',   'right'),
  wheelCenter:     hp('Wheel Center',      WHEELBASE,        -TRACK_HALF, WHEEL_RADIUS, 'wheel', 'right'),
  contactPatch:    hp('Contact Patch',     WHEELBASE,        -TRACK_HALF,          0, 'contact', 'right'),
};

export const defaultFSAEVehicle: VehicleSpec = {
  name: 'FSAE Default Vehicle',
  description: 'Formula SAE double wishbone template — 1600mm WB, 1220mm track, Hoosier 18x6-10',
  series: 'FSAE',

  mass: 200,
  sprungMass: 165,
  frontWeightDist: 0.45,
  cgHeight: 290,
  cgLongitudinal: WHEELBASE * 0.53,
  cgLateral: 0,

  wheelbase: WHEELBASE,
  frontTrack: TRACK_HALF * 2,
  rearTrack: TRACK_HALF * 2,
  frontOverhang: 150,
  rearOverhang: 120,

  frontSuspension: {
    position: 'front_left',
    suspensionType: 'double_wishbone',
    actuationType: 'pushrod',
    hardpoints: frontLeft,
    spring: {
      rate: 20,          // N/mm (≈114 lb/in) — competitive FSAE front
      freeLength: 152.4, // mm (6")
      preload: 0,
      type: 'linear',
    },
    damper: {
      compressionLowSpeed: 1.2,
      compressionHighSpeed: 0.6,
      reboundLowSpeed: 2.0,
      reboundHighSpeed: 1.0,
      crossoverVelocity: 50,
      type: 'digressive',
      digressiveCoeff: 0.01,
    },
    arb: {
      type: 'blade',
      stiffness: 120,
      motionRatio: 0.9,
    },
    staticCamber: -2.0,
    staticToe: 0.1,
    staticCaster: 5.0,
    rideHeight: RIDE_HEIGHT,
  },

  rearSuspension: {
    position: 'rear_left',
    suspensionType: 'double_wishbone',
    actuationType: 'pushrod',
    hardpoints: rearLeft,
    spring: {
      rate: 25,          // N/mm (≈143 lb/in) — competitive FSAE rear
      freeLength: 139.7, // mm (5.5")
      preload: 0,
      type: 'linear',
    },
    damper: {
      compressionLowSpeed: 1.5,
      compressionHighSpeed: 0.7,
      reboundLowSpeed: 2.2,
      reboundHighSpeed: 1.1,
      crossoverVelocity: 50,
      type: 'digressive',
      digressiveCoeff: 0.01,
    },
    arb: {
      type: 'blade',
      stiffness: 80,
      motionRatio: 0.85,
    },
    staticCamber: -1.5,
    staticToe: 0.2,
    staticCaster: 0,
    rideHeight: RIDE_HEIGHT,
  },

  allHardpoints: {
    frontLeft,
    frontRight,
    rearLeft,
    rearRight,
    cg: hp('CG', WHEELBASE * 0.53, 0, 290, 'cg', 'center'),
    frontRackLeft:  hp('Rack Left',  20,  105, 80, 'rack'),
    frontRackRight: hp('Rack Right', 20, -105, 80, 'rack', 'right'),
  },

  steering: {
    type: 'rack_and_pinion',
    rackPosition: { x: 20, y: 0, z: 80 },
    rackTravel: 60,        // mm
    steeringRatio: 3.5,    // turns lock to lock effective
    ackermann: 75,         // % ackermann
    wheelbase: WHEELBASE,
    trackFront: TRACK_HALF * 2,
  },

  frontTire: {
    width: 205,
    aspectRatio: 60,
    rimDiameter: 13,
    unloadedRadius: WHEEL_RADIUS,
    loadedRadius: WHEEL_RADIUS - 12,
    designLoad: 750,
    peakLateralMu: 1.65,
    peakLongMu: 1.6,
    pacejka: {
      B_y: 10.0, C_y: 1.3, D_y: 1.65, E_y: -0.5,
      B_x: 11.0, C_x: 1.5, D_x: 1.6,  E_x: -0.3,
      B_z:  8.0, C_z: 2.0, D_z: 0.08, E_z: -0.1,
    },
  },

  rearTire: {
    width: 205,
    aspectRatio: 60,
    rimDiameter: 13,
    unloadedRadius: WHEEL_RADIUS,
    loadedRadius: WHEEL_RADIUS - 12,
    designLoad: 800,
    peakLateralMu: 1.65,
    peakLongMu: 1.6,
    pacejka: {
      B_y: 10.0, C_y: 1.3, D_y: 1.65, E_y: -0.5,
      B_x: 11.0, C_x: 1.5, D_x: 1.6,  E_x: -0.3,
      B_z:  8.0, C_z: 2.0, D_z: 0.08, E_z: -0.1,
    },
  },

  drivetrain: 'RWD',
  brakeBias: 0.65,
};
