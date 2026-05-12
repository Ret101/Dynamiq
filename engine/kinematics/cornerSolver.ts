/**
 * Corner kinematic solver for double wishbone / pushrod / pullrod suspensions.
 *
 * Mathematical references:
 *   Milliken & Milliken, "Race Car Vehicle Dynamics", SAE, 1995
 *   Dixon, "Tires, Suspension and Handling", SAE, 1996
 *   Blundell & Harty, "The Multibody Systems Approach to Vehicle Dynamics", 2004
 *
 * Coordinate system: SAE J670 (X=forward, Y=left, Z=up)
 * All lengths in mm, angles in degrees unless noted.
 */

import type { Vec3 } from '@/types/geometry';
import type { CornerHardpoints } from '@/types/hardpoint';
import type { CornerKinematics } from '@/types/kinematics';
import type { SuspensionCorner } from '@/types/suspension';
import { v3 } from '../geometry/vec3';
import { computeFrontViewIC } from '../geometry/intersections';
import {
  safeAcos, safeAsin, safeDiv, safeSqrt, guardedNumber,
  solve2x2SVD, EPS, sanitizeOutput
} from '../math/robust';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

/**
 * Solve the wheel position given a suspension corner at a specified wheel travel
 * and steer rack displacement.
 *
 * The solver uses a kinematic constraint approach:
 * 1. The upright is treated as a rigid body.
 * 2. Wheel travel drives the upright along a constrained path.
 * 3. Ball joint lengths are preserved (constraint: distance from chassis pickup to
 *    ball joint is constant = design length).
 *
 * For the bump motion: we parameterize by wheel center Z displacement.
 * The upright moves such that all A-arm ball joint distances are preserved.
 * This is a system of nonlinear constraints solved iteratively (Newton-Raphson).
 */
export class CornerKinematicSolver {
  private readonly corner: SuspensionCorner;
  private readonly vehicleWheelbase: number;
  private readonly vehicleCgHeight: number;

  // Design-position (static) lengths — computed once
  private readonly ucaLength: number;
  private readonly lcaLength: number;
  private readonly tierodLength: number;
  private readonly shockLength: number;

  // Design-position (static) hardpoint snapshot
  private readonly staticHP: CornerHardpoints;

  constructor(corner: SuspensionCorner, vehicleWheelbase = 1530, vehicleCgHeight = 310) {
    this.corner = corner;
    this.vehicleWheelbase = vehicleWheelbase;
    this.vehicleCgHeight  = vehicleCgHeight;
    this.staticHP = corner.hardpoints;
    this.ucaLength = this.computeUCALength(corner.hardpoints);
    this.lcaLength = this.computeLCALength(corner.hardpoints);
    this.tierodLength = v3.distance(
      corner.hardpoints.tieRodChassis.position,
      corner.hardpoints.tieRodUpright.position
    );
    this.shockLength = v3.distance(
      corner.hardpoints.shockChassis.position,
      corner.hardpoints.shockUpright.position
    );
  }

  private computeUCALength(hp: CornerHardpoints): number {
    return v3.distance(
      hp.ucaFrontChassis.position,
      hp.ucaUpright.position
    );
  }

  private computeLCALength(hp: CornerHardpoints): number {
    return v3.distance(
      hp.lcaFrontChassis.position,
      hp.lcaUpright.position
    );
  }

  /**
   * Full kinematic solve at a given wheel travel (mm) and rack travel (mm).
   * Public entry point — includes numerical gain derivatives.
   */
  solve(travel: number, rackTravel: number): CornerKinematics {
    return this._solve(travel, rackTravel, true);
  }

