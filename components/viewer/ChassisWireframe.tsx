'use client';

/**
 * ChassisWireframe — parametric 3D tube-frame chassis visualisation.
 *
 * Geometry is derived from vehicle wheelbase + track so it updates live.
 * FSAE: modelled after a typical 2024 steel spaceframe with rule-compliant hoops.
 * Baja: modelled after a typical Baja SAE full roll cage with front bumper.
 *
 * SAE J670 → Three.js:  [x, y, z]_SAE → [x, z, -y]_Three
 */

import { useMemo } from 'react';
import * as THREE from 'three';

const MM = 0.001;

interface ChassisWireframeProps {
  wheelbase: number;
  frontTrack: number;
  rearTrack: number;
  series: string;
  rideHeight?: number;
  opacity?: number;
}

export function ChassisWireframe({
  wheelbase: wb,
  frontTrack,
  rearTrack,
  series,
  rideHeight,
  opacity = 0.75,
}: ChassisWireframeProps) {
  const isBaja = series === 'Baja';

  const { geo, mat } = useMemo(() => {
    const positions = isBaja
      ? buildBajaFrame(wb, frontTrack, rearTrack, rideHeight ?? 305)
      : buildFSAEFrame(wb, frontTrack, rearTrack);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const m = new THREE.LineBasicMaterial({
      color: isBaja ? '#9a7845' : '#7090b0',
      transparent: true,
      opacity,
    });

    return { geo: g, mat: m };
  }, [wb, frontTrack, rearTrack, isBaja, rideHeight, opacity]);

  return <primitive object={new THREE.LineSegments(geo, mat)} />;
}

// ─── SAE → Three.js ───────────────────────────────────────────────────────────

function pushSeg(
  buf: number[],
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
) {
  buf.push(ax * MM, az * MM, -ay * MM);
  buf.push(bx * MM, bz * MM, -by * MM);
}

// ─── FSAE 2024 steel spaceframe ───────────────────────────────────────────────
//
// Typical FSAE car with:
//   - Pointed aerodynamic nose cone with anti-intrusion structure
//   - Twin lower floor rails front-to-rear
//   - Outrigger suspension pickup tabs
//   - T3.5.1 side impact tubes (150–350 mm)
//   - Front A-hoop (T3.3.1 ≥250 mm wide)
//   - Main roll hoop (T3.2.3 ≥920 mm, ≥380 mm wide)
//   - Main hoop rear braces ≤15° (T3.2.1)
//   - Harness bar behind driver
//   - Rear engine cradle with X-bracing

