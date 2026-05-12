/**
 * Model Validator — detects geometric, physical, and numerical issues in
 * a vehicle suspension model before the solver runs.
 *
 * Runs automatically on every hardpoint change (debounced).
 * Results displayed in the UI as engineering warnings.
 */

import type { VehicleSpec } from '@/types/suspension';
import type { CornerHardpoints } from '@/types/hardpoint';
import type { Vec3 } from '@/types/geometry';
import { v3 } from '../geometry/vec3';
import {
  checkLinkLength, checkCollinear, GeometryWarning, EPS_MM
} from './robust';

export interface ValidationResult {
  isValid: boolean;
  errors: GeometryWarning[];
  warnings: GeometryWarning[];
  infos: GeometryWarning[];
}

/** Run all validation checks on a vehicle model. */
export function validateVehicle(vehicle: VehicleSpec): ValidationResult {
  const errors: GeometryWarning[] = [];
  const warnings: GeometryWarning[] = [];
  const infos: GeometryWarning[] = [];

  const pushAll = (ws: (GeometryWarning | null)[]) => {
    for (const w of ws) {
      if (!w) continue;
      if (w.severity === 'error')   errors.push(w);
      if (w.severity === 'warning') warnings.push(w);
      if (w.severity === 'info')    infos.push(w);
    }
  };

  // Validate each corner
  const hp = vehicle.allHardpoints;
  pushAll(validateCorner('Front Left',  hp.frontLeft));
  pushAll(validateCorner('Front Right', hp.frontRight));
  pushAll(validateCorner('Rear Left',   hp.rearLeft));
  pushAll(validateCorner('Rear Right',  hp.rearRight));

  // Vehicle-level checks
  pushAll(validateVehicleLevel(vehicle));

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    infos,
  };
}

function validateCorner(name: string, hp: CornerHardpoints): GeometryWarning[] {
  const results: GeometryWarning[] = [];
  const push = (w: GeometryWarning | null) => { if (w) results.push(w); };

  // ── Link length checks ──
  push(checkLinkLength(`${name} UCA (front)`, hp.ucaFrontChassis.position, hp.ucaUpright.position));
  push(checkLinkLength(`${name} UCA (rear)`,  hp.ucaChassisRear.position,  hp.ucaUpright.position));
  push(checkLinkLength(`${name} LCA (front)`, hp.lcaFrontChassis.position, hp.lcaUpright.position));
  push(checkLinkLength(`${name} LCA (rear)`,  hp.lcaChassisRear.position,  hp.lcaUpright.position));
  push(checkLinkLength(`${name} Tie Rod`,     hp.tieRodChassis.position,   hp.tieRodUpright.position));
  push(checkLinkLength(`${name} Shock`,       hp.shockChassis.position,    hp.shockUpright.position));
  push(checkLinkLength(`${name} Upright`,     hp.ucaUpright.position,      hp.lcaUpright.position));

  // ── Collinearity checks ──
  // If UCA chassis pickups and upright are collinear → degenerate arm
  if (checkCollinear(hp.ucaFrontChassis.position, hp.ucaChassisRear.position, hp.ucaUpright.position)) {
    results.push({
      code: 'UCA_COLLINEAR',
      severity: 'error',
      message: `${name}: UCA chassis pickups and upright are collinear — arm has no triangulation. Pivot axis passes through ball joint.`,
    });
  }

  if (checkCollinear(hp.lcaFrontChassis.position, hp.lcaChassisRear.position, hp.lcaUpright.position)) {
    results.push({
      code: 'LCA_COLLINEAR',
      severity: 'error',
      message: `${name}: LCA chassis pickups and upright are collinear`,
    });
  }

  // ── Wheel center below ground ──
  if (hp.wheelCenter.position.z < -1) {
    results.push({
      code: 'WHEEL_BELOW_GROUND',
      severity: 'error',
      message: `${name}: Wheel center is below ground (Z = ${hp.wheelCenter.position.z.toFixed(1)}mm)`,
    });
  }

  // ── Contact patch at ground level ──
  if (Math.abs(hp.contactPatch.position.z) > 5) {
    results.push({
      code: 'CONTACT_NOT_GROUND',
      severity: 'warning',
      message: `${name}: Contact patch Z = ${hp.contactPatch.position.z.toFixed(1)}mm (expected ~0)`,
    });
  }

  // ── UCA above LCA check ──
  if (hp.ucaUpright.position.z <= hp.lcaUpright.position.z) {
    results.push({
      code: 'UCA_BELOW_LCA',
      severity: 'error',
      message: `${name}: UCA outboard Z (${hp.ucaUpright.position.z.toFixed(1)}) is not above LCA (${hp.lcaUpright.position.z.toFixed(1)}) — inverted suspension geometry`,
    });
  }

  // ── Symmetry check (left corner Y should be positive, right negative) ──
  const side = hp.wheelCenter.side;
  const wcY  = hp.wheelCenter.position.y;
  if (side === 'left'  && wcY < 0) {
    results.push({ code: 'WRONG_SIDE', severity: 'warning', message: `${name}: Left corner has negative Y wheel center` });
  }
  if (side === 'right' && wcY > 0) {
    results.push({ code: 'WRONG_SIDE', severity: 'warning', message: `${name}: Right corner has positive Y wheel center` });
  }

  // ── Shock length vs ride height ──
  const shockLen = v3.distance(hp.shockChassis.position, hp.shockUpright.position);
  if (shockLen < 50) {
    results.push({ code: 'SHORT_SHOCK', severity: 'warning', message: `${name}: Shock/spring length is very short (${shockLen.toFixed(0)}mm)` });
  }
  if (shockLen > 600) {
    results.push({ code: 'LONG_SHOCK', severity: 'warning', message: `${name}: Shock length > 600mm — verify spring rate and stroke` });
  }

  // ── Kingpin inclination sanity ──
  const kpVec = v3.sub(hp.ucaUpright.position, hp.lcaUpright.position);
  const kpLen = v3.length(kpVec);
  if (kpLen < 30) {
    results.push({ code: 'SHORT_KINGPIN', severity: 'warning', message: `${name}: Kingpin axis span is only ${kpLen.toFixed(0)}mm — upright may be degenerate` });
  }

  // ── Scrub radius sign warning ──
  // Scrub radius = wheel center Y − kingpin ground intercept Y
  // KP ground intercept: extrapolate kp axis to z=0
  const kpPoint = hp.lcaUpright.position;
  if (Math.abs(kpVec.z) > EPS_MM) {
    const t = -kpPoint.z / kpVec.z;
    const kpGroundY = kpPoint.y + t * kpVec.y;
    const scrub = Math.abs(hp.wheelCenter.position.y) - Math.abs(kpGroundY);
    if (Math.abs(scrub) > 60) {
      results.push({
        code: 'LARGE_SCRUB',
        severity: 'warning',
        message: `${name}: Scrub radius is ${scrub.toFixed(0)}mm — consider moving kingpin axis`,
      });
    }
  }

  return results;
}