  /**
   * Internal solver. When computeGains=false the derivative fields are set to 0,
   * which breaks the mutual recursion solve→numericalGain→solve.
   */
  private _solve(travel: number, rackTravel: number, computeGains: boolean): CornerKinematics {
    const hp = this.staticHP;

    // === Step 1: Compute upright position at travel ===
    const uprightState = this.solveUprightPosition(hp, travel);

    // === Step 2: Compute alignment from upright orientation ===
    const alignment = this.computeAlignment(uprightState);

    // === Step 3: Compute tie rod / steer ===
    const steerResult = this.computeSteer(hp, uprightState, rackTravel);

    // === Step 4: Compute instant center ===
    const ic = this.computeIC(uprightState);

    // === Step 6: Motion ratio (at this travel position) ===
    const mr = this.computeMotionRatio(hp, uprightState, travel);

    // === Step 7: Anti-geometry ===
    const antis = this.computeAntiGeometry(hp, uprightState);

    // === Step 8: Track / wheelbase change ===
    const contactPatch = uprightState.contactPatch;
    const staticContact = hp.contactPatch.position;
    const trackChange = contactPatch.y - staticContact.y;
    const wheelbaseChange = contactPatch.x - staticContact.x;

    // === Step 9: Gain derivatives — only when requested to avoid infinite recursion ===
    let camberGain = 0, toeGain = 0, casterGain = 0;
    if (computeGains) {
      const base = this._solve(0, 0, false);
      camberGain = travel !== 0
        ? (alignment.camber - base.camber) / travel
        : this._numericalGain('camber', travel, rackTravel);
      toeGain    = this._numericalGain('toe',    travel, rackTravel);
      casterGain = this._numericalGain('caster', travel, rackTravel);
    }

    const result: CornerKinematics = {
      wheelTravel: travel,
      steerInput: rackTravel,
      movedPositions: {
        ucaBallJoint:      uprightState.ucaBallJoint,
        lcaBallJoint:      uprightState.lcaBallJoint,
        tieRodUprightEnd:  uprightState.tieRodUprightEnd,
        shockUprightMount: uprightState.shockUprightMount,
      },
      wheelCenter: uprightState.wheelCenter,
      contactPatch: uprightState.contactPatch,
      instantCenter: ic ?? { x: 0, y: 0, z: 0 },
      instantCenterSide: { x: 0, y: 0, z: 0 },
      camber: guardedNumber(alignment.camber + steerResult.camberDelta),
      toe: guardedNumber(alignment.toe + steerResult.toe),
      caster: guardedNumber(alignment.caster),
      kingpin: guardedNumber(alignment.kpi),
      scrubRadius: guardedNumber(alignment.scrubRadius),
      mechanicalTrail: guardedNumber(alignment.mechanicalTrail),
      pneumaticTrail: 0,
      rollCenter: { x: 0, y: 0, z: 0 },
      rollCenterHeight: 0,
      motionRatio: guardedNumber(mr.motionRatio, 1),
      wheelRate: guardedNumber(mr.wheelRate),
      antiDive: guardedNumber(antis.antiDive),
      antiSquat: guardedNumber(antis.antiSquat),
      antiLift: guardedNumber(antis.antiLift),
      trackChange: guardedNumber(trackChange),
      wheelbaseChange: guardedNumber(wheelbaseChange),
      scrubVsTravel: Math.abs(guardedNumber(trackChange)),
      camberGain: guardedNumber(camberGain),
      toeGain: guardedNumber(toeGain),
      casterGain: guardedNumber(casterGain),
      jackingForce: guardedNumber(this.computeJackingForce(ic, uprightState.contactPatch)),
    };
    return sanitizeOutput(result) as CornerKinematics;
  }

