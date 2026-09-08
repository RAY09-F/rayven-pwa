# ASGARD — Build the Reference Realms in Real 3D

## Read this first: this is the new visual direction

Codex, implement this assignment in my actual ASGARD repository. My name is Rayan. I want working code, a visually inspected application, and the correct live index. The attached images are reference art for reconstruction, not backgrounds to place behind a chat box.

**This brief supersedes the humanoid particle heads, holographic busts and face-based Bifrost Aperture instructions in the previous master prompt.** Keep the older prompt's useful architecture, verification, permission and efficiency guidance. Keep the existing working tool system. Put its broad tool-expansion backlog behind this visual milestone.

The three primary representations are now:

- **Thor:** Mjolnir, a substantial modeled hammer suspended in a bronze astronomical assembly over a storm-blue cartographic dais.
- **Loki:** a luminous yellow/gold faceted Mind-Stone-inspired crystal in an emerald-and-bronze prism foundry. Sylvie remains green.
- **Odin:** a miniature basalt-and-gold architectural command realm, with a central tower, terraces, stairs, bridges and five advisor platforms. The architectural place is the persona representation.

Preserve the HUD and conversation behavior that already work. Improve spacing, framing, materials, interaction feedback and polish without replacing the whole application with an unrelated dashboard.

## 1. References included in this pack

All three images are 1920 × 1080 reference compositions:

| File | Reference identity | Visual features to reconstruct |
| --- | --- | --- |
| `references/thor.jpg` | The Astral Cartographer | Hammer, bronze armillary structure, blue projected map, circular dais, five colored gems and right-side dark conversation panel |
| `references/loki.jpg` | The Bifrost Prism Foundry | Yellow crystal, surrounding bronze bands, sharp emerald backing, polished circular foundation, five gems and dark conversation panel |
| `references/odin.jpg` | The Basalt Command Monument | Gold tower, layered stone terraces, radiating illuminated paths, five raised platforms, cliffs/vegetation and a pale conversation panel |

Inspect the actual images before modeling. Describe the important proportions and scene layers briefly, then build. Do not substitute the previous humanoid faces because their source code is convenient.

Treat the requested image fidelity as a visual target. Reconstruct the major silhouettes, composition, palette, material hierarchy and depth as closely as practical with real runtime assets. Document material differences honestly rather than claiming a pixel-perfect match that was not demonstrated.

These images must not be imported by the production scene as full-frame textures, hidden backgrounds, sprites, video substitutes or a flattened mesh. A real 3D object with the entire screenshot pasted onto a plane also fails. Individual original/licensed surface textures or an environment map may support materials, but cannot contain the complete screenshot composition.

## 2. Layout decision: centered, balanced, all important objects visible

The user described the center position ambiguously while naming Loki and Thor. Use this explicit reversible interpretation so work can begin: **Thor is the default centered selection. Selecting Loki or Odin puts that selected realm's representation in the center.** All three realm choices remain visibly available. Do not place Thor's hammer in the center of Loki's selected realm or change chat ownership independently of the selected representation.

The selected realm has one full council scene with all five advisors visible at its default camera. Keep the other two realms available as compact, clearly labeled miniature 3D previews in the existing realm-switching strip. Do not render three complete council rooms at equal size beside the transcript. Shared geometry and a single renderer can provide preview views if practical; an accessible text button remains the interaction target.

Keep those realm previews small enough that the full selected scene stays faithful to its reference. Do not confuse a realm preview with a councillor gem. If preview rendering is constrained, retain the realm names and selected state; label any static fallback honestly and never let it replace the main interactive model.

The central object should be clearly larger than an individual advisor, but not three times the height of every gem. Use an initial projected-height ratio of approximately **1.4–1.8 times** the main object to a typical advisor gem, then tune by inspecting the actual composition. Compare the hammer/stone/tower body itself, not its entire platform or rings. The central architectural base may be wider without making the central object enormous.

Use one top advisor and four around the sides/lower perimeter, following the supplied layouts. Keep comparable visual gaps around the center. A perspective camera can make rear platforms smaller, so compensate with positions or modest scale changes where needed. Do not achieve apparent balance by scaling one advisor randomly every frame.

Center the scene within its available stage, not the entire browser width when the chat panel is open. Account for the actual chat width in framing. Keep the hero object, all five gems, labels and interactive targets visible without overlap at the default camera. Camera reset must return to this composed view.

