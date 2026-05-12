export interface GearboxEngineSpec {
  name: string;
  idleRPM: number;
  redlineRPM: number;
  peakTorque: number;       // N·m
  peakTorqueRPM: number;
  peakPower: number;        // kW
  peakPowerRPM: number;
  torqueAtIdle: number;     // N·m (for curve shape)
  torqueAtRedline: number;  // N·m (for curve shape)
}

export interface GearEntry {
  ratio: number;
}

export interface GearboxSpec {
  numGears: number;
  gears: GearEntry[];       // length = numGears
  finalDrive: number;
  efficiency: number;       // 0–1 drivetrain efficiency
  shiftTime: number;        // s per gear change
}

export interface GearboxVehicleSpec {
  mass: number;             // kg total
  tireRadius: number;       // mm loaded radius
  frontalArea: number;      // m²
  cdAero: number;           // drag coefficient (Cd)
  rollResistCoeff: number;  // Crr rolling resistance
  gradePercent: number;     // % grade for gradeability calc
}

export interface GearOperatingPoint {
  rpm: number;
  speedKph: number;
  engineTorque: number;     // N·m at crank
  wheelTorque: number;      // N·m at wheel
  tractiveForce: number;    // N
  powerKw: number;          // kW at wheel
  dragForce: number;        // N (aero + roll)
  netForce: number;         // N (tractive - drag)
  accelerationG: number;    // g
}

export interface GearResult {
  gearIndex: number;        // 1-based
  ratio: number;
  totalRatio: number;       // gear × final drive
  speedAtPeakTorqueKph: number;
  speedAtRedlineKph: number;
  maxTractiveForce: number; // N
  curve: GearOperatingPoint[];
}

export interface GearboxResult {
  gears: GearResult[];
  topSpeedKph: number;
  time060Kph: number;       // seconds
  time0100Kph: number;      // seconds
  optimalShiftRPMs: number[]; // shift RPM per gear (index 0 = shift from 1→2)
  gradeability: number;       // % max grade at crawl speed
}

export interface GearboxProject {
  engine: GearboxEngineSpec;
  gearbox: GearboxSpec;
  vehicle: GearboxVehicleSpec;
}
