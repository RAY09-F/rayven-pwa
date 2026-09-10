# Solar Throne

Odin's council is rendered three.js geometry ported from the supplied design handoff. The handoff arrived in `Prism foundry 3D model (3).zip` and was extracted to `design_handoff_solar_throne/`; the README was read in full before the prototype was opened. It supersedes the earlier Basalt Command Monument scene, which was ignored.

## What was built

`public/ui/solar-throne-model.js` is the portable model: the marble floor with glowing gold inlays, spokes, council ring and inner glow disc; the stacked pedestal drums with gold bands and rune panels; the solar disc with its seven nested counter-rotating toothed layers, thirty-six studs, eight rim gems and the ten-blade spiral iris; the event horizon with its two accretion rings, the sun and halo hidden behind it, and 220 infall motes; fourteen orbiting shards; the two flanking pylons and the light beam; five stations carrying Odin's eyes, floor sigils, gold channels with travelling pulses and Bézier connector arcs with travelling beads; and 280 rising gold motes plus the two click shockwaves.

Each eye is a polished gold orb with a dark-gold equator, a gold socket and emissive inner ring, twenty lash cones, a domed pupil lens in the agent colour over a near-black core, a white glint, a transmissive cornea and two brow brackets, under a spinning tilted halo. Agent keys map to the existing Odin council IDs: `volstagg`, `heimdall`, `fandral`, `hogun`, `frigga`.

`public/ui/solar-throne.js` configures the shared shell. `public/ui/scene.js` now routes all three halls through a single table, so Odin joins Thor and Loki on the reference scene path and falls back to the legacy realm only when `?renderer=` forces it.

## Shared architecture

`council-scene.js` already owned the canvas, PMREM studio, lighting, camera, orbit controls, projected and occluded labels, pointer hooks, preview thumbnails and cleanup for Thor and Loki. Odin reuses all of it. The shell gained six scene knobs, each defaulted to today's behaviour so Thor and Loki are byte-identical in effect: `environmentIntensity`, `groundOpacity`, `shadowExtent`, `fitRadius` / `viewTarget` / `viewDirection`, `autoRotateSpeed`, `agentOffset` and `plate`.

One structural addition: the shell now passes its `camera` in the per-frame update state. The Solar Throne needs it because the disc billboards to the viewer every frame, the disc shockwave is camera-facing, and each eye tracks the camera. Models that ignore the field are unaffected.

The label DOM gains an optional `.prism-plate` wrapper around the name and role when a scene sets `plate:true`, so the tick stays outside the engraved plate. Only the Solar Throne opts in.

## Fidelity notes

- ACES filmic at exposure 1.05, pixel ratio capped at 1.25, `environmentIntensity` 0.6, `FogExp2(0x07070a, 0.035)`, and the five-panel warm PMREM studio on `#0a0908`. The tight point-light ranges (core 24–36 over distance 5.5, back 9–14 over distance 4, stations 3.5–5.5 over distance 2.4) are what keep the marble black instead of washing gold.
- Camera: fov 45, target `(0,1.5,0)`, direction `(0.35,0.45,1)`, distance `4.6 / sin(min(vFov,hFov)) × 0.95`, refit on resize. Autorotate 0.6 until the first drag.
- Hemisphere `#a8b4c8`/`#14100c` ×0.55, key ×1.76 from `(4,7,5)`, fill ×0.4 from `(−5,3,−4)`. The prototype's stage multiplied its own directional defaults by 0.8; those products are the values used here.
- Shadow casting matches the prototype mesh for mesh: only the large forms cast, and the thin gold, glass and additive parts stop casting while still receiving.
- `PCFSoftShadowMap` was removed from three 0.184, which warns and silently substitutes `PCFShadowMap`. The scene asks for PCF at 1024 with radius 4 directly, so the console stays clean.
- The key light's shadow frustum is widened to ±6.5 because this floor is r4.3, wider than the default ±5 ortho box the other two scenes fit inside.
- The eyes' `lookAt` target is the camera position converted into the eye mount's local frame, exactly as the README specifies and the prototype implements. Read strictly that mixes a local target with a world-space API, so the eyes sweep the viewer rather than locking onto them. That sweep is the approved look, so it is reproduced rather than corrected.
- The blink is the prototype's `((t*0.28 + phase) % 4)` ramp: a roughly 14 s cycle with a ~0.8 s close to y-scale 0.1. The README's "4 s cycle ... for ~0.12 s" describes the `% 4` and `− 0.12` literals rather than seconds.
- ODIN's plate is never occlusion-tested. It is anchored at the centre of its own disc, so any occluder list would hide it behind the throne it names. The five eye plates test against the pedestal drums, floor disc, disc rim, layer rings and pylon shafts, bases and blades.
- The disc is re-billboarded even while motion is paused. Freezing the transform outright would leave the disc edge-on as soon as a paused viewer orbited.

## Departures from the prototype file

The viewer shell, export toolbar and orbit hint in `three-d-stage.js` are not ported; the site's own canvas mount, controls and caption are used. Per-frame allocations in the prototype (a fresh `Vector2` in the pointer lerp, a `Vector3` per resize) are hoisted. The eight rim gems share one geometry and the fourteen shards another, instead of building sixteen and fourteen copies. Infall mote state moved from an array of objects into typed arrays. Effects that the prototype parented to the viewer's scene — motes, dust, shockwaves, channel pulses and connector beads — live in an `effects` group under the model root, so root-local coordinates, transforms and disposal stay coherent. Elapsed time is accumulated from the shell's delta with a 50 ms clamp rather than read from a `Clock`, so a frame rate change cannot change the animation.

## Dependencies

three 0.184.0 is already pinned in `package.json` and `package-lock.json` and vendored at `public/ui/vendor/`. Cinzel 700 and Cormorant Garamond 500 are already loaded from Google Fonts by `index.html`. Nothing new was installed.

## Verification

161 repository tests pass, including six new Solar Throne suites covering geometry and material values against the README, frame-rate independence, the freeze contract, camera billboarding and the paused-orbit case, eye blink and pupil dilation ranges, mote and bead bounds, the click pulse and its decay, and single disposal of every geometry and material.

Playwright runs against the local preview confirm the live scene. `scripts/solar-browser-check.js` asserts the `solar-throne` scene with five advisors, render scale 1.25, a 1024 shadow map, three revision 184, six plate labels carrying the right names and roles, hover then click selecting Hogun and opening his advisor, dragging stopping autorotation without selecting, motion resuming and advancing the animation clock, and every label inside the host at desktop and at 390px. Cycling Odin to Loki to Thor and back leaves exactly one canvas, one label overlay, one flash layer, six labels and the five Odin advisors, with no page errors.

The port was compared against the design prototype rendered at the same size. Over the model region the mean channel difference is under one 8-bit level (R −0.83, G −0.59, B −0.29 out of 255), the bright-pixel fraction differs by 0.63 points and the near-black fraction by 0.92, so exposure, the tight light ranges and the black marble all reproduce. Screenshots are in `output/solar/`.

Rendering used SwiftShader software graphics. Frame rate on real hardware is unverified. Playwright's actionability waits time out against a continuously animating canvas under that driver, so the check reads the host box and drives hall buttons directly, the same accommodation the Astral rollout recorded.

Not deployed. Nothing in the backend, the Worker configuration or the other two halls was changed beyond the shared shell's new optional knobs.
