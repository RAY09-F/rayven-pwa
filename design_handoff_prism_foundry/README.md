# Handoff: Prism Foundry — animated 3D hero / agent council

## Overview
An interactive three.js scene: a gold core crystal ("LOKI") on a brass pedestal, ringed by five colored satellite crystals for the other agents. Everything floats, spins, glows and reacts to the cursor; HTML labels track each crystal in 3D. Intended as the centerpiece of an "agent council" UI.

## About the Design Files
`prism-foundry.html` + `three-d-stage.js` are **design references built in HTML/three.js** — a working prototype, not production code to paste in. Recreate this in the target codebase's environment (React + react-three-fiber, Vue + TresJS, or vanilla three.js in a component). If the site has no framework, plain three.js in a single module is fine. The model-building and animation code in `prism-foundry.html` (inside `<script type="module">`) is portable and can be lifted nearly verbatim; `three-d-stage.js` (viewer shell, exporter toolbar) should be replaced by the site's own canvas mount — drop the download toolbar and "drag to orbit" note unless wanted.

## Fidelity
**High-fidelity.** Geometry, materials, colors, motion and label typography are final. Match them.

## Scene / View
**Name:** Prism Foundry
**Purpose:** Visual hub showing the primary agent (core) and five sub-agents (satellites); hover/click for feedback, later wire to agent selection.

### Layout
- Full-bleed `<canvas>` (100vw × 100vh in prototype; size to the hero container in production).
- Background: `radial-gradient(ellipse at 50% 40%, #0f2430 0%, #050b12 70%)` behind a transparent canvas. Scene fog `FogExp2(0x050b12, 0.045)`.
- Absolutely-positioned label layer over the canvas, `pointer-events:none`.

### Geometry (meters, y-up, origin at dais center)
- Dais: cylinder r3.0–3.2 h0.12 (stone) at y0.06; step r2.4–2.5 h0.10 (slate) at y0.17; brass torus rings r2.75 and r1.35 (tube 0.02); thin brass grooves r1.7, 2.1 (y0.225) and 2.9 (y0.125); 24 brass studs r0.035 at radius 2.62; brass channels (box 0.06×0.012) from r1.0 to each station along the dais.
- Pedestal stack: foot r0.95–1.05 h0.14; brass band r0.82 h0.08; column r0.72–0.78 h0.36 (slate); brass band; brass bowl r0.9–0.7 h0.12; stone cup r0.6–0.86 h0.06. Top at y≈1.06.
- Core crystal: elongated hexagonal faceted bipyramid — apex at +1.7, crown-break ring r×0.55 at +0.85 (rotated half step), girdle r0.66 at 0, pavilion ring r×0.6 at −0.45, culet at −1.0; z squashed ×0.9; centered y2.15. Inner brass bipyramid r0.30 (0.9/0.5) rotated 30°; brass girdle torus r0.67 t0.018. Six brass prongs (r0.028–0.045, h0.75) leaning in from the cup with ball tips, plus fluted column (18 brass rods r0.035).
- Three brass orbit rings (torus): r1.15 t0.035 @y2.05 tilt (π/2+0.35, 0, 0.2); r1.3 t0.03 @y1.9 (π/2−0.25, 0, −0.45); r1.0 t0.025 @y2.3 (π/2+0.1, 0, 1.1).
- Six smoked-glass shards: 4-sided cones, positions/heights `[x,z,tilt,h,r]`: [-0.9,0.5,-0.4,1.9,0.18] [0.85,0.55,-0.5,2.1,0.16] [0.2,0.1,-1.0,2.4,0.2] [-0.5,0.3,-0.9,1.6,0.14] [1.1,0.4,0,1.4,0.12] [-1.15,0.2,0.2,1.3,0.12], base at y1.05.
- Five stations at radius 2.05, angles 90° Miss Minutes, 18° Hunter B-15, 306° Mobius, 234° Sylvie, 162° Kang. Each: stone plinth r0.34–0.4 h0.08 @y0.26, brass ring r0.3, gem bipyramid r0.2 (apex 0.5 / culet 0.32, same facet scheme) @y0.85 with brass girdle r0.205, slate step r0.44–0.5 h0.05, four brass claws (r0.012–0.02 h0.42) leaning in, two brass halos (r0.34 t0.012, r0.28 t0.008), point light, and a beam (cylinder r0.008→0.02) from gem to (0, 2.0, 0).

### Materials
- `dark_stone` Standard #0f1820 rough .55 metal .2
- `slate_inlay` Standard #1a2e40 rough .35 metal .3
- `brass` Standard #e0a93a rough .22 metal .85, emissive #3a2000 ×.25
- Crystals: `MeshPhysicalMaterial` rough 0, metal 0, transmission 1, thickness .8, ior 2.42, dispersion .35, attenuationColor = base color, attenuationDistance 1.2, clearcoat 1, flatShading true (hard facets). Emissive intensities: core .55–.9 (+1.5 pulse), satellites .7–1.1 (+1.5 hover, +1.5 pulse).
  - gold_crystal color #ffc21a emissive #ff8c00
  - amber (Miss Minutes) #ff7a1a / #ff4a00
  - sapphire (Hunter B-15) #4aa8ff / #0a5aff
  - copper (Mobius) #ffc08a / #ff7a20
  - emerald (Sylvie) #2aff9a / #00c860
  - violet (Kang) #9a5cff / #5a10ff