  /**
   * Solve upright position using virtual swing arm method.
   *
   * The double wishbone suspension can be modeled as a 4-bar linkage in the front view.
   * The upright traces a path determined by the lengths of UCA and LCA and their
   * chassis pivot positions.
   *
   * We parameterize by the angle of the LCA from its static position, find the
   * corresponding UCA angle that maintains the correct upright height, then
   * reconstruct all positions.
   */
  private solveUprightPosition(hp: CornerHardpoints, travel: number): UprightState {
    const ucaF = hp.ucaFrontChassis.position;
    const ucaR = hp.ucaChassisRear.position; // rear chassis pickup
    const ucaU_static = hp.ucaUpright.position;
    const lcaF = hp.lcaFrontChassis.position;
    const lcaR = hp.lcaChassisRear.position;
    const lcaU_static = hp.lcaUpright.position;
    const wc_static = hp.wheelCenter.position;
    const cp_static = hp.contactPatch.position;

    // Midpoints of chassis pivot pairs
    const ucaMid = v3.midpoint(ucaF, ucaR);
    const lcaMid = v3.midpoint(lcaF, lcaR);

    // Arm vectors (inboard mid → outboard ball joint) at static
    const ucaArm_static = v3.sub(ucaU_static, ucaMid); // static arm vector
    const lcaArm_static = v3.sub(lcaU_static, lcaMid);

    // Upright offset from LCA ball joint at static
    const uprightFromLCA_static = v3.sub(ucaU_static, lcaU_static);

    // Arm lengths in the plane perpendicular to pivot axes
    const ucaArmLen = v3.length(ucaArm_static);
    const lcaArmLen = v3.length(lcaArm_static);

    // Pivot axes (unit vectors along chassis fore-aft)
    const ucaAxis = v3.normalize(v3.sub(ucaR, ucaF));
    const lcaAxis = v3.normalize(v3.sub(lcaR, lcaF));

    // Current target: wheel center moves vertically by travel
    const wc_target_z = wc_static.z + travel;
    const delta_lca_z = wc_target_z - wc_static.z;

    // LCA angle change: Δθ_lca = Δz / (lcaArm_lateral) in 2D approximation
    // More precisely: solve Newton-Raphson on the 4-bar constraint
    const solution = this.solveDoubleWishboneNR(
      ucaMid, ucaAxis, ucaArmLen, ucaArm_static,
      lcaMid, lcaAxis, lcaArmLen, lcaArm_static,
      uprightFromLCA_static,
      travel
    );

    // Reconstruct contact patch and wheel center from upright rigid body transform
    const lcaUNew = solution.lcaBallJoint;
    const ucaUNew = solution.ucaBallJoint;

    // Upright rigid body: defined by its two ball joints
    // Upright Y-axis: along UCA_U → LCA_U (normalized)
    const uprightY_static = v3.normalize(v3.sub(lcaU_static, ucaU_static));
    const uprightY_new    = v3.normalize(v3.sub(lcaUNew, ucaUNew));

    // Rotation of upright: from static to new orientation
    const rotAngle = v3.angleBetween(uprightY_static, uprightY_new);
    const rotAxis  = v3.lengthSq(v3.cross(uprightY_static, uprightY_new)) > 1e-20
      ? v3.normalize(v3.cross(uprightY_static, uprightY_new))
      : { x: 1, y: 0, z: 0 };

    // Wheel center offset from LCA ball joint at static
    const wcFromLCA_static = v3.sub(wc_static, lcaU_static);
    const wcFromLCA_new    = v3.rotateAroundAxis(wcFromLCA_static, rotAxis, rotAngle);
    const wcNew            = v3.add(lcaUNew, wcFromLCA_new);

    // Contact patch offset from LCA ball joint at static
    const cpFromLCA_static = v3.sub(cp_static, lcaU_static);
    const cpFromLCA_new    = v3.rotateAroundAxis(cpFromLCA_static, rotAxis, rotAngle);
    const cpNew            = v3.add(lcaUNew, cpFromLCA_new);

    // Shock mount on upright
    const shockUFromLCA_static = v3.sub(hp.shockUpright.position, lcaU_static);
    const shockUFromLCA_new    = v3.rotateAroundAxis(shockUFromLCA_static, rotAxis, rotAngle);
    const shockUNew            = v3.add(lcaUNew, shockUFromLCA_new);

    // Tie rod upright
    const tierodUFromLCA_static = v3.sub(hp.tieRodUpright.position, lcaU_static);
    const tierodUFromLCA_new    = v3.rotateAroundAxis(tierodUFromLCA_static, rotAxis, rotAngle);
    const tierodUNew            = v3.add(lcaUNew, tierodUFromLCA_new);

    // Upright kingpin axis: from LCA ball joint to UCA ball joint
    const kpAxis_static = v3.normalize(v3.sub(ucaU_static, lcaU_static));
    const kpAxis_new    = v3.normalize(v3.sub(ucaUNew, lcaUNew));

    return {
      ucaBallJoint: ucaUNew,
      lcaBallJoint: lcaUNew,
      wheelCenter: wcNew,
      contactPatch: cpNew,
      shockUprightMount: shockUNew,
      tieRodUprightEnd: tierodUNew,
      kingpinAxis: kpAxis_new,
      rotationAngle: rotAngle,
      rotationAxis: rotAxis,
    };
  }

