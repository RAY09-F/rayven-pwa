# Handoff: The Solar Throne — Odin's animated 3D council scene

## Overview
Interactive three.js hero: a great gold solar disc with a rotating spiral iris and a glowing sun core, mounted on stacked black-marble drums between two angular gold-edged pylons, on a polished marble floor with gold inlays. Five agent plinths carry faceted refractive crystals joined to the throne by gold floor channels carrying travelling energy pulses and thin colored threads. HTML labels track each object in 3D. Third scene in the set with Prism Foundry (Loki) and Astral Cartographer (Thor) — same label system and interaction model. (Supersedes the earlier Basalt Command Monument scene.)

## About the Design Files
`solar-throne.html` + `three-d-stage.js` are **design references** (a working prototype), not production code. Recreate in the target codebase's stack, reusing the architecture of the other two scenes where they exist. The model-building and animation code in the `<script type="module">` is portable three.js; `three-d-stage.js` (viewer shell, export toolbar) should be replaced by the site's own canvas mount.

## Fidelity
**High-fidelity.** Geometry, materials, colors, motion and typography are final.

## Layout
- Full-bleed canvas. Background `radial-gradient(ellipse at 50% 40%, #1a1710 0%, #07070a 70%)`; fog `FogExp2(0x07070a, 0.035)`.
- Label overlay (`pointer-events:none`) and a fixed `#flash` overlay (warm radial, `mix-blend-mode:screen`) for click flashes.

