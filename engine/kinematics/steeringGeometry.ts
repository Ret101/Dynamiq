/**
 * Steering geometry solver: Ackermann, turn radius, bump steer vs steer.
 *
 * Ackermann geometry:
 *   For pure rolling (no slip), the inside wheel turns more than the outside.
 *   Pure Ackermann: tan(delta_i) / tan(delta_o) = (track / 2) / (wheelbase)
 *   Ackermann % = (delta_i - delta_o) / (delta_i_ackermann - delta_o) × 100
 *
 * Bellcrank model:
 *   The bellcrank rotates about a fixed pivot. The input arm (length L_in) is driven
 *   by the steering column (primary ratio = steeringRatio deg_SW/deg_crank). The output
 *   arm (length L_out, at angle `armAngle` from input arm) moves the tie rod.
 *
 *   phi   = sw_angle / steeringRatio          (bellcrank rotation, deg)
 *   phi_0 = preloadAngle                       (arm angle at center, deg)
 *
 *   Output displacement:
 *     d = L_out * [ sin(phi_0 + phi) - sin(phi_0) ]
 *
 *   Instantaneous ratio (deg_SW per mm of output):
 *     K(phi) = steeringRatio / [ L_out * cos(phi_0 + phi) * RAD ]
 */

import type { SteeringSystem, BellcrankSpec } from '@/types/suspension';
import type { SteeringGeometry } from '@/types/kinematics';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export class SteeringGeometrySolver {
  private readonly steering: SteeringSystem;
  private readonly wheelbase: number;
  private readonly trackFront: number;

  constructor(steering: SteeringSystem, wheelbase: number, trackFront: number) {
    this.steering = steering;
    this.wheelbase = wheelbase;
    this.trackFront = trackFront;
  }

  /**
   * Convert steering wheel angle (degrees) to effective rack/output displacement (mm).
   * Uses bellcrank model when enabled, otherwise linear rack.
   */
  private swAngleToRack(swAngle: number): number {
    const { rackTravel, steeringRatio, bellcrank } = this.steering;
    const maxDisp = rackTravel / 2;

    if (bellcrank?.enabled) {
      const bc = bellcrank;
      const phi0 = bc.preloadAngle * RAD;
      const phi  = (swAngle / steeringRatio) * RAD; // bellcrank rotation in radians
      const disp = bc.outputArmLength * (Math.sin(phi0 + phi) - Math.sin(phi0));
      return Math.max(-maxDisp, Math.min(maxDisp, disp));
    }

    return Math.max(-maxDisp, Math.min(maxDisp, swAngle / steeringRatio));
  }

  /**
   * Compute effective steering ratio (deg_SW per mm of output) at a given sw angle.
   * Returns the instantaneous ratio — useful for non-linearity plots.
   */
  effectiveRatioAt(swAngle: number): number {
    const { steeringRatio, bellcrank } = this.steering;
    if (!bellcrank?.enabled) return steeringRatio;

    const phi0 = bellcrank.preloadAngle * RAD;
    const phi  = (swAngle / steeringRatio) * RAD;
    const cosVal = Math.cos(phi0 + phi);
    if (Math.abs(cosVal) < 0.001) return Infinity;
    // d(disp)/d(swAngle) = L_out * cos(phi0+phi) / steeringRatio (in mm/deg_SW)
    // ratio = deg_SW / mm = steeringRatio / (L_out * cos(phi0+phi) * RAD)
    return steeringRatio / (bellcrank.outputArmLength * cosVal * RAD);
  }

  /**
   * Compute steering geometry at a given steering wheel angle (degrees).
   */
  solve(steeringWheelAngle: number): SteeringGeometry {
    const rackDisp = this.swAngleToRack(steeringWheelAngle);
    return this.solveFromRack(rackDisp, steeringWheelAngle);
  }

  /**
   * Solve geometry from rack/output travel (mm).
   * Positive rack = steer left (inside wheel = left).
   */
  solveFromRack(rackTravel: number, swAngleOverride?: number): SteeringGeometry {
    const { wheelbase, trackFront } = this;
    const { steeringRatio } = this.steering;

    const steeringWheelAngle = swAngleOverride ?? rackTravel * steeringRatio;

    const baseAngle = Math.atan2(rackTravel, wheelbase) * DEG;

    let leftToe: number;
    let rightToe: number;

    if (Math.abs(rackTravel) < 0.01) {
      leftToe  = 0;
      rightToe = 0;
    } else {
      const R = wheelbase / Math.tan(Math.abs(baseAngle) * RAD);

      const insideAngle_ackermann  = Math.atan2(wheelbase, R - trackFront / 2) * DEG;
      const outsideAngle_ackermann = Math.atan2(wheelbase, R + trackFront / 2) * DEG;

      const ackermannFraction = this.steering.ackermann / 100;

      if (rackTravel > 0) {
        leftToe  = -(insideAngle_ackermann  * ackermannFraction + baseAngle * (1 - ackermannFraction));
        rightToe =  (outsideAngle_ackermann * ackermannFraction + baseAngle * (1 - ackermannFraction));
      } else {
        rightToe = -(insideAngle_ackermann  * ackermannFraction + baseAngle * (1 - ackermannFraction));
        leftToe  =  (outsideAngle_ackermann * ackermannFraction + baseAngle * (1 - ackermannFraction));
      }
    }

    const ackermann = this.computeAckermannPercent(leftToe, rightToe, rackTravel);

    const avgToe = (Math.abs(leftToe) + Math.abs(rightToe)) / 2;
    const turningRadius = avgToe > 0.01
      ? wheelbase / Math.tan(avgToe * RAD)
      : Infinity;

    const insideAngle  = rackTravel > 0 ? Math.abs(leftToe)  : Math.abs(rightToe);
    const outsideAngle = rackTravel > 0 ? Math.abs(rightToe) : Math.abs(leftToe);

    return {
      steerAngle: steeringWheelAngle,
      rackTravel,
      frontLeft:  { toeAngle: leftToe,  turnRadius: turningRadius },
      frontRight: { toeAngle: rightToe, turnRadius: turningRadius },
      ackermann,
      insideAngle,
      outsideAngle,
      turningRadius,
      scrubAngle: 0,
    };
  }

  /**
   * Compute Ackermann percentage from actual wheel angles.
   * 0% = parallel steer, 100% = pure Ackermann.
   */
  private computeAckermannPercent(leftToe: number, rightToe: number, rackTravel: number): number {
    if (Math.abs(rackTravel) < 0.01) return 0;
    const { wheelbase, trackFront } = this;

    const avgAngle = (Math.abs(leftToe) + Math.abs(rightToe)) / 2;
    if (avgAngle < 0.001) return 0;

    const R = wheelbase / Math.tan(avgAngle * RAD);
    const insideAngle_actual  = rackTravel > 0 ? Math.abs(leftToe)  : Math.abs(rightToe);
    const outsideAngle_actual = rackTravel > 0 ? Math.abs(rightToe) : Math.abs(leftToe);
    const insideAngle_ack     = Math.atan2(wheelbase, R - trackFront / 2) * DEG;
    const insideAngle_para    = outsideAngle_actual;

    if (Math.abs(insideAngle_ack - insideAngle_para) < 0.001) return 0;

    return ((insideAngle_actual - insideAngle_para) / (insideAngle_ack - insideAngle_para)) * 100;
  }

  /** Generate Ackermann curve across full steer range (steps points). */
  generateAckermannCurve(steps = 50): Array<{ steerAngle: number; ackermann: number }> {
    const maxSteerAngle = this.maxSteeringWheelAngle();
    const results = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const angle = t * maxSteerAngle;
      const geom = this.solve(angle);
      results.push({ steerAngle: angle, ackermann: geom.ackermann });
    }
    return results;
  }

  /**
   * Approximate max useful steering wheel angle.
   * For bellcrank: angle at which output reaches ±rackTravel/2.
   * For linear: (rackTravel/2) * steeringRatio.
   */
  maxSteeringWheelAngle(): number {
    const { rackTravel, steeringRatio, bellcrank } = this.steering;
    if (!bellcrank?.enabled) return (rackTravel / 2) * steeringRatio;

    const { outputArmLength, preloadAngle } = bellcrank;
    const phi0 = preloadAngle * RAD;
    const maxDisp = rackTravel / 2;
    // Solve: outputArmLength * (sin(phi0 + phi) - sin(phi0)) = maxDisp
    // sin(phi0 + phi) = maxDisp/outputArmLength + sin(phi0)
    const sinVal = Math.min(1, maxDisp / outputArmLength + Math.sin(phi0));
    const phiMax = Math.asin(sinVal) - phi0; // radians
    return (phiMax * DEG) * steeringRatio;
  }

  /**
   * Generate bellcrank ratio curve: effective ratio vs steering wheel angle.
   * Returns null when no bellcrank is configured.
   */
  generateRatioCurve(steps = 60): Array<{ swAngle: number; ratio: number }> | null {
    if (!this.steering.bellcrank?.enabled) return null;
    const maxAngle = this.maxSteeringWheelAngle();
    const results = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const swAngle = t * maxAngle;
      results.push({ swAngle, ratio: this.effectiveRatioAt(swAngle) });
    }
    return results;
  }

  /**
   * Generate wheel steer angle vs steering wheel angle curve.
   * Useful for visualizing the non-linear response.
   */
  generateWheelAngleCurve(steps = 60): Array<{ swAngle: number; wheelAngle: number }> {
    const maxAngle = this.maxSteeringWheelAngle();
    const results = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 - 1;
      const swAngle = t * maxAngle;
      const geom = this.solve(swAngle);
      const avgWheel = (Math.abs(geom.frontLeft.toeAngle) + Math.abs(geom.frontRight.toeAngle)) / 2;
      results.push({ swAngle, wheelAngle: swAngle >= 0 ? avgWheel : -avgWheel });
    }
    return results;
  }
}