function buildFSAEFrame(wb: number, ft: number, _rt: number): number[] {
  const buf: number[] = [];
  const s = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
    pushSeg(buf, ax, ay, az, bx, by, bz);

  // ── Widths (mm, half-width) ──────────────────────────────────────────────────
  const cw   = 145;   // cockpit half-width
  const cwNB =  85;   // nose base half-width (where it meets front bulkhead)
  const fhw  = 145;   // front hoop legs at ±145 mm (290 mm total, T3.3.1 ✓)
  const mhw  = 192;   // main hoop legs at ±192 mm (384 mm total, T3.2.3 ≥380 mm ✓)
  const cwR  = 138;   // rear engine bay half-width

  // ── Heights above ground (mm) ────────────────────────────────────────────────
  const zF   =  52;   // floor rail
  const zSI  = 252;   // side impact tube centre (T3.5.1: 150–350 mm ✓)
  const zUP  = 388;   // upper rail at front bulkhead
  const zHB  = 450;   // harness bar
  const zFH  = 688;   // front A-hoop apex
  const zMH  = 920;   // main hoop apex (T3.2.3 ≥920 mm ✓)

  // ── Longitudinal X from front axle (mm) ──────────────────────────────────────
  const xNT   = -275;
  const xFB   =  -42;
  const xFH   =  290;
  const xMH   = Math.round(wb * 0.42);
  const xHB   = Math.round(xFH + (xMH - xFH) * 0.78);  // harness bar X
  const xRB   = wb +  92;
  const xRE   = wb + 255;
  // Main hoop rear braces ≤15° from vertical (T3.2.1)
  const xBr   = xMH + Math.round(zMH * Math.tan(13 * Math.PI / 180));

  // Suspension inboard pickup Y (scaled from front track)
  const yLcaIn = Math.round(ft * 0.089);   // LCA inboard ≈ 122 mm (1372 mm track)
  const yUcaIn = Math.round(ft * 0.113);   // UCA inboard ≈ 155 mm
  const zLca   = 86;
  const zUca   = 355;

  const xLcaFront =  -55;
  const xLcaRear  =   65;
  const xUcaFront =  -42;
  const xUcaRear  =   58;

  // ── Nose cone ────────────────────────────────────────────────────────────────
  // Lower nose: tapers from tip to FB lower corners
  s(xNT,   0, zF + 22,  xFB, -cwNB, zF);
  s(xNT,   0, zF + 22,  xFB,  cwNB, zF);
  // Keel (centre lower rail)
  s(xNT,   0, zF + 8,   xNT,   0, zF + 22);
  s(xNT,   0, zF + 8,   xFB,   0, zF);
  // Upper nose
  s(xNT,   0, zUP - 12, xFB, -cwNB, zUP - 22);
  s(xNT,   0, zUP - 12, xFB,  cwNB, zUP - 22);
  s(xNT,   0, zF + 8,   xNT,   0, zUP - 12);  // nose upright
  // Nose side diagonals
  s(xNT,   0, zF + 8,   xFB, -cwNB, zUP - 22);
  s(xNT,   0, zF + 8,   xFB,  cwNB, zUP - 22);
  // FB anti-intrusion (X on face)
  s(xFB, -cwNB, zF,      xFB,  cwNB, zUP - 22);
  s(xFB,  cwNB, zF,      xFB, -cwNB, zUP - 22);
  // FB mid horizontal
  s(xFB, -cwNB, zSI - 25, xFB, cwNB, zSI - 25);

  // ── Front bulkhead ───────────────────────────────────────────────────────────
  s(xFB, -cw,  zF,    xFB,  cw,  zF);
  s(xFB, -cw,  zUP,   xFB,  cw,  zUP);
  s(xFB, -cw,  zF,    xFB, -cw,  zUP);
  s(xFB,  cw,  zF,    xFB,  cw,  zUP);
  s(xFB, -cw,  zF,    xFB,  cw,  zUP);    // X
  s(xFB,  cw,  zF,    xFB, -cw,  zUP);
  // Connect FB upper to nose upper
  s(xFB, -cw,  zUP,   xFB, -cwNB, zUP - 22);
  s(xFB,  cw,  zUP,   xFB,  cwNB, zUP - 22);

  // ── Front bay lower rails (FB → FH) ─────────────────────────────────────────
  s(xFB, -cw, zF,   xFH, -fhw, zF);
  s(xFB,  cw, zF,   xFH,  fhw, zF);
  // Cross-member mid-bay
  const xFC = Math.round((xFB + xFH) / 2);
  s(xFC, -cw, zF,   xFC,  cw, zF);
  // Floor X-brace front bay
  s(xFB, -cw, zF,   xFH,  fhw, zF);
  s(xFB,  cw, zF,   xFH, -fhw, zF);
  // Upper front rails (FB upper → FH apex)
  s(xFB, -cw, zUP,  xFH, -fhw, zFH);
  s(xFB,  cw, zUP,  xFH,  fhw, zFH);
  // Side panel of front bay (vertical + diagonal)
  s(xFB, -cw, zF,   xFB, -cw, zUP);
  s(xFH, -fhw, zF,  xFH, -fhw, zFH);
  s(xFB,  cw, zF,   xFB,  cw, zUP);
  s(xFH,  fhw, zF,  xFH,  fhw, zFH);
  s(xFB, -cw, zUP,  xFH, -fhw, zF);  // reverse diagonal for triangulation
  s(xFB,  cw, zUP,  xFH,  fhw, zF);

  // ── Suspension pickup outrigger tabs ─────────────────────────────────────────
  // LCA front chassis pickup (short tab from lower rail outward)
  s(xLcaFront, -cw, zF,    xLcaFront, -yLcaIn, zLca);
  s(xLcaFront,  cw, zF,    xLcaFront,  yLcaIn, zLca);
  s(xLcaRear,  -cw, zF,    xLcaRear,  -yLcaIn, zLca);
  s(xLcaRear,   cw, zF,    xLcaRear,   yLcaIn, zLca);
  // LCA fore-aft cross-tab
  s(xLcaFront, -yLcaIn, zLca, xLcaRear, -yLcaIn, zLca);
  s(xLcaFront,  yLcaIn, zLca, xLcaRear,  yLcaIn, zLca);
  // UCA front chassis pickup (tab from upper rail outward)
  s(xUcaFront, -cw, zUP,   xUcaFront, -yUcaIn, zUca);
  s(xUcaFront,  cw, zUP,   xUcaFront,  yUcaIn, zUca);
  s(xUcaRear,  -cw, zUP,   xUcaRear,  -yUcaIn, zUca);
  s(xUcaRear,   cw, zUP,   xUcaRear,   yUcaIn, zUca);
  // UCA fore-aft cross-tab
  s(xUcaFront, -yUcaIn, zUca, xUcaRear, -yUcaIn, zUca);
  s(xUcaFront,  yUcaIn, zUca, xUcaRear,  yUcaIn, zUca);

  // ── Front A-hoop (T3.3.1) ────────────────────────────────────────────────────
  s(xFH, -fhw, zF,  xFH, -fhw, zFH);   // left leg
  s(xFH,  fhw, zF,  xFH,  fhw, zFH);   // right leg
  s(xFH, -fhw, zFH, xFH,  fhw, zFH);   // top bar

  // ── Cockpit floor rails (FH → MH) ────────────────────────────────────────────
  s(xFH, -fhw, zF,  xMH, -mhw, zF);
  s(xFH,  fhw, zF,  xMH,  mhw, zF);
  // Mid cockpit cross-member
  const xCC = Math.round((xFH + xMH) / 2);
  s(xCC, -cw, zF,   xCC,  cw, zF);
  // Floor X-brace cockpit bay
  s(xFH, -fhw, zF,  xMH,  mhw, zF);
  s(xFH,  fhw, zF,  xMH, -mhw, zF);

  // ── Side impact tubes (T3.5.1: 150–350 mm) ──────────────────────────────────
  s(xFH, -fhw, zSI,  xMH, -mhw, zSI);
  s(xFH,  fhw, zSI,  xMH,  mhw, zSI);
  // Verticals at hoop feet
  s(xFH, -fhw, zF,   xFH, -fhw, zSI);
  s(xFH,  fhw, zF,   xFH,  fhw, zSI);
  s(xMH, -mhw, zF,   xMH, -mhw, zSI);
  s(xMH,  mhw, zF,   xMH,  mhw, zSI);
  // Diagonal in side panel (N-brace each side)
  s(xFH, -fhw, zF,   xCC, -cw, zSI);
  s(xCC, -cw,  zSI,  xMH, -mhw, zF);
  s(xFH,  fhw, zF,   xCC,  cw, zSI);
  s(xCC,  cw,  zSI,  xMH,  mhw, zF);

  // ── Main roll hoop (T3.2.3) ──────────────────────────────────────────────────
  s(xMH, -mhw, zF,   xMH, -mhw, zMH);  // left leg
  s(xMH,  mhw, zF,   xMH,  mhw, zMH);  // right leg
  s(xMH, -mhw, zMH,  xMH,  mhw, zMH);  // top bar
  // Mid-height lateral cross-member
  s(xMH, -mhw, zMH * 0.52, xMH, mhw, zMH * 0.52);

  // ── Harness / shoulder bar ────────────────────────────────────────────────────
  s(xHB, -mhw * 0.85, zHB, xHB, mhw * 0.85, zHB);
  // Harness bar support legs down to floor
  s(xHB, -mhw * 0.85, zHB, xMH, -mhw, zF);
  s(xHB,  mhw * 0.85, zHB, xMH,  mhw, zF);
  // Harness bar forward diagonal to main hoop (prevents fore-aft movement)
  s(xHB, -mhw * 0.85, zHB, xMH - 30, -mhw, zMH * 0.38);
  s(xHB,  mhw * 0.85, zHB, xMH - 30,  mhw, zMH * 0.38);

  // ── Main hoop rear braces (T3.2.1 ≤15°) ────────────────────────────────────
  s(xMH, -mhw, zMH, xBr, -mhw, zF);
  s(xMH,  mhw, zMH, xBr,  mhw, zF);
  // Intermediate brace node
  const zBrMid = zF + (zMH - zF) * 0.48;
  s(xMH, -mhw, zBrMid, xBr, -mhw, zF + 35);
  s(xMH,  mhw, zBrMid, xBr,  mhw, zF + 35);

  // ── Upper cockpit rails (FH top → MH top, each side) ────────────────────────
  s(xFH, -fhw, zFH,  xMH, -mhw, zMH);
  s(xFH,  fhw, zFH,  xMH,  mhw, zMH);

  // ── Rear bay (MH → RB) ───────────────────────────────────────────────────────
  // MH top descends rearward to rear bulkhead upper
  s(xMH, -mhw, zMH,    xRB, -cwR, zUP - 15);
  s(xMH,  mhw, zMH,    xRB,  cwR, zUP - 15);
  // Brace foot to rear bulkhead lower
  s(xBr, -mhw, zF,     xRB, -cwR, zF);
  s(xBr,  mhw, zF,     xRB,  cwR, zF);

  // ── Rear bulkhead ─────────────────────────────────────────────────────────────
  s(xRB, -cwR, zF,      xRB,  cwR, zF);
  s(xRB, -cwR, zUP-15,  xRB,  cwR, zUP-15);
  s(xRB, -cwR, zF,      xRB, -cwR, zUP-15);
  s(xRB,  cwR, zF,      xRB,  cwR, zUP-15);
  s(xRB, -cwR, zF,      xRB,  cwR, zUP-15);  // X
  s(xRB,  cwR, zF,      xRB, -cwR, zUP-15);

  // ── Rear engine cradle ────────────────────────────────────────────────────────
  // Lower rails spreading slightly outward
  const cwRE = cwR * 0.58;
  s(xRB, -cwR, zF,      xRE, -cwRE, zF);
  s(xRB,  cwR, zF,      xRE,  cwRE, zF);
  s(xRE, -cwRE, zF,     xRE,  cwRE, zF);       // rear cross lower
  // Upper rails
  s(xRB, -cwR, zUP-15,  xRE, -cwRE, zF + 95);
  s(xRB,  cwR, zUP-15,  xRE,  cwRE, zF + 95);
  s(xRE, -cwRE, zF+95,  xRE,  cwRE, zF+95);    // rear cross upper
  // X-brace rear bay
  s(xRB, -cwR, zF,      xRE,  cwRE, zF);
  s(xRB,  cwR, zF,      xRE, -cwRE, zF);
  // Engine mount platform (mid-bay horizontal structure)
  const xEM = Math.round((xRB + xRE) / 2);
  s(xEM, -cwRE * 1.05, zF,       xEM, cwRE * 1.05, zF);
  s(xEM, -cwRE * 1.05, zF,       xEM, -cwRE * 1.05, zF + 85);
  s(xEM,  cwRE * 1.05, zF,       xEM,  cwRE * 1.05, zF + 85);
  s(xEM, -cwRE * 1.05, zF + 85,  xEM,  cwRE * 1.05, zF + 85);

  return buf;
}

