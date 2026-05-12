'use client';

/**
 * ChassisWireframe — parametric 3D tube-frame chassis visualisation.
 *
 * SAE J670 → Three.js coord:  [x, y, z]_SAE → [x*MM, z*MM, -y*MM]_Three
 * Origin: front axle centre, vehicle centreline, ground plane.
 *
 * FSAE: open-wheel formula spaceframe — pointed nose, A-hoop, main hoop, rear engine bay.
 * Baja: full roll cage buggy — front bumper, front hoop, RRH, overhead bars, door bars.
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
      color: isBaja ? '#b08040' : '#5080c0',
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

// ─── FSAE steel spaceframe ────────────────────────────────────────────────────
//
// Represents a typical 2024-era FSAE open-wheel formula car:
//   • Pointed nose cone connecting to front bulkhead
//   • Front A-hoop (T3.3.1: ≥290 mm wide at apex)
//   • Cockpit floor rails + side impact tubes (T3.5.1: 150–350 mm)
//   • Main roll hoop (T3.2.3: ≥920 mm tall, ≥380 mm wide)
//   • Main hoop rear braces ≤15° from vertical (T3.2.1)
//   • Rear engine cradle
//
function buildFSAEFrame(wb: number, ft: number, _rt: number): number[] {
  const buf: number[] = [];
  const s = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
    pushSeg(buf, ax, ay, az, bx, by, bz);

  // Half-widths (mm) ────────────────────────────────────────────────────────────
  const cw  = Math.min(Math.round(ft * 0.16), 200);  // cockpit half-width
  const fhw = 148;                                    // front hoop half-width (296 mm ≥290 ✓)
  const mhw = 195;                                    // main hoop half-width (390 mm ≥380 ✓)
  const nbw =  72;                                    // nose-base half-width at front bulkhead

  // Heights above ground (mm) ───────────────────────────────────────────────────
  const zF  =  30;    // floor rail (≈25 mm ride height)
  const zSI = 220;    // side impact tube (T3.5.1: 150–350 mm ✓)
  const zUP = 370;    // upper front-bay rail / front bulkhead top
  const zFH = 690;    // front A-hoop apex
  const zMH = 930;    // main hoop apex (≥920 mm ✓)

  // X positions from front axle (mm) ───────────────────────────────────────────
  const xNT  = -340;                                        // nose tip
  const xFB  =  -80;                                        // front bulkhead
  const xFH  =  360;                                        // front A-hoop
  const xMH  = Math.round(wb * 0.535);                      // main hoop (~855 mm @ 1600 mm WB)
  const xBr  = xMH + Math.round(zMH * Math.tan(13 * Math.PI / 180));  // brace foot
  const xRB  = wb +  75;                                    // rear bulkhead
  const xRE  = wb + 265;                                    // rear engine tip

  // ── Nose cone ─────────────────────────────────────────────────────────────────
  // Four rails from tip to front bulkhead corners, plus nose upright and FB face
  s(xNT, 0, zF + 12,   xFB, -nbw, zF);         // lower-left
  s(xNT, 0, zF + 12,   xFB,  nbw, zF);         // lower-right
  s(xNT, 0, zUP - 45,  xFB,  -cw, zUP);        // upper-left
  s(xNT, 0, zUP - 45,  xFB,   cw, zUP);        // upper-right
  s(xNT, 0, zF + 12,   xNT,   0,  zUP - 45);   // nose upright
  // Front bulkhead face
  s(xFB, -nbw, zF,    xFB,  nbw, zF);           // lower cross
  s(xFB,  -cw, zUP,   xFB,   cw, zUP);          // upper cross
  s(xFB, -nbw, zF,    xFB,  -cw, zUP);          // left upright
  s(xFB,  nbw, zF,    xFB,   cw, zUP);          // right upright

  // ── Front bay (FB → FH) ───────────────────────────────────────────────────────
  s(xFB, -cw, zF,    xFH, -fhw, zF);            // floor rail L
  s(xFB,  cw, zF,    xFH,  fhw, zF);            // floor rail R
  s(xFB, -cw, zUP,   xFH, -fhw, zFH);           // upper rail L
  s(xFB,  cw, zUP,   xFH,  fhw, zFH);           // upper rail R
  // Uprights at bulkhead sides
  s(xFB, -cw, zF,    xFB, -cw, zUP);
  s(xFB,  cw, zF,    xFB,  cw, zUP);

  // ── Front A-hoop (T3.3.1) ─────────────────────────────────────────────────────
  s(xFH, -fhw, zF,   xFH, -fhw, zFH);           // left leg
  s(xFH,  fhw, zF,   xFH,  fhw, zFH);           // right leg
  s(xFH, -fhw, zFH,  xFH,  fhw, zFH);           // top bar
  s(xFH, -fhw, zF,   xFH,  fhw, zF);            // base cross

  // ── Cockpit (FH → MH) ─────────────────────────────────────────────────────────
  s(xFH, -fhw, zF,   xMH, -mhw, zF);            // floor rail L
  s(xFH,  fhw, zF,   xMH,  mhw, zF);            // floor rail R
  s(xFH, -fhw, zSI,  xMH, -mhw, zSI);           // side impact tube L (T3.5.1)
  s(xFH,  fhw, zSI,  xMH,  mhw, zSI);           // side impact tube R
  // Verticals connecting floor to SI at hoop feet
  s(xFH, -fhw, zF,   xFH, -fhw, zSI);
  s(xFH,  fhw, zF,   xFH,  fhw, zSI);
  s(xMH, -mhw, zF,   xMH, -mhw, zSI);
  s(xMH,  mhw, zF,   xMH,  mhw, zSI);
  // Upper cockpit rails (FH apex → MH apex)
  s(xFH, -fhw, zFH,  xMH, -mhw, zMH);
  s(xFH,  fhw, zFH,  xMH,  mhw, zMH);

  // ── Main roll hoop (T3.2.3) ───────────────────────────────────────────────────
  s(xMH, -mhw, zF,   xMH, -mhw, zMH);           // left leg
  s(xMH,  mhw, zF,   xMH,  mhw, zMH);           // right leg
  s(xMH, -mhw, zMH,  xMH,  mhw, zMH);           // top bar
  s(xMH, -mhw, 480,  xMH,  mhw, 480);           // mid cross-brace
  s(xMH, -mhw, zF,   xMH,  mhw, zF);            // base cross

  // ── Main hoop rear braces (T3.2.1 ≤15°) ──────────────────────────────────────
  s(xMH, -mhw, zMH,  xBr, -mhw, zF);
  s(xMH,  mhw, zMH,  xBr,  mhw, zF);

  // ── Rear engine bay ───────────────────────────────────────────────────────────
  const cwR = 115;
  // Lower rails + cross-members
  s(xBr, -mhw, zF,   xRB, -cwR, zF);
  s(xBr,  mhw, zF,   xRB,  cwR, zF);
  s(xRB, -cwR, zF,   xRB,  cwR, zF);            // rear bulkhead lower
  s(xRB, -cwR, zF,   xRE, -cwR * 0.5, zF);
  s(xRB,  cwR, zF,   xRE,  cwR * 0.5, zF);
  s(xRE, -cwR * 0.5, zF,  xRE, cwR * 0.5, zF); // rear tip lower
  // X-brace rear bay floor
  s(xBr, -mhw, zF,   xRB,  cwR, zF);
  s(xBr,  mhw, zF,   xRB, -cwR, zF);
  // Upper rear rails
  const zRU = zUP - 30;
  s(xMH, -mhw, zMH,  xRB, -cwR, zRU);
  s(xMH,  mhw, zMH,  xRB,  cwR, zRU);
  s(xRB, -cwR, zF,   xRB, -cwR, zRU);           // rear bulkhead uprights
  s(xRB,  cwR, zF,   xRB,  cwR, zRU);
  s(xRB, -cwR, zRU,  xRB,  cwR, zRU);           // rear bulkhead upper
  s(xRB, -cwR, zRU,  xRE, -cwR * 0.5, zF + 80);
  s(xRB,  cwR, zRU,  xRE,  cwR * 0.5, zF + 80);
  s(xRE, -cwR * 0.5, zF + 80, xRE, cwR * 0.5, zF + 80);

  return buf;
}

// ─── Baja SAE 2025/2026 full roll cage ───────────────────────────────────────
//
// Represents a typical Baja SAE open-wheel off-road buggy:
//   • Front bumper hoop with X-brace and A-pillar struts
//   • Front cage face (rectangle)
//   • Front hoop arch over cockpit opening
//   • Side door protection bars, 203–356 mm above ground (B6.5)
//   • Overhead bars connecting front hoop to RRH
//   • Rear roll hoop (B6.3: ≥736 mm wide at ≥686 mm above seat)
//   • RRH rear diagonal braces
//   • Rear engine sub-frame
//
function buildBajaFrame(wb: number, ft: number, _rt: number, rideHt = 305): number[] {
  const buf: number[] = [];
  const s = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
    pushSeg(buf, ax, ay, az, bx, by, bz);

  // Half-widths (mm) ────────────────────────────────────────────────────────────
  const bmpW = Math.min(Math.round(ft * 0.26), 355);   // bumper half-width
  const cw   = Math.min(Math.round(ft * 0.34), 480);   // cockpit / FH half-width
  const rrhw = Math.max(Math.round(ft * 0.38), 368);   // RRH half-width (≥368 = 736 mm ✓)
  const cwR  = Math.round(rrhw * 0.62);                // rear sub-frame half-width

  // Heights above ground (mm) ───────────────────────────────────────────────────
  const zFloor = rideHt;                  // belly / floor rail
  const zDB    = 268;                     // door bar height (203–356 mm ✓)
  const zUP    = rideHt + 255;            // upper cockpit rail / FH shoulder
  const zFH    = rideHt + 500;            // front hoop apex
  const zRRH   = rideHt + 760;            // RRH apex (seat ≈ rideHt+120 → ≥+686 mm = rideHt+806; close enough for visual)

  // X positions from front axle (mm) ───────────────────────────────────────────
  const xBump  = -365;                              // front bumper face
  const xFront =  -55;                              // front cage face
  const xFH    =  270;                              // front hoop
  const xRRH   = Math.round(wb * 0.515);            // RRH (~732 mm @ 1422 mm WB)
  const xBrace = xRRH + Math.round((zRRH - zFloor) * Math.tan(17 * Math.PI / 180));
  const xRE    = wb + 195;                          // rear sub-frame tip

  // ── Front bumper hoop ─────────────────────────────────────────────────────────
  s(xBump, -bmpW, zFloor,  xBump,  bmpW, zFloor);  // lower bar
  s(xBump, -bmpW, zDB,     xBump,  bmpW, zDB);     // upper bar
  s(xBump, -bmpW, zFloor,  xBump, -bmpW, zDB);     // left upright
  s(xBump,  bmpW, zFloor,  xBump,  bmpW, zDB);     // right upright
  // X-brace
  s(xBump, -bmpW, zFloor,  xBump,  bmpW, zDB);
  s(xBump,  bmpW, zFloor,  xBump, -bmpW, zDB);
  // Bumper → front cage rails (lower + upper)
  s(xBump, -bmpW, zFloor,  xFront, -cw, zFloor);
  s(xBump,  bmpW, zFloor,  xFront,  cw, zFloor);
  s(xBump, -bmpW, zDB,     xFront, -cw, zUP);
  s(xBump,  bmpW, zDB,     xFront,  cw, zUP);

  // ── Front cage face ───────────────────────────────────────────────────────────
  s(xFront, -cw, zFloor,  xFront,  cw, zFloor);    // lower cross
  s(xFront, -cw, zUP,     xFront,  cw, zUP);       // upper cross
  s(xFront, -cw, zFloor,  xFront, -cw, zUP);       // left upright
  s(xFront,  cw, zFloor,  xFront,  cw, zUP);       // right upright

  // ── Belly floor rails (front → rear) ─────────────────────────────────────────
  s(xFront, -cw,   zFloor,  xFH,    -cw,   zFloor);
  s(xFront,  cw,   zFloor,  xFH,     cw,   zFloor);
  s(xFH,    -cw,   zFloor,  xRRH,  -rrhw,  zFloor);
  s(xFH,     cw,   zFloor,  xRRH,   rrhw,  zFloor);
  s(xRRH,  -rrhw,  zFloor,  xBrace, -rrhw, zFloor); // continue to brace foot
  s(xRRH,   rrhw,  zFloor,  xBrace,  rrhw, zFloor);
  // Mid belly cross-member
  const xBellyMid = Math.round((xFH + xRRH) / 2);
  s(xBellyMid, -cw, zFloor, xBellyMid, cw, zFloor);

  // ── Door protection bars (B6.5: 203–356 mm above ground) ─────────────────────
  s(xFront, -cw, zDB,   xRRH, -rrhw, zDB);         // left door bar
  s(xFront,  cw, zDB,   xRRH,  rrhw, zDB);         // right door bar
  // Verticals: floor → door bar at each end
  s(xFront, -cw, zFloor, xFront, -cw, zDB);
  s(xFront,  cw, zFloor, xFront,  cw, zDB);
  s(xRRH, -rrhw, zFloor, xRRH, -rrhw, zDB);
  s(xRRH,  rrhw, zFloor, xRRH,  rrhw, zDB);
  // X-brace in each door panel
  s(xFront, -cw, zFloor,  xRRH, -rrhw, zDB);
  s(xFront, -cw, zDB,     xRRH, -rrhw, zFloor);
  s(xFront,  cw, zFloor,  xRRH,  rrhw, zDB);
  s(xFront,  cw, zDB,     xRRH,  rrhw, zFloor);

  // ── Front hoop arch ───────────────────────────────────────────────────────────
  const fhApex = Math.round(cw * 0.55);             // arch narrows at top
  s(xFH, -cw, zFloor,  xFH, -cw,     zUP);         // left straight leg
  s(xFH,  cw, zFloor,  xFH,  cw,     zUP);         // right straight leg
  s(xFH, -cw, zUP,     xFH, -fhApex, zFH);         // left arch
  s(xFH,  cw, zUP,     xFH,  fhApex, zFH);         // right arch
  s(xFH, -fhApex, zFH, xFH,  fhApex, zFH);         // top bar
  s(xFH, -cw, zFloor,  xFH,  cw,     zFloor);      // base cross

  // ── Upper side rails (front cage → FH → RRH) ─────────────────────────────────
  s(xFront, -cw, zUP,   xFH,   -cw,  zUP);
  s(xFront,  cw, zUP,   xFH,    cw,  zUP);
  const zRRHmid = zFloor + (zRRH - zFloor) * 0.44;
  s(xFH, -cw, zUP,    xRRH, -rrhw, zRRHmid);
  s(xFH,  cw, zUP,    xRRH,  rrhw, zRRHmid);

  // ── Rear roll hoop (B6.3: ≥736 mm wide at ≥686 mm above seat) ────────────────
  s(xRRH, -rrhw, zFloor,  xRRH, -rrhw, zRRH);      // left leg
  s(xRRH,  rrhw, zFloor,  xRRH,  rrhw, zRRH);      // right leg
  s(xRRH, -rrhw, zRRH,    xRRH,  rrhw, zRRH);      // top bar
  s(xRRH, -rrhw, zFloor,  xRRH,  rrhw, zFloor);    // base cross
  s(xRRH, -rrhw, zRRHmid, xRRH,  rrhw, zRRHmid);  // mid cross

  // ── Overhead bars (FH apex → RRH top) ────────────────────────────────────────
  const ohwR = Math.round(rrhw * 0.38);             // overhead bars meet near RRH centre
  s(xFH, -fhApex, zFH,   xRRH, -ohwR, zRRH);       // left overhead
  s(xFH,  fhApex, zFH,   xRRH,  ohwR, zRRH);       // right overhead
  // Mid overhead cross-bar
  const xOH = Math.round((xFH + xRRH) / 2);
  const zOH = Math.round((zFH + zRRH) / 2);
  const wOH = Math.round((fhApex + ohwR) / 2);
  s(xOH, -wOH, zOH,  xOH, wOH, zOH);

  // ── RRH rear diagonal braces ──────────────────────────────────────────────────
  s(xRRH, -rrhw, zRRH,    xBrace, -rrhw, zFloor);
  s(xRRH,  rrhw, zRRH,    xBrace,  rrhw, zFloor);

  // ── Rear sub-frame (brace feet → engine tip) ──────────────────────────────────
  s(xBrace, -rrhw, zFloor,  xRE, -cwR, zFloor);
  s(xBrace,  rrhw, zFloor,  xRE,  cwR, zFloor);
  s(xRE, -cwR, zFloor,      xRE,  cwR, zFloor);     // rear cross lower
  // X-brace rear bay
  s(xBrace, -rrhw, zFloor,  xRE,  cwR, zFloor);
  s(xBrace,  rrhw, zFloor,  xRE, -cwR, zFloor);
  // Upper rear rails (elevated for CVT / engine clearance)
  const zRearUp = zFloor + 125;
  s(xBrace, -rrhw, zFloor + 55,  xRE, -cwR * 0.72, zRearUp);
  s(xBrace,  rrhw, zFloor + 55,  xRE,  cwR * 0.72, zRearUp);
  s(xRE, -cwR * 0.72, zRearUp,   xRE,  cwR * 0.72, zRearUp);

  return buf;
}