- `smoked_glass` Physical #9fe4ff rough .02 clearcoat 1 opacity .22 emissive #1a6a8a ×.3
- Beams: Standard, color = agent hex, emissive same ×2.5, opacity animated .25–1.

### Lighting / render
- ACES filmic tone mapping, exposure 1.1; pixel ratio capped 1.5; PCF soft shadows, 1024 map.
- Hemisphere light #4a7a9a / #0a1a2a ×.25; key directional ×~0.77 from (4,7,5) with shadows; fill ×~0.18 from (−5,3,−4).
- Environment: PMREM of a dark scene (#06101a) with 4 emissive planes — warm #ffe6c0×6 at (4,6,3) 5×3; cool #9ad4ff×3 at (−6,3,−4) 6×4; floor #fff0d0×1.5 at (0,−3,6) 8×2; dome #2a6a9a×1 at (0,8,0) 12×12. `environmentIntensity 0.9`.
- Core point light #ffc020 intensity 45–70, distance 9, decay 2 @ (0,2.3,0). Station point lights intensity 9–14 (up to +38 on hover/pulse), distance 4.
- Camera: fov 45, target (0,1.35,0), direction (0.55,0.5,1) normalized, distance = 3.9 / sin(min(vFov, hFov)) × 0.95 — recompute on resize. OrbitControls damping .05, autoRotate speed 0.9 until first interaction.

### Labels (HTML overlay)
- Font: Cinzel 700 for names, Cormorant Garamond 500 for roles (Google Fonts).
- Name 15px, letter-spacing .14em, color = agent CSS color (#ff8f3a, #6ab8ff, #ffc79a, #4dffab, #a97cff; core #ffd84a), `filter:brightness(1.35)` (1.8 on hover). Role 12px, letter-spacing .32em, rgba(255,255,255,.75). 1px vertical tick (14px) fading from agent color. Text-shadow `0 0 6px <color>, 0 1px 2px rgba(0,0,0,.95)`.
- Core label: name 26px, role 13px, tick below text.
- Copy: LOKI / GOD OF MISCHIEF · THE ONE WHO MAKES; MISS MINUTES / THE CLOCK; HUNTER B-15 / THE RUNNER; MOBIUS / THE LEDGER; SYLVIE / THE APOCALYPSES; KANG / THE WATCH.
- Placement each frame: project gem world position to screen; satellites: 26px×scale below the point; core: 34px×scale above the point at core.y+1.45, anchored bottom. Scale = clamp(7 / cameraDistance, .7, 1.4). Clamp inside viewport (8–96px margins). Hide (opacity 0, .25s) when a raycast from camera to the gem hits the core crystal, rings, pedestal or dais.

## Interactions & Behavior
All motion is time-based (dt), eased with `k = 1 − e^(−6·dt)`.
- Core: y = 2.15 + sin(1.3t)·0.08; rotation.y = 0.6t; tilts toward smoothed pointer (z = px·0.18, x = −py·0.12). Heartbeat `beat = .5+.5·sin(2.2t)`: gold emissive 1.1 + beat·.5, core light 45 + beat·25; hue drifts ±0.015 around 0.09.
- Rings spin 0.7/0.55/0.9 rad/s on z/x/y and bob ±0.05. Shards rotate ±0.12 rad/s. Glass emissive .3 + beat·.5.
- Satellites: bob sin(1.7t+phase)·0.07; spin (0.9 + 0.1·i) rad/s; flicker sin(3t+2·phase). Emissive 1.4 + flicker·.6; beam opacity .25 + flicker·.25.
- Hover (raycast, throttled every other frame): `hot` eases to 1 → gem rises +0.15, scale ×1.35, emissive +2, light +18, beam opacity +.5 and radius ×3, label brightens.
- Pointer down: `pulse = 1`, decays e^(−4·dt); adds emissive +2, lights +90/+20, gem scale +.25, beam opacity +.4 on everything.
- Drag orbits, wheel zooms, right-drag pans; autorotate stops on first drag.

## State Management
- `pointer` (NDC vec2, −9 when off-canvas), `pointerSmoothed`, `pulse` (0–1), per-station `hot` (0–1) and `phase`.
- Hooks to expose: `onHover(agentKey|null)`, `onSelect(agentKey)` from the raycast hit — wire to the site's agent selection.

## Design Tokens
- Backgrounds #050b12, #0f2430, #06101a. Stone #0f1820, slate #1a2e40, brass #e0a93a.
- Agent colors above (material hex / emissive / label CSS).
- Type: Cinzel 700 15/26px; Cormorant Garamond 500 12/13px.
- Motion: easing k = 1 − e^(−6dt); label fade .25s.

## Ambient
420 additive point sprites (#ffd27a, size .035, opacity .5–.85 pulsing) rising 0.06–0.11 m/s between y0.3–3.9 within radius 0.6–3.2, wrapping at the top.

## Assets
No images. Fonts from Google Fonts (Cinzel, Cormorant Garamond). three.js 0.184 (OrbitControls only needed in production). Optional: export GLB from the prototype's toolbar and load it with GLTFLoader instead of building geometry in code — but emissive animation and per-part motion need the parts kept as separate named nodes (they are).

## Files
- `prism-foundry.html` — full prototype: geometry, materials, environment, animation loop, labels, pointer reactivity.
- `three-d-stage.js` — viewer shell (renderer, lights, controls, shadow ground, export toolbar). Reference only; replace with your own mount.
