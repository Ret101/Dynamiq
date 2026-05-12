/**
 * 3D geometric intersection routines used throughout the kinematic solver.
 * All coordinates are in mm (SAE: X forward, Y left, Z up).
 */

import type { Vec3, Line3, Plane3, IntersectionResult } from '@/types/geometry';
import { v3 } from './vec3';

const EPSILON = 1e-10;

/**
 * Closest point on a line to a given point.
 */
export function closestPointOnLine(line: Line3, point: Vec3): Vec3 {
  const t = v3.dot(v3.sub(point, line.point), line.direction) /
            v3.lengthSq(line.direction);
  return v3.add(line.point, v3.scale(line.direction, t));
}

/**
 * Distance from a point to a line.
 */
export function distancePointToLine(line: Line3, point: Vec3): number {
  return v3.length(v3.cross(v3.sub(point, line.point), line.direction)) /
         v3.length(line.direction);
}

/**
 * Closest points between two skew lines (or their intersection if they intersect).
 * Returns the two closest points (one on each line) and the parameter values.
 *
 * Uses the standard skew-line algorithm:
 *   P = line1.point + s * line1.direction
 *   Q = line2.point + t * line2.direction
 *   minimize |P - Q|²
 */
export function closestPointsBetweenLines(
  l1: Line3,
  l2: Line3
): { p1: Vec3; p2: Vec3; s: number; t: number; distance: number } {
  const r = v3.sub(l1.point, l2.point);
  const e = v3.dot(l1.direction, l1.direction);
  const f = v3.dot(l2.direction, l2.direction);
  const g = v3.dot(l1.direction, r);

  const denom = e * f - v3.dot(l1.direction, l2.direction) ** 2;
  let s: number;
  let t: number;

  if (Math.abs(denom) < EPSILON) {
    // Parallel lines
    s = 0;
    t = g / v3.dot(l2.direction, l1.direction);
  } else {
    const h = v3.dot(l2.direction, r);
    s = (v3.dot(l1.direction, l2.direction) * h - f * g) / denom;
    t = (e * h - v3.dot(l1.direction, l2.direction) * g) / denom;
  }

  const p1 = v3.add(l1.point, v3.scale(l1.direction, s));
  const p2 = v3.add(l2.point, v3.scale(l2.direction, t));
  return { p1, p2, s, t, distance: v3.distance(p1, p2) };
}

/**
 * Intersect two lines in 2D (x, z plane — front view).
 * Returns null if parallel.
 */
export function intersectLines2D(
  p1: Vec3, d1: Vec3,
  p2: Vec3, d2: Vec3
): Vec3 | null {
  // Solve: p1 + s*d1 = p2 + t*d2 (in x,z)
  const denom = d1.x * d2.z - d1.z * d2.x;
  if (Math.abs(denom) < EPSILON) return null;

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const s = (dx * d2.z - dz * d2.x) / denom;

  return {
    x: p1.x + s * d1.x,
    y: 0, // 2D result; y is irrelevant
    z: p1.z + s * d1.z,
  };
}

/**
 * Intersect two line segments in 2D (x, z) — front view.
 * Extends segments to infinite lines for IC computation.
 */
export function intersectLineSegments2DExtended(
  a1: Vec3, a2: Vec3,
  b1: Vec3, b2: Vec3
): Vec3 | null {
  return intersectLines2D(
    a1, v3.sub(a2, a1),
    b1, v3.sub(b2, b1)
  );
}

/**
 * Intersect a ray with a plane: n·(P - P0) = 0
 */
export function intersectRayPlane(
  rayOrigin: Vec3,
  rayDir: Vec3,
  plane: Plane3
): IntersectionResult {
  const denom = v3.dot(plane.normal, rayDir);
  if (Math.abs(denom) < EPSILON) return { hit: false };

  const t = -(v3.dot(plane.normal, rayOrigin) + plane.d) / denom;
  if (t < 0) return { hit: false };

  return {
    hit: true,
    t,
    point: v3.add(rayOrigin, v3.scale(rayDir, t)),
  };
}

/**
 * Intersect a line (infinite) with a plane.
 */
export function intersectLinePlane(
  line: Line3,
  plane: Plane3
): IntersectionResult {
  return intersectRayPlane(line.point, line.direction, plane);
}

