/**
 * Pacejka "Magic Formula" tire model implementation.
 *
 * Reference: H.B. Pacejka, "Tire and Vehicle Dynamics", 3rd Ed., Butterworth-Heinemann, 2012
 *
 * Implemented:
 * - Lateral force Fy (slip angle α)
 * - Longitudinal force Fx (slip ratio κ)
 * - Aligning moment Mz
 * - Combined slip (Fy + Fx using Pacejka combined-slip weights)
 * - Friction ellipse normalization
 *
 * Convention: SAE J670 — α positive for left slip, κ positive for traction.
 */

import type { PacejkaCoefficients } from '@/types/suspension';

/**
 * Core Magic Formula:
 *   F = D · sin(C · atan(B·x − E·(B·x − atan(B·x))))
 *
 * where x = slip angle (deg) or slip ratio (-).
 */
function magicFormula(B: number, C: number, D: number, E: number, x: number): number {
  const Bx = B * x;
  return D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
}

export interface TireForces {
  Fy: number;    // N lateral force
  Fx: number;    // N longitudinal force
  Mz: number;    // N·mm aligning moment
  mu_y: number;  // effective lateral friction coefficient
  mu_x: number;  // effective longitudinal friction coefficient
}

export interface FrictionEllipsePoint {
  slipAngle: number;    // deg
  slipRatio: number;    // -
  Fy: number;           // N
  Fx: number;           // N
  combinedMu: number;
}

export class PacejkaTireModel {
  private readonly coeff: PacejkaCoefficients;
  private readonly peakLateralMu: number;
  private readonly peakLongMu: number;
  private readonly designLoad: number;

  constructor(coeff: PacejkaCoefficients, peakLateralMu: number, peakLongMu: number, designLoad: number) {
    this.coeff = coeff;
    this.peakLateralMu = peakLateralMu;
    this.peakLongMu = peakLongMu;
    this.designLoad = designLoad;
  }

  /**
   * Compute lateral force Fy for a given slip angle and normal load.
   *
   * @param slipAngle  degrees (SAE: positive = vehicle sideslip to right = tire force left)
   * @param normalLoad N
   * @param camber     degrees
   */
  lateralForce(slipAngle: number, normalLoad: number, camber = 0): number {
    const { B_y, C_y, D_y, E_y } = this.coeff;
    // Scale D by load ratio relative to design load
    const loadRatio = normalLoad / this.designLoad;
    const D_scaled = D_y * normalLoad * this.peakLateralMu * loadRatio;
    // Camber effect: shifts the peak (simplified)
    const gamma = camber;
    const alpha_eff = slipAngle - gamma * 0.1; // 10% camber steer effect
    return magicFormula(B_y, C_y, D_scaled, E_y, alpha_eff);
  }

  /**
   * Compute longitudinal force Fx for a given slip ratio and normal load.
   *
   * @param slipRatio  κ = (ω·r - V) / V, dimensionless (-1 to +1)
   * @param normalLoad N
   */
  longitudinalForce(slipRatio: number, normalLoad: number): number {
    const { B_x, C_x, D_x, E_x } = this.coeff;
    const loadRatio = normalLoad / this.designLoad;
    const D_scaled = D_x * normalLoad * this.peakLongMu * loadRatio;
    return magicFormula(B_x, C_x, D_scaled, E_x, slipRatio);
  }

  /**
   * Aligning moment Mz.
   *
   * @param slipAngle  degrees
   * @param normalLoad N
   */
  aligningMoment(slipAngle: number, normalLoad: number): number {
    const { B_z, C_z, D_z, E_z } = this.coeff;
    const loadRatio = normalLoad / this.designLoad;
    const D_scaled = D_z * normalLoad * loadRatio;
    return magicFormula(B_z, C_z, D_scaled, E_z, slipAngle);
  }