## 3. Start from the actual current app

Expected repository: `RAY09-F/rayven-pwa`; likely local directory `~/rayven-pwa`. Verify the remote, branch, HEAD and uncommitted work before changes. Preserve newer edits and current working behavior, including changes another Codex session may have made since the earlier `9d2fb784f629f82463037a0aaf219e063299329a` checkpoint. That hash is historical, not a reset target.

Inspect repository instructions, current index, renderer, CSS, state management, current reference assets, persona configuration, tools, voice and deployment configuration. Read the current handoff and relevant reports. Do not launch a competing editor against the same files while another session owns them; coordinate or use an isolated worktree.

The earlier configuration served `public/` through the existing `asgrard-backend` Worker, with `src/index.js`, an `ASSETS` binding and `run_worker_first = true`; root `index.html` mirrored `public/index.html`. Verify these facts in the current tree. Preserve POST chat and webhook behavior while fixing the homepage.

Find the exact URL the user opens. Determine whether it belongs to Workers, an existing Pages deployment, a custom domain or a redirect. If the current visible index is on Pages, deploying only Worker assets is insufficient. Update the correct existing frontend pipeline as well where authorized. Do not create duplicate projects, rename the Worker or silently change domains.

Capture the actual baseline before major changes. Keep a working path while replacing the scene. Do not hide an unfinished renderer behind the supplied reference picture.

## 4. Thor — build Mjolnir as a real object

Model a recognizable hammer with a heavy rectangular head, beveled edges, distinct end caps, layered face plates and a properly proportioned handle. Create enough bevel geometry to catch light; a sharp unshaded box does not meet the reference. Define metal grain/roughness, restrained engraving and metallic borders. The head needs real side depth and visible construction when rotated.

The handle should read as leather-wrapped or banded, with a dark grip, segmented wraps, neck/collar and end cap. Use actual geometry where it affects the silhouette. Fine decoration may use original texture/normal detail. Add a modeled loop if practical and visible. Do not texture a cylinder with the entire handle photograph.

Set the initial hammer pose diagonally, similar to the reference: the head low/front and the handle rising to the upper right. Its mass should feel suspended, not weightless plastic. Keep the diagonal composition within the stage when advisors and chat are visible.

Build the armillary assembly from a small number of bronze rings/bands with real thickness, different axis tilts, mounts and selected star-like ornaments. Rings can move slowly relative to each other. Avoid perfect coplanar rings, impossible intersections with the hammer or excessive visual noise. Keep the hammer silhouette legible between them.

Build the concentric foundation from stepped cylinders/ring meshes with side walls, lips and recessed illuminated blue seams. Add a blue map/holographic cartographic layer above the dais using procedural lines and actual geometry where depth matters. Small surrounding terrain ridges and star-field details should reinforce scale without covering labels.

Use storm blue and ice-white highlights with bronze/gunmetal structure. Lightning is an accent along selected paths, not a full-screen strobe. A small restrained electrical arc may connect the hammer's energy point to the projection layer during real work. Keep glow low enough to reveal metal faces and engraved borders.

Advisor arrangement from the reference: Jane Foster red at the top; Darcy violet at left; Valkyrie ice blue at right; Korg pale champagne at lower left; Hulk green at lower right. Preserve actual backend IDs and roles even if display aliases differ.

## 5. Loki — build the yellow crystal foundry

Create a custom faceted crystal mesh with a pointed top/bottom, deliberate belt facets and a clear elongated diamond silhouette. Model the faces and normals intentionally. A generic sphere, glowing cone or flat diamond SVG is insufficient.

The central crystal is **yellow/gold**, not emerald. Use amber depth, lemon-gold face highlights and a bright inner core, with controlled translucent/refraction-like material behavior. Preserve facet boundaries. Do not overexpose the whole crystal to solid white or obscure it with dozens of transparent shells.

Use physically plausible transmission/refraction only where supported and performant. A controlled opaque-faceted material plus inner glow and carefully chosen highlights is preferable to broken transparency. Evaluate actual renderer version, environment lighting and sorting. Never claim ray-traced refraction if the implementation uses an approximation.

Surround the crystal with a few modeled bronze bands at differing tilts, with visible thickness and supports. They should orbit with slow coherent motion and retain a clear outline. Add the sharp emerald/metal backing structure seen in the reference: layered pointed architectural fins, not a humanoid head or horns floating without support.

