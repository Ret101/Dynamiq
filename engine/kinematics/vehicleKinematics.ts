/**
 * Vehicle-level kinematic solver.
 * Combines all four corners, computes roll center pair, load transfer,
 * and full vehicle state at a given heave/roll/pitch/steer condition.
 */

import type { VehicleSpec } from '@/types/suspension';
import type { VehicleKinematics, CornerKinematics, LateralLoadTransfer, LongitudinalLoadTransfer } from '@/types/kinematics';
import { CornerKinematicSolver } from './cornerSolver';
import { SteeringGeometrySolver } from './steeringGeometry';
import { computeRollCenter } from '../geometry/intersections';

const RAD = Math.PI / 180;

export class VehicleKinematicSolver {
  private readonly vehicle: VehicleSpec;
  private readonly flSolver: CornerKinematicSolver;
  private readonly frSolver: CornerKinematicSolver;
  private readonly rlSolver: CornerKinematicSolver;
  private readonly rrSolver: CornerKinematicSolver;
  private readonly steerSolver: SteeringGeometrySolver;

  constructor(vehicle: VehicleSpec) {
    this.vehicle = vehicle;
    const { frontSuspension, rearSuspension } = vehicle;

    // Clone suspension corners for each position — pass vehicle-level params for anti-geometry
    const { wheelbase, cgHeight } = vehicle;
    this.flSolver = new CornerKinematicSolver(frontSuspension, wheelbase, cgHeight);
    this.frSolver = new CornerKinematicSolver(this.mirrorCorner(frontSuspension), wheelbase, cgHeight);
    this.rlSolver = new CornerKinematicSolver(rearSuspension, wheelbase, cgHeight);
    this.rrSolver = new CornerKinematicSolver(this.mirrorCorner(rearSuspension), wheelbase, cgHeight);

    this.steerSolver = new SteeringGeometrySolver(
      vehicle.steering,
      vehicle.wheelbase,
      vehicle.frontTrack
    );
  }

  /**
   * Solve vehicle kinematics at given chassis motion state.
   *
   * @param heave   - chassis vertical displacement mm (positive = up)
   * @param roll    - chassis roll degrees (positive = roll right = left side down)
   * @param pitch   - chassis pitch degrees (positive = nose down)
   * @param steerAngle - steering wheel angle degrees
   * @param lateralAccel - lateral acceleration g (for load transfer)
   * @param longAccel    - longitudinal acceleration g
   */
  solve(
    heave: number,
    roll: number,
    pitch: number,
    steerAngle: number,
    lateralAccel = 0,
    longAccel = 0
  ): VehicleKinematics {
    const { frontTrack, wheelbase, frontSuspension, rearSuspension } = this.vehicle;

    // Convert chassis motion to individual corner wheel travels
    const rollRad  = roll  * RAD;
    const pitchRad = pitch * RAD;

    const halfFrontTrack = frontTrack / 2;
    const halfRearTrack  = (this.vehicle.rearTrack || frontTrack) / 2;
    const halfWheelbase  = wheelbase / 2;

    // Wheel travel at each corner due to heave + roll + pitch
    const flTravel = heave + halfFrontTrack * Math.sin(rollRad)  - halfWheelbase * Math.sin(pitchRad);
    const frTravel = heave - halfFrontTrack * Math.sin(rollRad)  - halfWheelbase * Math.sin(pitchRad);
    const rlTravel = heave + halfRearTrack  * Math.sin(rollRad)  + halfWheelbase * Math.sin(pitchRad);
    const rrTravel = heave - halfRearTrack  * Math.sin(rollRad)  + halfWheelbase * Math.sin(pitchRad);

    // Steering: convert to rack travel
    const steerGeom = this.steerSolver.solve(steerAngle);
    const rackTravel = steerGeom.rackTravel;

    // Solve all four corners
    const fl = this.flSolver.solve(flTravel, rackTravel);
    const fr = this.frSolver.solve(frTravel, -rackTravel); // mirror steer
    const rl = this.rlSolver.solve(rlTravel, 0);
    const rr = this.rrSolver.solve(rrTravel, 0);

    // Front roll center
    const frontRC = computeRollCenter(
      fl.instantCenter, fl.contactPatch,
      fr.instantCenter, fr.contactPatch
    ) ?? { x: 0, y: 0, z: 0 };

    // Rear roll center
    const rearRC = computeRollCenter(
      rl.instantCenter, rl.contactPatch,
      rr.instantCenter, rr.contactPatch
    ) ?? { x: 0, y: 0, z: 0 };

    // Assign roll centers back to corner kinematics
    fl.rollCenter = frontRC;
    fr.rollCenter = frontRC;
    fl.rollCenterHeight = frontRC.z;
    fr.rollCenterHeight = frontRC.z;
    rl.rollCenter = rearRC;
    rr.rollCenter = rearRC;
    rl.rollCenterHeight = rearRC.z;
    rr.rollCenterHeight = rearRC.z;

    // Load transfer calculations
    const { mass, sprungMass, cgHeight, wheelbase: wb } = this.vehicle;
    const g = 9.81;

    const lateralLT = this.computeLateralLoadTransfer(
      lateralAccel, frontRC.z, rearRC.z
    );
    const longLT = this.computeLongitudinalLoadTransfer(
      longAccel, cgHeight, wb, fl, fr, rl, rr
    );

    // Ackermann and effective steering ratio
    const ackermann = steerGeom.ackermann;
    const effectiveSR = Math.abs(steerAngle) > 0.1
      ? steerGeom.rackTravel / steerAngle
      : this.vehicle.steering.steeringRatio;

    return {
      heave,
      roll,
      pitch,
      steerAngle,
      frontLeft: fl,
      frontRight: fr,
      rearLeft: rl,
      rearRight: rr,
      ackermann,
      steeringRatio: effectiveSR,
      turningRadius: steerGeom.turningRadius,
      lateralLoadTransfer: lateralLT,
      longitudinalLoadTransfer: longLT,
    };
  }