  /**
   * Combined slip forces using Pacejka combined-slip weighting.
   *
   * The combined slip model reduces Fy and Fx from their pure-slip values
   * based on the total slip vector magnitude.
   *
   * Combined slip magnitude: σ = √(κ² + (tan α)²)
   * Reduction factors based on friction ellipse normalization.
   */
  combinedSlip(
    slipAngle: number,    // deg
    slipRatio: number,    // -
    normalLoad: number    // N
  ): TireForces {
    const Fy_pure = this.lateralForce(slipAngle, normalLoad);
    const Fx_pure = this.longitudinalForce(slipRatio, normalLoad);
    const Mz_pure = this.aligningMoment(slipAngle, normalLoad);

    // Friction ellipse normalization
    const { B_y, D_y, B_x, D_x } = this.coeff;
    const loadRatio = normalLoad / this.designLoad;

    // Peak forces
    const Fy_peak = D_y * normalLoad * this.peakLateralMu * loadRatio;
    const Fx_peak = D_x * normalLoad * this.peakLongMu    * loadRatio;

    // Normalized slip inputs
    const alpha_n = Math.abs(slipAngle) > 0.01
      ? Fy_pure / (Fy_peak + 1e-6)
      : 0;
    const kappa_n = Math.abs(slipRatio) > 0.001
      ? Fx_pure / (Fx_peak + 1e-6)
      : 0;

    // Combined slip magnitude
    const sigma = Math.sqrt(alpha_n ** 2 + kappa_n ** 2);

    let G_alpha = 1.0;
    let G_kappa = 1.0;

    if (sigma > 1e-4) {
      // Weights: proportion of total slip in each direction
      G_alpha = alpha_n / sigma;
      G_kappa = kappa_n / sigma;
      // Ellipse: reduce each force by its weight
      // Simplified: use friction ellipse (Fy/Fy_peak)² + (Fx/Fx_peak)² ≤ 1
      const scale = 1.0 / Math.max(sigma, 1.0); // clip to ellipse boundary
      G_alpha *= scale;
      G_kappa *= scale;
    }

    const Fy = Fy_pure * G_alpha;
    const Fx = Fx_pure * G_kappa;
    const Mz = Mz_pure * G_alpha;

    const mu_y = Math.abs(normalLoad) > 1 ? Math.abs(Fy) / normalLoad : 0;
    const mu_x = Math.abs(normalLoad) > 1 ? Math.abs(Fx) / normalLoad : 0;

    return { Fy, Fx, Mz, mu_y, mu_x };
  }

  /**
   * Generate friction ellipse data for plotting.
   */
  frictionEllipse(
    normalLoad: number,
    slipAngleMax = 12,
    slipRatioMax = 0.15,
    steps = 36
  ): FrictionEllipsePoint[] {
    const points: FrictionEllipsePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * 2 * Math.PI;
      const alpha = slipAngleMax * Math.sin(theta);
      const kappa = slipRatioMax * Math.cos(theta);
      const forces = this.combinedSlip(alpha, kappa, normalLoad);
      points.push({
        slipAngle: alpha,
        slipRatio: kappa,
        Fy: forces.Fy,
        Fx: forces.Fx,
        combinedMu: Math.sqrt(forces.mu_y ** 2 + forces.mu_x ** 2),
      });
    }
    return points;
  }

  /**
   * Generate Fy vs slip angle curve for plotting.
   */
  lateralCurve(
    normalLoad: number,
    maxSlipAngle = 15,
    steps = 60
  ): Array<{ slipAngle: number; Fy: number; mu: number }> {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const alpha = (i / steps) * maxSlipAngle * 2 - maxSlipAngle;
      const Fy = this.lateralForce(alpha, normalLoad);
      return { slipAngle: alpha, Fy, mu: Math.abs(normalLoad) > 1 ? Math.abs(Fy) / normalLoad : 0 };
    });
  }

  /**
   * Generate Fx vs slip ratio curve for plotting.
   */
  longitudinalCurve(
    normalLoad: number,
    maxSlipRatio = 0.3,
    steps = 60
  ): Array<{ slipRatio: number; Fx: number; mu: number }> {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const kappa = (i / steps) * maxSlipRatio * 2 - maxSlipRatio;
      const Fx = this.longitudinalForce(kappa, normalLoad);
      return { slipRatio: kappa, Fx, mu: Math.abs(normalLoad) > 1 ? Math.abs(Fx) / normalLoad : 0 };
    });
  }

  /**
   * Peak slip angle (angle of maximum lateral force).
   */
  peakSlipAngle(normalLoad: number): number {
    let bestAlpha = 0;
    let bestFy = 0;
    for (let alpha = 0.1; alpha <= 20; alpha += 0.1) {
      const Fy = Math.abs(this.lateralForce(alpha, normalLoad));
      if (Fy > bestFy) {
        bestFy = Fy;
        bestAlpha = alpha;
      }
    }
    return bestAlpha;
  }
}
