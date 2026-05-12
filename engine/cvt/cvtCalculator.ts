/**
 * CVT Calculator Engine
 *
 * Models a belt CVT drivetrain from engine → CVT primary → CVT secondary →
 * fixed gearbox → chain/sprocket → axle → tire.
 *
 * Math references:
 *   - SAE Baja rules (engine power limits, CVT requirements)
 *   - Comet Industries clutch tuning guides
 *   - Basic drivetrain power-flow analysis
 *
 * Units: rpm, ft·lb, mph, N, kg, mm throughout (converted where noted).
 */

import type {
  EngineSpec,
  CVTClutchSpec,
  DrivetrainSpec,
  VehicleDynSpec,
  CVTOperatingPoint,
  CVTSummary,
} from '@/types/cvt';

const G = 9.81; // m/s²
const FT_LB_TO_NM = 1.35582;
const MPH_TO_MS = 0.44704;
const MS_TO_MPH = 2.23694;

// ─── Engine torque model ──────────────────────────────────────────────────────

/**
 * Returns engine torque in ft·lb at a given RPM.
 *
 * Three-region piecewise model:
 *   1. idleRPM → maxTorqueRPM : linear rise from 30% to 100% of max torque
 *   2. maxTorqueRPM → maxPowerRPM : falls to match max power point
 *   3. maxPowerRPM → maxRPM : steep drop (governor / rev limiter territory)
 *
 * The torque at maxPowerRPM is derived from:
 *   T (ft·lb) = P (hp) × 5252 / RPM
 */
export function engineTorque(rpm: number, eng: EngineSpec): number {
  if (rpm < eng.idleRPM) return 0;
  if (rpm > eng.maxRPM) return 0;

  const T_peak = eng.maxTorque;
  const T_maxPower = (eng.maxPower * 5252) / eng.maxPowerRPM;

  if (rpm <= eng.maxTorqueRPM) {
    // Rise from 30% at idle to 100% at max-torque RPM
    const t = (rpm - eng.idleRPM) / (eng.maxTorqueRPM - eng.idleRPM);
    return T_peak * (0.30 + 0.70 * t);
  }

  if (rpm <= eng.maxPowerRPM) {
    // Gentle fall from T_peak → T_maxPower
    const t = (rpm - eng.maxTorqueRPM) / (eng.maxPowerRPM - eng.maxTorqueRPM);
    return T_peak + (T_maxPower - T_peak) * t;
  }

  // Above max-power RPM: steep drop to ~20% at maxRPM (governor region)
  const t = (rpm - eng.maxPowerRPM) / (eng.maxRPM - eng.maxPowerRPM);
  return T_maxPower * (1 - 0.80 * t);
}

/** Returns engine power in hp at a given RPM. */
export function enginePower(rpm: number, eng: EngineSpec): number {
  return (engineTorque(rpm, eng) * rpm) / 5252;
}

// ─── CVT ratio model ──────────────────────────────────────────────────────────

/**
 * Returns CVT belt ratio at a given engine RPM.
 *
 * Below engagementRPM: clutch is open, belt at max ratio (low gear).
 * Above shiftOutRPM: fully shifted, belt at min ratio (overdrive).
 * Between shiftStartRPM and shiftOutRPM: smooth transition using a
 *   power curve shaped by shiftCurveExponent.
 *
 * exponent < 1 → early aggressive shift (ratio drops quickly)
 * exponent = 1 → linear shift
 * exponent > 1 → late shift (stays low longer, then shifts quickly)
 */
export function cvtRatioAtRPM(rpm: number, clutch: CVTClutchSpec): number {
  if (rpm <= clutch.shiftStartRPM) return clutch.maxRatio;
  if (rpm >= clutch.shiftOutRPM)   return clutch.minRatio;

  const t = (rpm - clutch.shiftStartRPM) / (clutch.shiftOutRPM - clutch.shiftStartRPM);
  const tShaped = Math.pow(Math.max(0, Math.min(1, t)), clutch.shiftCurveExponent);
  return clutch.maxRatio - (clutch.maxRatio - clutch.minRatio) * tShaped;
}

/** True if clutch is engaged enough to transmit torque. */
export function isClutchEngaged(rpm: number, clutch: CVTClutchSpec): boolean {
  return rpm >= clutch.engagementRPM;
}

