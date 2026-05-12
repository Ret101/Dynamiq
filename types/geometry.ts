// Core 3D geometric primitives used throughout the engine

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export interface Line3 {
  point: Vec3;
  direction: Vec3;
}

export interface Plane3 {
  normal: Vec3;
  d: number; // ax + by + cz + d = 0
}

export interface Ray3 {
  origin: Vec3;
  direction: Vec3;
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface Sphere {
  center: Vec3;
  radius: number;
}

export interface LineSegment3 {
  start: Vec3;
  end: Vec3;
}

export interface Triangle3 {
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

export interface IntersectionResult {
  hit: boolean;
  point?: Vec3;
  t?: number; // parameter along ray/line
  distance?: number;
}

export type CoordinateSystem = 'SAE' | 'ISO' | 'custom';
export type Units = 'mm' | 'in' | 'm';
export type AngleUnits = 'deg' | 'rad';