Build a polished concentric dais with outer rims, dark inset faces, bronze edging and restrained emerald illumination. The material should respond to actual light or a appropriate local environment texture. Reflection approximations may be used, but must not duplicate the reference photograph.

The crystal floats gently above its cradle. Its vertical travel should be small relative to its own height, approximately 1–3% as an initial art-direction range, and independent of typing speed. Subtle yaw or facet shimmer can reveal its depth without constant full rotation. Motion stops under Still/reduced-motion settings.

Advisor arrangement: Miss Minutes orange/amber at top; Kang violet at left; Hunter B-15 ice blue at right; **Sylvie emerald green at lower left**; Mobius champagne at lower right. All five should be modeled gems on small platforms with visible tethers and readable labels.

Keep the existing Loki UI's usable colors and behavior. The central stone's gold does not require every button and paragraph to turn yellow. Emerald can remain the secondary realm accent.

## 6. Odin — build the miniature architectural realm

Odin's central representation is the monumental place shown in the reference: a gold vertical tower rising from a multi-tier circular command foundation. Build it as a miniature architectural diorama with real depth. Do not substitute an eye ring, a face, a crystal or a photograph of a town.

Construct the main gold tower from grouped vertical masses with different heights, beveled edges and a bright interior seam or light well. Surround it with concentric structural rings, recessed channels, stepped stone/metal terraces and a circular central basin or foundation. The tower should feel substantial but remain only moderately taller than the advisor monuments.

Build the large circular plaza from layered stone slabs, recessed seams and radial pathways. Give the edge a believable thickness with basalt wall segments. Add stairs that actually have step geometry where visible, plus small rail/parapet structures. Use consistent architectural proportions rather than many unrelated primitives.

Place five raised advisor platforms around the central monument. Each needs a visible connection to the main plaza, a stair or short bridge, a gem plinth and a readable sign. Light paths should follow the architectural channels rather than cutting arbitrarily through walls.

Reference arrangement: Volstagg red at the rear/top; Frigga violet on the left; Heimdall warm gold on the right; Hogun blue lower left; Fandral green lower right. Use actual configured runtime IDs rather than guessing from display spelling.

Surround the playable composition with restrained basalt cliffs, some instanced conifers/vegetation and depth haze. Build nearby cliffs and terrain as geometry. Distant environmental layers may be inexpensive, but they cannot flatten the entire scene. The main plaza, stairs, towers and platforms must show correct parallax and occlusion during camera movement.

Animate appropriate elements: gently floating advisor gems, a subtle core light, slow atmospheric particles and restrained banner motion if implemented. The whole town must not bob up and down as a rigid floating toy unless that treatment is deliberately chosen and visually justified. Architecture should feel grounded.

The reference uses a pale warm conversation panel and dark architecture. Preserve the current working HUD structure; use that palette only if it integrates cleanly with current settings and readability. Do not sacrifice interaction consistency for screenshot imitation.

## 7. Interaction: inspect the model, do not accidentally move the UI

Provide bounded orbit rotation, sensible zoom limits and a clear Reset view action. Use an initial perspective camera matching the reference's raised three-quarter view. Prevent the camera from going through the floor, inside the model or behind labels at normal limits.

Support pointer/touch input without breaking page scrolling or text selection. Distinguish click/tap from drag using movement thresholds. Do not start orbiting when the user selects text, manipulates the composer or touches a control overlay. Handle pointer cancellation, capture loss and page blur.

The user asked to move objects around. Support a small, reversible **Arrange** mode inside the scene controls: drag the main object within bounded stage space, adjust its vertical placement if practical, and reset the layout. Lock the normal council composition by default. Label arrangement clearly and keep the action separate from orbit. Moving a gem in Arrange mode changes only local visual placement, not backend assignment, permissions or active tasks.

Use a bounded drag plane and collision/label constraints. Do not allow users to lose a model outside the scene or cover the transcript. On small phones, a simpler position control plus Reset can substitute for fiddly direct manipulation. Avoid adding a full editor, transform gizmo workspace or modeling bay.

Make all five advisor gems selectable with corresponding keyboard-accessible DOM controls. Selection opens the existing useful role/status/tools detail; it does not claim an agent is running. Tethers can respond to actual selection and verified activity. Use plain status text as well as light.

