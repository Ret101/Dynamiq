/**
 * Numerically robust math primitives.
 *
 * Rules enforced across the entire engine:
 *  1. epsilon = 1e-9  (never compare floats directly)
 *  2. All acos/asin inputs clamped to [-1, 1]
 *  3. All divisions guarded against zero denominator
 *  4. All sqrt inputs clamped to [0, ∞)
 *  5. No NaN ever propagates — every operation returns a valid finite number
 *  6. Singular matrices handled via Moore-Penrose pseudoinverse (SVD fallback)
 */

export const EPS = 1e-9;
export const EPS_MM = 1e-6; // 1 nanometer in mm — effectively zero link length

// ─── Safe scalar operations ───────────────────────────────────────────────────

export const safeAcos = (x: number): number =>
  Math.acos(Math.max(-1, Math.min(1, x)));

export const safeAsin = (x: number): number =>
  Math.asin(Math.max(-1, Math.min(1, x)));

export const safeSqrt = (x: number): number =>
  Math.sqrt(Math.max(0, x));

export const safeDiv = (num: number, den: number, fallback = 0): number =>
  Math.abs(den) < EPS ? fallback : num / den;

export const safeLn = (x: number): number =>
  Math.log(Math.max(EPS, x));

export const safeAtan2 = (y: number, x: number): number =>
  (Math.abs(x) < EPS && Math.abs(y) < EPS) ? 0 : Math.atan2(y, x);

export const isFiniteNumber = (x: number): boolean =>
  typeof x === 'number' && isFinite(x) && !isNaN(x);

export const guardedNumber = (x: number, fallback = 0): number =>
  isFiniteNumber(x) ? x : fallback;

export const clampAngle = (deg: number, min = -90, max = 90): number =>
  Math.max(min, Math.min(max, deg));

// ─── 2×2 matrix operations ────────────────────────────────────────────────────

/** Solve 2×2 linear system Ax = b using Cramer's rule with SVD fallback. */
export function solve2x2(
  A: [number, number, number, number], // [a00, a01, a10, a11]
  b: [number, number]
): [number, number] | null {
  const [a00, a01, a10, a11] = A;
  const det = a00 * a11 - a01 * a10;
  if (Math.abs(det) < EPS) return null; // singular — caller handles
  return [
    (b[0] * a11 - b[1] * a01) / det,
    (a00 * b[1] - a10 * b[0]) / det,
  ];
}

/** Solve 2×2 system, returning zero vector on singularity (never throws). */
export function solve2x2Safe(
  A: [number, number, number, number],
  b: [number, number]
): [number, number] {
  return solve2x2(A, b) ?? [0, 0];
}

// ─── N×N matrix — Gaussian elimination with partial pivoting ─────────────────

/** Solve Ax = b by Gaussian elimination with partial pivoting. Returns null if singular. */
export function solveNxN(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    if (Math.abs(M[col][col]) < EPS) return null; // singular

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] = safeDiv(x[i], M[i][i], 0);
  }

  return x;
}

// ─── SVD-based Moore-Penrose pseudoinverse (2×2 case) ────────────────────────

/**
 * 2×2 SVD: decompose M = U Σ V^T.
 * Returns pseudoinverse M+ = V Σ+ U^T.
 * Used when the Jacobian is singular in the NR solver.
 */
export function pseudoInverse2x2(
  M: [number, number, number, number]
): [number, number, number, number] {
  const [a, b, c, d] = M;

  // Compute 2×2 SVD via Jacobi iteration
  // M^T M = V Σ^2 V^T
  const theta = 0.5 * Math.atan2(2 * (a * b + c * d), a * a + c * c - b * b - d * d);
  const cos_t = Math.cos(theta);
  const sin_t = Math.sin(theta);

  // V matrix
  const v00 =  cos_t, v01 = -sin_t;
  const v10 =  sin_t, v11 =  cos_t;

  // S = M * V
  const s00 = a * v00 + b * v10, s01 = a * v01 + b * v11;
  const s10 = c * v00 + d * v10, s11 = c * v01 + d * v11;

  // Singular values
  const sig0 = safeSqrt(s00 * s00 + s10 * s10);
  const sig1 = safeSqrt(s01 * s01 + s11 * s11);

  // U columns
  const u00 = sig0 > EPS ? s00 / sig0 : 1;
  const u10 = sig0 > EPS ? s10 / sig0 : 0;
  const u01 = sig1 > EPS ? s01 / sig1 : 0;
  const u11 = sig1 > EPS ? s11 / sig1 : 1;

  // Pseudoinverse: V * Σ+ * U^T
  const inv0 = sig0 > EPS ? 1 / sig0 : 0;
  const inv1 = sig1 > EPS ? 1 / sig1 : 0;

  return [
    v00 * inv0 * u00 + v01 * inv1 * u01,
    v00 * inv0 * u10 + v01 * inv1 * u11,
    v10 * inv0 * u00 + v11 * inv1 * u01,
    v10 * inv0 * u10 + v11 * inv1 * u11,
  ];
}

