'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// ─── Data model ───────────────────────────────────────────────────────────────

type Series = 'FSAE' | 'Baja' | 'Both';

interface PartSpec {
  id: string;
  name: string;
  category: string;
  series: Series;
  description: string;
  material?: string;
  typicalSpec?: string;
  function: string;
  connections?: string;
  notes?: string;
  ruleRef?: string;
}

// ─── Parts database ───────────────────────────────────────────────────────────

const PARTS: PartSpec[] = [
  // ─── CHASSIS ───────────────────────────────────────────────────────────────
  {
    id: 'fsae_spaceframe',
    name: 'Spaceframe Chassis',
    category: 'Chassis',
    series: 'FSAE',
    description: 'Triangulated tube-frame structure that forms the primary structural backbone of the car, carrying all suspension, powertrain, and aero loads.',
    material: 'AISI 4130 chromoly or SAE 1018 mild steel',
    typicalSpec: '25.4 mm × 2.0 mm wall main hoops; 25.4 × 1.6 mm side impact, chassis rails',
    function: 'Primary load path for all forces: suspension pickup loads, engine torque reaction, driver restraint.',
    connections: 'Suspension pickup points, engine mounts, steering rack mount, body/aero attachment.',
    ruleRef: 'FSAE Rules T3.2 – T3.10',
  },
  {
    id: 'fsae_main_hoop',
    name: 'Main Roll Hoop (MRH)',
    category: 'Chassis',
    series: 'FSAE',
    description: 'Single-piece bent tube hoop that protects the driver\'s head in a rollover. Must be the highest point of the car.',
    material: 'AISI 4130 chromoly (mandatory)',
    typicalSpec: '≥25.4 mm OD, ≥2.4 mm wall; ≥920 mm tall; ≥380 mm wide at driver helmet level',
    function: 'Rollover protection, driver head clearance.',
    connections: 'Floor rails, main hoop braces (diagonal), cockpit side rails.',
    ruleRef: 'FSAE Rules T3.2.3: height ≥ 920 mm, width ≥ 380 mm from ground',
  },
  {
    id: 'fsae_front_hoop',
    name: 'Front Roll Hoop (FRH / A-Hoop)',
    category: 'Chassis',
    series: 'FSAE',
    description: 'Hoop in front of the driver forming the leading edge of the roll protection envelope.',
    material: 'AISI 4130 chromoly',
    typicalSpec: '≥25.4 mm OD, ≥1.6 mm wall; ≥290 mm wide at apex',
    function: 'Forward rollover protection, driver entry/exit reference point.',
    connections: 'Nose section rails, cockpit floor, main hoop via cockpit side rails.',
    ruleRef: 'FSAE Rules T3.3.1',
  },
  {
    id: 'fsae_front_bulkhead',
    name: 'Front Bulkhead',
    category: 'Chassis',
    series: 'FSAE',
    description: 'Structural cross-member at the nose that forms the forward-most face of the primary structure and anchor for the nose cone.',
    material: 'Steel (welded tube) or aluminum plate (monocoque)',
    typicalSpec: '150–200 mm wide, 100–150 mm tall',
    function: 'Impact load distribution from nose cone into spaceframe, front suspension pickup reaction.',
    connections: 'Nose cone (bolted), front suspension forward pickup points.',
    ruleRef: 'FSAE Rules T3.4',
  },
  {
    id: 'baja_rollcage',
    name: 'Roll Cage',
    category: 'Chassis',
    series: 'Baja',
    description: 'Full roll cage protecting the driver from all directions. Must meet Baja SAE dimensional and material requirements at every cross-section.',
    material: 'AISI 4130 chromoly — mandatory for RRH and lateral protection members',
    typicalSpec: 'RRH: ≥25.4 mm OD, ≥3.0 mm wall; non-primary members: ≥25.4 mm OD, ≥2.0 mm wall',
    function: 'Driver rollover and side-impact protection.',
    connections: 'All suspension inboard mounts, engine mounts, seat mounts, belly plate.',
    ruleRef: 'Baja SAE Rules B6.3 – B6.7',
  },
  {
    id: 'baja_rrh',
    name: 'Rear Roll Hoop (RRH)',
    category: 'Chassis',
    series: 'Baja',
    description: 'The highest structural hoop at the rear of the cockpit. Primary rollover protection member.',
    material: 'AISI 4130 chromoly (mandatory)',
    typicalSpec: '≥25.4 mm OD, ≥3.0 mm wall; ≥736 mm wide; ≥686 mm above seat reference point',
    function: 'Main rollover load path. Must not deform to contact driver in any rollover.',
    connections: 'Rear diagonal braces, overhead bars, door bars, belly rail.',
    ruleRef: 'Baja SAE Rules B6.3',
  },
  {
    id: 'baja_belly_plate',
    name: 'Skid Plate / Belly Plate',
    category: 'Chassis',
    series: 'Baja',
    description: 'Flat plate bolted beneath the frame belly to protect the drivetrain and frame from rock strikes.',
    material: 'UHMW polyethylene, aluminum 6061, or HDPE',
    typicalSpec: '6.35 mm (¼") min thickness UHMW; full drivetrain coverage',
    function: 'Protect CVT, chain drive, and frame rails from ground contact.',
    connections: 'Bolted to frame belly rails with steel fasteners.',
  },
  {
    id: 'baja_door_bar',
    name: 'Lateral Side Door Bar',
    category: 'Chassis',
    series: 'Baja',
    description: 'Horizontal tube on each side of the cockpit providing side-impact protection at driver hip/torso height.',
    material: 'AISI 4130 chromoly or mild steel',
    typicalSpec: '≥25.4 mm OD, ≥2.0 mm wall; between 203 mm and 356 mm above lowest interior frame point',
    function: 'Side impact energy absorption and load path to roll cage.',
    connections: 'Front cage face, RRH or intermediate frame node.',
    ruleRef: 'Baja SAE Rules B6.5',
  },

  // ─── SUSPENSION ────────────────────────────────────────────────────────────
  {
    id: 'uca',
    name: 'Upper Control Arm (UCA)',
    category: 'Suspension',
    series: 'Both',
    description: 'A-arm or wishbone link connecting the upper chassis pickup points to the upper ball joint on the upright. Controls camber and toe in jounce/rebound.',
    material: 'AISI 4130 chromoly tube with rod-end (heim joint) bearings',
    typicalSpec: '19.05 mm × 1.65 mm (FSAE) or 25.4 mm × 2.0 mm (Baja); rod ends at both ends',
    function: 'Constrains upright upper pivot point. Arm geometry determines camber gain rate.',
    connections: 'Chassis upper pickup (2 points, front and rear), upper ball joint or rod end on upright.',
    notes: 'Shorter arms give more camber gain per mm of travel. UCA/LCA length ratio sets roll center height.',
  },
  {
    id: 'lca',
    name: 'Lower Control Arm (LCA)',
    category: 'Suspension',
    series: 'Both',
    description: 'A-arm connecting the lower chassis pickup points to the lower ball joint on the upright. Typically longer than UCA to limit positive camber in bump.',
    material: 'AISI 4130 chromoly tube with rod-end bearings',
    typicalSpec: '19.05 mm × 1.65 mm (FSAE) or 31.75 mm × 2.0 mm (Baja); longer than UCA',
    function: 'Primary suspension geometry link. LCA length relative to UCA controls camber gain sign.',
    connections: 'Chassis lower pickup (2 points), lower ball joint on upright.',
    notes: 'LCA also reacts longitudinal load from braking (if front) and traction (if rear drive).',
  },
  {
    id: 'upright',
    name: 'Upright / Spindle',
    category: 'Suspension',
    series: 'Both',
    description: 'Structural member that houses the wheel bearing and connects the suspension links (UCA, LCA, tie rod, shock) to the wheel assembly.',
    material: 'Aluminum 7075-T6 (FSAE) or steel (Baja); often billet CNC machined',
    typicalSpec: '250–400 g (FSAE); 0.8–1.5 kg (Baja)',
    function: 'Carries wheel bearing preload, brake caliper mount, and all suspension link forces.',
    connections: 'Upper and lower ball joints from control arms, tie rod, shock absorber lower mount, wheel bearing and hub.',
    notes: 'Kingpin inclination (KPI) and caster trail are set by upright geometry.',
  },
  {
    id: 'hub',
    name: 'Wheel Hub',
    category: 'Suspension',
    series: 'Both',
    description: 'Rotating member that mounts the wheel/tire and spins inside the upright via the wheel bearing. Also carries the brake rotor.',
    material: 'Aluminum 7075-T6 or 6061-T6',
    typicalSpec: '10" or 13" wheel pilot diameter (FSAE); splined half-shaft interface or bolt-on (Baja)',
    function: 'Transfers braking/drive torque between half-shaft/axle and wheel. Supports rotor.',
    connections: 'Wheel bearing (inside upright), wheel (5-stud or 3-bolt flange), brake rotor, half-shaft/axle spline.',
  },
  {
    id: 'wheel_bearing',
    name: 'Wheel Bearing',
    category: 'Suspension',
    series: 'Both',
    description: 'Allows the wheel hub to rotate freely inside the upright while supporting radial and axial loads.',
    material: 'Chrome steel or ceramic hybrid; sealed or shielded',
    typicalSpec: 'Angular contact ball bearing pairs or tapered roller bearing. 40–60 mm ID (FSAE). 50–75 mm (Baja)',
    function: 'Low-friction rotation of hub inside upright under combined radial (cornering) and axial (lateral) loads.',
    connections: 'Press-fit or bolted into upright bore; hub shaft or spline through inner race.',
  },
  {
    id: 'rocker',
    name: 'Rocker / Bellcrank',
    category: 'Suspension',
    series: 'FSAE',
    description: 'Pivoting triangular plate or bellcrank that converts pushrod/pullrod motion into spring-damper compression. Sets motion ratio.',
    material: 'Aluminum 7075-T6 billet',
    typicalSpec: '100–200 mm arm lengths; pivot on needle or plain bearing; motion ratio typically 0.5–0.9',
    function: 'Multiplies or reduces wheel travel to damper travel (motion ratio). Allows inboard spring/damper packaging.',
    connections: 'Pushrod or pullrod (input), damper body (output), chassis pivot mount.',
    notes: 'Motion ratio = rocker output arm / rocker input arm. Wheel rate = spring rate × MR².',
  },
  {
    id: 'pushrod',
    name: 'Pushrod',
    category: 'Suspension',
    series: 'FSAE',
    description: 'Compression link running upward-outboard from the lower upright or LCA to the inboard rocker. Used for lower CG spring/damper packaging.',
    material: 'AISI 4130 chromoly tube; rod ends at both ends',
    typicalSpec: '12–16 mm OD, 1.6 mm wall; length 200–350 mm; angled ~30–45° from horizontal',
    function: 'Transfers vertical wheel load to rocker as a compressive column. Allows inboard packaging.',
    connections: 'Lower upright or LCA (outboard), rocker input arm (inboard).',
  },
  {
    id: 'pullrod',
    name: 'Pullrod',
    category: 'Suspension',
    series: 'FSAE',
    description: 'Tension link running downward-inboard from the upper upright or UCA to the inboard rocker. Lowers rocker to chassis floor level.',
    material: 'AISI 4130 chromoly tube; rod ends at both ends',
    typicalSpec: '12–16 mm OD, 1.6 mm wall; angled ~20–35° from horizontal',
    function: 'Transfers vertical wheel load to rocker as a tension rod. Lowers sprung mass CG by packaging spring/damper lower.',
    connections: 'Upper upright or UCA (outboard), rocker input arm (inboard).',
  },
  {
    id: 'coilover_fsae',
    name: 'Coilover Damper (FSAE)',
    category: 'Suspension',
    series: 'FSAE',
    description: 'Combined spring-damper unit with coaxial spring and adjustable bump/rebound damping. Used inboard on FSAE cars via rocker.',
    material: 'Aluminum body, chrome steel shaft, steel spring',
    typicalSpec: '50–100 mm stroke; spring rate 15–35 N/mm; Penske 7700, Öhlins TTX, Fox FLOAT common choices',
    function: 'Controls wheel motion speed (damping) and supports sprung mass (spring).',
    connections: 'Rocker output arm (top), chassis or frame lower mount (bottom), or reversed.',
  },
  {
    id: 'coilover_baja',
    name: 'Coilover Shock (Baja)',
    category: 'Suspension',
    series: 'Baja',
    description: 'Long-travel coilover unit mounted directly between chassis and upright/LCA in direct-acting configuration (no pushrod/pullrod on Baja).',
    material: 'Aluminum reservoir body, chrome steel shaft, wound steel spring',
    typicalSpec: '10–14" stroke; spring rate 25–60 N/mm; Fox 2.0, Elka Stage 5, King OEM popular',
    function: 'Handles large wheel travel (200–300 mm) over rough terrain. Provides both spring and damping.',
    connections: 'Upper chassis node (top clevis), lower upright or LCA (bottom clevis).',
  },
  {
    id: 'arb',
    name: 'Anti-Roll Bar (ARB / Sway Bar)',
    category: 'Suspension',
    series: 'Both',
    description: 'Torsion spring coupling left and right suspension, resisting body roll without affecting single-wheel (parallel) motion.',
    material: 'AISI 4130 or 1040 steel; blade ARB (FSAE) or tubular (Baja)',
    typicalSpec: 'Blade ARB: 60–100 mm × 5–12 mm rectangular section; stiffness 10–80 N·m/deg',
    function: 'Increases roll stiffness independently of ride frequency. Adjusts front/rear roll stiffness balance.',
    connections: 'ARB drop-links (connects to lower rocker or LCA), chassis pivot bearings at center.',
  },
  {
    id: 'tie_rod',
    name: 'Tie Rod',
    category: 'Suspension',
    series: 'Both',
    description: 'Link connecting the steering rack (or steering arm) to the upright toe arm. Controls wheel steer angle.',
    material: 'AISI 4130 chromoly tube; rod ends (FSAE) or heavy-duty ends (Baja)',
    typicalSpec: 'Length adjusted for bump-steer correction. 12–16 mm OD (FSAE); 19–22 mm OD (Baja)',
    function: 'Transmits rack displacement to wheel as toe angle change. Tie rod geometry sets bump-steer curve.',
    connections: 'Steering rack output or relay rod (inboard), upright toe arm rod end (outboard).',
  },
  {
    id: 'ball_joint',
    name: 'Ball Joint',
    category: 'Suspension',
    series: 'Both',
    description: 'Spherical bearing allowing multi-axis rotation between control arm and upright. Allows the upright to steer and camber while the arm is fixed.',
    material: 'Chrome steel ball in steel or aluminum housing; grease-filled or PTFE-lined',
    typicalSpec: '12 mm or 14 mm shank; spherical rod ends for FSAE; OEM-style press-in for Baja',
    function: 'Allows 3-DOF rotation at control arm tips. Defines kingpin axis geometry.',
    connections: 'UCA tip → upper ball joint hole in upright; LCA tip → lower ball joint hole.',
  },
  {
    id: 'bump_stop',
    name: 'Bump Stop / Jounce Bumper',
    category: 'Suspension',
    series: 'Both',
    description: 'Elastomeric or foam block that cushions the suspension at full jounce, preventing metal-to-metal contact.',
    material: 'Microcellular polyurethane (bump rubber) or EPDM foam',
    typicalSpec: '20–50 mm free length; progressive rate from 10 N/mm to >200 N/mm compressed',
    function: 'Soft end-of-travel cushioning. Adds progressive spring rate at extreme jounce.',
    connections: 'Damper piston rod or separate chassis bracket; contacts damper collar or rocker.',
  },

  // ─── STEERING ──────────────────────────────────────────────────────────────
  {
    id: 'rack_pinion',
    name: 'Rack & Pinion Steering',
    category: 'Steering',
    series: 'Both',
    description: 'Linear rack translated by a rotary pinion gear converts steering wheel input into lateral tie rod displacement.',
    material: 'Steel rack and pinion gear; aluminum housing',
    typicalSpec: 'FSAE: 50–80 mm rack travel; 3–5:1 ratio. Baja: 60–90 mm rack travel.',
    function: 'Primary steering mechanism. Rack travel per steering wheel rotation set by pinion radius.',
    connections: 'Steering column U-joint (input), two tie rods (output), chassis rack mounts.',
    notes: 'Woodward Engineering, Stiletto, and custom in-house racks are common for FSAE.',
  },
  {
    id: 'steering_column',
    name: 'Steering Column & U-Joints',
    category: 'Steering',
    series: 'Both',
    description: 'Shaft transmitting steering wheel torque to the rack pinion. Universal joints allow angular offsets between wheel, column, and rack.',
    material: 'DOM (drawn-over-mandrel) steel tube; U-joints chromoly with needle bearings',
    typicalSpec: '19–25 mm OD column; quick-release spline or D-shaft at wheel end',
    function: 'Torque transmission from driver hands to rack. Collapsible design for safety.',
    connections: 'Steering wheel quick-release (top), rack pinion (bottom), chassis bearing mounts.',
    ruleRef: 'FSAE T6.3 / Baja B8: collapsible column required',
  },
  {
    id: 'steering_wheel',
    name: 'Steering Wheel',
    category: 'Steering',
    series: 'Both',
    description: 'Grippable ring for driver steering input. Bolted to column via a quick-release hub.',
    material: 'Aluminum or composite rim; foam/suede grip',
    typicalSpec: '250–300 mm OD (FSAE); 280–330 mm (Baja); Momo or OMP-style quick release',
    function: 'Driver interface for directional control. Mounts controls (paddles, display, buttons) on FSAE.',
    connections: 'Quick-release boss on steering column.',
  },
  {
    id: 'tie_rod_end',
    name: 'Tie Rod End / Rod End Bearing',
    category: 'Steering',
    series: 'Both',
    description: 'Spherical rod end (heim joint) at each end of the tie rod allowing 3D angular adjustment without binding.',
    material: 'Chrome steel ball in steel or aluminum housing; right-hand and left-hand thread for length adjustment',
    typicalSpec: 'M10, M12, or M14 thread; Aurora, FK, or Alinabal brands common',
    function: 'Angular misalignment absorption. Length adjustment sets static toe.',
    connections: 'Tie rod tube (threaded each end), rack output pin (inboard), upright toe pin (outboard).',
  },

  // ─── BRAKES ────────────────────────────────────────────────────────────────
  {
    id: 'brake_rotor',
    name: 'Brake Rotor / Disc',
    category: 'Brakes',
    series: 'Both',
    description: 'Rotating disc that the brake caliper clamps against to generate friction torque and decelerate the wheel.',
    material: 'Cast iron (OEM) or aluminum with steel inserts (FSAE lightweight)',
    typicalSpec: 'FSAE: 175–220 mm OD, 3–4 mm vented or solid. Baja: single rear 200–250 mm OD inboard.',
    function: 'Convert kinetic energy to heat via friction. Must be sized to avoid thermal fade.',
    connections: 'Hub flange (bolted 3–5 bolt), caliper (floating over disc).',
  },
  {
    id: 'brake_caliper',
    name: 'Brake Caliper',
    category: 'Brakes',
    series: 'Both',
    description: 'Hydraulically actuated pistons that clamp brake pads against the rotor.',
    material: 'Aluminum billet (FSAE); cast iron or aluminum (Baja/OEM)',
    typicalSpec: 'FSAE: AP Racing CP2696 or similar 2-piston; Baja: 1 or 2 piston OEM motorcycle',
    function: 'Generate clamping force = hydraulic pressure × piston area. Braking torque = clamp force × pad friction × rotor radius.',
    connections: 'Upright caliper bracket (bolted), hydraulic line (compression fitting).',
  },
  {
    id: 'master_cylinder',
    name: 'Brake Master Cylinder',
    category: 'Brakes',
    series: 'Both',
    description: 'Converts driver pedal force into hydraulic fluid pressure to actuate calipers. Separate front and rear circuits.',
    material: 'Aluminum body, chrome steel bore',
    typicalSpec: 'FSAE: 15–19 mm bore F/R; Baja: single rear 17–19 mm bore; AP Racing, Wilwood, or OEM',
    function: 'Pascal\'s law amplification of pedal force into line pressure (typically 30–80 bar).',
    connections: 'Brake pedal or bias bar (push rod), brake lines, fluid reservoir.',
    ruleRef: 'FSAE T6.1.1: separate F/R circuits required',
  },
  {
    id: 'brake_bias_bar',
    name: 'Brake Bias Bar',
    category: 'Brakes',
    series: 'FSAE',
    description: 'Mechanical balance bar between two master cylinders allowing the driver to adjust front/rear brake force distribution.',
    material: 'Steel or titanium pivot bar; aluminum clevis ends',
    typicalSpec: '±10–15° adjustment range; typically 60–70% front bias for FSAE',
    function: 'Balance braking efficiency front/rear preventing premature lockup on either axle.',
    connections: 'Brake pedal push rod (center pivot), front MC push rod, rear MC push rod.',
  },
  {
    id: 'brake_line',
    name: 'Brake Line / Hose',
    category: 'Brakes',
    series: 'Both',
    description: 'Transmits hydraulic fluid pressure from master cylinder to caliper.',
    material: 'Stainless braided PTFE hose with AN fittings (FSAE); OEM rubber or braided (Baja)',
    typicalSpec: 'AN-3 (3/16") lines; -3 AN fittings; ≥minimum DOT bend radius',
    function: 'Low-expansion hydraulic conduit rated to >3000 psi burst pressure.',
    connections: 'Master cylinder outlet → caliper inlet via AN fittings.',
    ruleRef: 'FSAE T6.1.3: lines must be hard-mounted away from heat sources',
  },
  {
    id: 'brake_pad',
    name: 'Brake Pads',
    category: 'Brakes',
    series: 'Both',
    description: 'Friction material bonded to a steel backing plate that contacts the rotor.',
    material: 'Sintered metallic or carbon-metallic compound; steel backing',
    typicalSpec: 'FSAE: Carbone Industrie or Ferodo racing compound; μ = 0.4–0.55',
    function: 'Generate friction force = normal force × μ_pad. Convert braking energy to heat.',
    connections: 'Slide into caliper pads slots; spring clip or anti-rattle clip retention.',
  },

  // ─── POWERTRAIN — FSAE ─────────────────────────────────────────────────────
  {
    id: 'fsae_engine',
    name: 'FSAE Engine (≤610cc)',
    category: 'Powertrain',
    series: 'FSAE',
    description: 'Any 4-stroke ICE with ≤610cc displacement (post-2023: all engine types allowed). Common choices are 600cc inline-4 supersport motorcycle engines.',
    material: 'Aluminum alloy block and head; steel crankshaft and camshafts',
    typicalSpec: 'Honda CBR600RR: 65 N·m / 89 kW @ 12,500 RPM. KTM 690 Duke: single-cylinder option.',
    function: 'Primary power source. Throttled via ECU. Rotation direction may require chain or shaft reversal.',
    connections: 'Engine mounts (frame), gearbox (integral), exhaust (header bolted to head), airbox, oil cooler.',
    ruleRef: 'FSAE Rules IC1: ≤610cc displacement; intake restrictor 19 mm (IC), 20 mm (EV)',
  },
  {
    id: 'fsae_restrictor',
    name: 'Intake Restrictor (IC cars)',
    category: 'Powertrain',
    series: 'FSAE',
    description: 'Mandatory 19 mm (or 20 mm for supercharged) circular throat restrictor in the intake path to limit peak power.',
    material: 'Aluminum or steel machined insert',
    typicalSpec: '19.0 mm min orifice for normally aspirated; limits peak power to ~80 kW depending on engine',
    function: 'Equalize competition by capping available power. Creates significant boost/intake pressure drop.',
    connections: 'Between airbox and throttle body. Must be within airbox system.',
    ruleRef: 'FSAE IC3.2.1',
  },
  {
    id: 'fsae_gearbox',
    name: 'Motorcycle Gearbox (integrated)',
    category: 'Powertrain',
    series: 'FSAE',
    description: 'Sequential constant-mesh gearbox integral to the engine. 5 or 6 speeds, shifted via foot lever adapted to paddle or cable pull.',
    material: 'Steel gear dogs and shafts; aluminum housing (integral engine case)',
    typicalSpec: 'CBR600RR: 6-speed, ratios 2.600–0.897; final drive via chain sprockets',
    function: 'Multiplies torque and steps down RPM for each speed range. Constant-mesh allows power-on shifts.',
    connections: 'Engine (integral); output sprocket → chain → rear sprocket → differential/spool.',
  },
  {
    id: 'fsae_differential',
    name: 'Differential / Spool',
    category: 'Powertrain',
    series: 'FSAE',
    description: 'Allows left/right wheel speed difference (open or limited-slip) or locks them together (spool/locker). Mounted between rear half-shafts.',
    material: 'Steel gears, aluminum housing; LSD friction plates or Torsen gears',
    typicalSpec: 'Drexler FSAE LSD: 20–40% lock; or welded spool for low-speed tracks',
    function: 'Distribute drive torque rear-rear while accommodating cornering speed differential.',
    connections: 'Chain sprocket (input), two half-shafts (output).',
  },
  {
    id: 'halfshaft',
    name: 'Half-Shaft / CV Axle',
    category: 'Powertrain',
    series: 'Both',
    description: 'Shaft transmitting drive torque from differential to driven wheel hub through suspension travel. Constant velocity (CV) joints prevent vibration at steering/suspension angles.',
    material: '300M or 4340 chromoly steel; tripod or plunge-type inboard CV, ball-cage outboard CV',
    typicalSpec: 'FSAE: custom length per geometry; 22–28 mm OD splined shaft. Baja: heavy-duty ATV half-shafts',
    function: 'Torque transmission through up to ±30° operating angle without velocity fluctuation.',
    connections: 'Differential output flange (splined), wheel hub (splined and nutted).',
  },
  {
    id: 'chain_drive',
    name: 'Chain Drive / Sprockets',
    category: 'Powertrain',
    series: 'FSAE',
    description: 'Roller chain and sprocket set providing the final drive ratio between gearbox output and rear differential.',
    material: '#530 or #520 racing chain; 7075-T6 or steel sprockets',
    typicalSpec: 'Front: 13–17T; Rear: 48–58T; #520 or #530 chain; ~3–5:1 final drive reduction',
    function: 'Efficient torque multiplication and speed reduction to rear axle.',
    connections: 'Engine output shaft sprocket → chain → rear differential sprocket.',
  },

  // ─── POWERTRAIN — BAJA ─────────────────────────────────────────────────────
  {
    id: 'baja_engine',
    name: 'Briggs & Stratton Engine (fixed spec)',
    category: 'Powertrain',
    series: 'Baja',
    description: 'Fixed-spec Briggs & Stratton OHV single-cylinder 4-stroke engine. Mandatory — no modifications to combustion or valve timing permitted.',
    material: 'Cast aluminum block/head; steel crank, camshaft',
    typicalSpec: '305cc, 10 HP (7.5 kW) @ 3060 RPM; peak torque ~19.4 N·m @ 2400 RPM; governed to 3800 RPM',
    function: 'Primary power source. Directly connected to CVT primary clutch on output shaft.',
    connections: 'CVT primary clutch (direct shaft mount), engine mounts to frame.',
    ruleRef: 'Baja SAE Rules B2: Briggs & Stratton Intek 10 HP engine required',
  },
  {
    id: 'cvt_primary',
    name: 'CVT Primary Clutch (Driver)',
    category: 'Powertrain',
    series: 'Baja',
    description: 'Centrifugal flyweight clutch on the engine output shaft that engages and shifts ratio automatically as engine RPM rises.',
    material: 'Aluminum and steel; fly weights; compression spring inside',
    typicalSpec: 'Comet 40 series, CVtech, or Hilliard; engages ~1800–2200 RPM; shifts via flyweight centrifugal force',
    function: 'Smooth engagement at idle, ratio shift from ~3:1 (low) to ~1:1 (high) as RPM climbs.',
    connections: 'Engine output taper shaft (keyed), belt (shared with secondary clutch).',
    notes: 'Flyweight mass and spring rate tuned to engine torque curve for optimal ratio shift schedule.',
  },
  {
    id: 'cvt_secondary',
    name: 'CVT Secondary Clutch (Driven)',
    category: 'Powertrain',
    series: 'Baja',
    description: 'Torque-sensing driven sheave that responds to load: closes (low ratio) under high load, opens (high ratio) at low load.',
    material: 'Aluminum sheaves; steel helix cam, torsion spring',
    typicalSpec: 'Comet 40/44 series or CVtech Backyard; ramp angle 31–55° helix; spring pre-load 70–120 N·m',
    function: 'Torque-proportional ratio shift from high reduction to 1:1 at cruise. Maintains engine near peak power RPM.',
    connections: 'Belt (shared with primary), jackshaft or chain input shaft (output via key/spline).',
    notes: 'Helix ramp angle is the primary tuning variable — steeper = more torque-sensitive, earlier upshift.',
  },
  {
    id: 'cvt_belt',
    name: 'CVT Drive Belt',
    category: 'Powertrain',
    series: 'Baja',
    description: 'Trapezoid cross-section cogged or smooth rubber belt that runs between primary and secondary clutch sheaves.',
    material: 'Reinforced rubber (cord-wound polyester); aramid fiber top band',
    typicalSpec: 'Dayco, Gates, or OEM Comet series belt. Width 28–32 mm, length 35–40"',
    function: 'Transmit torque across variable-diameter sheaves, changing ratio continuously.',
    connections: 'Primary clutch sheave V-groove, secondary clutch sheave V-groove.',
    notes: 'Belt life is 10–30 hours under racing use. Temperature and belt-to-sheave alignment are critical.',
  },
  {
    id: 'baja_rear_axle',
    name: 'Rear Axle / Live Axle',
    category: 'Powertrain',
    series: 'Baja',
    description: 'Single solid rear axle (for solid rear suspension) or independent half-shafts (for IRS). Transmits torque to rear wheels.',
    material: '1541H or 4140 chromoly steel; axle tubes 4130 (solid axle)',
    typicalSpec: 'Solid axle: 31.75 mm OD shaft; IRS: 25.4–31.75 mm half-shafts with CV joints',
    function: 'Final torque delivery from chain sprocket to rear wheels.',
    connections: 'Chain sprocket (center, live axle) or differential + half-shafts (IRS), wheel hub flanges.',
  },

  // ─── WHEELS AND TIRES ──────────────────────────────────────────────────────
  {
    id: 'fsae_tire',
    name: 'Hoosier 18x6-10 Slick (FSAE)',
    category: 'Wheels & Tires',
    series: 'FSAE',
    description: 'Purpose-built FSAE slick tire on a 10-inch rim. Dominant tire choice — virtually all FSAE teams run this tire.',
    material: 'Rubber compound on nylon cord body; slick (no tread pattern)',
    typicalSpec: '18x6-10: 457 mm OD × 152 mm section width × 10" rim; ~2.5 psi cold inflation typical',
    function: 'Generate cornering and longitudinal forces via rubber deformation and adhesion.',
    connections: 'Mounted on 10" aluminum wheel (bead seat diameter).',
    notes: 'Tire temperature range 70–100°C optimal. Peak lateral Fy typically at 8–12° slip angle.',
  },
  {
    id: 'fsae_wheel',
    name: 'Wheel (10" FSAE)',
    category: 'Wheels & Tires',
    series: 'FSAE',
    description: 'Lightweight aluminum wheel sized for the 10-inch Hoosier FSAE tire.',
    material: 'Aluminum 6061-T6 or cast A356; 3- or 5-spoke design',
    typicalSpec: '10" × 7" or 8" wide; 3.5–4.5 kg each; central lock or 5-stud (varies by team)',
    function: 'Tire mounting and hub load transfer. Brake caliper clearance must be maintained.',
    connections: 'Hub (5-bolt or central lock nut), tire (bead seats).',
  },
  {
    id: 'baja_tire',
    name: 'Baja SAE Tire (≥ 20")',
    category: 'Wheels & Tires',
    series: 'Baja',
    description: 'Knobby off-road ATV/UTV tire providing traction on loose dirt, grass, gravel, and obstacles.',
    material: 'Off-road rubber compound; bias-ply or radial; aggressive lug pattern',
    typicalSpec: 'Common: 23×10-12 or 25×10-12; rim 12"; inflation 6–8 psi. Maxxis, Kenda, ITP brands',
    function: 'Traction on deformable off-road surfaces via knob penetration and large contact patch.',
    connections: 'Mounted on 12" aluminum or steel wheel.',
    notes: 'Width limited to ≤9.5" (240 mm) by rules. Must not spin or slip excessively on hill climb.',
    ruleRef: 'Baja SAE B3.3: tire must be commercially available and listed in rules',
  },
  {
    id: 'baja_wheel',
    name: 'Wheel (12" Baja)',
    category: 'Wheels & Tires',
    series: 'Baja',
    description: '12-inch off-road wheel for Baja SAE. Heavier-duty than FSAE due to off-road impact loads.',
    material: 'Cast aluminum A356 or forged 6061; 4-bolt or 5-bolt pattern',
    typicalSpec: '12" × 8–10" wide; 3–5 kg; bolt pattern 4/115 mm or 4/156 mm to match hub',
    function: 'Off-road tire mounting, withstands impact loads from rocks and drops.',
    connections: 'Hub flange (4–5 bolt), tire bead seats.',
  },

  // ─── ELECTRONICS ───────────────────────────────────────────────────────────
  {
    id: 'ecu',
    name: 'Engine Control Unit (ECU)',
    category: 'Electronics',
    series: 'FSAE',
    description: 'Programmable ECU controlling fuel injection, ignition timing, launch control, traction control, and data logging.',
    material: 'PCB in sealed aluminum enclosure',
    typicalSpec: 'MoTeC M130, AEM Infinity 6, Bosch MS5.0, Haltech Elite 2500; CAN-bus communication',
    function: 'Closed-loop engine management via map-based fuel and ignition tables, sensor feedback.',
    connections: 'Fuel injectors, coil packs, crank/cam sensors, TPS, MAP, WBO2, wheel speeds, dash display via CAN.',
  },
  {
    id: 'sensor_suite',
    name: 'Sensor Suite',
    category: 'Electronics',
    series: 'FSAE',
    description: 'Collection of transducers measuring vehicle and engine state for ECU control and data analysis.',
    material: 'Varied: MEMS, hall effect, inductive, strain gauge, thermocouple',
    typicalSpec: 'Suspension pots (linear potentiometer 50–100mm stroke), wheel speed (hall effect), IMU (6-DOF), TPS, MAP, WBO2, oil temp/pressure, coolant temp',
    function: 'Real-time measurement of kinematics, engine performance, tire loading, and vehicle dynamics.',
    connections: 'ECU (analog/digital/CAN inputs), data logger (CAN bus).',
  },
  {
    id: 'data_logger',
    name: 'Data Logger & Dashboard',
    category: 'Electronics',
    series: 'FSAE',
    description: 'High-sample-rate data acquisition unit recording all sensor channels. Often combined with a driver display.',
    material: 'PCB in sealed enclosure; color TFT or transflective LCD display',
    typicalSpec: 'AIM MXL2, MoTeC CDL3, Dash2Pro; 100–1000 Hz sample rate; 4–32 GB storage',
    function: 'Post-session analysis of vehicle behavior, driver technique, system health monitoring.',
    connections: 'CAN bus from ECU and individual sensors; USB or WiFi download.',
  },
  {
    id: 'kill_switch',
    name: 'Engine Kill Switch / BOTS',
    category: 'Electronics',
    series: 'Both',
    description: 'Mandatory emergency cut-out switches that disable the engine when actuated. Both cockpit-accessible and external (for marshals) required.',
    material: 'Sealed IP67 rocker or push-button switch; rated for full battery current or ignition interrupt',
    typicalSpec: 'FSAE: brake-over-travel switch (BOTS) cuts engine if pedal travels beyond set point; also steering hoop and cockpit kill',
    function: 'Safety device to prevent unintended acceleration or runaway after accident.',
    connections: 'In series with ignition/fuel pump circuit or ECU main power relay.',
    ruleRef: 'FSAE Rules EV/IC: T6.3; Baja Rules B9',
  },

  // ─── AERO ──────────────────────────────────────────────────────────────────
  {
    id: 'aero_nosecone',
    name: 'Nose Cone',
    category: 'Aerodynamics',
    series: 'FSAE',
    description: 'Composite nose section directing airflow around the front suspension. Often houses front wing mounts.',
    material: 'Carbon fiber or fiberglass; epoxy prepreg or wet-layup',
    typicalSpec: '2–3 layers CF; 1.5–3 kg; designed for impact compliance per rules',
    function: 'Aerodynamic shaping; impact energy absorption; mounting surface for front wing.',
    connections: 'Front bulkhead (bolted multiple points), front wing (bolted strakes).',
    ruleRef: 'FSAE T5.6: nose must be compliant at impact zone',
  },
  {
    id: 'aero_rear_wing',
    name: 'Rear Wing',
    category: 'Aerodynamics',
    series: 'FSAE',
    description: 'Inverted aerofoil generating downforce at the rear. Usually two or three elements (main plane + flap(s)) with endplates.',
    material: 'Carbon fiber skin over foam core; aluminum spars',
    typicalSpec: 'CL × A ≈ 1.5–2.5 m²; endplate area 0.04–0.08 m² each; max height per rules',
    function: 'Rear aerodynamic load increasing rear tire grip. Primary downforce source for most FSAE teams.',
    connections: 'Main hoop or rear frame (wing stands bolted), endplates (riveted to wing).',
    ruleRef: 'FSAE Aero Rules T8: height, width, and overhang limits',
  },
  {
    id: 'aero_front_wing',
    name: 'Front Wing',
    category: 'Aerodynamics',
    series: 'FSAE',
    description: 'Inverted aerofoil ahead of the front tires generating front downforce and directing airflow to the underfloor.',
    material: 'Carbon fiber or fiberglass; often removable for events',
    typicalSpec: 'CL × A ≈ 0.5–1.2 m²; mounted 30–80 mm above ground',
    function: 'Front aerodynamic balance. Front wing increases front downforce, reducing understeer at speed.',
    connections: 'Nose cone or front bulkhead (wing supports).',
  },
  {
    id: 'aero_diffuser',
    name: 'Underfloor / Diffuser',
    category: 'Aerodynamics',
    series: 'FSAE',
    description: 'Shaped undertray beneath the car that generates downforce via ground effect, expanding flow from low ground clearance to ambient pressure.',
    material: 'Carbon fiber or aluminum; often Coroplast (corrugated polypropylene) for low-cost teams',
    typicalSpec: 'Diffuser expansion ratio 3–6°; exit height 100–250 mm; full-car underfloor width',
    function: 'Most aerodynamically efficient downforce source. Can exceed combined wing downforce on fast tracks.',
    connections: 'Frame belly (riveted or bolted undertray), diffuser exit (unsupported trailing edge).',
  },

  // ─── SAFETY ────────────────────────────────────────────────────────────────
  {
    id: 'harness',
    name: 'Driver Harness (5 or 6-point)',
    category: 'Safety',
    series: 'Both',
    description: 'Racing harness restraining the driver in the seat during impact. SFI or FIA rated.',
    material: 'Polyester webbing (48mm) with steel or aluminum cam-lock buckle',
    typicalSpec: '5-point: lap belts + 2× shoulder + anti-submarine. 6-point adds crotch strap. SFI 16.1 rated.',
    function: 'Prevent driver ejection and limit forward travel in frontal impact.',
    connections: 'Chassis attachment points (tube inserts through frame or welded tabs). Belt must be mounted at correct angles per rules.',
    ruleRef: 'FSAE T2.2 / Baja B5: 5-point harness minimum, SFI 16.1 or FIA 8853',
  },
  {
    id: 'helmet',
    name: 'Helmet',
    category: 'Safety',
    series: 'Both',
    description: 'Full-face motorsport helmet protecting the driver\'s head in impact, rollover, and from debris.',
    material: 'Carbon fiber or fiberglass shell; energy-absorbing EPS liner; Nomex interior',
    typicalSpec: 'Snell SA2020 or FIA 8860-2018 rated; must fit within head restraint zone',
    function: 'Head impact energy absorption, facial protection, and neck load reduction (combined with HANS device).',
    ruleRef: 'FSAE T2.1 / Baja: Snell SA2015 or newer required',
  },
  {
    id: 'hans',
    name: 'HANS Device / Head Restraint',
    category: 'Safety',
    series: 'FSAE',
    description: 'Head And Neck Support device preventing hyperextension in frontal impact.',
    material: 'Carbon fiber yoke; webbing tethers to helmet',
    typicalSpec: 'SFI 38.1 or FIA 8858 rated; 20° or 30° post angle versions; anchored to shoulder harness',
    function: 'Limit forward neck extension in deceleration, preventing basilar skull fracture.',
    ruleRef: 'FSAE Rules T2.2.4: HANS or equivalent required',
  },
  {
    id: 'firesuit',
    name: 'Fire Suit (Driver)',
    category: 'Safety',
    series: 'FSAE',
    description: 'Single or double-layer SFI or FIA rated fire-resistant driving suit.',
    material: 'Nomex or Proban treated cotton; multiple layers for higher rating',
    typicalSpec: 'SFI 3.2A/1 (single) or SFI 3.2A/5 (double); provides ≥4s to 10s thermal protection',
    function: 'Protect driver from fire and radiant heat.',
    ruleRef: 'FSAE T2.1: fire-resistant suit required',
  },
  {
    id: 'fire_suppression',
    name: 'Fire Suppression System',
    category: 'Safety',
    series: 'FSAE',
    description: 'Onboard fire extinguisher or automatic fire suppression plumbed to engine bay and cockpit.',
    material: 'Steel or aluminum bottle; FE-36 or AFFF agent',
    typicalSpec: '1.0 kg minimum agent; separate cockpit and engine nozzles; actuated by cockpit pull cable',
    function: 'Suppress engine bay or cockpit fire before driver can exit.',
    ruleRef: 'FSAE T8.6 (if required by competition): automatic suppression for certain car classes',
  },
];

