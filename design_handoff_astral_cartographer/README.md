# Handoff: Astral Cartographer — Thor's animated 3D council scene

## Overview
Interactive three.js hero: a Mjolnir-style war hammer floating inside a spinning brass armillary sphere on a marble pedestal, over a blue holographic star map. Five floating lightning-bolt sigils (one per agent) throw living, forking lightning to the hammer in their own colors. HTML labels track each object in 3D. Companion to the Prism Foundry (Loki) scene — same structure, same label system, same interaction model.

## About the Design Files
`astral-cartographer.html` + `three-d-stage.js` are **design references** (a working prototype), not production code. Recreate in the target codebase's stack (React + react-three-fiber, Vue + TresJS, or vanilla three.js in a component). The model-building and animation code in the `<script type="module">` is portable three.js and can be lifted nearly verbatim; `three-d-stage.js` (viewer shell, export toolbar, orbit hint) should be replaced by the site's own canvas mount.

## Fidelity
**High-fidelity.** Geometry, materials, colors, motion and typography are final.

## Layout
- Full-bleed canvas (hero container in production). Background `radial-gradient(ellipse at 50% 40%, #0c1a34 0%, #040914 70%)`; fog `FogExp2(0x040914, 0.04)`.
- Absolutely-positioned label layer, `pointer-events:none`. A fixed `#flash` overlay (radial blue, `mix-blend-mode:screen`) whose opacity drives lightning flashes.