  /**
   * Newton-Raphson solver for the 4-bar (double wishbone) constraint system.
   *
   * State: (θ_uca, θ_lca) — rotation angles of each arm about its pivot axis from static.
   * Constraints:
   *   f1: |ucaBallJoint(θ_uca) - lcaBallJoint(θ_lca)| = |ucaU_static - lcaU_static|
   *   f2: lcaBallJoint(θ_lca).z = lcaU_static.z + target_dz
   *       where target_dz is derived from wheel travel
   *
   * Jacobian computed analytically from arm geometry.
   */
  private solveDoubleWishboneNR(
    ucaMid: Vec3, ucaAxis: Vec3, ucaArmLen: number, ucaArm_static: Vec3,
    lcaMid: Vec3, lcaAxis: Vec3, lcaArmLen: number, lcaArm_static: Vec3,
    uprightLength_static: Vec3,  // vec from lcaU to ucaU at static
    travel: number,
    maxIter = 50,
    tol = 1e-6
  ): { ucaBallJoint: Vec3; lcaBallJoint: Vec3 } {
    // The target Z of the LCA ball joint
    // For wheel travel, we approximate: lcaBallJoint.z changes by travel * (lcaArm_z_component / totalArm_length)
    // But we use the full constraint correctly.

    // Static positions
    const ucaU0 = v3.add(ucaMid, ucaArm_static);
    const lcaU0 = v3.add(lcaMid, lcaArm_static);
    const uprightLen = v3.length(uprightLength_static);

    // LCA target z: wheel center is approximately directly above LCA ball joint
    // Approximation: dz_lca ≈ travel * (lcaArm from static normalized z component)
    const lcaArmNorm = v3.normalize(lcaArm_static);

    // Initial guess: small angle approximation
    let theta_lca = travel > 0
      ? Math.asin(Math.min(1, Math.max(-1, travel / (lcaArmLen + 1e-10))))
      : -Math.asin(Math.min(1, Math.max(-1, -travel / (lcaArmLen + 1e-10))));
    let theta_uca = theta_lca * 0.8; // initial guess

    for (let iter = 0; iter < maxIter; iter++) {
      // Current ball joint positions
      const lcaU = v3.add(lcaMid, v3.rotateAroundAxis(lcaArm_static, lcaAxis, theta_lca));
      const ucaU = v3.add(ucaMid, v3.rotateAroundAxis(ucaArm_static, ucaAxis, theta_uca));

      // Constraint residuals
      const uprightVec = v3.sub(ucaU, lcaU);
      const f1 = v3.length(uprightVec) - uprightLen;       // upright length constraint
      const f2 = (lcaU.z - lcaU0.z) - travel;              // target travel (approximate)

      if (Math.abs(f1) < tol && Math.abs(f2) < tol) break;

      // Jacobian (2×2):
      // df1/d_theta_lca = d/dθ |ucaU - lcaU(θ)| → dot(-(ucaU-lcaU)/|ucaU-lcaU|, d(lcaU)/dθ)
      // df1/d_theta_uca = dot((ucaU-lcaU)/|ucaU-lcaU|, d(ucaU)/dθ)
      const dLcaU_dt = v3.cross(lcaAxis, v3.sub(lcaU, lcaMid)); // d(lcaU)/d(theta_lca)
      const dUcaU_dt = v3.cross(ucaAxis, v3.sub(ucaU, ucaMid)); // d(ucaU)/d(theta_uca)

      const uprightDir = v3.normalize(uprightVec);
      const J11 = v3.dot(v3.negate(uprightDir), dLcaU_dt); // df1/dθ_lca
      const J12 = v3.dot(uprightDir, dUcaU_dt);             // df1/dθ_uca
      const J21 = dLcaU_dt.z;                               // df2/dθ_lca
      const J22 = 0;                                         // df2/dθ_uca (uca doesn't affect lca.z)

      // 2×2 Newton step: J * [Δθ_lca, Δθ_uca]^T = -[f1, f2]^T
      const det = J11 * J22 - J12 * J21;

      let d_theta_lca: number;
      let d_theta_uca: number;

      if (Math.abs(det) < 1e-12) {
        // Singular Jacobian — use Moore-Penrose pseudoinverse via SVD
        const [dl, du] = solve2x2SVD([J11, J12, J21, J22], [-f1, -f2]);
        d_theta_lca = dl;
        d_theta_uca = du;
      } else {
        d_theta_lca = (-f1 * J22 + f2 * J12) / det;
        d_theta_uca = (-f2 * J11 + f1 * J21) / det;
      }

      // Damped step
      const step = 0.5;
      theta_lca += step * d_theta_lca;
      theta_uca += step * d_theta_uca;
    }

    const lcaUFinal = v3.add(lcaMid, v3.rotateAroundAxis(lcaArm_static, lcaAxis, theta_lca));
    const ucaUFinal = v3.add(ucaMid, v3.rotateAroundAxis(ucaArm_static, ucaAxis, theta_uca));

    return { ucaBallJoint: ucaUFinal, lcaBallJoint: lcaUFinal };
  }

