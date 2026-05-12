/**
 * Import/export module supporting:
 *  - JSON (native project format)
 *  - CSV (hardpoint coordinates)
 *  - XML (generic exchange format)
 *  - MATLAB .m script
 *  - SolidWorks CSV (coordinate table)
 */

import type { VehicleSpec } from '@/types/suspension';
import type { ProjectFile, ProjectMetadata, SimulationSettings } from '@/types/project';
import type { Hardpoint } from '@/types/hardpoint';

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function exportJSON(
  vehicle: VehicleSpec,
  metadata: ProjectMetadata,
  settings: SimulationSettings
): string {
  const file: ProjectFile = {
    format: 'lotus-shark-online',
    formatVersion: '1.0',
    metadata,
    vehicle,
    simulationSettings: settings,
  };
  return JSON.stringify(file, null, 2);
}

export function importJSON(jsonString: string): ProjectFile {
  const parsed = JSON.parse(jsonString);
  if (parsed.format !== 'lotus-shark-online') {
    throw new Error('Invalid project file format');
  }
  return parsed as ProjectFile;
}

// ─── CSV hardpoints ────────────────────────────────────────────────────────────

export function exportHardpointsCSV(vehicle: VehicleSpec): string {
  const headers = ['label', 'component', 'side', 'x_mm', 'y_mm', 'z_mm', 'corner'];
  const rows: string[][] = [headers];

  const processCorner = (corner: Record<string, Hardpoint>, cornerName: string) => {
    for (const hp of Object.values(corner)) {
      if (typeof hp === 'object' && hp !== null && 'position' in hp) {
        rows.push([
          hp.label,
          hp.component,
          hp.side,
          hp.position.x.toFixed(3),
          hp.position.y.toFixed(3),
          hp.position.z.toFixed(3),
          cornerName,
        ]);
      }
    }
  };

  const hp = vehicle.allHardpoints as unknown as Record<string, Record<string, Hardpoint>>;
  processCorner(hp.frontLeft,  'front_left');
  processCorner(hp.frontRight, 'front_right');
  processCorner(hp.rearLeft,   'rear_left');
  processCorner(hp.rearRight,  'rear_right');

  return rows.map(row => row.join(',')).join('\n');
}

export function importHardpointsCSV(csvString: string): Array<{
  label: string; component: string; side: string;
  x: number; y: number; z: number; corner: string;
}> {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const idx = (key: string) => headers.indexOf(key);

  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim());
    return {
      label:     cells[idx('label')]     ?? '',
      component: cells[idx('component')] ?? '',
      side:      cells[idx('side')]      ?? '',
      x: parseFloat(cells[idx('x_mm')]  ?? '0'),
      y: parseFloat(cells[idx('y_mm')]  ?? '0'),
      z: parseFloat(cells[idx('z_mm')]  ?? '0'),
      corner:    cells[idx('corner')]    ?? '',
    };
  });
}

// ─── SolidWorks CSV ───────────────────────────────────────────────────────────

export function exportSolidWorksCSV(vehicle: VehicleSpec): string {
  // SolidWorks coordinate export format: X, Y, Z
  const rows: string[] = ['! Lotus Shark Online - SolidWorks Coordinate Export'];
  rows.push('! Units: mm');
  rows.push('Label,X,Y,Z');

  const processCorner = (corner: Record<string, Hardpoint>, prefix: string) => {
    for (const hp of Object.values(corner)) {
      if (typeof hp === 'object' && hp !== null && 'position' in hp) {
        rows.push(`${prefix}_${hp.label},${hp.position.x.toFixed(4)},${hp.position.y.toFixed(4)},${hp.position.z.toFixed(4)}`);
      }
    }
  };

  const h = vehicle.allHardpoints as unknown as Record<string, Record<string, Hardpoint>>;
  processCorner(h.frontLeft,  'FL');
  processCorner(h.frontRight, 'FR');
  processCorner(h.rearLeft,   'RL');
  processCorner(h.rearRight,  'RR');

  return rows.join('\n');
}

// ─── MATLAB script ─────────────────────────────────────────────────────────────

export function exportMATLAB(vehicle: VehicleSpec): string {
  const lines: string[] = [
    '%% Lotus Shark Online — MATLAB Export',
    `% Vehicle: ${vehicle.name}`,
    `% Generated: ${new Date().toISOString()}`,
    '',
    '% Hardpoint coordinates [mm], SAE J670 (X=fwd, Y=left, Z=up)',
    '',
  ];

  const h = vehicle.allHardpoints as unknown as Record<string, Record<string, Hardpoint>>;
  const corners: Array<[string, string]> = [
    ['frontLeft', 'FL'],
    ['frontRight', 'FR'],
    ['rearLeft', 'RL'],
    ['rearRight', 'RR'],
  ];

  for (const [cornerKey, prefix] of corners) {
    lines.push(`% --- ${cornerKey} ---`);
    const corner = h[cornerKey] ?? {};
    for (const [key, hp] of Object.entries(corner)) {
      if (typeof hp === 'object' && hp !== null && 'position' in hp) {
        const varName = `${prefix}_${key}`;
        lines.push(`${varName} = [${hp.position.x.toFixed(3)}, ${hp.position.y.toFixed(3)}, ${hp.position.z.toFixed(3)}]; % ${hp.label}`);
      }
    }
    lines.push('');
  }

  // Vehicle parameters
  lines.push('% Vehicle parameters');
  lines.push(`wheelbase = ${vehicle.wheelbase}; % mm`);
  lines.push(`front_track = ${vehicle.frontTrack}; % mm`);
  lines.push(`rear_track = ${vehicle.rearTrack}; % mm`);
  lines.push(`cg_height = ${vehicle.cgHeight}; % mm`);
  lines.push(`total_mass = ${vehicle.mass}; % kg`);
  lines.push(`front_weight_dist = ${vehicle.frontWeightDist};`);

  return lines.join('\n');
}

// ─── XML ──────────────────────────────────────────────────────────────────────

export function exportXML(vehicle: VehicleSpec, metadata: ProjectMetadata): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const hpToXML = (hp: Hardpoint): string =>
    `    <hardpoint id="${hp.id}" label="${escape(hp.label)}" component="${hp.component}" side="${hp.side}">
      <position x="${hp.position.x.toFixed(4)}" y="${hp.position.y.toFixed(4)}" z="${hp.position.z.toFixed(4)}" units="${hp.units}"/>
    </hardpoint>`;

  const h = vehicle.allHardpoints as unknown as Record<string, Record<string, Hardpoint>>;
  const cornersXML = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].map(corner =>
    `  <corner position="${corner}">\n${Object.values(h[corner] ?? {})
      .filter(hp => typeof hp === 'object' && hp !== null && 'position' in hp)
      .map(hp => hpToXML(hp as Hardpoint)).join('\n')}\n  </corner>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<lotus-shark-online version="1.0">
  <metadata>
    <name>${escape(metadata.name)}</name>
    <author>${escape(metadata.author)}</author>
    <series>${escape(vehicle.series)}</series>
    <created>${metadata.created}</created>
    <modified>${metadata.modified}</modified>
  </metadata>
  <vehicle>
    <wheelbase>${vehicle.wheelbase}</wheelbase>
    <frontTrack>${vehicle.frontTrack}</frontTrack>
    <rearTrack>${vehicle.rearTrack}</rearTrack>
    <mass>${vehicle.mass}</mass>
    <cgHeight>${vehicle.cgHeight}</cgHeight>
  </vehicle>
  <hardpoints>
${cornersXML}
  </hardpoints>
</lotus-shark-online>`;
}

// ─── File download helper ─────────────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