## Geometry (meters, y-up, origin at floor center)
- Floor: marble disc r4.2–4.3 h0.14 at y0.07; step r3.5–3.6 h0.08 at y0.18; **glowing** gold inlay tori r4.0 t0.022, r3.75 t0.012 (y0.142), r3.15 t0.022, r2.6 t0.012, r2.0 t0.022 (y0.222) in `gold_inlay_glow`; 24 gold spoke bars 0.02×0.006×0.6 at r3.88. Additive council ring (RingGeometry 2.78–3.02) at y0.229, opacity .12–.18 (+.35 pulse), and an inner glow disc (RingGeometry 0.9–2.05) at y0.228, opacity .05–.08 (+.2 pulse) — the gold light the council sits on.
- Pedestal: drum r1.55–1.62 h0.22 (y0.33) + gold band torus r1.57 t0.025; drum r1.32–1.38 h0.26 (y0.57, dark marble) + band r1.34; drum r1.1–1.16 h0.22 (y0.82); gold cap r1.0–1.1 h0.06 (y0.96); 16 dark-gold rune panels 0.28×0.16×0.03 at r1.36.
- Solar disc (core group at y2.15) — **billboards to face the camera every frame** (`disc.quaternion.copy(camera.quaternion)` then a small cursor lean): gold rim torus r1.24 t0.075, outer torus r1.34 t0.03 (dark gold), emissive bevel torus r1.16 t0.045. **Seven nested layers** funnelling inward: layer i has radius 1.1 − i·0.115 at z −0.03 − i·0.055, a torus (tube 0.05 − i·0.004, alternating gold / dark gold), an emissive trim torus (t0.012, +0.035 z) and a ring of 18 − i teeth (boxes 0.055 × (0.11 − i·0.008) × 0.03) in its own group. 36 emissive studs r0.028 around r1.24 at z0.085; 8 small faceted gems at r1.24, z0.12.
- Aperture: 10 spiral blade arcs (torus r0.42 t0.085, arc 0.85π, z-scaled 0.5) in an `iris` group at z−0.42, each with an emissive edge arc t0.014; blades sit at radius = the "open" value.
- Event horizon: near-black sphere r0.26 (`void` #02030a) at z−0.5, emissive accretion torus r0.32 t0.012 at z−0.48 and a tilted second ring r0.42 t0.006 at z−0.44; additive sun disc r0.5 at z−0.56 and halo r1.05 at z−0.62 (opacity .1–.17) glowing from behind the hole. 220 additive infall motes (#ffd890, size .026–.046) spiral inward from r1.3 to r0.3 in the disc's plane, wrapping back out.
- 14 orbiting gold shards: small faceted crystals on individually tilted orbit groups at radius 1.45–1.73, spinning .25–.61 rad/s.
- Pylons at x±1.45, z−0.05, tilted ∓0.06: marble base 0.52×0.22×0.62 + gold band; dark shaft 0.34×1.5×0.5 centered y1.0; gold front edge and dark-gold back edge strips; gold collar 0.4×0.06×0.56 at y1.72; 4-sided tapered blade r0.02→0.16 h1.1 at y2.25 (rotated 45°, leaning inward) with a gold edge blade; three rune plates on the front face.
- Beam: additive open cone r0.02–0.35 h4.0 at y2.6 (core group).
- Stations at radius **3.05** (spaced out), facing center; angles 90° Volstagg, 18° Heimdall, 306° Fandral, 234° Hogun, 162° Frigga. Each: 8-sided marble base r0.46–0.5 h0.12 (y0.28); 8-sided plinth r0.36–0.42 h0.34 (y0.51) with gold band r0.4 and gold cap r0.38–0.36 h0.05 (y0.705); dark-gold plaque on the front face; emissive glow ring r0.22 at y0.74; **floor sigil** — additive ring 0.54–0.78 in the agent color at y0.231 (opacity .26–.36, +.35 hover, +.3 pulse) plus a glowing gold torus r0.82 t0.014 at y0.235.
- **Odin's eye** (replaces the agent crystals), group at y1.32 scaled 1.3 (+.28 hover, +.14 pulse): polished gold orb r0.26 (`eye_gold` #e8bc62, rough .16, metal .92) with a dark-gold equator torus r0.262 t0.008; a gold socket torus r0.13 t0.022 at z0.222 and an emissive inner ring r0.098 t0.012 at z0.238 framing the pupil; 20 dark-gold lash cones (r0.012 h0.07) around r0.155 at z0.208; the **pupil** is a domed lens — spherical cap r0.088 (thetaLength 1.05) in the agent color, emissive intensity 1.8–2.4 (+2.5 hover, +1.8 pulse) — over a near-black core sphere r0.05 at z0.245; additive white glint circle r0.022 at (−0.05, 0.055, 0.285); glass cornea cap r0.268 (transmission 1, ior 1.42, opacity .35); two gold brow brackets (torus r0.3 t0.014, 0.44π arcs). Tilted gold halo torus r0.42 t0.01 spins around it. The pupil dilates with the flicker, hover and click.
- **Connector arcs** Odin → each agent: quadratic Bézier from the eye (r, y1.24) to the disc center (0, 2.15, 0) with the midpoint lifted 0.75 — a TubeGeometry r0.022 in the agent color (emissive 2.6, opacity .5–.7, +.4 hover, +.3 pulse) wrapped in an additive glow tube r0.075 (opacity .14–.22, +.35 hover/pulse), with an additive bead (r0.045, #fff2d0) travelling from the eye to the throne every ~3 s (faster on hover/click), fading with sin(π·t).
- Gold floor channel box 0.06×0.01 from r1.62 to the station; travelling pulse sphere as before.
## Materials
- `black_marble` #0e1014 rough .5 metal .08 · `black_marble_dark` #070809 rough .55 metal .05
- `gold` #e0b050 rough .22 metal .9 emissive #3a2200×.3 · `gold_dark` #9a7430 rough .35 metal .85
- `gold_light` #ffc860 emissive #ff9a20 intensity 1.0–1.6 (+1.2 hover, +2.5 pulse) · `gold_inlay_glow` #ffc470 emissive #ff9a20 intensity 1.2–1.7 (+2.5 pulse) · `eye_gold` #e8bc62 rough .16 metal .92 · `pupil` #05060a · `cornea` transmissive white
- `sun_glow` MeshBasic #ffc870 additive, opacity .4–.65 (+.4 hover, +.6 pulse); halo clone at .12–.2
- `light_beam` MeshBasic #ff9a30 additive, opacity .03–.06 (+.3 pulse)
- Channels #ffd27a emissive #ffa030 intensity .9–1.8 (+1.2 hover, +2 pulse); pulse spheres MeshBasic #fff0c0 additive
- Agent crystals (refractive gem: transmission 1, ior 2.42, dispersion .35, flat-shaded; emissive intensity .8–1.2, +1.5 hover, +1.2 pulse):
  - Volstagg (ruby) #ff3a3a / #ff0a0a, label #ff6a6a — SUPPLY · GROWTH · PEOPLE
  - Heimdall (topaz) #ffc21a / #ff8c00, label #ffd84a — GOLD · GEO · MOMENTUM · ALERTS
  - Fandral (emerald) #2aff8a / #00c850, label #4dffa3 — BITCOIN · RISK · EXECUTION
  - Hogun (sapphire) #3a8aff / #0a4aff, label #6aa8ff — NASDAQ · MACRO · FLOW
  - Frigga (amethyst) #a040ff / #5a00ff, label #c088ff — ETHEREUM · MOMENTUM · TRENDS
- Odin label #ffd27a.

## Lighting / render
- ACES filmic, exposure 1.05; pixel ratio cap 1.25; PCF shadows 1024, only large forms cast (bands, inlays, spokes, halos, glow rings, channels, girdles, studs, edges, panels, plaques, threads, small gems don't).
- Hemisphere #a8b4c8 / #14100c ×.55; key directional ×~1.76 from (4,7,5) with shadows; fill ×~.4 from (−5,3,−4).
- Environment: PMREM of a #0a0908 scene with planes — #fff1dc×7 at (4,6,3) 5×3; #ffd9a0×3 at (−6,3,−4) 6×4; #ffe0b0×2.5 at (0,−3,6) 8×2; #5a4a30×1.2 at (0,8,0) 12×12; #ffc060×4 at (0,2,−6) 3×5. `environmentIntensity 0.6`.
- Core point light #ffb040 intensity 24–36 (+25 hover, +70 pulse) distance 5.5 at (0,2.15,0.6); back light #ff9a30 9–14 (+25 pulse) distance 4 at (0,2.15,−0.8). Station lights 3.5–5.5 (+10 hover, +8 pulse) distance 2.4. Keeping these tight is what keeps the marble black instead of washing gold.
- Camera fov 45, target (0,1.5,0), direction (0.35,0.45,1), distance = 4.6 / sin(min(vFov,hFov)) × 0.95, refit on resize. OrbitControls damping .05, autorotate .6 until first drag.

## Interactions & motion
Time-based, easing k = 1 − e^(−6dt); beat = .5+.5·sin(1.4t).
- Core bobs ±.03. The disc is billboarded to the camera each frame, then leaned by the smoothed cursor (yaw .16, pitch −.12), so it always faces the viewer head-on.
- Layers: each layer's teeth ring spins (0.18 + i·0.05) rad/s in alternating directions (×(1 + 3·pulse + hover)), its trim counter-rotates at half speed, and its depth pumps inward with the beat and click pulse (deeper for outer layers) so the funnel breathes.
- Event horizon: accretion ring spins 1.4 rad/s (+6 on pulse) and scales with the beat; second ring counter-rotates .9 rad/s; the void sphere swells slightly with the beat and hover and contracts on a click. Infall motes accelerate as they near the hole (angular speed ∝ 1/r) and respawn at r0.9–1.4.
- Orbit shards: orbit groups spin .25–.61 rad/s (×(1 + .8·hover + 2·pulse)), each shard tumbles 1.2 rad/s and breathes ±.06 radially, pushed out .35 on a click.
- Iris spins .35 rad/s plus a decaying click kick (`irisSpin += 6`, decay e^(−1.5dt)) and +.6 while the throne is hovered; blades breathe outward — open = .22 + beat·.05 + hover·.14 + pulse·.22 — repositioned per frame (blade and its edge arc share the offset).
- Sun core opacity and scale, gold_light emissive, both point lights and the beam all rise with beat, throne hover and click pulse.
- **Eyes** bob sin(1.7t+phase)·.05 and **track the camera** every frame (`lookAt` the camera position converted to local space, offset by a slow wander: x += sin(.5t+phase)·.5, y += cos(.37t+phase)·.35), roll sin(1.1t+phase)·.05, and **blink** — a 4 s cycle where the eye's y-scale collapses to .1 for ~0.12 s. Hover raises the group +.14 and scales it, flaring iris emissive, pupil dilation, glow ring, floor sigil, connector arc and light.
- Energy pulses: per station an additive sphere travels the channel from r2.35 to r1.62 over ~2.2 s (faster on hover/click), fading in/out with sin(π·t), then waits .2–.8 s; the channel emissive tracks it.
- Click: `pulse=1` (decay e^(−4dt)), warm screen flash, iris kick, all channel pulses restart, a floor shockwave ring (RingGeometry .9–1.0 at y0.24, additive #ffc060) expands ×4.2 and a camera-facing ring at the disc expands ×2.6, both fading (decay e^(−2.2dt)); hovered station gets `hot=1.2`.
- 280 additive gold motes (#ffc070, size .03) rise .07–.13 m/s between y.3–4.4.
- Raycast hover (iris blades + sun core for the throne, crystals for agents) and label placement every 3rd frame.

## Labels
Each label is a compact **plate**: padding 4/9/5px, background `linear-gradient(180deg, rgba(6,7,10,.86), rgba(6,7,10,.66))`, 1px `rgba(224,176,80,.5)` border, 2px radius, outer shadow `0 0 14px rgba(0,0,0,.7)` and a faint inner gold bloom. Name: Cinzel 700 12.5px (.14em) in the agent color, `brightness(1.5) saturate(1.15)` (1.8 on hover); role: Cormorant Garamond 500 8.5px (.22em) rgba(255,240,215,.9); text-shadow `0 0 10px var(--c), 0 0 22px rgba(0,0,0,.95), 0 2px 3px #000`; 1px 14px tick. Core: ODIN 19px / ALL FATHER · THE SOURCE · PAPER / SIM 9.5px, tick below. Placement: project the eye group (or core) to screen; agents 26px×scale below the point minus 0.55m in world y, core 34px×scale above core.y+1.45; scale clamp(7/cameraDistance, .7, 1.4); clamp inside viewport (8–96px); hide when a camera→crystal raycast hits pedestal drums, floor disc, the disc rim or any layer ring, or pylon shafts/bases/blades.

## State / hooks
`pointer`, `pointerSmoothed`, `pulse`, `shockT`, `irisSpin`, `coreHotV`, per-station `hot`, `phase`, `pulseT`. Expose `onHover(agentKey|null)` and `onSelect(agentKey)` from the raycast.

## Assets
No images. Google Fonts Cinzel + Cormorant Garamond. three.js 0.184 (OrbitControls only).

## Files
- `solar-throne.html` — full prototype.
- `three-d-stage.js` — viewer shell, reference only.