If the scene layout persists, namespace it per realm, validate loaded values, clamp bounds and provide a reset. Persist only after intentional changes, not each animation frame. Invalid saved state should return to the composed default safely.

## 8. Real reactivity and motion grammar

Connect the scene to actual application events through the existing state source. Use an explicit adapter if needed, with normalized idle, connecting, permission-pending, listening, thinking/waiting, speaking, error and cancelled states.

Do not invent streaming text, microphone amplitude, advisor activity, progress percentages, tool success, backend load or connection status. If an event source is absent, keep the response cosmetic and label its meaning honestly, or omit it.

| Real event | Thor | Loki | Odin |
| --- | --- | --- | --- |
| Idle | Gentle hammer suspension; extremely slow ring drift | Small crystal float; restrained facet shimmer | Stable architecture; quiet core and floating gems |
| Composer focus | Small blue seam strengthens | Small emerald/gold seam strengthens | Local pathway edge becomes clearer |
| Confirmed listening | Focused energy near hammer/core | Controlled core illumination | Central light well focuses |
| Request pending | Limited arc movement or ring alignment | Subtle band alignment and core pulse | Restrained radial channel flow |
| Actual speaking | State-based light articulation, or measured output response if available | Smooth facet/core variation | Smooth central/channel emphasis |
| Verified advisor activity | Corresponding tether/gem responds | Corresponding tether/gem responds | Corresponding path/platform responds |
| Error | Local contained warning and readable message | Local contained warning and readable message | Local contained warning and readable message |

Keep idle motion low-amplitude and low-frequency. Reaction to one event must not spawn a permanent new animation loop. Prevent stale async responses from lighting the wrong selected realm. Completed/cancelled activity settles correctly, and returning from a hidden tab never replays a backlog of effects.

Honor system reduced motion and existing Still mode. Stop float, ring drift, ambient particle movement and automatic camera easing where appropriate, while retaining direct user inspection and all semantic status text. No rapid flashes.

## 9. HUD refinement without throwing away what works

Inspect the current live HUD before changing it. Keep the usable navigation, conversation, tool entry, persona selection and settings conventions. Refine the composition into a coherent premium interface with consistent type, spacing, depth and focus treatment.

The main stage should usually occupy about 70–74% of the desktop width and conversation about 26–30%, as a reference starting point, subject to minimum readable panel widths. Do not center the 3D object underneath the transcript. Keep header/footer heights restrained.

Improve the following where current inspection shows a weakness:

- Align the header, scene bounds and conversation panel to a consistent grid.
- Use one strong display style for realm identity and a readable text face for conversation.
- Increase contrast of small labels without glowing every word.
- Use real contact shadows, restrained material highlights and fine borders rather than multiple bright neon outlines.
- Keep the conversation composer anchored and accessible during long replies and phone keyboard changes.
- Use subtle selected/hover/focus states for advisor and realm selection.
- Preserve existing rich-text safety, code/list/link rendering, drafts and sensible scroll behavior.
- Show tool results and meaningful sources in compact receipts, not decorative telemetry.
- Keep advanced diagnostics available on demand: actual renderer mode, asset revision, errors and measured performance.

The secondary tool nodes from the references may appear near a selected advisor when space permits. Do not show invented “4 tools” counts; use the real configured capability count or omit it. On phones, move these details to the selected advisor panel rather than covering the scene.

Use DOM for readable, accessible labels/buttons and project anchors from actual world positions. Account for canvas/container offsets, resize and the conversation panel. Never rebuild the whole DOM every frame. Avoid labels occluding one another with a deterministic layout policy at the default camera.

## 10. Rendering architecture and assets

Use the existing browser-compatible rendering stack where sound. Do not migrate the app to a framework simply for this scene. Match the locally installed Three.js version and its add-ons. Keep production assets local or in the existing managed pipeline where practical.

Use actual meshes for major silhouettes and visible architecture. Appropriate custom BufferGeometry, beveled extrusions, cylinders, rings, instanced repeated structures and original textures are acceptable. Material sophistication must serve readable depth; prioritize normals, lighting, roughness and camera before expensive effects.

