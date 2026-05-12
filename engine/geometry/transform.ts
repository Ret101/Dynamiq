/**
 * 4×4 homogeneous transformation matrices for suspension linkage positioning.
 * Row-major storage: M[row*4 + col].
 */

import type { Vec3, Mat4 } from '@/types/geometry';

export function mat4Identity(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
}

export function mat4TransformVec3(m: Mat4, v: Vec3): Vec3 {
  const x = m[0]*v.x + m[1]*v.y + m[2]*v.z  + m[3];
  const y = m[4]*v.x + m[5]*v.y + m[6]*v.z  + m[7];
  const z = m[8]*v.x + m[9]*v.y + m[10]*v.z + m[11];
  const w = m[12]*v.x + m[13]*v.y + m[14]*v.z + m[15];
  return { x: x/w, y: y/w, z: z/w };
}

export function mat4Translation(tx: number, ty: number, tz: number): Mat4 {
  return [
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1,
  ];
}

export function mat4RotationX(theta: number): Mat4 {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [
    1, 0,  0, 0,
    0, c, -s, 0,
    0, s,  c, 0,
    0, 0,  0, 1,
  ];
}

export function mat4RotationY(theta: number): Mat4 {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [
     c, 0, s, 0,
     0, 1, 0, 0,
    -s, 0, c, 0,
     0, 0, 0, 1,
  ];
}

export function mat4RotationZ(theta: number): Mat4 {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [
    c, -s, 0, 0,
    s,  c, 0, 0,
    0,  0, 1, 0,
    0,  0, 0, 1,
  ];
}

/** Rigid body transform: rotate about X then Y then Z, then translate. */
export function mat4RigidBody(
  tx: number, ty: number, tz: number,
  rx: number, ry: number, rz: number
): Mat4 {
  return mat4Mul(
    mat4Translation(tx, ty, tz),
    mat4Mul(mat4RotationZ(rz), mat4Mul(mat4RotationY(ry), mat4RotationX(rx)))
  );
}

/** Invert a rigid-body (rotation + translation only) transform. */
export function mat4InvertRigid(m: Mat4): Mat4 {
  // R^T and -R^T * t
  const out: Mat4 = [...m] as Mat4;
  // Transpose rotation block
  out[1] = m[4]; out[4] = m[1];
  out[2] = m[8]; out[8] = m[2];
  out[6] = m[9]; out[9] = m[6];
  // New translation: -R^T * t
  out[3]  = -(out[0]*m[3] + out[1]*m[7] + out[2]*m[11]);
  out[7]  = -(out[4]*m[3] + out[5]*m[7] + out[6]*m[11]);
  out[11] = -(out[8]*m[3] + out[9]*m[7] + out[10]*m[11]);
  return out;
}
