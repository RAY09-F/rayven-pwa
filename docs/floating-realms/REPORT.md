# Floating realms correction

## Scope and baseline

Started from main de12667. The current source already used real geometry, but idle bob was only 0.023–0.035 world units, camera elevation was 0.68 radians, and pointer drags changed the entire camera. The user requested conspicuous movement, frontal floating objects, individual dragging, colored readable names and preservation of the existing HUD.

## Implemented

- Front-facing camera and a five-advisor composition in the vertical plane across Thor, Loki and Odin. Removed the broad council tabletop and replaced chunky advisor stands with thin colored luminous discs.
- Names above every advisor, including Miss Minutes, with colored borders/text. Persona name under the central model and glowing heading match the realm accent. Loki remains yellow; Sylvie green.
- Larger bounded hammer/crystal hover, independent ring movement and advisor rotation. Odin's town is a compact floating miniature; its tower retains prominence.
- Procedural additive holographic rings and 480 rising GPU particle points, updated through the existing frame owner. Ambient particles are decorative; application state affects emphasis without inventing tool activity.
- Direct raycast selection on meshes. Pointer drag changes only the selected group's position, within bounds; empty-space dragging no longer orbits the camera. Advisor click still opens the existing dossier. Tethers follow positions. Reset layout restores objects. Existing keyboard centerpiece controls remain.
- Visible Pause/Resume motion action mirrors existing Still settings. System reduced motion is preserved. Renderer failure is honestly labeled; no photo fallback.
- Root index mirror and import query versions updated. Backend code, routes and credentials unchanged.

## Verification and limits

54 Node tests passed: existing reference geometry/resource tests, state/conversation tests and nine additional movement/isolation/holographic-field tests. Syntax and git whitespace checks passed.

The current cloud browser cannot create WebGL (`THREE.WebGLRenderer: Error creating WebGL context`). The real integrated app showed the honest fallback and retained conversation, all five council controls and Settings. This is an environment limitation, not evidence of final GPU appearance.

A separate CPU SVG projection of the actual geometry was inspected for Thor, Loki, Odin and a 390px-wide Loki scene. This caught a top-label collision and an oversized Odin footprint, both corrected. This preview cannot establish shader correctness, lighting fidelity, GPU frame rate or real pointer-event integration. It is not shipped as the scene. `geometry-review.html` is a QA fixture; serve it temporarily from public for reproduction, never use it as production output.

GPU animation, pointer capture on real hardware, mobile touch gestures, live backend replies and final deployed appearance remain unverified. Tests of drag math do not substitute for an actual browser drag. No claim of perfection or full GPU acceptance is made.

## Publication

This correction is source code for the existing GitHub main branch. Cloudflare deployment has not been performed from this environment. A source push does not establish a live release. See HANDOFF.md.
