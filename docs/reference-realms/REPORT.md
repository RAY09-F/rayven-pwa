# ASGARD reference realm implementation

The actual index now contains three modeled 3D reference scenes in the existing HUD. See [deployment evidence](DEPLOYMENT.md) for the separately verified live release, not just the GitHub push.

## Reference interpretation and changes

The three supplied 1920×1080 compositions were inspected before building. Their shared hierarchy is a circular foundation, a moderately dominant centerpiece, five colored advisor gems and a separate readable conversation panel. Thor is the default centered selection; Loki and Odin center their own realm and conversation when selected. The desktop grid reserves about 71% for the stage and 29% for conversation at 1440px, relaxing at compact widths to preserve readable conversation.

- Thor: substantial beveled silver/gunmetal Mjolnir, layered plates and endcaps, modeled grip wraps/loop, diagonal pose, thick bronze astronomical bands, independent axes, blue cartographic grid/contours and stepped dais. First review found the head lost among rings; it was moved forward, enlarged and pitched toward the camera. Repeated geometry was deduplicated/instanced.
- Loki: deliberately faceted gold/amber crystal with belt and crown facets, narrow luminous ridge/core accents, three bronze bands, supported emerald fins and concentric foundation. Its body was scaled 1.18 during visual refinement. Sylvie stays green. This is an opaque faceted approximation with emissive accents, not ray-traced refraction.
- Odin: grouped beveled gold tower, light well, tiered basalt foundation, slab plaza, actual stair geometry, five bridges, wall segments and varied instanced vegetation. Original procedural mineral/metal textures supply surface detail. Architecture stays grounded. The warm pale conversation palette retains existing controls with corrected text/code/link contrast.
- Shared council: five separate gems/platforms in each realm, fixed reference colors and actual CAST identities. DOM buttons project from world anchors and open the existing role/status/tool dossier. Rear advisor placement/scale and label offsets were adjusted to clear the main silhouette. Unknown activity stays unknown.

The production modules never load the reference JPGs. Those images remain development inputs outside public/. No humanoid factory is imported by the new scene owner; old supporting assets are preserved. This is a stylized geometric reconstruction, not a demonstrated pixel-perfect match: fine engravings, atmospheric volume and photographic surface complexity are simplified.

## Interaction and ownership

Drag to orbit within limits; +/− zoom; Reset view restores the composed camera. Arrange explicitly switches to bounded local centerpiece movement, with pointer dragging plus left/right/raise/lower buttons and Reset layout. Layout is held per realm for this page session, not persisted or sent to the backend. It cannot alter advisor ownership, permissions or tasks.

Pointer capture, release outside the canvas, cancellation, multiple-pointer guards and blur prevent stale drags. Ordinary touch page scrolling remains available outside Arrange; controls and labels do not orbit the canvas. Keyboard-accessible advisor buttons open the actual existing dossier. A source audit caught and corrected stale Arrange status after switching and missing shadow-map disposal.

Actual request, listening, voice, error, focus and cancellation states drive bounded light/motion responses. No fabricated advisor activity, streaming, amplitude or progress is added. One renderer/RAF owner pauses hidden tabs, clamps resumed time, respects Still/system reduced motion and disposes models, textures, instances and shadow targets. Rendering failure retains conversation and all council buttons with an explicit unavailable notice.

## Evidence and checks

- **58 source tests pass** across reference geometry, existing local tools, schema/persona contracts, state and conversation. The 17 new reference tests cover actual depth, finite normals/indices/instances, independent motion, Still, arrangement preservation, exact resource disposal, council identities and malformed bounds. [Tests](evidence/tests.txt).
- **56 integrated scene/browser assertions**, **27 existing conversation assertions**, and **14 final interaction/layout assertions** pass. These cover actual changed pixels under orbit, zoom, five advisors, model switches, resource stability, Arrange/reset, pointer release outside the canvas, keyboard selection, fallback conversation, safe replies, drafts/cancel/late ownership, and 1024/390/320px layouts. [Scene checks](evidence/scene-browser.json), [conversation checks](evidence/conversation-browser.json), [final checks](evidence/final-browser.json).
- Existing file smoke checks, updated to the reference scene contract, pass. Wrangler dry run passes. Root/public index mirrors match; no backend/config diff. [Smoke](evidence/smoke.txt), [dry run](evidence/dry-run.txt).
- Projected geometry at the actual desktop and phone camera sizes puts the main body at **Thor 1.72–1.73×, Loki 1.58×, Odin 1.68–1.69×** the mean advisor height. Measurement includes instance transforms and excludes the main foundation/rings where appropriate. [Proportions](evidence/proportions.json); reproduce with `node scripts/reference-proportions.mjs`.

Visual evidence: [actual before](evidence/reference-before.png), [Thor](evidence/final-thor.png), [Loki](evidence/final-loki.png), [Odin](evidence/final-odin.png), [Thor phone](evidence/final-thor-390.png), [Loki phone](evidence/final-loki-390.png), [Odin phone](evidence/final-odin-390.png), [320px](evidence/final-loki-320.png), [keyboard-sized viewport](evidence/realm-keyboard.png), [renderer unavailable](evidence/realm-fallback.png). Live release captures are recorded separately after deployment.

## Performance and practical limits

The available browser is Headless Chrome 152, Three r185, WebGL through ANGLE SwiftShader on a roughly 2.7 GiB RAM environment. This exercises actual geometry and shader rendering, but **physical GPU appearance/performance is unverified**. Local response tests use explicitly labeled fixtures; they are not live provider proof. Real microphone/speaker hardware, assistive technology and a physical phone keyboard remain device checks.

At 1440×900, the initial full-lighting SwiftShader sample rendered 10 frames in 10.18 seconds (0.98 FPS). The reduced software-driver path rendered 40 frames in 10.06 seconds (3.98 FPS). This is still below smooth-animation performance; no target frame-rate claim is made. Balanced rendering detects software drivers, reduces moving pixel scale to .65, uses direct lighting/basic shadows, and restores full-resolution drawing in Still mode. Hardware drivers retain the procedural studio environment; High also restores it on software. DOM labels and conversation stay full resolution. Still/reduced motion stops continuous frames and retains direct inspection.

The final software sample is [performance.json](evidence/performance.json); its predecessor measurements are retained in final-browser.json and performance-intermediate.json. No new dependencies, paid services, account changes, standing agents or backend automation were introduced. Exact Codex token/cache savings are not exposed, so no percentage savings is claimed.
