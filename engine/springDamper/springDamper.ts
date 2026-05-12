/**
 * Spring and damper models.
 *
 * Spring types:
 *   - Linear: F = k·x
 *   - Progressive: F = k₁·x + k₂·x² (or piecewise dual-rate)
 *   - Dual-rate coilover: two rates with helper spring
 *
 * Damper types:
 *   - Linear: F = c·v
 *   - Digressive: F = c·v / (1 + d·|v|)  (plateau at high speed)
 *   - Progressive: F = c·v·(1 + p·|v|)   (increases with speed)
 *   - High/low speed with crossover velocity
 */

import type { SpringSpec, DamperSpec } from '@/types/suspension';

export interface SpringForceResult {
  force: number;       // N (positive = compression)
  rate: number;        // N/mm effective instantaneous rate
  preloadForce: number;
}

export interface DamperForceResult {
  force: number;       // N (positive = compression damping)
  coefficient: number; // N/(mm/s) effective at this velocity
}

// ──────────────────────────────────────────────────────────────────────────────
// SPRING MODEL
// ──────────────────────────────────────────────────────────────────────────────

export class SpringModel {
  private readonly spec: SpringSpec;

  constructor(spec: SpringSpec) {
    this.spec = spec;
  }

  /** Compute spring force at given compression (mm from free length). */
  force(compression: number): SpringForceResult {
    const { rate, preload, type, progressiveCoeff, dualRateBreak, dualRateHigh } = this.spec;

    const preloadForce = preload;

    switch (type) {
      case 'linear': {
        const force = rate * compression + preloadForce;
        return { force, rate, preloadForce };
      }

      case 'progressive': {
        const k_eff = rate + (progressiveCoeff ?? 0) * compression;
        const force = rate * compression + 0.5 * (progressiveCoeff ?? 0) * compression ** 2 + preloadForce;
        return { force, rate: k_eff, preloadForce };
      }

      case 'dual_rate': {
        const breakPoint = dualRateBreak ?? 25;
        const highRate   = dualRateHigh  ?? rate * 1.5;
        if (compression <= breakPoint) {
          const force = rate * compression + preloadForce;
          return { force, rate, preloadForce };
        } else {
          const forceAtBreak = rate * breakPoint;
          const excessCompression = compression - breakPoint;
          const force = forceAtBreak + highRate * excessCompression + preloadForce;
          return { force, rate: highRate, preloadForce };
        }
      }
    }
  }

  /** Ride frequency at given wheel rate and corner mass (Hz). */
  static rideFrequency(wheelRate: number, cornerMass: number): number {
    // f = (1/(2π)) · √(k_wheel / m_corner)
    // k_wheel in N/mm → N/m: × 1000
    const k_SI = wheelRate * 1000; // N/m
    return (1 / (2 * Math.PI)) * Math.sqrt(k_SI / cornerMass);
  }

  /** Corner mass for a given total mass and weight distribution. */
  static cornerMass(totalMass: number, frontFrac: number, position: 'front' | 'rear'): number {
    const axleMass = position === 'front' ? totalMass * frontFrac : totalMass * (1 - frontFrac);
    return axleMass / 2;
  }

  /** Generate force-deflection curve. */
  forceCurve(maxCompression: number, steps = 100): Array<{ deflection: number; force: number; rate: number }> {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const deflection = (i / steps) * maxCompression;
      const result = this.force(deflection);
      return { deflection, force: result.force, rate: result.rate };
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DAMPER MODEL
// ──────────────────────────────────────────────────────────────────────────────

export class DamperModel {
  private readonly spec: DamperSpec;

  constructor(spec: DamperSpec) {
    this.spec = spec;
  }

  /**
   * Compute damper force at given velocity (mm/s).
   * Positive velocity = compression.
   * Positive force = compression (resists jounce).
   */
  force(velocity: number): DamperForceResult {
    const {
      compressionLowSpeed, compressionHighSpeed,
      reboundLowSpeed, reboundHighSpeed,
      crossoverVelocity, type, digressiveCoeff,
    } = this.spec;

    const absV = Math.abs(velocity);
    const isCompression = velocity >= 0;

    let c_low  = isCompression ? compressionLowSpeed  : reboundLowSpeed;
    let c_high = isCompression ? compressionHighSpeed : reboundHighSpeed;

    let force: number;
    let coefficient: number;

    switch (type) {
      case 'linear': {
        coefficient = c_low;
        force = coefficient * velocity;
        break;
      }

      case 'digressive': {
        // F = c_low · v / (1 + d · |v|)
        const d = digressiveCoeff ?? 0.01;
        coefficient = c_low / (1 + d * absV);
        force = coefficient * velocity;
        break;
      }

      case 'progressive': {
        // High/low speed with linear interpolation at crossover
        if (absV <= crossoverVelocity) {
          coefficient = c_low;
        } else {
          // Linear transition from low to high speed coefficient
          const t = Math.min(1, (absV - crossoverVelocity) / crossoverVelocity);
          coefficient = c_low + (c_high - c_low) * t;
        }
        force = coefficient * velocity;
        break;
      }
    }

    return { force, coefficient };
  }

  /** Generate damper dyno curve (force vs velocity). */
  dynoCurve(
    maxVelocity = 300,
    steps = 120
  ): Array<{ velocity: number; force: number; coefficient: number }> {
    const points = [];
    for (let i = -steps; i <= steps; i++) {
      const velocity = (i / steps) * maxVelocity;
      const result = this.force(velocity);
      points.push({ velocity, force: result.force, coefficient: result.coefficient });
    }
    return points;
  }

  /** Critical damping ratio at a given ride frequency and wheel rate. */
  dampingRatio(rideFrequencyHz: number, cornerMass: number): number {
    // ζ = c / (2 · √(k · m))
    // c = low speed compression coefficient (N/(mm/s)) = N·s/mm → N·s/m: × 1000
    const c_SI = this.spec.compressionLowSpeed * 1000; // N·s/m
    const k_SI = (this.spec.compressionLowSpeed + this.spec.reboundLowSpeed) * 1000; // placeholder
    const cc = 2 * Math.sqrt(k_SI * cornerMass); // critical damping
    return cc > 0 ? c_SI / cc : 0;
  }
}