  /**
   * Compute camber, toe, caster, KPI, scrub radius, mechanical trail
   * from upright orientation.
   */
  private computeAlignment(state: UprightState): AlignmentAngles {
    const kp = state.kingpinAxis;

    // Camber: angle of kingpin axis from vertical in front view (Y-Z plane)
    // Camber = atan(dY / dZ) — but for the wheel spin axis (X-axis of upright)
    // Camber is defined as the angle of the wheel plane from vertical.
    // Wheel plane normal is perpendicular to the wheel spin axis.
    // Wheel spin axis ≈ perpendicular to kingpin axis, in the Y-Z plane.
    // Simplified: camber ≈ angle of upright tilt from vertical in front view.
    const camber = Math.atan2(kp.y, kp.z) * DEG;

    // Toe: angle of wheel direction from straight-ahead in top view (X-Y plane)
    // Static toe is from the heel: we compute the deviation of the tire plane.
    // Approximation: toe change from static = atan of lateral displacement at wheel rim
    // vs axial (X) distance. For now, compute toe as rotation of upright about Z.
    // Toe = atan2(kp.x, kp.z) would be caster; for toe we need wheel spin axis.
    // The wheel spin axis is perpendicular to kingpin in the X-Y plane.
    const toe = -Math.atan2(kp.x, kp.z) * DEG; // sign: positive = toe-in

    // Caster: angle of kingpin axis from vertical in side view (X-Z plane)
    const caster = Math.atan2(kp.x, kp.z) * DEG;

    // KPI (Kingpin Inclination): angle of kingpin axis from vertical in front view
    const kpi = Math.atan2(Math.abs(kp.y), kp.z) * DEG;

    // Scrub radius: horizontal distance from kingpin axis intercept at ground to wheel center
    // Kingpin axis passes through ucaBallJoint and lcaBallJoint.
    // Extended to ground (z=0) gives the kingpin intercept point.
    const kpDir = state.kingpinAxis;
    const kpPoint = state.lcaBallJoint;

    // t such that (kpPoint + t*kpDir).z = 0
    const t_ground = Math.abs(kpDir.z) > 1e-10
      ? -kpPoint.z / kpDir.z
      : 0;
    const kpGroundIntercept: Vec3 = {
      x: kpPoint.x + t_ground * kpDir.x,
      y: kpPoint.y + t_ground * kpDir.y,
      z: 0,
    };

    const contactPatchY = state.contactPatch.y;
    const scrubRadius = contactPatchY - kpGroundIntercept.y;

    // Mechanical trail: X distance from contact patch to kingpin ground intercept
    const mechanicalTrail = kpGroundIntercept.x - state.contactPatch.x;

    return { camber, toe, caster, kpi, scrubRadius, mechanicalTrail };
  }

  /** Compute tie rod steering effect for a given rack displacement. */
  private computeSteer(
    hp: CornerHardpoints,
    state: UprightState,
    rackTravel: number
  ): { toe: number; camberDelta: number } {
    // Move tie rod chassis end by rack travel in Y direction
    const tierodChassis = {
      ...hp.tieRodChassis.position,
      y: hp.tieRodChassis.position.y + rackTravel,
    };

    // The tie rod upright end is constrained to be tierodLength from tierodChassis
    // and also connected to the upright rigid body.
    // For the steer angle, the toe changes as the rack moves.
    // Simplified: the lateral displacement of the inner end changes the outer end
    // position, rotating the upright about the kingpin axis.

    // Tie rod length from static
    const tieRodLength = this.tierodLength;

    // Current distance from rack point to (bumped) tie rod upright end
    const currentDist = v3.distance(tierodChassis, state.tieRodUprightEnd);
    const stretch = currentDist - tieRodLength;

    // Toe from tie rod: approximate as angle change
    // The tie rod pushes/pulls the knuckle, rotating it about the kingpin axis.
    // Simplified: toe_delta ≈ stretch / (tie rod moment arm about kingpin)
    const momentArm = Math.abs(state.tieRodUprightEnd.y - state.wheelCenter.y);
    const toe = momentArm > 1 ? -(stretch / momentArm) * DEG : 0;

    return { toe, camberDelta: 0 };
  }