/**
 * Instantaneous center (2D front-view) of a control arm defined by two chassis pickups
 * and one upright attachment.
 *
 * The instant center of each arm is the intersection of its projection
 * (extended to the front view X-Z plane, i.e., Y=constant plane passing through
 * the arm's midpoints projected).
 *
 * For a wishbone: IC is intersection of lines through [front_chassis, front_upright]
 * extended infinitely, treating each as a 2D line in the (lateral=Y, vertical=Z) plane.
 *
 * SAE convention: Y is lateral (left positive), Z is up.
 * Front view: we look along X, see Y (horizontal) and Z (vertical).
 */
export function computeWishboneIC(
  chassisFront: Vec3,
  chassisRear: Vec3,
  upright: Vec3
): Vec3 | null {
  // Project onto front view: use Y (lateral) and Z (vertical)
  // Line through chassisFront-upright
  // Line through chassisRear-upright → they share the upright point
  // Actually: IC is intersection of the two lines through the TWO chassis points and their corresponding upright point
  // But a wishbone has ONE upright ballpoint; the IC is found by intersecting the lines drawn through
  // EACH chassis-to-upright link direction.
  // Correct: Extend the line from chassisFront through upright, and chassisRear through upright —
  // both pass through the upright point, so intersection IS the upright → not meaningful.
  //
  // Correct wishbone IC: the control arm as a rigid body rotates about an axis connecting
  // the two chassis pickups. The instant center in front view is the intersection of:
  //   - Line through chassisFront perpendicular to the arm... No.
  //
  // Correct method: IC in FRONT VIEW is intersection of the chassis-pivot axis extended
  // AND the upright-pivot axis extended, projected onto the Y-Z plane.
  //
  // For a simple A-arm: the arm rotates about the axis (chassisFront → chassisRear).
  // The 2D front-view IC is found by extending the arm's front-view projected pivot line.
  // → project chassisFront, chassisRear, upright onto Y-Z plane; the IC is at the intersection
  //   of line(chassisFront_yz, chassisRear_yz) and line from upright parallel to global Y... no.
  //
  // CORRECT approach for double wishbone front-view IC:
  // The UCA IC = intersection of the line thru (UCA chassis pivots projected to YZ) with the
  //              line thru (UCA upright joint and extending outboard)
  // Actually the standard textbook method:
  // - The FVIC of the UCA is the intersection of the UCA chord line (chassis front → chassis rear)
  //   EXTENDED and the FVIC of the upright (which is simply a point at the upright ballpoint).
  // → Then the overall suspension FVIC = intersection of:
  //       Line A: from UCA_upright through UCA_FVIC (i.e., along the UCA projected direction)
  //       Line B: from LCA_upright through LCA_FVIC (i.e., along LCA projected direction)
  //
  // Simplification used in practice: the IC in front view is determined by
  // extending lines through chassis pickups of each arm.
  // For each arm individually, the IC is at infinity when viewed from the front if the arm is horizontal.
  //
  // Standard method for DOUBLE WISHBONE:
  //   UCA: Line through (ucaFrontChassis_yz, ucaRearChassis_yz) → direction of UCA pivot axis in FV
  //        Line through (ucaUpright_yz, perpendicular) — upright traces arc about IC
  //   IC_UCA is where: line(ucaFrontChassis_yz → ucaRearChassis_yz) intersects vertical at upright.
  //   This is not right either.
  //
  // THE ACTUAL correct textbook answer:
  // FVIC = intersection of:
  //   Line 1: thru UCA chassis outboard end (upright) and UCA inboard pivot projected to FV
  //   Line 2: thru LCA chassis outboard end (upright) and LCA inboard pivot projected to FV
  // Where the "inboard pivot projected" is the intersection of the 3D inboard pivot axis with
  // a vertical transverse plane.
  //
  // This function takes the simplified inputs: front/rear chassis pickups and upright of ONE arm.
  // It returns the direction of that arm's line in the front view.
  // Caller intersects UCA and LCA lines to get the true FVIC.

  // Project onto Y-Z plane
  const pCF = { y: chassisFront.y, z: chassisFront.z };
  const pCR = { y: chassisRear.y, z: chassisRear.z };
  const pU  = { y: upright.y,     z: upright.z };

  // Midpoint of chassis pivots in YZ
  const mid = { y: (pCF.y + pCR.y) / 2, z: (pCF.z + pCR.z) / 2 };

  // Direction from midpoint to upright in YZ
  const dir = { y: pU.y - mid.y, z: pU.z - mid.z };

  // Return: a line in YZ passing through upright with direction from chassis-mid → upright
  // The IC is found by calling this for UCA and LCA and intersecting those two lines.
  // Return the line as two points for intersection.
  return {
    x: 0,
    y: pU.y + dir.y * 1e6, // far point along direction
    z: pU.z + dir.z * 1e6,
  };
}

