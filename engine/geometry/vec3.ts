import type { Vec3 } from '@/types/geometry';

const EPSILON = 1e-10;

export const v3 = {
  zero: (): Vec3 => ({ x: 0, y: 0, z: 0 }),

  create: (x: number, y: number, z: number): Vec3 => ({ x, y, z }),

  clone: (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z }),

  add: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),

  sub: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),

  scale: (a: Vec3, s: number): Vec3 => ({
    x: a.x * s,
    y: a.y * s,
    z: a.z * s,
  }),

  negate: (a: Vec3): Vec3 => ({ x: -a.x, y: -a.y, z: -a.z }),

  dot: (a: Vec3, b: Vec3): number =>
    a.x * b.x + a.y * b.y + a.z * b.z,

  cross: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),

  lengthSq: (a: Vec3): number =>
    a.x * a.x + a.y * a.y + a.z * a.z,

  length: (a: Vec3): number =>
    Math.sqrt(v3.lengthSq(a)),

  normalize: (a: Vec3): Vec3 => {
    const len = v3.length(a);
    if (len < EPSILON) return v3.zero();
    return v3.scale(a, 1 / len);
  },

  distance: (a: Vec3, b: Vec3): number =>
    v3.length(v3.sub(b, a)),

  distanceSq: (a: Vec3, b: Vec3): number =>
    v3.lengthSq(v3.sub(b, a)),

  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }),

  midpoint: (a: Vec3, b: Vec3): Vec3 => v3.lerp(a, b, 0.5),

  // Project vector a onto vector b
  project: (a: Vec3, b: Vec3): Vec3 => {
    const bLenSq = v3.lengthSq(b);
    if (bLenSq < EPSILON) return v3.zero();
    return v3.scale(b, v3.dot(a, b) / bLenSq);
  },

  // Reject (perpendicular component of a relative to b)
  reject: (a: Vec3, b: Vec3): Vec3 =>
    v3.sub(a, v3.project(a, b)),

  // Angle between two vectors in radians
  angleBetween: (a: Vec3, b: Vec3): number => {
    const denom = v3.length(a) * v3.length(b);
    if (denom < EPSILON) return 0;
    return Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b) / denom)));
  },

  // Reflect vector a about normal n (n must be normalized)
  reflect: (a: Vec3, n: Vec3): Vec3 =>
    v3.sub(a, v3.scale(n, 2 * v3.dot(a, n))),

  // Rotate vector v around axis (normalized) by angle theta (radians) — Rodrigues
  rotateAroundAxis: (v: Vec3, axis: Vec3, theta: number): Vec3 => {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const dot = v3.dot(axis, v);
    return {
      x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos),
    };
  },

  // Mirror across Y=0 plane (symmetry plane in SAE coords)
  mirrorY: (a: Vec3): Vec3 => ({ x: a.x, y: -a.y, z: a.z }),

  // Component-wise multiply
  mul: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.x * b.x,
    y: a.y * b.y,
    z: a.z * b.z,
  }),

  // Approximate equality
  approxEqual: (a: Vec3, b: Vec3, tol = EPSILON): boolean =>
    Math.abs(a.x - b.x) < tol &&
    Math.abs(a.y - b.y) < tol &&
    Math.abs(a.z - b.z) < tol,

  toArray: (a: Vec3): [number, number, number] => [a.x, a.y, a.z],

  fromArray: (arr: [number, number, number]): Vec3 => ({
    x: arr[0],
    y: arr[1],
    z: arr[2],
  }),
};