  /** Compute front-view instant center. */
  private computeIC(state: UprightState): Vec3 | null {
    const hp = this.staticHP;
    return computeFrontViewIC(
      hp.ucaFrontChassis.position, hp.ucaChassisRear.position, state.ucaBallJoint,
      hp.lcaFrontChassis.position, hp.lcaChassisRear.position, state.lcaBallJoint
    );
  }

  /** Compute spring motion ratio and wheel rate. */
  private computeMotionRatio(
    hp: CornerHardpoints,
    state: UprightState,
    travel: number
  ): { motionRatio: number; wheelRate: number } {
    // Motion ratio = spring travel / wheel travel
    // Spring travel = change in distance between shock chassis mount and shock upright mount
    const shockLengthNew = v3.distance(hp.shockChassis.position, state.shockUprightMount);
    const shockLengthStatic = this.shockLength;
    const springTravel = Math.abs(shockLengthNew - shockLengthStatic);
    const motionRatio = Math.abs(travel) > 0.01 ? springTravel / Math.abs(travel) : 1.0;
    const wheelRate = this.corner.spring.rate * motionRatio * motionRatio;
    return { motionRatio, wheelRate };
  }

  /** Anti-dive, anti-squat, anti-lift geometry. */
  private computeAntiGeometry(
    hp: CornerHardpoints,
    state: UprightState
  ): { antiDive: number; antiSquat: number; antiLift: number } {
    // Anti-dive (braking): fraction of pitch that is handled geometrically
    // Anti-dive = tan(theta_arm_sideview) × wheelbase / CG_height
    // Simplified: compute side-view angle of LCA
    const lcaF = hp.lcaFrontChassis.position;
    const lcaR = hp.lcaChassisRear.position;
    const lcaU = state.lcaBallJoint;

    // Side-view: X-Z plane
    const lcaMidX = (lcaF.x + lcaR.x) / 2;
    const lcaMidZ = (lcaF.z + lcaR.z) / 2;
    const lcaAngle_sideview = Math.atan2(lcaU.z - lcaMidZ, lcaU.x - lcaMidX);

    const antiDive = Math.tan(lcaAngle_sideview) * this.vehicleWheelbase / this.vehicleCgHeight;
    const antiSquat = antiDive; // simplified — proper calculation needs drivetrain geometry
    const antiLift  = 0; // simplified

    return {
      antiDive:  Math.max(0, Math.min(1, antiDive)),
      antiSquat: Math.max(0, Math.min(1, antiSquat)),
      antiLift,
    };
  }

  private computeJackingForce(ic: Vec3 | null, contactPatch: Vec3): number {
    if (!ic) return 0;
    // Jacking coefficient = RC height / track
    const rcHeight = ic.z;
    const track = Math.abs(contactPatch.y) * 2;
    return track > 1 ? rcHeight / track : 0;
  }

  /** Numerical gain: uses _solve with computeGains=false to avoid infinite recursion. */
  private _numericalGain(
    quantity: 'camber' | 'toe' | 'caster',
    travel: number,
    rackTravel: number,
    h = 1.0
  ): number {
    const kPlus  = this._solve(travel + h, rackTravel, false);
    const kMinus = this._solve(travel - h, rackTravel, false);
    return (kPlus[quantity] - kMinus[quantity]) / (2 * h);
  }
}

interface UprightState {
  ucaBallJoint: Vec3;
  lcaBallJoint: Vec3;
  wheelCenter: Vec3;
  contactPatch: Vec3;
  shockUprightMount: Vec3;
  tieRodUprightEnd: Vec3;
  kingpinAxis: Vec3;
  rotationAngle: number;
  rotationAxis: Vec3;
}

interface AlignmentAngles {
  camber: number;
  toe: number;
  caster: number;
  kpi: number;
  scrubRadius: number;
  mechanicalTrail: number;
}