Organize the implementation into focused modules following existing conventions: shared materials/geometry helpers, Thor model, Loki model, Odin architecture, advisor gems/platforms, scene layout, input controls, real-state adapter and lifecycle owner. This is a suggested separation, not a requirement to create duplicate modules where equivalent code exists.

Make the scene factories return explicit ownership of roots, update behavior, interaction targets and disposal. One owner controls rendering and scheduling. Shared resources need reference-aware disposal; changing a realm must not dispose resources still used by preview models.

Reuse materials and instance repeating steps, wall pieces, trees and decorative elements when beneficial. Use sensible shadow-map resolution and limited shadow casters. Avoid numerous transparent layers, full-resolution multi-pass effects and high-DPR rendering on the Chromebook by default.

Measure rather than guarantee performance. Quality tiers may reduce far terrain, tree count, shadow detail, particles, transmission and reflection complexity while preserving main silhouettes, all five advisors and functional controls. Do not degrade low quality into the supplied picture.

Pause unnecessary work when hidden. Clamp resumed time. Avoid per-frame geometry creation, material recreation, listener registration and network activity. Release obsolete resources on switching/unmount. Keep one active camera-control owner and avoid multiple handlers fighting over the same canvas.

Preserve a graceful rendering failure path with usable conversation. Tell the user if WebGL is unavailable. A software or static fallback is not proof that the GPU path matches the reference. Test the real GPU path on available supported hardware and report what could not be verified.

## 11. Tools, agents and token efficiency

Use actual available tools that help modeling, design and verification: repository search, existing Three.js tooling, shader/material inspection, licensed asset inspection, a real browser, screenshots, network/console inspection, performance profiling, accessibility review and focused tests. Use image generation only for exploration or limited original material assets if useful, never as the implemented scene.

If a local offline modeling tool is available and useful, it can create development assets. The product remains a browser assistant, and the low-RAM Chromebook must not need to run a modeling suite to use it. Do not install random packages based on ambiguous names or introduce paid services without approval.

I authorize subagents for independent work. Suggested bounded ownership: one Thor model specialist, one Loki model specialist, one Odin architecture specialist, one integration/HUD owner and one independent visual reviewer. The lead controls shared scene/state contracts and release. Use only the concurrency supported by the environment and actual resource budget; roles are not a quota.

Agree scale, axis convention, origin, bounding box, material/resource ownership and update/dispose APIs before parallel implementation. Give each specialist the relevant reference and files only. Keep one owner for the index, common CSS, shared state and deployment. Integrate the models into the real page before judging completion.

Conserve usage through targeted reads, stable source maps, local scripts for deterministic checks, narrow agent context, shared evidence and concise handoffs. Load relevant sections from older inventory prompts only when necessary. Do not send the entire 46,000-word catalogue to every model specialist. Do not skip visual review to save tokens. More agents can increase total usage; use them where independent work justifies the cost.

Keep original backend capabilities intact. This milestone does not require adding unrelated tools, new financial systems, paid billing, additional personas or a modeling bay. Finish the reference-driven index first.

## 12. A concrete implementation sequence

### Wave 1 — Baseline and contracts

Inspect current repository and exact live URL; capture existing HUD. Read these three images. Identify what serves the index. Record actual chat/state/control contracts. Define shared world scale, default camera and five-advisor layout. Write a short implementation map and begin.

### Wave 2 — Silhouette pass

Build real Thor hammer/assembly, Loki crystal/foundry and Odin tower/terraces/platforms. Integrate all three selectable scenes with all five advisors each. Use basic materials first so silhouette, scale and spacing can be judged without glow. Verify the default center interpretation and compact other-realm previews.

### Wave 3 — Materials and environment

Refine bevels, normals, faceting, metal, stone, glass approximation, light, shadows and atmosphere. Match the reference composition and color relationships. Add only the details visible enough to improve the actual screen. Inspect at normal view size, not only close-up screenshots.

### Wave 4 — Movement and interaction

Add gentle float, meaningful ring/channel movement, orbit, zoom, Reset, bounded Arrange mode, advisor selection and state reactions. Preserve chat focus, scrolling and phone gestures. Verify keyboard alternatives and reduced motion.

### Wave 5 — HUD and responsive polish

Refine the existing HUD. Test desktop, compact desktop/tablet, 390-pixel phone and 320-pixel width. Keep advisor identities and realm options discoverable, and protect the composer. Inspect labels and overlays during camera movement and panel changes.