// ─── Drivetrain calculations ──────────────────────────────────────────────────

/** Total drivetrain reduction ratio at a given engine RPM. */
export function totalRatio(rpm: number, clutch: CVTClutchSpec, dt: DrivetrainSpec): number {
  return cvtRatioAtRPM(rpm, clutch) * dt.gearboxRatio * dt.chainSprocketRatio;
}

/** Combined drivetrain mechanical efficiency (CVT belt × gearbox × chain). */
export function totalEfficiency(dt: DrivetrainSpec): number {
  return dt.beltEfficiency * dt.gearboxEfficiency * dt.chainEfficiency;
}

/** Vehicle speed in mph at a given RPM and CVT ratio. */
export function vehicleSpeedMph(
  rpm: number,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  tireRadius_mm: number
): number {
  const ratio = totalRatio(rpm, clutch, dt);
  const wheelRPM = rpm / ratio;
  const wheelRad_s = (wheelRPM * 2 * Math.PI) / 60;
  const speed_ms = wheelRad_s * (tireRadius_mm / 1000);
  return speed_ms * MS_TO_MPH;
}

/** Axle torque in N·m. */
export function axleTorque_Nm(
  rpm: number,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  eng: EngineSpec
): number {
  const T_engine_ftlb = engineTorque(rpm, eng);
  const ratio = totalRatio(rpm, clutch, dt);
  const eta = totalEfficiency(dt);
  return T_engine_ftlb * FT_LB_TO_NM * ratio * eta;
}

/** Tractive force at the contact patch in N. */
export function tractiveForce_N(
  rpm: number,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  eng: EngineSpec,
  tireRadius_mm: number
): number {
  const T_axle = axleTorque_Nm(rpm, clutch, dt, eng);
  return T_axle / (tireRadius_mm / 1000);
}

/** Rolling resistance force in N. */
function rollingResistanceForce(veh: VehicleDynSpec): number {
  return veh.totalMass * G * veh.rollingResistanceCoeff;
}

/** Aerodynamic drag in N at a given speed (m/s). */
function aeroDragForce(speedMs: number, veh: VehicleDynSpec): number {
  const airDensity = 1.225; // kg/m³ at sea level
  return 0.5 * airDensity * veh.dragCoefficient * veh.frontalArea * speedMs * speedMs;
}

/** Grade resistance force in N. */
function gradeForce(veh: VehicleDynSpec): number {
  const gradeRad = Math.atan(veh.gradePercent / 100);
  return veh.totalMass * G * Math.sin(gradeRad);
}

/** Net acceleration in m/s² at a given RPM. */
export function netAcceleration(
  rpm: number,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  eng: EngineSpec,
  veh: VehicleDynSpec
): number {
  const speedMs = vehicleSpeedMph(rpm, clutch, dt, veh.tireRadius) * MPH_TO_MS;
  const F_tract = isClutchEngaged(rpm, clutch)
    ? tractiveForce_N(rpm, clutch, dt, eng, veh.tireRadius)
    : 0;
  const F_rr   = rollingResistanceForce(veh);
  const F_aero = aeroDragForce(speedMs, veh);
  const F_grade = gradeForce(veh);
  const F_net  = F_tract - F_rr - F_aero - F_grade;

  // Rotational inertia penalty (wheels + engine flywheel) ≈ 10% mass
  const effectiveMass = veh.totalMass * 1.10;
  return F_net / effectiveMass;
}

// ─── Full sweep ───────────────────────────────────────────────────────────────

/**
 * Generate operating points from idleRPM to maxRPM in small steps.
 * Returns one point per 50 RPM for smooth charts.
 */