/**
 * Compute the front-view instant center of the suspension.
 *
 * Projects all points to the Y-Z plane (front view, SAE coords).
 * Returns IC as a Vec3 with x=0.
 *
 * References:
 *   Dixon, J.C. "Tires, Suspension and Handling" (1991)
 *   Milliken & Milliken "Race Car Vehicle Dynamics" (1995)
 */
export function computeFrontViewIC(
  ucaChassisFront: Vec3, ucaChassisRear: Vec3, ucaUpright: Vec3,
  lcaChassisFront: Vec3, lcaChassisRear: Vec3, lcaUpright: Vec3
): Vec3 | null {
  // Project to Y-Z plane
  // UCA arm direction in YZ: from arm inboard midpoint to arm outboard (upright)
  const ucaMid  = { y: (ucaChassisFront.y + ucaChassisRear.y) / 2, z: (ucaChassisFront.z + ucaChassisRear.z) / 2 };
  const lcaMid  = { y: (lcaChassisFront.y + lcaChassisRear.y) / 2, z: (lcaChassisFront.z + lcaChassisRear.z) / 2 };
  const ucaUpr  = { y: ucaUpright.y, z: ucaUpright.z };
  const lcaUpr  = { y: lcaUpright.y, z: lcaUpright.z };

  // Line 1 (UCA): through ucaMid → ucaUpr, extend to IC
  // Line 2 (LCA): through lcaMid → lcaUpr, extend to IC
  // Intersection in 2D (Y horizontal, Z vertical):
  const d1y = ucaUpr.y - ucaMid.y;
  const d1z = ucaUpr.z - ucaMid.z;
  const d2y = lcaUpr.y - lcaMid.y;
  const d2z = lcaUpr.z - lcaMid.z;

  const denom = d1y * d2z - d1z * d2y;
  if (Math.abs(denom) < EPSILON) return null; // parallel arms → IC at infinity

  const dy = lcaMid.y - ucaMid.y;
  const dz = lcaMid.z - ucaMid.z;
  const t = (dy * d2z - dz * d2y) / denom;

  return {
    x: 0,
    y: ucaMid.y + t * d1y,
    z: ucaMid.z + t * d1z,
  };
}

/**
 * Compute roll center from two front-view ICs (left and right corners)
 * and their respective contact patches.
 *
 * Roll center = intersection of:
 *   Line (IC_left  → contact_patch_left)
 *   Line (IC_right → contact_patch_right)
 *
 * Result is in Y-Z plane (x=0).
 */
export function computeRollCenter(
  icLeft: Vec3,  contactLeft: Vec3,
  icRight: Vec3, contactRight: Vec3
): Vec3 | null {
  // Line 1: from icLeft to contactLeft in YZ
  const d1y = contactLeft.y  - icLeft.y;
  const d1z = contactLeft.z  - icLeft.z;
  // Line 2: from icRight to contactRight in YZ
  const d2y = contactRight.y - icRight.y;
  const d2z = contactRight.z - icRight.z;

  const denom = d1y * d2z - d1z * d2y;
  if (Math.abs(denom) < EPSILON) {
    // IC-to-contact lines are parallel: roll center is at infinity.
    // This occurs when the arms produce a very high or unreachable RC.
    // Returning null lets callers treat it as zero geometric LLT contribution
    // rather than fabricating an unphysical on-centreline value.
    return null;
  }

  const dy = icRight.y - icLeft.y;
  const dz = icRight.z - icLeft.z;
  const t = (dy * d2z - dz * d2y) / denom;

  return {
    x: 0,
    y: icLeft.y + t * d1y,
    z: icLeft.z + t * d1z,
  };
}