### Wave 6 — Correct and release

Run tests, inspect integrated GPU rendering where possible, fix visual defects and regressions, commit scoped changes, push to main as authorized and deploy the correct existing application. Verify the exact URL Rayan opens. Complete reports and provide real screenshots/video evidence where available.

Do not stop at the first primitive silhouette pass. Do not spend the session expanding a plan instead of implementing. Complete the strongest coherent version, then refine the visible weaknesses in order: layout, silhouette, material/light, interaction, small detail.

## 13. Acceptance tests that prove it is not a picture

For each selected realm, demonstrate all of the following in the actual integrated app:

1. Orbiting changes relative occlusion of hammer/rings, crystal/bands or tower/terraces.
2. Zoom reveals actual side depth and modeled construction, not pixelated screenshot detail.
3. Individual structural parts move independently where designed.
4. All five advisor gems exist as separate 3D objects with stable accessible selection controls.
5. All three realm choices remain visible and switch the correct scene/conversation.
6. The default layout is centered, balanced and avoids clipping/label overlap.
7. The main object is moderately larger than advisors, not overwhelming them.
8. Orbit and Arrange modes are distinct, reversible and do not break typing or page scrolling.
9. Real assistant states produce correct bounded responses; absent state is not fabricated.
10. Still mode produces an attractive complete scene.
11. Repeated switching and resizing do not accumulate canvases, event handlers or undisposed resources.
12. Renderer failure preserves functional conversation and reports its mode honestly.

Inspect source imports and browser requests to confirm the reference JPGs are not loaded by the production scene. Store them as development references outside the publicly deployed asset root unless there is a deliberate separate documentation need. A screenshot-shaped textured plane fails even if the surrounding UI is functional.

Test current conversation contracts, per-persona drafts, pending/error states, response ownership, voice controls if present, tool receipts and existing links. Run relevant existing tests and add focused scene/state/lifecycle tests for the new behavior. Do not replace meaningful checks with assertions that merely repeat CSS strings.

For visual comparisons, use fixed camera/seed, a stopped-animation capture where appropriate and a stated viewport. Do not mask the model or update an obviously wrong baseline to make a screenshot test pass. Capture motion evidence separately: screenshot comparison alone cannot prove animation or performance.

Record actual renderer, browser, viewport, device and sample duration for performance measurements. If GPU access is absent, say so, perform independent source/geometry tests and leave GPU appearance explicitly unverified. Do not report “perfect” or a target frame rate without evidence.

## 14. GitHub, deployment and completion evidence

Preserve unrelated work and newer main commits. Push the tested scoped changes directly to `RAY09-F/rayven-pwa` main as previously authorized, using a non-force update. Verify the remote revision. Do not reset to an older hologram commit just because it is mentioned here.

Use the existing authenticated deployment workflow. Preserve the existing `asgrard-backend` name and all current bindings/migrations. If the actual visible frontend belongs to an existing Pages deployment, update that deployment's correct assets as needed; a Worker-only release is not sufficient proof for a different URL.

Check the real served HTML and module/model assets, MIME types, cache behavior and release fingerprint. Diagnose any old-image behavior instead of assuming the push failed or telling the user to accept a stale page. Preserve POST chat and existing webhook routing.

If credentials or account access block deployment, finish code, tests, screenshots and the exact deploy handoff. Ask only for the concrete login/access step needed. Never claim live deployment from a GitHub push or mock preview.

Save a current handoff and a concise report containing actual files changed, reference interpretation, layout decision, model construction, interaction behavior, tests, screenshots, performance limits, source revision, deployment version/URL and remaining blockers. Include a before/after of the actual index and one image per realm, plus phone evidence. Provide a short real video of orbit/switching if supported.

The first final statement should tell Rayan what is actually implemented and where to see it. Distinguish source implementation, pushed revision and verified live release. The requested outcome is an attractive, professionally composed, real-time reconstruction of these references with a functioning HUD—not another prompt, catalogue or reference image used as the page.

## Start now

Inspect the three references and the current application. Confirm the center/default interpretation in a brief progress update, without stopping for a design-choice questionnaire. Establish the scene contracts, delegate independent model work where useful and implement the actual index. Continue through visual inspection, correction, testing and authorized delivery.

DONE — EXECUTE THIS REFERENCE BUILD IN CODEX.