  private computeLateralLoadTransfer(
    lateralAccel: number,  // g
    frontRCHeight: number, // mm
    rearRCHeight:  number, // mm
  ): LateralLoadTransfer {
    const {
      mass, sprungMass, cgHeight, frontTrack, rearTrack: rearTrackOpt,
      frontSuspension, rearSuspension, frontWeightDist, frontTire,
    } = this.vehicle;
    const rearTrack = rearTrackOpt ?? frontTrack;

    if (Math.abs(lateralAccel) < 1e-10) {
      return { total: 0, front: 0, rear: 0, frontGeometric: 0, frontElastic: 0, frontUnsprung: 0, rearGeometric: 0, rearElastic: 0, rearUnsprung: 0 };
    }

    const g = 9.81;
    const ay = lateralAccel * g; // m/s²

    // Mass split: unsprung and sprung per axle
    const m_s  = sprungMass;
    const m_u  = mass - sprungMass;
    const m_sf = m_s * frontWeightDist;       // sprung mass on front axle (static balance)
    const m_sr = m_s * (1 - frontWeightDist);
    const m_uf = m_u * frontWeightDist;       // front unsprung mass
    const m_ur = m_u * (1 - frontWeightDist);

    // Heights (meters)
    const h_s  = cgHeight / 1000;
    const RC_f = frontRCHeight / 1000;
    const RC_r = rearRCHeight  / 1000;
    // Unsprung CG ≈ wheel center height = loaded tire radius
    const h_u  = (frontTire?.loadedRadius ?? 250) / 1000;

    // Track widths (meters)
    const t_f = frontTrack / 1000;
    const t_r = rearTrack  / 1000;

    // Roll axis height at sprung CG longitudinal position (weighted by wheelbase fractions)
    const RC_axis = RC_f * (1 - frontWeightDist) + RC_r * frontWeightDist;

    // Rolling moment on sprung mass about the roll axis (N·m)
    const M_roll = m_s * ay * (h_s - RC_axis);

    // Roll stiffness [N·m/rad]:  K = 2 × k[N/m] × (t/2)²[m²]
    const K_phi_f_spring = 2 * (frontSuspension.spring.rate * 1000) * (t_f / 2) ** 2;
    const K_phi_r_spring = 2 * (rearSuspension.spring.rate  * 1000) * (t_r / 2) ** 2;
    // ARB: torsional stiffness × motion-ratio² converts bar stiffness to wheel-pair stiffness
    const K_phi_f_arb = (frontSuspension.arb?.stiffness ?? 0) * (frontSuspension.arb?.motionRatio ?? 1) ** 2;
    const K_phi_r_arb = (rearSuspension.arb?.stiffness  ?? 0) * (rearSuspension.arb?.motionRatio  ?? 1) ** 2;
    const K_phi_f     = K_phi_f_spring + K_phi_f_arb;
    const K_phi_r     = K_phi_r_spring + K_phi_r_arb;
    const K_phi_total = K_phi_f + K_phi_r + 1e-9; // guard against divide-by-zero

    // 1. Geometric LLT — sprung mass moment transferred directly through roll centers
    const frontGeometric = m_sf * ay * RC_f / t_f;
    const rearGeometric  = m_sr * ay * RC_r / t_r;

    // 2. Elastic LLT — proportional to roll stiffness share, via body roll
    const frontElastic = (K_phi_f / K_phi_total) * M_roll / t_f;
    const rearElastic  = (K_phi_r / K_phi_total) * M_roll / t_r;

    // 3. Unsprung LLT — directly from unsprung inertia at wheel centre height
    const frontUnsprung = m_uf * ay * h_u / t_f;
    const rearUnsprung  = m_ur * ay * h_u / t_r;

    const front = frontGeometric + frontElastic + frontUnsprung;
    const rear  = rearGeometric  + rearElastic  + rearUnsprung;

    return {
      total: front + rear,
      front,
      rear,
      frontGeometric,
      frontElastic,
      frontUnsprung,
      rearGeometric,
      rearElastic,
      rearUnsprung,
    };
  }