// ─── Baja SAE 2025/2026 full roll cage ───────────────────────────────────────
//
// Modelled after a typical Baja SAE open-wheel off-road buggy:
//   - Box-tube front bumper hoop with struts
//   - Front cockpit hoop (FH) with A-pillar diagonals
//   - Rear Roll Hoop (RRH) — tall, B6.3: ≥736 mm wide at ≥686 mm above seat
//   - X-braced door protection bars, B6.5: 203–356 mm above ground
//   - Overhead cage bars connecting front to rear hoop
//   - LCA outrigger brackets from belly down to wishbone pickup level
//   - Rear engine sub-frame with CVT tunnel area

function buildBajaFrame(wb: number, ft: number, rt: number, rideHt = 305): number[] {
  const buf: number[] = [];
  const s = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
    pushSeg(buf, ax, ay, az, bx, by, bz);

  // ── Widths (mm, half) ─────────────────────────────────────────────────────────
  const cw   = Math.min(Math.round(ft * 0.46),  318);  // main cockpit half-width
  const cwR  = Math.min(Math.round(rt * 0.40),  288);  // rear sub-frame half-width
  const fhw  = Math.max(Math.round(cw * 0.88),  275);  // FH leg Y
  const rrhw = Math.max(Math.round(cw * 0.95),  370);  // RRH leg Y (740 mm total ≥736 ✓)

  // ── Heights above ground (mm) ─────────────────────────────────────────────────
  const zLca   = 105;                   // LCA outrigger foot height
  const zFloor = rideHt;                // main belly/floor rails
  const zDB    = 248;                   // door bar height (B6.5: 203–356 mm ✓)
  const zUP    = rideHt + 228;          // upper cockpit rail
  const zFH    = rideHt + 452;          // FH apex
  const zRRH   = rideHt + 572;          // RRH apex

  // ── X positions from front axle (mm) ─────────────────────────────────────────
  const xBump  = -328;
  const xFront =  -55;
  const xFH    =  252;
  const xRRH   = Math.round(wb * 0.52);
  // RRH rear braces at 17° from vertical
  const xBrace = xRRH + Math.round((zRRH - zFloor) * Math.tan(17 * Math.PI / 180));
  const xRE    = wb + 168;
  const xREtip = wb + 325;

  // LCA outrigger Y (inboard pickup approximated from track)
  const yLcaIn = Math.round(ft * 0.089);   // ≈ 122 mm for 1372 mm track

  // ── Front bumper structure ────────────────────────────────────────────────────
  // Bumper is a separate rectangular hoop ahead of the cockpit
  const bw = Math.round(cw * 0.62);   // bumper half-width
  // Lower bumper bar (near skid plate level)
  s(xBump, -bw, zLca + 15, xBump,  bw, zLca + 15);
  // Upper bumper bar (door-bar height)
  s(xBump, -bw, zDB,       xBump,  bw, zDB);
  // Bumper uprights
  s(xBump, -bw, zLca + 15, xBump, -bw, zDB);
  s(xBump,  bw, zLca + 15, xBump,  bw, zDB);
  // Mid bumper horizontal for impact distribution
  s(xBump, -bw, (zLca + zDB) / 2, xBump, bw, (zLca + zDB) / 2);
  // Bumper X-brace
  s(xBump, -bw, zLca + 15, xBump,  bw, zDB);
  s(xBump,  bw, zLca + 15, xBump, -bw, zDB);

  // Bumper connect to front cockpit face (lower rails at floor level)
  s(xBump, -bw, zFloor,    xFront, -cw, zFloor);
  s(xBump,  bw, zFloor,    xFront,  cw, zFloor);
  // Drop tubes: bumper belly to bumper bar level
  s(xBump, -bw, zFloor,    xBump,  -bw, zDB);
  s(xBump,  bw, zFloor,    xBump,   bw, zDB);
  // A-pillar diagonals from bumper upper corners to FH legs
  s(xBump, -bw, zDB,       xFH,   -fhw, zUP);
  s(xBump,  bw, zDB,       xFH,    fhw, zUP);

  // ── Front cockpit bulkhead ─────────────────────────────────────────────────────
  s(xFront, -cw, zFloor, xFront,  cw, zFloor);
  s(xFront, -cw, zUP,   xFront,  cw, zUP);
  s(xFront, -cw, zFloor, xFront, -cw, zUP);
  s(xFront,  cw, zFloor, xFront,  cw, zUP);
  s(xFront, -cw, zFloor, xFront,  cw, zUP);    // X
  s(xFront,  cw, zFloor, xFront, -cw, zUP);

  // ── Front belly-to-bumper lower connection ─────────────────────────────────────
  s(xBump, -bw, zFloor,  xFront, -cw, zFloor);
  s(xBump,  bw, zFloor,  xFront,  cw, zFloor);

  // ── Front hoop (FH) — rectangular arch ────────────────────────────────────────
  // Straight legs up to upper cockpit height
  s(xFH, -fhw, zFloor, xFH, -fhw, zUP);
  s(xFH,  fhw, zFloor, xFH,  fhw, zUP);
  // Arch: legs angle slightly inward from zUP to apex
  const fhwApex = Math.round(fhw * 0.58);
  s(xFH, -fhw,     zUP, xFH, -fhwApex, zFH);
  s(xFH,  fhw,     zUP, xFH,  fhwApex, zFH);
  // Arch top bar
  s(xFH, -fhwApex, zFH, xFH,  fhwApex, zFH);
  // FH base cross (at belly)
  s(xFH, -fhw, zFloor,  xFH,  fhw, zFloor);
  // Knee bar (mid-height brace in FH face)
  s(xFH, -fhw, zUP * 0.55 + zFloor * 0.45,
    xFH,  fhw, zUP * 0.55 + zFloor * 0.45);

  // ── Rear Roll Hoop (RRH) — B6.3 ──────────────────────────────────────────────
  // Vertical legs (full height)
  s(xRRH, -rrhw, zFloor, xRRH, -rrhw, zRRH);
  s(xRRH,  rrhw, zFloor, xRRH,  rrhw, zRRH);
  // Top bar (B6.3: ≥736 mm wide ✓)
  s(xRRH, -rrhw, zRRH,   xRRH,  rrhw, zRRH);
  // RRH base cross
  s(xRRH, -rrhw, zFloor,  xRRH,  rrhw, zFloor);
  // RRH mid lateral cross (structural)
  const zRRHmid = zFloor + (zRRH - zFloor) * 0.48;
  s(xRRH, -rrhw, zRRHmid, xRRH,  rrhw, zRRHmid);

  // ── RRH rear diagonal braces ──────────────────────────────────────────────────
  s(xRRH, -rrhw, zRRH,    xBrace, -rrhw, zFloor);
  s(xRRH,  rrhw, zRRH,    xBrace,  rrhw, zFloor);
  // Intermediate brace nodes
  s(xRRH, -rrhw, zRRHmid, xBrace, -rrhw, zFloor + 55);
  s(xRRH,  rrhw, zRRHmid, xBrace,  rrhw, zFloor + 55);

  // ── Overhead cage (FH apex → RRH top) ────────────────────────────────────────
  // Main overhead bars
  s(xFH,  -fhwApex, zFH,  xRRH, -rrhw * 0.35, zRRH);
  s(xFH,   fhwApex, zFH,  xRRH,  rrhw * 0.35, zRRH);
  // Mid-overhead lateral cross-bar
  const xRoof = Math.round((xFH + xRRH) / 2);
  const zRoof = Math.round((zFH + zRRH) / 2) - 18;
  const rwApex = Math.round((fhwApex + rrhw * 0.35) / 2);
  s(xRoof, -rwApex, zRoof, xRoof,  rwApex, zRoof);
  // Front-to-mid diagonal bars
  s(xFH, -fhwApex, zFH,   xRoof, -rwApex, zRoof);
  s(xFH,  fhwApex, zFH,   xRoof,  rwApex, zRoof);

  // ── Upper side rails (FH base → RRH, upper cockpit) ──────────────────────────
  s(xFront, -cw,  zUP,   xFH,   -fhw,  zUP);
  s(xFront,  cw,  zUP,   xFH,    fhw,  zUP);
  s(xFH,   -fhw,  zUP,   xRRH, -rrhw,  zRRHmid);
  s(xFH,    fhw,  zUP,   xRRH,  rrhw,  zRRHmid);

  // ── Door bars — B6.5 (203–356 mm above ground ✓) ─────────────────────────────
  s(xFH,   -fhw, zDB,  xRRH, -rrhw, zDB);
  s(xFH,    fhw, zDB,  xRRH,  rrhw, zDB);
  // Vertical connecting belly to door bar
  s(xFH,   -fhw, zFloor, xFH,  -fhw, zDB);
  s(xFH,    fhw, zFloor, xFH,   fhw, zDB);
  s(xRRH, -rrhw, zFloor, xRRH, -rrhw, zDB);
  s(xRRH,  rrhw, zFloor, xRRH,  rrhw, zDB);
  // X-brace each door panel
  s(xFH,   -fhw, zFloor, xRRH, -rrhw, zDB);
  s(xFH,   -fhw, zDB,    xRRH, -rrhw, zFloor);
  s(xFH,    fhw, zFloor, xRRH,  rrhw, zDB);
  s(xFH,    fhw, zDB,    xRRH,  rrhw, zFloor);

  // ── Lower belly rails ─────────────────────────────────────────────────────────
  s(xFront, -cw,   zFloor, xFH,    -fhw,  zFloor);
  s(xFront,  cw,   zFloor, xFH,     fhw,  zFloor);
  s(xFH,    -fhw,  zFloor, xRRH,  -rrhw,  zFloor);
  s(xFH,     fhw,  zFloor, xRRH,   rrhw,  zFloor);
  s(xRRH,  -rrhw,  zFloor, xBrace, -rrhw, zFloor);
  s(xRRH,   rrhw,  zFloor, xBrace,  rrhw, zFloor);
  // Belly floor cross-members (front + mid)
  s(xFH,   -fhw,  zFloor, xFH,    fhw,   zFloor);
  const xBellyMid = Math.round((xFH + xRRH) / 2);
  s(xBellyMid, -cw, zFloor, xBellyMid, cw, zFloor);

  // ── LCA outrigger brackets (belly → LCA pickup area) ──────────────────────────
  // Front corners
  const xLF = xFH - 62;
  const xLR = xFH + 70;
  s(xLF, -cw, zFloor, xLF, -yLcaIn, zLca);
  s(xLF,  cw, zFloor, xLF,  yLcaIn, zLca);
  s(xLR, -cw, zFloor, xLR, -yLcaIn, zLca);
  s(xLR,  cw, zFloor, xLR,  yLcaIn, zLca);
  s(xLF, -yLcaIn, zLca, xLR, -yLcaIn, zLca);   // lower fore-aft bar
  s(xLF,  yLcaIn, zLca, xLR,  yLcaIn, zLca);
  // Rear corners
  const xRLF = wb - 62;
  const xRLR = wb + 62;
  s(xRLF, -cwR, zFloor, xRLF, -yLcaIn, zLca);
  s(xRLF,  cwR, zFloor, xRLF,  yLcaIn, zLca);
  s(xRLR, -cwR, zFloor, xRLR, -yLcaIn, zLca);
  s(xRLR,  cwR, zFloor, xRLR,  yLcaIn, zLca);
  s(xRLF, -yLcaIn, zLca, xRLR, -yLcaIn, zLca);
  s(xRLF,  yLcaIn, zLca, xRLR,  yLcaIn, zLca);

  // ── Rear engine sub-frame ──────────────────────────────────────────────────────
  // Lower rails (brace feet to engine bay end)
  s(xBrace, -rrhw, zFloor, xRE,  -cwR, zFloor);
  s(xBrace,  rrhw, zFloor, xRE,   cwR, zFloor);
  s(xRE,    -cwR,  zFloor, xRE,   cwR, zFloor);    // rear cross lower
  // Upper frame (elevated for CVT clearance)
  const zCVT = zFloor + 110;
  s(xBrace, -rrhw, zFloor + 60, xRE, -cwR * 0.80, zCVT);
  s(xBrace,  rrhw, zFloor + 60, xRE,  cwR * 0.80, zCVT);
  s(xRE,  -cwR * 0.80, zCVT, xRE,  cwR * 0.80, zCVT);   // rear cross upper
  // X-brace rear bay floor
  s(xBrace, -rrhw, zFloor, xRE,  cwR, zFloor);
  s(xBrace,  rrhw, zFloor, xRE, -cwR, zFloor);
  // Engine mount cantilever
  s(xRE,    -cwR,  zFloor, xREtip, -cwR * 0.42, zFloor + 22);
  s(xRE,     cwR,  zFloor, xREtip,  cwR * 0.42, zFloor + 22);
  s(xREtip, -cwR * 0.42, zFloor + 22, xREtip, cwR * 0.42, zFloor + 22);
  // CVT tunnel side rails (Baja: CVT on right side)
  s(xRRH + 40, rrhw * 0.55, zFloor,       xRE, cwR * 0.80, zFloor);
  s(xRRH + 40, rrhw * 0.55, zFloor + 55,  xRE, cwR * 0.80, zCVT);

  return buf;
}
