/**
 * Gearbox calculator math engine.
 * All velocities in km/h, forces in N, torques in N·m, power in kW.
 */

import type {
  GearboxProject,
  GearboxResult,
  GearResult,
  GearOperatingPoint,
} from '@/types/gearbox';

const G   = 9.81;   // m/s²
const RHO = 1.225;  // kg/m³ air density at sea level

/**
 * Quadratic torque curve fit through three known points:
 *   (idleRPM, torqueAtIdle), (peakTorqueRPM, peakTorque), (redlineRPM, torqueAtRedline)
 * Returns engine torque [N·m] at a given RPM.
 */
export function engineTorqueAtRPM(rpm: number, engine: GearboxProject['engine']): number {
  const { idleRPM, redlineRPM, peakTorqueRPM, peakTorque, torqueAtIdle, torqueAtRedline } = engine;

  // Three-point quadratic: T = a + b*rpm + c*rpm²
  const r1 = idleRPM, T1 = torqueAtIdle;
  const r2 = peakTorqueRPM, T2 = peakTorque;
  const r3 = redlineRPM, T3 = torqueAtRedline;

  const denom = (r1 - r2) * (r1 - r3) * (r2 - r3);
  if (Math.abs(denom) < 1e-6) return peakTorque;

  const A = (r3 * (T2 - T1) + r2 * (T1 - T3) + r1 * (T3 - T2)) / denom;
  const B = (r3 * r3 * (T1 - T2) + r2 * r2 * (T3 - T1) + r1 * r1 * (T2 - T3)) / denom;
  const C = (r2 * r3 * (r2 - r3) * T1 + r3 * r1 * (r3 - r1) * T2 + r1 * r2 * (r1 - r2) * T3) / denom;

  const t = A * rpm * rpm + B * rpm + C;
  return Math.max(0, t);
}

/**
 * Wheel speed [km/h] at a given engine RPM in a given gear.
 */
function speedKph(rpm: number, totalRatio: number, tireRadiusMm: number): number {
  const rps = rpm / 60;
  const wheelRps = rps / totalRatio;
  const vMs = wheelRps * 2 * Math.PI * (tireRadiusMm / 1000);
  return vMs * 3.6;
}

/**
 * Aerodynamic + rolling resistance drag force [N] at speed [km/h].
 */
function dragForce(speedKph: number, proj: GearboxProject): number {
  const v = speedKph / 3.6;
  const Faero = 0.5 * RHO * proj.vehicle.cdAero * proj.vehicle.frontalArea * v * v;
  const Froll = proj.vehicle.rollResistCoeff * proj.vehicle.mass * G;
  const Fgrade = proj.vehicle.gradePercent / 100 * proj.vehicle.mass * G;
  return Faero + Froll + Fgrade;
}

/**
 * Compute operating curve for one gear across the full RPM range.
 */
function computeGearCurve(
  gearIndex: number,
  totalRatio: number,
  proj: GearboxProject,
  steps = 60,
): GearOperatingPoint[] {
  const { idleRPM, redlineRPM } = proj.engine;
  const { efficiency } = proj.gearbox;
  const rTire = proj.vehicle.tireRadius;
  const mass = proj.vehicle.mass;

  const curve: GearOperatingPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const rpm = idleRPM + (redlineRPM - idleRPM) * (i / steps);
    const engineTq = engineTorqueAtRPM(rpm, proj.engine);
    const wheelTq = engineTq * totalRatio * efficiency;
    const Ft = wheelTq / (rTire / 1000);
    const v = speedKph(rpm, totalRatio, rTire);
    const Fd = dragForce(v, proj);
    const Fnet = Ft - Fd;
    const powerKw = (engineTq * rpm * Math.PI / 30) / 1000 * efficiency;

    curve.push({
      rpm,
      speedKph: v,
      engineTorque: engineTq,
      wheelTorque: wheelTq,
      tractiveForce: Ft,
      powerKw,
      dragForce: Fd,
      netForce: Fnet,
      accelerationG: Fnet / (mass * G),
    });
  }
  return curve;
}

/**
 * Find the optimal shift RPM from gear N to N+1:
 * the RPM at which next-gear tractive force exceeds current-gear tractive force.
 */
