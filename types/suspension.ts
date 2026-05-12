import type { Vec3 } from './geometry';
import type { CornerHardpoints, VehicleHardpoints } from './hardpoint';

export type SuspensionType =
  | 'double_wishbone'
  | 'macpherson'
  | 'pushrod'
  | 'pullrod'
  | 'multilink'
  | 'trailing_arm'
  | 'semi_trailing_arm'
  | 'live_axle'
  | 'de_dion'
  | 'solid_axle'
  | 'beam_axle';

export type SteeringType =
  | 'rack_and_pinion'
  | 'recirculating_ball'
  | 'direct';

export type ARBType = 'blade' | 'tubular' | 'none';
export type DrivetrainConfig = 'FWD' | 'RWD' | 'AWD';
export type CornerPosition = 'front_left' | 'front_right' | 'rear_left' | 'rear_right';

export interface SpringSpec {
  rate: number;           // N/mm
  freeLength: number;     // mm
  preload: number;        // N
  type: 'linear' | 'progressive' | 'dual_rate';
  progressiveCoeff?: number; // for progressive spring rate coefficient
  dualRateBreak?: number;    // mm travel at which dual rate kicks in
  dualRateHigh?: number;     // N/mm high rate
}

export interface DamperSpec {
  compressionLowSpeed: number;   // N/(mm/s)
  compressionHighSpeed: number;
  reboundLowSpeed: number;
  reboundHighSpeed: number;
  crossoverVelocity: number;     // mm/s
  type: 'linear' | 'digressive' | 'progressive';
  // Digressive: F = c*v / (1 + d*|v|)
  digressiveCoeff?: number;
}

export interface ARBSpec {
  type: ARBType;
  stiffness: number;    // N·m/rad
  motionRatio: number;  // ARB motion ratio
}

export interface SuspensionCorner {
  position: CornerPosition;
  suspensionType: SuspensionType;
  hardpoints: CornerHardpoints;
  spring: SpringSpec;
  damper: DamperSpec;
  arb?: ARBSpec;

  // Static alignment targets
  staticCamber: number;   // deg (negative = tilted in at top)
  staticToe: number;      // deg (positive = toe-in)
  staticCaster: number;   // deg
  rideHeight: number;     // mm (from contact patch to reference plane)
}

export interface BellcrankSpec {
  enabled: boolean;
  inputArmLength: number;   // mm — from pivot to column/input pushrod connection
  outputArmLength: number;  // mm — from pivot to tie-rod connection
  armAngle: number;         // deg — angle between input and output arms (90 = right-angle)
  preloadAngle: number;     // deg — input arm angle at steering center (tunes where non-linearity peaks)
}

export interface SteeringSystem {
  type: SteeringType;
  rackPosition: Vec3;    // rack centerline midpoint
  rackTravel: number;    // mm total rack travel (or max output displacement when bellcrank is used)
  steeringRatio: number; // deg steering-wheel per mm rack (linear) or deg per deg bellcrank (with bellcrank)
  ackermann: number;     // % ackermann (100 = pure ackermann, 0 = parallel)
  wheelbase: number;     // mm
  trackFront: number;    // mm
  bellcrank?: BellcrankSpec;
}

export interface TireSpec {
  width: number;           // mm
  aspectRatio: number;     // %
  rimDiameter: number;     // in
  unloadedRadius: number;  // mm
  loadedRadius: number;    // mm at design load
  designLoad: number;      // N
  peakLateralMu: number;   // peak lateral friction coefficient
  peakLongMu: number;      // peak longitudinal friction coefficient
  // Pacejka coefficients
  pacejka: PacejkaCoefficients;
}

export interface PacejkaCoefficients {
  // Lateral force Fy
  B_y: number; // stiffness factor
  C_y: number; // shape factor
  D_y: number; // peak value
  E_y: number; // curvature factor
  // Longitudinal force Fx
  B_x: number;
  C_x: number;
  D_x: number;
  E_x: number;
  // Aligning moment Mz
  B_z: number;
  C_z: number;
  D_z: number;
  E_z: number;
}

export interface VehicleSpec {
  name: string;
  description: string;
  series: 'FSAE' | 'Baja' | 'Formula' | 'Rally' | 'Road' | 'Custom';

  // Mass properties
  mass: number;            // kg total
  sprungMass: number;      // kg sprung mass
  frontWeightDist: number; // fraction (0–1)
  cgHeight: number;        // mm from ground
  cgLongitudinal: number;  // mm from front axle
  cgLateral: number;       // mm from centerline (0 = center)

  // Geometry
  wheelbase: number;       // mm
  frontTrack: number;      // mm (wheel center to wheel center)
  rearTrack: number;       // mm
  frontOverhang: number;   // mm
  rearOverhang: number;    // mm

  // Suspension
  frontSuspension: SuspensionCorner;
  rearSuspension: SuspensionCorner;  // represents one-side spec for all rear corners
  allHardpoints: VehicleHardpoints;

  // Steering
  steering: SteeringSystem;

  // Tires
  frontTire: TireSpec;
  rearTire: TireSpec;

  // Drivetrain
  drivetrain: DrivetrainConfig;
  brakeBias: number;       // 0–1 (0 = all rear, 1 = all front)
}
