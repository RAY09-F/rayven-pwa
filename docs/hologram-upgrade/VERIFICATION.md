# Holographic personas — verification

Date: 2026-09-07. This report describes the current hologram iteration; earlier rendered-realms reports remain historical records.

## Automated checks

The combined local suite passed **29 tests**:

```sh
node --test scripts/hologram.test.mjs scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs
node scripts/smoke-fx.mjs --files
```

The smoke check passed in **local-file mode**, which checks source assets and entry-point conventions, not HTTP delivery or production deployment.

The six focused hologram tests use the actual locally vendored Three.js classes. They verify:

- Each persona has substantive geometry in all three axes, finite vertices and bounded portrait dimensions.
- Thor, Loki and Odin produce different, deterministic particle geometry; Loki's horns change the silhouette.
- Low, balanced and high quality reuse existing buffers and respect the particle ceiling.
- Visible geometry and particle intensity remain still when motion is disabled, across idle, connecting, listening, thinking, speaking and error states.
- Geometry, materials and the particle sprite texture each dispose once; repeated teardown is harmless.
- A recording Canvas2D boundary receives points with correct camera perspective, depth ordering, clipping and draw-budget behavior. Editing actual vertex positions changes the projection.
- All three real portrait buffers project finite coordinates and respond to camera orbit.

The remaining suites cover preserved state routing/preferences, legacy core resource handling, catalogue/schema boundaries, tool request construction and local utilities. These tests do not certify external service availability.

## Integrated browser evidence

The root implementation agent inspected the real integrated local application in the cloud browser, with fixture replies clearly separated from live backend behavior. Confirmed interactions:

- Thor, Loki and Odin switches update the rendered model identity and selected persona.
- A Thor draft survives switching to another persona and back.
- A fixture chat request receives a formatted reply through the existing conversation flow.
- Frigga's supporting-council dossier opens.
- Desktop persona scenes and a phone layout render the procedural particle portraits through the software projection path.

Visual evidence is stored beside this report:

- [Thor desktop](evidence/thor-desktop.jpg)
- [Odin desktop](evidence/odin-desktop.jpg)
- [Loki phone](evidence/loki-phone.jpg)

These screenshots show the software projection of the actual 3D particle buffers. They are not concept-art substitutions. They prove the pictured layout and appearance at the captured moment; they do not establish sustained performance.

## Rendering and performance limits

**WebGL is disabled in the available cloud browser.** The CPU renderer projects the same Three.js geometry through the same perspective camera, while WebGL remains the preferred runtime path on supported browsers. Genuine GPU material appearance, GPU rendering failures, physical-device smoothness and sustained FPS remain unverified.

Source review confirms one scene-owned animation loop, hidden-page suspension, clamped elapsed time, bounded pixel density, geometry reuse, replacement-model disposal and a fresh Canvas2D canvas on WebGL fallback. The configured update intervals are scheduling limits, not measured frame-rate guarantees.

The one-shot assembly and speaking response are bounded visual animations. No measured microphone or output amplitude is claimed. Still mode and reduced-motion handling are implemented and covered at the model level; this is not a complete assistive-technology audit.

## Other unverified behavior

This iteration does not certify live provider connections, actual microphone/TTS hardware, real phone keyboard behavior, billing activation, the entire external tool catalogue or production deployment. Deployment status must be recorded from actual Cloudflare evidence in the final report, independently of a GitHub push. Existing backend code, credentials and authorization boundaries are retained.

## Final root checks

Desktop screenshots are 1348 × 926 captured pixels. Phone framing was inspected in 390 × 844 and 320 × 844 iframe viewports (desktop scrollbars reduce usable content width). At 320 pixels the body width and scroll width both measured 305 pixels, with no horizontal document overflow. Dragging visibly changed Odin's viewing angle; Reset view returned the camera. Still mode confirmed `data-animated=false` and a static frame count. Real phone keyboard behavior remains untested.

Raw logs: [29-test suite](evidence/tests.txt), [file smoke checks](evidence/smoke.txt), [diff check](evidence/diff-check.txt).
