import type { Vec3 } from './geometry';

// 3D positions of upright-attached hardpoints after kinematic solve (SAE mm)
export interface MovedHardpoints {
  ucaBallJoint:      Vec3;
  lcaBallJoint:      Vec3;
  tieRodUprightEnd:  Vec3;
  shockUprightMount: Vec3;
}

// Output of the kinematic solver for one corner at one wheel position
export interface CornerKinematics {
  // Wheel position state
  wheelTravel: number;    // mm from static (positive = jounce)
  steerInput: number;     // mm rack travel (positive = steer left)

  // 3D positions of movable hardpoints at this state (populated by solver)
  movedPositions?: MovedHardpoints;

  // Derived geometry
  wheelCenter: Vec3;
  contactPatch: Vec3;
  instantCenter: Vec3;    // front-view instant center
  instantCenterSide: Vec3; // side-view instant center

  // Alignment
  camber: number;         // deg
  toe: number;            // deg (positive = toe-in)
  caster: number;         // deg
  kingpin: number;        // KPI deg
  scrubRadius: number;    // mm (positive = wheel center outboard of KP intercept)
  mechanicalTrail: number; // mm
  pneumaticTrail: number;  // mm

  // Roll center
  rollCenter: Vec3;
  rollCenterHeight: number; // mm

  // Motion ratio (spring travel / wheel travel)
  motionRatio: number;
  wheelRate: number;      // N/mm

  // Anti-geometry (fraction of inertial reaction carried by links; >1 = jacking tendency)
  antiDive: number;
  antiSquat: number;
  antiLift: number;

  // Track / wheelbase change
  trackChange: number;    // mm delta from static
  wheelbaseChange: number; // mm delta from static
  scrubVsTravel: number;  // mm lateral contact patch movement

  // Derivatives (per mm of wheel travel)
  camberGain: number;     // deg/mm
  toeGain: number;        // deg/mm (bump steer)
  casterGain: number;     // deg/mm

  // Jacking force coefficient
  jackingForce: number;   // N per N lateral tire force
}

// Kinematic sweep result (full travel range)
export interface KinematicSweep {
  corner: string;
  travelRange: [number, number];  // [min, max] mm
  steerRange: [number, number];   // [min, max] mm rack travel
  steps: number;
  results: CornerKinematics[][];  // [travelIdx][steerIdx]
  // 1D slices at zero steer
  bumpSteerCurve: Array<{ travel: number; toe: number }>;
  camberCurve: Array<{ travel: number; camber: number }>;
  rollCenterMigration: Array<{ travel: number; rcHeight: number; rcLateral: number }>;
  motionRatioCurve: Array<{ travel: number; motionRatio: number }>;
  wheelRateCurve: Array<{ travel: number; wheelRate: number }>;
}

// Full vehicle kinematic state at given roll, pitch, heave, steer
export interface VehicleKinematics {
  heave: number;      // mm
  roll: number;       // deg
  pitch: number;      // deg
  steerAngle: number; // deg steering wheel

  frontLeft: CornerKinematics;
  frontRight: CornerKinematics;
  rearLeft: CornerKinematics;
  rearRight: CornerKinematics;

  // Vehicle-level
  ackermann: number;         // % ackermann at current steer
  steeringRatio: number;     // effective
  turningRadius: number;     // mm at current steer angle

  // Load transfer
  lateralLoadTransfer: LateralLoadTransfer;
  longitudinalLoadTransfer: LongitudinalLoadTransfer;
}

export interface LateralLoadTransfer {
  total: number;       // N
  front: number;       // N
  rear: number;        // N
  frontGeometric: number;
  frontElastic: number;
  frontUnsprung: number;
  rearGeometric: number;
  rearElastic: number;
  rearUnsprung: number;
}

export interface LongitudinalLoadTransfer {
  total: number;       // N
  front: number;       // N (positive = added load front)
  rear: number;        // N
  geometric: number;
  elastic: number;
  unsprung: number;
}

// Steering geometry at a given steer angle
export interface SteeringGeometry {
  steerAngle: number;       // deg steering wheel
  rackTravel: number;       // mm

  frontLeft: {
    toeAngle: number;       // deg
    turnRadius: number;     // mm
  };
  frontRight: {
    toeAngle: number;
    turnRadius: number;
  };

  ackermann: number;        // % (0=parallel, 100=pure ackermann, <0 = anti-ackermann)
  insideAngle: number;      // deg
  outsideAngle: number;     // deg
  turningRadius: number;    // mm (to front axle center)
  scrubAngle: number;       // deg
}