function findShiftRPM(
  totalRatioCurrent: number,
  totalRatioNext: number,
  proj: GearboxProject,
): number {
  const { idleRPM, redlineRPM } = proj.engine;
  const { efficiency } = proj.gearbox;
  const rTire = proj.vehicle.tireRadius;

  // Scan from redline downward
  for (let rpm = redlineRPM; rpm > idleRPM + 500; rpm -= 50) {
    const vKph = speedKph(rpm, totalRatioCurrent, rTire);
    // RPM in next gear at same speed
    const rpmNext = vKph / 3.6 * totalRatioNext * 60 / (2 * Math.PI * rTire / 1000);
    if (rpmNext > redlineRPM) continue;

    const Ft1 = engineTorqueAtRPM(rpm,     proj.engine) * totalRatioCurrent * efficiency / (rTire / 1000);
    const Ft2 = engineTorqueAtRPM(rpmNext, proj.engine) * totalRatioNext    * efficiency / (rTire / 1000);

    if (Ft2 >= Ft1) return rpm;
  }
  return redlineRPM;
}

/**
 * Simulate 0-to-target acceleration time [s] by numerically integrating.
 * Accounts for gear shifts.
 */
function simulate0ToTarget(
  targetKph: number,
  proj: GearboxProject,
  gearResults: GearResult[],
  shiftRPMs: number[],
): number {
  const { mass } = proj.vehicle;
  const { shiftTime } = proj.gearbox;

  let t = 0;
  let vKph = 1; // start at 1 km/h to avoid divide-by-zero
  let gear = 0; // 0-indexed

  const dtMax = 0.01; // s integration step

  let safety = 0;
  while (vKph < targetKph && gear < gearResults.length) {
    if (++safety > 100000) break;

    const gr = gearResults[gear];
    const rTire = proj.vehicle.tireRadius;
    const totalRatio = gr.totalRatio;

    // Engine RPM at current speed
    const rpm = (vKph / 3.6) * totalRatio * 60 / (2 * Math.PI * (rTire / 1000));

    // Check if we should shift
    if (gear < shiftRPMs.length && rpm >= shiftRPMs[gear]) {
      if (gear + 1 < gearResults.length) {
        gear++;
        t += shiftTime;
        continue;
      }
    }

    // Clamp RPM to engine range
    const rpmClamped = Math.min(Math.max(rpm, proj.engine.idleRPM), proj.engine.redlineRPM);
    const engineTq = engineTorqueAtRPM(rpmClamped, proj.engine);
    const Ft = engineTq * totalRatio * proj.gearbox.efficiency / (rTire / 1000);
    const Fd = dragForce(vKph, proj);
    const Fnet = Math.max(0, Ft - Fd);
    const acc = Fnet / mass; // m/s²

    if (acc < 0.01) break; // not accelerating

    const dvMs = acc * dtMax;
    vKph += dvMs * 3.6;
    t += dtMax;
  }

  return t;
}

/**
 * Main calculation entry point.
 */
export function computeGearbox(proj: GearboxProject): GearboxResult {
  const { gearbox, vehicle } = proj;
  const rTire = vehicle.tireRadius;

  const gearResults: GearResult[] = gearbox.gears.slice(0, gearbox.numGears).map((g, i) => {
    const totalRatio = g.ratio * gearbox.finalDrive;
    const curve = computeGearCurve(i + 1, totalRatio, proj);

    const speedAtPeak = speedKph(proj.engine.peakTorqueRPM, totalRatio, rTire);
    const speedAtRed  = speedKph(proj.engine.redlineRPM,    totalRatio, rTire);
    const maxFt       = curve.reduce((mx, pt) => Math.max(mx, pt.tractiveForce), 0);

    return {
      gearIndex: i + 1,
      ratio: g.ratio,
      totalRatio,
      speedAtPeakTorqueKph: speedAtPeak,
      speedAtRedlineKph: speedAtRed,
      maxTractiveForce: maxFt,
      curve,
    };
  });

  // Optimal shift RPMs
  const optimalShiftRPMs: number[] = [];
  for (let i = 0; i < gearResults.length - 1; i++) {
    optimalShiftRPMs.push(findShiftRPM(gearResults[i].totalRatio, gearResults[i + 1].totalRatio, proj));
  }

  const topGear = gearResults[gearResults.length - 1];
  const topSpeedKph = topGear?.speedAtRedlineKph ?? 0;

  const time060   = simulate0ToTarget(60,  proj, gearResults, optimalShiftRPMs);
  const time0100  = simulate0ToTarget(100, proj, gearResults, optimalShiftRPMs);

  // Gradeability: max grade sustainable in 1st gear at low speed (peak tractive - roll) / weight
  const gr1 = gearResults[0];
  const Ft1max = gr1?.maxTractiveForce ?? 0;
  const Froll  = vehicle.rollResistCoeff * vehicle.mass * G;
  const gradeFrac = Math.max(0, (Ft1max - Froll)) / (vehicle.mass * G);
  const gradeability = gradeFrac * 100;

  return {
    gears: gearResults,
    topSpeedKph,
    time060Kph: time060,
    time0100Kph: time0100,
    optimalShiftRPMs,
    gradeability,
  };
}