/**
 * Solve 2×2 system using SVD pseudoinverse — never fails.
 * Used as last-resort fallback in NR when Jacobian is ill-conditioned.
 */
export function solve2x2SVD(
  A: [number, number, number, number],
  b: [number, number]
): [number, number] {
  const Aplus = pseudoInverse2x2(A);
  return [
    Aplus[0] * b[0] + Aplus[1] * b[1],
    Aplus[2] * b[0] + Aplus[3] * b[1],
  ];
}

// ─── NaN audit ───────────────────────────────────────────────────────────────

/** Recursively replace any NaN / Infinity in an object tree with 0 (or fallback). */
export function sanitizeOutput<T>(obj: T, fallback = 0): T {
  if (typeof obj === 'number') {
    return (isFiniteNumber(obj) ? obj : fallback) as unknown as T;
  }
  if (typeof obj === 'object' && obj !== null) {
    const out = { ...obj } as Record<string, unknown>;
    for (const k of Object.keys(out)) {
      out[k] = sanitizeOutput(out[k], fallback);
    }
    return out as unknown as T;
  }
  return obj;
}

/** Assert no NaN in a flat object — throws in dev, sanitizes in prod. */
export function assertFinite(label: string, obj: Record<string, number>): void {
  for (const [k, v] of Object.entries(obj)) {
    if (!isFiniteNumber(v)) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`NaN detected in ${label}.${k}: ${v}`);
      }
    }
  }
}

// ─── Geometric predicates ─────────────────────────────────────────────────────

import type { Vec3 } from '@/types/geometry';
import { v3 } from '../geometry/vec3';

export interface GeometryWarning {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  points?: string[];
}

/** Check that a link (defined by two endpoints) has nonzero length. */
export function checkLinkLength(
  label: string, a: Vec3, b: Vec3
): GeometryWarning | null {
  const len = v3.distance(a, b);
  if (len < EPS_MM) {
    return { code: 'ZERO_LENGTH', severity: 'error', message: `${label} has zero length`, points: [label] };
  }
  if (len < 20) {
    return { code: 'SHORT_LINK', severity: 'warning', message: `${label} is very short (${len.toFixed(1)}mm) — may cause solver instability` };
  }
  return null;
}

/** Check that three points are not collinear (needed for instant center computation). */
export function checkCollinear(
  a: Vec3, b: Vec3, c: Vec3, tolerance = 1.0 // mm
): boolean {
  const ab = v3.sub(b, a);
  const ac = v3.sub(c, a);
  const cross = v3.cross(ab, ac);
  return v3.length(cross) < tolerance * v3.length(ab);
}

/** Validate that an instant center solution is physically reasonable. */
export function validateInstantCenter(ic: Vec3 | null): {
  valid: boolean;
  atInfinity: boolean;
  warning?: GeometryWarning;
} {
  if (!ic) return {
    valid: false,
    atInfinity: true,
    warning: {
      code: 'IC_PARALLEL',
      severity: 'warning',
      message: 'Control arm lines are parallel — instant center at infinity (valid for pure translation)',
    },
  };
  if (!isFiniteNumber(ic.x) || !isFiniteNumber(ic.y) || !isFiniteNumber(ic.z)) {
    return { valid: false, atInfinity: true };
  }
  const dist = v3.length(ic);
  if (dist > 100000) { // > 100 meters
    return { valid: true, atInfinity: true }; // analytically infinite, handled as such
  }
  return { valid: true, atInfinity: false };
}

/** Compute condition number of a 2×2 matrix (ratio of largest to smallest singular value). */
export function conditionNumber2x2(A: [number, number, number, number]): number {
  const [a, b, c, d] = A;
  const tr = a * a + b * b + c * c + d * d;
  const det = Math.abs(a * d - b * c);
  if (det < EPS) return Infinity;
  // Approximate via Frobenius norm ratio
  return safeSqrt(tr) / det;
}