export function sweepRPM(
  eng: EngineSpec,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  veh: VehicleDynSpec,
  stepRPM = 50
): CVTOperatingPoint[] {
  const points: CVTOperatingPoint[] = [];

  for (let rpm = eng.idleRPM; rpm <= eng.maxRPM; rpm += stepRPM) {
    const cvtR = cvtRatioAtRPM(rpm, clutch);
    const totR = cvtR * dt.gearboxRatio * dt.chainSprocketRatio;
    const speedMph = vehicleSpeedMph(rpm, clutch, dt, veh.tireRadius);
    const speedMs = speedMph * MPH_TO_MS;
    const engTq = engineTorque(rpm, eng);
    const engaged = isClutchEngaged(rpm, clutch);

    const T_axle = engaged ? engTq * FT_LB_TO_NM * totR * totalEfficiency(dt) : 0;
    const F_tract = engaged ? T_axle / (veh.tireRadius / 1000) : 0;
    const F_rr    = rollingResistanceForce(veh);
    const F_aero  = aeroDragForce(speedMs, veh);
    const F_grade = gradeForce(veh);
    const F_net   = F_tract - F_rr - F_aero - F_grade;
    const accel   = F_net / (veh.totalMass * 1.10);

    // Wheel power (kW)
    const wheelPowerW = F_tract * speedMs;

    points.push({
      rpm,
      cvtRatio: cvtR,
      totalRatio: totR,
      speedMph,
      speedKph: speedMph * 1.60934,
      engineTorque: engTq,
      axleTorque: T_axle,
      tractiveForce: F_tract,
      wheelPower: wheelPowerW / 1000,
      acceleration: accel,
      isEngaged: engaged,
      isShifting: rpm > clutch.shiftStartRPM && rpm < clutch.shiftOutRPM,
    });
  }

  return points;
}

// ─── Summary statistics ───────────────────────────────────────────────────────

export function computeSummary(
  points: CVTOperatingPoint[],
  eng: EngineSpec,
  clutch: CVTClutchSpec,
  dt: DrivetrainSpec,
  veh: VehicleDynSpec
): CVTSummary {
  const engagedPts = points.filter(p => p.isEngaged);

  const maxSpeed = Math.max(...points.map(p => p.speedMph), 0);
  const engagePt = points.find(p => p.isEngaged);
  const engagementSpeed = engagePt ? engagePt.speedMph : 0;

  const peakTractiveForce = Math.max(...engagedPts.map(p => p.tractiveForce), 0);
  const peakAcceleration  = Math.max(...engagedPts.map(p => p.acceleration), 0);

  const totalReductionLow  = clutch.maxRatio * dt.gearboxRatio * dt.chainSprocketRatio;
  const totalReductionHigh = clutch.minRatio * dt.gearboxRatio * dt.chainSprocketRatio;
  const ratioSpread = clutch.maxRatio / clutch.minRatio;

  // Gradeability at peak tractive force
  const gradeability = ((peakTractiveForce - rollingResistanceForce(veh)) / (veh.totalMass * G)) * 100;

  // Rough quarter-mile estimate using kinematic integration
  const quarterMileTime = estimateQuarterMile(points, veh);

  return {
    engagementSpeed,
    maxSpeed,
    peakTractiveForce,
    peakAcceleration,
    ratioSpread,
    totalReductionLow,
    totalReductionHigh,
    maxGradeability: Math.max(0, gradeability),
    quarterMileTime,
  };
}

function estimateQuarterMile(
  points: CVTOperatingPoint[],
  veh: VehicleDynSpec
): number {
  // Simple Euler integration: advance speed using acceleration at each point,
  // map speed → operating point, stop at 402m (¼ mile)
  let dist_m = 0;
  let speed_ms = 0;
  let time_s = 0;
  const dt_s = 0.05;
  const targetDist = 402.336;

  // Build interpolation table: speed → acceleration
  const table = points
    .filter(p => p.isEngaged && p.speedMph > 0)
    .map(p => ({ v: p.speedMph * MPH_TO_MS, a: Math.max(0, p.acceleration) }));

  if (table.length === 0) return 0;

  const interp = (v: number): number => {
    if (v >= table[table.length - 1].v) return 0;
    for (let i = 1; i < table.length; i++) {
      if (v <= table[i].v) {
        const t = (v - table[i - 1].v) / (table[i].v - table[i - 1].v);
        return table[i - 1].a + t * (table[i].a - table[i - 1].a);
      }
    }
    return 0;
  };

  while (dist_m < targetDist && time_s < 120) {
    const a = interp(speed_ms);
    speed_ms += a * dt_s;
    dist_m   += speed_ms * dt_s;
    time_s   += dt_s;
    if (speed_ms <= 0 && time_s > 1) break;
  }

  return time_s;
}
