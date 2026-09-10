# Prism Foundry integration

**Deployed to Cloudflare at 100%.** [Open the live scene](https://asgrard-backend.rayanfahil2.workers.dev/?hall=loki). See the [deployment receipt](DEPLOYMENT.md) for staged rollout, live browser checks and both verified hosts. The deployment uses the existing backend plus this UI; the separate pending brain waves remain excluded.

The supplied README is the design specification. Its procedural model is ported into `public/ui/prism-foundry-model.js`; `prism-foundry.js` owns the renderer, studio environment, OrbitControls, projected labels and input callbacks. `scene.js` serializes mount/disposal when switching halls. Loki uses Prism Foundry; Thor and Odin retain their existing scenes and conversation controls.

The original handoff lives in `design_handoff_prism_foundry/`. Its HTML, viewer shell and export buttons are not served as the application. No scene pictures or exported model replace the geometry.

## Decisions where the handoff conflicts

- README line 33 gives lower emissive ranges than the explicit animation formulas at lines 59–63. The animation formulas take precedence. The gold base color follows the README, #ffc21a, rather than the prototype’s #ffd45a.
- README line 44 asks for PCF soft shadows. The pinned three.js 0.184 renderer accepts that setting but maps it to PCFShadowMap and emits a deprecation warning. The integration keeps the requested setting, 1024 map, radius 4 and bias −0.0002 without modifying library internals.
- The prototype samples its clock twice per frame, clamps only vertical label placement, leaks its PMREM target and drifts dust out of its original bounds. The port uses one elapsed delta, clamps both label axes, disposes the environment target and wraps dust vertically within the specified field.
- Autorotation stops after an actual drag, as requested. Wheel zoom alone does not stop it. Still mode/system reduced motion freeze the scene while retaining selection and camera controls.

## Integration contract

`createPrismFoundry(host, {onHover, onSelect, still, quality, onStatus})` reports the prototype keys `core`, `amber`, `sapphire`, `copper`, `emerald`, `violet`. The existing presence adapter maps these to `loki`, `miss_minutes`, `hunter_b15`, `mobius`, `sylvie`, `kang` before opening the app’s advisor panel. Hover is also exposed through `#presence-scene[data-hover-agent]`.

Labels are a non-interactive HTML overlay. Existing council buttons remain available to keyboard users and become visible on focus. Scene objects are selectable by raycast; dragging orbits the camera. Reset and zoom use the existing HUD controls.

## Dependency updates

`npm install` installs the exact three.js 0.184.0 dependency. `npm run vendor:three` updates the locally served renderer and OrbitControls and copies the upstream license. Google Fonts loads Cinzel 700 and Cormorant Garamond 500 from the application head. No bundler was introduced.

## Verification

- `npm test`: 151 passed, including new optical/geometry, elapsed-time, hover/pulse and disposal coverage.
- Real Chromium WebGL desktop inspection completed with the reference scene rendered. This machine uses SwiftShader software graphics; it cannot establish hardware-GPU frame rates.
- Browser hover/click selected Hunter B-15 and opened the correct advisor panel; dragging set the orbit interaction flag and stopped autorotation. No JavaScript application errors occurred.
- At 390 × 844, the canvas resized to 368 × 322, all six label boxes remained contained, and there was no horizontal page overflow. Occluded labels were hidden.
- A rapid-switch check found a stale-status race: a queued hall change could override the last click. The presence adapter now reports the requested persona while mounting; the repeated Thor → Odin → Loki sequence now passes, ending on Loki with exactly one canvas and six labels. Switching to Thor leaves one canvas and no Prism labels. All three hall previews are rendered.
- With motion enabled, autorotation was active before dragging and stopped after the drag. Still mode settled with no scheduled animation frame. A local Loki fixture reply completed and the scene returned to idle; no live model calls were used.
- Final captures: [desktop](desktop.png) and [phone](mobile.png). Release fingerprint: `floating-09c8bbec9862` (30 assets).
- Reproduce the browser checks against the local fixture preview using the Playwright CLI: create `output/`, open `http://127.0.0.1:4177/?hall=loki&fixture=1`, then run `scripts/prism-browser-check.js` with `run-code --filename`.

This implementation does not deploy the pending brain/backend waves. A source change or GitHub push is not evidence of a live Cloudflare release.
