import type { Vec3, Units } from './geometry';

export type HardpointComponent =
  | 'chassis'
  | 'uca'
  | 'lca'
  | 'upright'
  | 'tierod'
  | 'rack'
  | 'shock'
  | 'rocker'
  | 'pushrod'
  | 'pullrod'
  | 'arb'
  | 'wheel'
  | 'contact'
  | 'cg'
  | 'bellcrank'
  | 'droplink';

export type HardpointSide = 'left' | 'right' | 'center';
export type HardpointAxis = 'x' | 'y' | 'z';

export interface HardpointConstraint {
  type: 'fixed' | 'sliding' | 'revolute' | 'ball' | 'free';
  axis?: Vec3;
  min?: number;
  max?: number;
}

export interface ParametricEquation {
  expression: string; // e.g., "scrubRadius * 0.5 + 25"
  variables: Record<string, number>;
}

export interface Hardpoint {
  id: string;
  label: string;
  description?: string;
  position: Vec3;
  component: HardpointComponent;
  side: HardpointSide;
  constraints: HardpointConstraint[];
  symmetry: boolean;          // true = mirrored in Y plane
  editable: boolean;
  units: Units;
  color?: string;
  parametric?: {
    x?: ParametricEquation;
    y?: ParametricEquation;
    z?: ParametricEquation;
  };
  tags?: string[];
}

// Named hardpoint collections per suspension corner
export interface CornerHardpoints {
  // Upper control arm
  ucaFrontChassis: Hardpoint;
  ucaChassisRear: Hardpoint;
  ucaUpright: Hardpoint;

  // Lower control arm
  lcaFrontChassis: Hardpoint;
  lcaChassisRear: Hardpoint;
  lcaUpright: Hardpoint;

  // Steering
  tieRodChassis: Hardpoint;   // inner tie rod / rack end
  tieRodUpright: Hardpoint;   // outer tie rod

  // Shock / spring
  shockChassis: Hardpoint;
  shockUpright: Hardpoint;

  // Rocker (if pushrod/pullrod)
  rockerPivot?: Hardpoint;
  rockerShockMount?: Hardpoint;
  rockerRodMount?: Hardpoint;

  // Pushrod / pullrod
  rod?: Hardpoint;             // rod-to-upright attach

  // ARB
  arbDroplinkUpright?: Hardpoint;
  arbDroplinkARB?: Hardpoint;

  // Wheel geometry
  wheelCenter: Hardpoint;
  contactPatch: Hardpoint;
}

export interface VehicleHardpoints {
  frontLeft: CornerHardpoints;
  frontRight: CornerHardpoints;
  rearLeft: CornerHardpoints;
  rearRight: CornerHardpoints;
  cg: Hardpoint;
  frontRackLeft: Hardpoint;
  frontRackRight: Hardpoint;
  [key: string]: CornerHardpoints | Hardpoint;
}

export type HardpointId = string;
export type HardpointMap = Map<HardpointId, Hardpoint>;