// ─── UI ───────────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Chassis', 'Suspension', 'Steering', 'Brakes', 'Powertrain', 'Wheels & Tires', 'Electronics', 'Aerodynamics', 'Safety'];
const SERIES_OPTS: { id: Series | 'All'; label: string }[] = [
  { id: 'All',  label: 'All Cars' },
  { id: 'FSAE', label: 'FSAE Only' },
  { id: 'Baja', label: 'Baja Only' },
];

const CATEGORY_ICONS: Record<string, string> = {
  Chassis: '⬡', Suspension: '⟳', Steering: '⊙', Brakes: '◎',
  Powertrain: '⚙', 'Wheels & Tires': '◌', Electronics: '⊛',
  Aerodynamics: '↗', Safety: '⊕',
};

const SERIES_COLORS: Record<Series, string> = {
  FSAE: 'text-brand bg-brand/10 border-brand/30',
  Baja: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  Both: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
};

export function PartsReferencePage() {
  const [category, setCategory] = useState('All');
  const [series, setSeries] = useState<Series | 'All'>('All');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PARTS.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (series !== 'All' && p.series !== series && p.series !== 'Both') return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, series, search]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-0">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border bg-surface-1 px-4 py-2 flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-brand whitespace-nowrap">Parts Reference</span>
        <div className="w-px h-4 bg-border" />
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search parts…"
          className="input-sm w-44"
        />
        <div className="w-px h-4 bg-border" />
        {/* Series filter */}
        <div className="flex gap-1">
          {SERIES_OPTS.map(s => (
            <button
              key={s.id}
              onClick={() => setSeries(s.id)}
              className={cn(
                'px-2 py-0.5 rounded text-2xs font-mono border transition-colors',
                series === s.id
                  ? 'bg-brand/20 text-brand border-brand/40'
                  : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-2xs text-muted-foreground font-mono">{filtered.length} parts</span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Category sidebar */}
        <div className="w-40 shrink-0 border-r border-border bg-surface-1 overflow-y-auto flex flex-col gap-0.5 py-2 px-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors w-full',
                category === cat
                  ? 'bg-brand/15 text-brand border border-brand/25'
                  : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-transparent'
              )}
            >
              <span className="w-4 text-center shrink-0 text-sm">
                {CATEGORY_ICONS[cat] ?? '◈'}
              </span>
              <span className="truncate font-medium">{cat}</span>
            </button>
          ))}
        </div>

        {/* Parts grid */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No parts match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filtered.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  isExpanded={expanded === part.id}
                  onToggle={() => setExpanded(expanded === part.id ? null : part.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PartCard({
  part,
  isExpanded,
  onToggle,
}: {
  part: PartSpec;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border transition-all bg-surface-1 cursor-pointer',
        isExpanded ? 'border-brand/40 shadow-sm' : 'border-border hover:border-border/80 hover:bg-surface-2/50'
      )}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="w-7 h-7 rounded bg-surface-2 border border-border flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm text-muted-foreground">{CATEGORY_ICONS[part.category] ?? '◈'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{part.name}</span>
            <span className={cn('text-2xs font-mono px-1.5 py-0.5 rounded border', SERIES_COLORS[part.series])}>
              {part.series}
            </span>
          </div>
          <div className="text-2xs text-muted-foreground mt-0.5">{part.category}</div>
          <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed line-clamp-2">
            {part.description}
          </p>
        </div>
        <span className={cn(
          'text-muted-foreground/40 text-xs shrink-0 mt-1 transition-transform',
          isExpanded && 'rotate-180'
        )}>▾</span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2" onClick={e => e.stopPropagation()}>
          <DetailRow label="Function" value={part.function} />
          {part.material && <DetailRow label="Material" value={part.material} />}
          {part.typicalSpec && <DetailRow label="Typical Spec" value={part.typicalSpec} highlight />}
          {part.connections && <DetailRow label="Connects To" value={part.connections} />}
          {part.notes && <DetailRow label="Notes" value={part.notes} />}
          {part.ruleRef && (
            <div className="flex gap-2 mt-1">
              <span className="text-2xs text-yellow-400/80 font-semibold shrink-0 mt-px">Rule Ref</span>
              <span className="text-2xs text-yellow-400/70 font-mono leading-relaxed">{part.ruleRef}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className={cn(
        'text-2xs font-semibold shrink-0 mt-px w-20',
        highlight ? 'text-brand/80' : 'text-muted-foreground/60'
      )}>
        {label}
      </span>
      <span className={cn(
        'text-2xs leading-relaxed',
        highlight ? 'text-foreground font-mono' : 'text-muted-foreground'
      )}>
        {value}
      </span>
    </div>
  );
}
