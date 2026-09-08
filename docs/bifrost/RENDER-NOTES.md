# Bifrost sculptural renderer — RENDER-B

The main visual failure was shared by two different rendering problems: WebGL used an additive surface with opacity 0.038, while the software path ignored mesh geometry altogether. Both paths now show opaque, shaded, faceted sculpture. Existing public renderer/state APIs remain compatible.

## Construction

- Thor: broad storm-blue armor, a solid helmet with six thick wing blades, sculpted brow, cheek and nose planes, and short beard elements.
- Loki: a narrower gold face/headpiece, tall tapered physical gold horns, emerald shoulder and torso armor.
- Odin: crown, long solid beard with selected raised strands, aged cheek accents, one luminous eye and a dark physical eye patch.
- All personas: recessed dark eye sockets, an actual projecting nose, mouth recess/lower lip, depth-writing surfaces and sparse luminous inlays. No triangle-edge wireframe overlay is enabled.

The geometry is original runtime construction. No external models, textures, new dependencies, or image replacements are introduced. The vendored Three.js version is **r185**. WebGL uses flat-shaded `MeshStandardMaterial` with hemisphere, key, fill and rear lighting; eyes alone use an unlit solid material. Rendering has no bloom dependency.

Deterministic area-weighted samples remain surface attached. Particle budgets are **900 low / 1,800 balanced / 3,000 high**, with fixed backing buffers and a bounded 0.9 second assembly. Completion stops particle-buffer updates. Still/reduced motion and hiding the document complete the assembly immediately; resuming does not replay it.

## Software and lifecycle

The explicitly labeled **Software 3D projection** now paints projected mesh triangles using world-space face-normal illumination. A half-resolution depth buffer hides rear particles and obstructed feature paths. It uses painter ordering for solid triangles and is an approximation of WebGL, not a claim of GPU equivalence. It does not use a screen-wide animated scanline.

One scene still owns one canvas and one animation loop. Persona changes dispose superseded geometry/materials/textures. Existing hidden-tab, reduced-motion, still-mode, context-loss and teardown behavior remains supported. Diagnostics include Three revision, owned geometry/material/texture counts, sculptural mesh count and actual WebGL renderer memory when available.

Camera framing accounts for aspect ratio, preserves broad shoulders on narrower stages and raises the camera target for Loki's horns. Final framing must be assessed in the actual shell.

## Verification

Run `node --test scripts/hologram.test.mjs` (10 tests):

- Finite bounded 3D geometry for every persona; deterministic sample buffers.
- Quality changes reuse resources; all traversed resources dispose once.
- Distinct anatomy and silhouette, opaque depth-writing surfaces and bounded particles.
- Real software perspective, camera orbit, shaded mesh paint and point occlusion.
- Assembly never regresses/replays and settles without repeated buffer updates.
- Scene ownership: one canvas, one queued frame through repeated selection, hidden pause, reduced/still settling, teardown and explicit software labeling.

These are real Three geometry/camera tests with a recording Canvas2D boundary; they do not prove browser paint or GPU appearance. Lead-owned browser review is the next gate, including desktop/phone, grayscale/still and modest orbit. Sustained target-device FPS and GPU visual parity are not claimed. Software triangle ordering can show small intersections and is intentionally a fallback.

## RENDER-B2 — correction from first integrated WebGL capture

Inspected `output/playwright/first-integrated.png`. The initial mass read too much like a low-poly mannequin: separated round pauldrons, long exposed neck, oval bright eyes, cheek overlays and narrow wing shapes.

Replaced the round shoulders with connected, overlapping upper/lower armor plates and raised the collar over a shorter neck. Added paired sculpted breastplates/lower plates; removed intersecting chest-light decoration. Reworked the face into a smoother continuous surface with a smaller projecting nose, substantive angular brow and narrow physical light slits inside rectangular recesses. Thor's six wing plates now spread farther sideways with thick faceted faces and individual seams. Added temple guards and reduced the central armor clasp. These face/collar/armor changes also apply to Loki and Odin.

WebGL standard materials retain lighting and opaque depth writing, with a small r185 `onBeforeCompile` hook for material-local horizontal band modulation and restrained grazing-angle emission. Bands are static in still mode; there is no full-screen shader, bloom dependency, or animated scan overlay. Particles are slightly larger/brighter so the sculpture retains projected surface texture. Software keeps the shaded triangle approximation and does not claim equivalent shader effects.

`node --test scripts/hologram.test.mjs` now has **11 passing tests**, including the r185 shader injection contract, preserved standard lighting/opaque output, stable state uniform, and connected armor/collar geometry. Actual shader compilation and final paint still require lead browser verification after this correction.