function validateVehicleLevel(vehicle: VehicleSpec): GeometryWarning[] {
  const results: GeometryWarning[] = [];

  // CG height sanity
  if (vehicle.cgHeight < 50) {
    results.push({ code: 'LOW_CG', severity: 'warning', message: `CG height ${vehicle.cgHeight}mm is unrealistically low (< 50mm)` });
  }
  if (vehicle.cgHeight > 800) {
    results.push({ code: 'HIGH_CG', severity: 'warning', message: `CG height ${vehicle.cgHeight}mm is very high (> 800mm)` });
  }

  // Weight distribution
  if (vehicle.frontWeightDist < 0.3 || vehicle.frontWeightDist > 0.75) {
    results.push({ code: 'WEIGHT_DIST', severity: 'warning', message: `Front weight distribution ${(vehicle.frontWeightDist * 100).toFixed(0)}% is unusual` });
  }

  // Mass
  if (vehicle.mass < 100) {
    results.push({ code: 'LOW_MASS', severity: 'warning', message: `Total mass ${vehicle.mass}kg seems low` });
  }

  // Track vs wheelbase
  const aspect = vehicle.wheelbase / vehicle.frontTrack;
  if (aspect < 1.0) {
    results.push({ code: 'WIDE_VEHICLE', severity: 'warning', message: `Wheelbase/track ratio ${aspect.toFixed(2)} < 1.0 — very wide vehicle` });
  }

  // Spring rate sanity
  const frontRate = vehicle.frontSuspension.spring.rate;
  const rearRate  = vehicle.rearSuspension.spring.rate;
  if (frontRate < 3 || rearRate < 3) {
    results.push({ code: 'SOFT_SPRING', severity: 'warning', message: `Spring rate < 3 N/mm — check units (expect N/mm)` });
  }
  if (frontRate > 500 || rearRate > 500) {
    results.push({ code: 'STIFF_SPRING', severity: 'error', message: `Spring rate > 500 N/mm — check units (expect N/mm, not N/m)` });
  }

  // Ackermann range
  const ack = vehicle.steering.ackermann;
  if (ack < -50 || ack > 150) {
    results.push({ code: 'ACKERMANN_RANGE', severity: 'warning', message: `Ackermann ${ack}% is outside normal range (-50% to 150%)` });
  }

  return results;
}
