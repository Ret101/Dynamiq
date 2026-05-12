/**
 * Default CVT project presets.
 *
 * Baja SAE preset:
 *   Engine: Briggs & Stratton Intek 305cc (OHV, governor-limited to 3600 RPM)
 *   CVT:    Comet 780-series or equivalent (Team Industries / Gaged EVO)
 *   Gearbox: 3.0:1 custom reduction or Polaris 3.36:1
 *   Chain:  50T/20T sprocket = 2.5:1
 *   Tires:  23×10.5-12 (rear) ≈ 292mm radius
 *   Mass:   250 kg (180 kg car + 70 kg driver)
 *
 *   Results: engagement ~5 mph, max speed ~38 mph, peak F_tract ~3200 N
 *
 * Go-Kart preset:
 *   Engine: Honda GX390 (13hp @ 3600 RPM)
 *   CVT:    Comet 94C TAV2 (engagement 1700 RPM, shift out 3600 RPM)
 *   Gearbox: 6:1 reduction jackshaft
 *   Chain:  1:1 direct to axle
 *   Tires:  200mm radius (11×7.10-5 typical go-kart tire)
 *   Mass:   160 kg (kart + driver)
 */

import type { CVTProject } from '@/types/cvt';
import { nanoid } from '@/engine/suspension/nanoid';

function nowISO() {
  return new Date().toISOString();
}

export const defaultBajaCVT: CVTProject = {
  id: nanoid(),
  name: 'Baja SAE — B&S 10hp',
  series: 'Baja',
  notes: 'SAE Baja rules-compliant 10 hp engine with Comet 780 CVT',
  created: nowISO(),
  modified: nowISO(),

  engine: {
    name: 'Briggs & Stratton Intek 305cc',
    displacement: 305,
    maxPower: 10,
    maxPowerRPM: 3600,
    maxTorque: 18.4,
    maxTorqueRPM: 2200,
    idleRPM: 1200,
    maxRPM: 3600,
  },

  clutch: {
    engagementRPM: 1800,
    fullEngageRPM: 2200,
    shiftStartRPM: 2400,
    shiftOutRPM: 3600,
    maxRatio: 3.60,
    minRatio: 0.84,
    shiftCurveExponent: 1.2,
    helixAngle: 38,
    secondarySpringPreload: 45,
  },

  drivetrain: {
    gearboxRatio: 3.00,
    gearboxEfficiency: 0.95,
    chainSprocketRatio: 2.50,   // 50T driven / 20T drive
    chainEfficiency: 0.98,
    beltEfficiency: 0.88,
  },

  vehicle: {
    totalMass: 250,
    tireRadius: 292,             // 23" OD ÷ 2 = 292mm
    rollingResistanceCoeff: 0.04, // off-road terrain
    dragCoefficient: 0.85,
    frontalArea: 1.1,
    gradePercent: 0,
  },
};

export const defaultGokartCVT: CVTProject = {
  id: nanoid(),
  name: 'Go-Kart — Honda GX390',
  series: 'GoKart',
  notes: 'Predator 13hp / Honda GX390 with Comet 94C TAV2 CVT',
  created: nowISO(),
  modified: nowISO(),

  engine: {
    name: 'Honda GX390 / Predator 420',
    displacement: 390,
    maxPower: 13,
    maxPowerRPM: 3600,
    maxTorque: 22.0,
    maxTorqueRPM: 2500,
    idleRPM: 1400,
    maxRPM: 3800,
  },

  clutch: {
    engagementRPM: 1700,
    fullEngageRPM: 2100,
    shiftStartRPM: 2300,
    shiftOutRPM: 3600,
    maxRatio: 3.00,
    minRatio: 0.90,
    shiftCurveExponent: 1.0,
    helixAngle: 35,
    secondarySpringPreload: 40,
  },

  drivetrain: {
    gearboxRatio: 6.00,
    gearboxEfficiency: 0.95,
    chainSprocketRatio: 1.00,   // direct chain to rear axle
    chainEfficiency: 0.98,
    beltEfficiency: 0.90,
  },

  vehicle: {
    totalMass: 160,
    tireRadius: 200,             // ~400mm OD go-kart tire
    rollingResistanceCoeff: 0.015, // smooth asphalt
    dragCoefficient: 0.60,
    frontalArea: 0.65,
    gradePercent: 0,
  },
};

export const defaultCustomCVT: CVTProject = {
  id: nanoid(),
  name: 'Custom CVT Project',
  series: 'Custom',
  notes: '',
  created: nowISO(),
  modified: nowISO(),

  engine: {
    name: 'Custom Engine',
    displacement: 400,
    maxPower: 15,
    maxPowerRPM: 4000,
    maxTorque: 20,
    maxTorqueRPM: 2800,
    idleRPM: 1200,
    maxRPM: 4500,
  },

  clutch: {
    engagementRPM: 1800,
    fullEngageRPM: 2200,
    shiftStartRPM: 2500,
    shiftOutRPM: 4000,
    maxRatio: 3.50,
    minRatio: 0.80,
    shiftCurveExponent: 1.0,
    helixAngle: 36,
    secondarySpringPreload: 42,
  },

  drivetrain: {
    gearboxRatio: 4.00,
    gearboxEfficiency: 0.95,
    chainSprocketRatio: 2.00,
    chainEfficiency: 0.98,
    beltEfficiency: 0.88,
  },

  vehicle: {
    totalMass: 200,
    tireRadius: 250,
    rollingResistanceCoeff: 0.02,
    dragCoefficient: 0.75,
    frontalArea: 0.90,
    gradePercent: 0,
  },
};

export const CVT_PRESETS: CVTProject[] = [
  defaultBajaCVT,
  defaultGokartCVT,
  defaultCustomCVT,
];

export function cloneCVTProject(p: CVTProject): CVTProject {
  return JSON.parse(JSON.stringify(p)) as CVTProject;
}
