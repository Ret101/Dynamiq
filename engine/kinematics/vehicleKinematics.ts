/**
 * Vehicle-level kinematic solver.
 * Combines all four corners, computes roll center pair, load transfer,
 * and full vehicle state at a given heave/roll/pitch/steer condition.
 */

import type { VehicleSpec } from '@/types/suspension';
import type { VehicleKinematics, LateralLoadTransfer, LongitudinalLoadTransfer } from '@/types/kinematics';
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
      lateralAccel, frontRC.z, rearRC.z, frontTrack
    );
    const longLT = this.computeLongitudinalLoadTransfer(
      longAccel, cgHeight, wb
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
    track: number          // mm
  ): LateralLoadTransfer {
    const { mass, sprungMass, cgHeight, frontTrack, wheelbase, frontSuspension, rearSuspension } = this.vehicle;
    const g = 9.81;
    const ay = lateralAccel * g; // m/s²
    const massKg = mass;
    const trackM = (frontTrack / 2) / 1000; // half-track in m
    const cgH = cgHeight / 1000; // m
    const rcFH = frontRCHeight / 1000;
    const rcRH = rearRCHeight / 1000;

    // Total lateral load transfer: ΔFz = m·ay·h / t  (t = average track)
    const avgTrack_m = ((frontTrack + (this.vehicle.rearTrack || frontTrack)) / 2) / 1000;
    const totalLT = massKg * ay * cgH / avgTrack_m;

    // Simplified breakdown:
    const frontFrac = this.vehicle.frontWeightDist;
    const rearFrac  = 1 - frontFrac;

    // Geometric component: through roll center
    const frontGeometric = massKg * frontFrac * ay * rcFH / (frontTrack / 1000);
    const rearGeometric  = massKg * rearFrac  * ay * rcRH / ((this.vehicle.rearTrack || frontTrack) / 1000);

    // Elastic component: through springs
    const frontStiffness = (frontSuspension.spring.rate * 2) * (frontTrack / 1000 / 2) ** 2 / 1000; // N·m/rad approx
    const rearStiffness  = (rearSuspension.spring.rate  * 2) * ((this.vehicle.rearTrack || frontTrack) / 1000 / 2) ** 2 / 1000;
    const totalStiffness = frontStiffness + rearStiffness + 1e-6;

    const sprungRollMoment = sprungMass * ay * (cgH - (rcFH * frontFrac + rcRH * rearFrac));
    const frontElastic = sprungRollMoment * frontStiffness / totalStiffness;
    const rearElastic  = sprungRollMoment * rearStiffness  / totalStiffness;

    // Unsprung component (simplified: unsprung mass at wheel center height)
    const unsprungMass = mass - sprungMass;
    const frontUnsprung = unsprungMass * frontFrac * ay * 0.15; // 150mm unsprung CG approx
    const rearUnsprung  = unsprungMass * rearFrac  * ay * 0.15;

    return {
      total: frontGeometric + rearGeometric + frontElastic + rearElastic + frontUnsprung + rearUnsprung,
      front: frontGeometric + frontElastic + frontUnsprung,
      rear:  rearGeometric  + rearElastic  + rearUnsprung,
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
    wheelbase: number  // mm
  ): LongitudinalLoadTransfer {
    const { mass } = this.vehicle;
    const g = 9.81;
    const ax = longAccel * g;
    const total = mass * ax * (cgHeight / 1000) / (wheelbase / 1000);

    return {
      total,
      front: total,   // braking: loads front
      rear: -total,   // braking: unloads rear
      geometric: total * 0.4,
      elastic: total * 0.4,
      unsprung: total * 0.2,
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