## Geometry (meters, y-up, origin at dais center)
- Dais: cylinder r3.0–3.2 h0.12 (marble) y0.06; step r2.4–2.5 h0.10 (navy) y0.17; brass rings r2.75 t0.02 & r2.9 t0.012 (y0.125); grooves r1.35/1.7/2.1 t0.012 (y0.225); 24 brass studs r0.035 at radius 2.62; brass channels (0.06×0.012) from r1.25 to each station.
- Ice peaks (faceted 5- and 4-sided cones, `ice_rock`) at rim positions [2.55,0.9] [2.35,−1.5] [−2.2,1.6] [−2.6,−0.7] [0.4,2.75] [−1.2,−2.5] [1.9,2.1], heights .4–.7 plus a smaller companion each.
- Pedestal: drum r1.15–1.2 h0.22 (y0.33), brass band r1.17; drum r0.95–1.0 h0.24 (y0.56, navy), band r0.97; drum r0.78–0.82 h0.22 (y0.79); brass cap r0.7–0.78 h0.06 (y0.93); 12 brass ribs 0.05×0.6×0.05 at radius 1.0.
- Core group at y2.0 (floats). Armillary: 4 brass tori — r1.2 t0.04 rot(π/2+.45,0,.3); r1.05 t0.035 rot(π/2−.3,0,−.9); r0.9 t0.03 rot(.2,.6,0); r1.3 t0.025 rot(π/2,0,0) — each with 4 star tips (4-sided cones r0.05 h0.16) at quarter points. No central axis.
- Hammer (group scale 1.45, rotation (.15,.6,−.65)): head = extruded chamfered rectangle 0.60×0.34, depth 0.36, bevel 0.025; two dark bands 0.035×0.365×0.415 at x±0.19; top band 0.64×0.02×0.06; raised strike faces 0.03×0.30×0.34 at x±0.335 with dark rims; rune torus r0.075 + triple-knot (3× r0.045) on front face and rune on back (emissive `rune_glow` #bfe0ff / #4a9aff); brass collar r0.08–0.095 h0.07; dark collar ring; leather haft r0.048–0.052 h0.8 with 12 alternating cross-wrap tori; brass pommel r0.068–0.058 h0.09 + dome; leather loop torus r0.075.
- Hologram (group y1.0): additive disc r1.35, four additive rings r0.5/0.85/1.2/1.5 t0.006 rising and wrapping over 0.5m, inverted open cone beam r0.06–0.25 h1.1.
- Stations at radius 2.05, angles 90° Jane Foster, 18° Valkyrie, 306° Hulk, 234° Korg, 162° Darcy. Each: navy step r0.44–0.5 h0.05, marble plinth r0.34–0.4 h0.08, brass ring r0.3, emissive glow ring r0.24 in agent color, point light, and the **storm bolt** at y0.9: a chamfered crystal lightning bolt — outline (0.14,0.55) (−0.20,0.06) (−0.04,0.06) (−0.16,−0.55) (0.20,0.0) (0.03,0.0), extruded depth .10 with a single hard bevel (thickness .035, size .03), centered; refractive gem material in the agent color (transmission 1, ior 2.42, dispersion .35, flat-shaded); a white-hot core = same outline extruded .14, scaled (.42,.8,1); thin brass ring r0.42 tilted (.35,0,.2). Live arcs: five white fractal arcs (8 segs, amp .08) leaping between random points sampled along the bolt's outline on both faces (≥2 always visible); three crawlers in the lightning color (10 segs, amp .12) firing off the top and bottom tips and a random edge into the air; all re-jittered every 40–80 ms. 40 orbiting spark points (size .02) at .39–.47 radius. Invisible cylinder r0.26 h1.2 is the pick target. Bolt sways (x sin(.9t+phase)·.15, z sin(1.3t+phase)·.08). Brass halo torus r0.4 t0.008 tilted.

## Materials
- `dark_marble` #0c1424 rough .35 metal .25 · `navy_inlay` #152848 rough .3 metal .3 · `brass` #d9a54a rough .25 metal .85 emissive #2a1a00×.25
- `hammer_steel` #d0dcea rough .22 metal .9 (emissive #0f2a55, intensity animated .1–.25, +1.2 on pulse) · `hammer_steel_dark` #4a5666 rough .4 metal .85 · `leather_wrap` #3a2418 rough .85
- `hologram` MeshBasic #3f8cff additive, opacity .16–.26 · `hologram_line` #7fb8ff additive .45–.75
- `ice_rock` #27405e rough .4 metal .3 emissive #0a2a5a×.4 flat-shaded
- Storm bolts: refractive gem material, emissive intensity .9–1.3 (+1.2 hover, +1.0 pulse, +1.8 strike); white core emissive 2.0 (+3 strike, +1.5 hover, random ±.6 flicker); arc opacity scales with orbGlow = .55 + .4 hover + .5 strike + .4 pulse:
  - Jane Foster (ruby) color #ff3a3a emissive #ff0a0a, lightning #ff7a7a, label #ff6a6a
  - Valkyrie (sapphire) #3a8aff / #0a4aff, lightning #8ac0ff, label #6aa8ff
  - Hulk (rose) #ff4ab8 / #ff0a8a, lightning #ffa0e0, label #ff7ad0
  - Korg (gold) #ffc21a / #ff8c00, lightning #ffe08a, label #ffd84a
  - Darcy (amethyst) #a040ff / #5a00ff, lightning #d0a0ff, label #c088ff
- Thor label #7fb8ff.

## Lighting / render
- ACES filmic, exposure 1.35; pixel ratio cap 1.25; PCF shadows 1024 map, only large forms cast (wraps, studs, grooves, star tips, halos, glow rings, beams, channels, hologram, runes and bolts do not).
- Hemisphere #6a9ae0 / #0a1630 ×.55; key directional ×~1.3 from (4,7,5) with shadows; fill ×~.3 from (−5,3,−4).
- Environment: PMREM of a #050c1a scene with planes — #dfe9ff×6 at (4,6,3) 5×3; #6aa8ff×3.5 at (−6,3,−4) 6×4; #ffe9c8×1.5 at (0,−3,6) 8×2; #1a4a9a×1.2 at (0,8,0) 12×12. Intensity .9.
- Core point light #4a9aff intensity 40–65 (+160 pulse, +30 hammer hover), distance 9, at (0,2,0); hue shifts toward white on pulse. Station point lights intensity 7–11 (+18 hover, +16 pulse), distance 4.
- Camera fov 45, target (0,1.35,0), direction (0.55,0.5,1), distance = 3.9 / sin(min(vFov,hFov)) × 0.95, refit on resize. OrbitControls damping .05, autorotate .9 until first drag.

## Lightning
Per station, additive LineSegments from the sigil to a hammer anchor, built by **fractal midpoint displacement** (32 segments): recursively split the chord, offset each midpoint perpendicular to the chord (two orthonormal axes) by ±amp, halving amp (×0.55) per level, so the channel wanders sideways like a stepped leader rather than a zigzag. amp = .45 (+.35 hover, +.5 pulse). Three overlaid channels share the same path: main (agent lightning color, opacity ≈ glow), sleeve (agent base color, glow×.35), white core (glow²×.9). Three tapering branches (12 segments, half amp) fork from random points along the main path, biased downward/outward, each visible ~70% of the time.
Timing: **return-stroke model** — every 0.35–1.75 s (sooner while hovered) a strike sets glow=1 and re-forms the channel; glow decays e^(−7dt) (e^(−3dt) while hovered) with 1–3 stochastic re-strikes back to .85; while glow > .15 the path re-jitters every 40–90 ms; per-frame ±15% opacity flicker. Each strike adds +30 to that station's point light and up to .18 to the screen flash. Click: every station strikes at once (3 re-strikes), `pulse=1`, hovered or random station gets `hot=1.2`.

## Interactions & motion
Time-based, easing k = 1 − e^(−6dt). Core bobs 2.0 + sin(1.2t)·.07 and tilts toward smoothed pointer (z .14, x −.1). Hammer yaw .6 + .25t, bob sin(1.9t)·.04. Rings spin .9/.7/1.2/−.6 rad/s; armillary yaw .25t. Hologram yaw −.25t, rings rise .15 m/s. Bolts bob sin(1.7t+phase)·.07, yaw (.9+.1i) rad/s, roll sin(1.1t+phase)·.12; scale .95 (+.3 hover, +.2 pulse, +.08 strike); hover raises +.15. 260 additive dust sprites (#8fc4ff) rise between y.3–3.9. 160-star constellation field on the dais (y.235) with nearest-neighbour lines ≤.55 m, opacity .18–.33.
Raycast hover and label placement run every 3rd frame.

## Labels
Cinzel 700 15px (.14em) in agent color, filter brightness 1.35 (1.8 hover); role Cormorant Garamond 500 12px (.32em) rgba(255,255,255,.78); 1px 14px tick. Core: THOR 26px / PRINCE OF ASGARD · THE NORTH VOICE 13px, tick below. Copy: JANE FOSTER / THE SEEKER; VALKYRIE / THE ROAD; HULK / THE HANDS; KORG / THE WORLD; DARCY / THE KEEPER. Placement: project sigil (or core) to screen; satellites 26px×scale below, core 34px×scale above core.y+1.3; scale clamp(7/cameraDistance, .7, 1.4); clamp inside viewport (8–96px); hide when a camera→sigil raycast hits pedestal, dais, armillary rings or hammer.

## State / hooks
`pointer`, `pointerSmoothed`, `pulse`, per-station `hot`, `phase`, `nextJit`. Expose `onHover(agentKey|null)` and `onSelect(agentKey)` from the raycast.

## Assets
No images. Google Fonts Cinzel + Cormorant Garamond. three.js 0.184 (OrbitControls only).

## Files
- `astral-cartographer.html` — full prototype.
- `three-d-stage.js` — viewer shell, reference only.
