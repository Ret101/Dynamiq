/**
 * Types for the CVT Calculator project type.
 * Supports Baja SAE, Go-Kart, and custom CVT-driven vehicles.
 */

export type CVTSeries = 'Baja' | 'FSAE' | 'GoKart' | 'Custom';

export interface EngineSpec {
  name: string;
  displacement: number;     // cc
  maxPower: number;         // hp
  maxPowerRPM: number;      // RPM at which max power occurs
  maxTorque: number;        // ft·lb
  maxTorqueRPM: number;     // RPM at which max torque occurs
  idleRPM: number;
  maxRPM: number;           // governed or physical limit
}

export interface CVTClutchSpec {
  // Primary (drive) clutch — centrifugally operated
  engagementRPM: number;      // RPM where clutch begins to engage (creep)
  fullEngageRPM: number;      // RPM where clutch is fully locked in
  shiftStartRPM: number;      // RPM where CVT ratio begins to change
  shiftOutRPM: number;        // RPM where CVT reaches minimum (overdrive) ratio

  // Ratio range
  maxRatio: number;           // ratio at low speed / engagement (e.g. 3.6)
  minRatio: number;           // ratio at high speed / shift-out (e.g. 0.84)

  // Shift profile — 1=linear, <1=aggressive early shift, >1=lazy late shift
  shiftCurveExponent: number;

  // Secondary (driven) clutch
  helixAngle: number;         // deg — helix cam angle, affects back-shift response
  secondarySpringPreload: number; // N — determines down-shift aggressiveness
}

export interface DrivetrainSpec {
  gearboxRatio: number;       // fixed reduction after CVT (e.g. 3.36)
  gearboxEfficiency: number;  // 0–1 (typically 0.93–0.97)
  chainSprocketRatio: number; // driven/drive sprocket teeth ratio (e.g. 2.5)
  chainEfficiency: number;    // 0–1 (typically 0.97–0.99)
  beltEfficiency: number;     // 0–1 CVT belt losses (typically 0.85–0.92)
}

export interface VehicleDynSpec {
  totalMass: number;          // kg — vehicle + driver
  tireRadius: number;         // mm
  rollingResistanceCoeff: number;  // Crr — 0.015 road, 0.03–0.06 off-road
  dragCoefficient: number;    // Cd — aerodynamic
  frontalArea: number;        // m² — frontal projected area
  gradePercent: number;       // % grade for hill-climbing calculation
}

export interface CVTProject {
  id: string;
  name: string;
  series: CVTSeries;
  notes: string;
  created: string;
  modified: string;

  engine: EngineSpec;
  clutch: CVTClutchSpec;
  drivetrain: DrivetrainSpec;
  vehicle: VehicleDynSpec;
}

// ─── Computed outputs ────────────────────────────────────────────────────────

export interface CVTOperatingPoint {
  rpm: number;
  cvtRatio: number;
  totalRatio: number;
  speedMph: number;
  speedKph: number;
  engineTorque: number;       // ft·lb
  axleTorque: number;         // N·m
  tractiveForce: number;      // N
  wheelPower: number;         // kW
  acceleration: number;       // m/s²
  isEngaged: boolean;
  isShifting: boolean;
}

export interface CVTSummary {
  engagementSpeed: number;    // mph
  maxSpeed: number;           // mph — at governed RPM, min ratio
  peakTractiveForce: number;  // N — at max torque RPM
  peakAcceleration: number;   // m/s²
  ratioSpread: number;        // maxRatio / minRatio
  totalReductionLow: number;  // total ratio at engagement
  totalReductionHigh: number; // total ratio at shift-out
  maxGradeability: number;    // % maximum climbable grade at peak tractive effort
  quarterMileTime: number;    // seconds — estimated 0-quarter mile
}