  private computeLongitudinalLoadTransfer(
    longAccel: number, // g (positive = braking = nose down)
    cgHeight: number,  // mm
    wheelbase: number, // mm
    fl: CornerKinematics,
    fr: CornerKinematics,
    rl: CornerKinematics,
    rr: CornerKinematics,
  ): LongitudinalLoadTransfer {
    const { mass, brakeBias } = this.vehicle;
    const g = 9.81;
    const ax = longAccel * g;
    const h   = cgHeight  / 1000;
    const L   = wheelbase / 1000;

    const total = mass * ax * h / L; // N  (positive = braking: loads front, unloads rear)

    if (Math.abs(total) < 1e-6) {
      return { total: 0, front: 0, rear: 0, geometric: 0, elastic: 0, unsprung: 0 };
    }

    // Anti-geometry fractions averaged across each axle
    const antiDiveFront = (fl.antiDive  + fr.antiDive)  / 2;
    const antiLiftRear  = (rl.antiLift  + rr.antiLift)  / 2;
    const antiSquatRear = (rl.antiSquat + rr.antiSquat) / 2;

    // Geometric fraction: suspension links carry this portion without spring deflection.
    // Braking: weighted sum of front anti-dive and rear anti-lift by brake bias.
    // Acceleration: rear anti-squat (RWD/AWD dominant in FSAE/Baja).
    let geoFrac: number;
    if (longAccel >= 0) {
      geoFrac = brakeBias * Math.max(0, antiDiveFront)
              + (1 - brakeBias) * Math.max(0, antiLiftRear);
    } else {
      geoFrac = Math.max(0, antiSquatRear);
    }

    // Values >1 are physically valid (jacking tendency); cap at 2 for display sanity
    const geoFracClamped = Math.min(geoFrac, 2.0);
    const geometric = total * geoFracClamped;

    // Remainder through springs and unsprung inertia
    const remainder = total - geometric;
    const unsprung  = remainder * 0.15; // unsprung inertia (~15%)
    const elastic   = remainder * 0.85;

    return {
      total,
      front:  total,  // braking transfers load to front
      rear:  -total,  // braking removes load from rear
      geometric,
      elastic,
      unsprung,
    };
  }

  /** Mirror a corner's hardpoints across the Y=0 plane. */
  private mirrorCorner(corner: typeof this.vehicle.frontSuspension) {
    // Deep-clone and negate all Y coordinates
    const mirror = JSON.parse(JSON.stringify(corner));
    const mirrorHardpoints = (obj: Record<string, unknown>): void => {
      if (typeof obj !== 'object' || obj === null) return;
      if ('position' in obj && typeof (obj as {position: {y: number}}).position === 'object') {
        (obj as {position: {y: number}}).position.y *= -1;
      }
      for (const v of Object.values(obj)) mirrorHardpoints(v as Record<string, unknown>);
    };
    mirrorHardpoints(mirror.hardpoints);
    return mirror;
  }
}
