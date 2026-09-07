# Verification record

Date: 2026-09-07. Baseline: `22fc1e85db1dec5d0e08eef7a5287b3cbaeaf34b`. Working branch: `codex/quiet-core-ui`.

## Result and boundary

The integrated layout, conversation fixture flow, selected keyboard behavior and settings were inspected in the cloud Chrome browser. The actual mesh modules passed geometry/lifecycle tests. **WebGL could not initialize in this browser, so GPU materials, animated output and sustained hardware performance are not verified.** Real microphone permission, recognition hardware and live provider speech/chat were not exercised.

The renderer reported that GL_VENDOR/GL_RENDERER were disabled and that a WebGL context could not be created. The automatic simplified fallback was observed. Later review URLs deliberately selected `renderer=svg` for deterministic still inspection. All after screenshots show that simplified geometry projection; none is presented as proof of the GPU path.

## Checks run

| Check | Result | What it proves / does not prove |
| --- | --- | --- |
| `node --test scripts/ui-state.test.mjs` | 10 pass, 0 fail | Seven state/routing/preferences/editable-boundary tests plus three actual core geometry lifecycle tests; no GPU, network or audio |
| `node scripts/smoke-fx.mjs --files` | All pass | Local homepage/legacy-asset contracts, core registration, renderer asset presence; not HTTP delivery or rendering quality |
| `node scripts/check-scripts.mjs public/index.html` | Exit 0 | Existing inline-script syntax check; the new app uses external modules, checked separately |
| `node --check` for app, scene, state, core and preview modules | Pass | Syntax, not runtime correctness |
| Root/public HTML byte comparison | Pass | Deployment mirror retained |
| `git diff --check` | Pass | No whitespace errors in tracked diff |
| Local HTTP smoke attempts | Could not complete | Terminal-side requests could not reach the supervised browser preview: loopback fetch failure and preview-host 502; browser itself loaded the app successfully |
| Billed chat/tool smoke scripts | Not run | They would invoke live providers/tools; no claim of live success |

The old smoke test initially required the former JPG homepage. Its superseded homepage assertions were updated for the focused interface while retaining legacy asset checks. A `--files` option provides explicitly labeled source-asset verification when terminal HTTP access is unavailable. Failed transport requests are no longer incorrectly treated as proof that an optional JavaScript file is absent.

## Actual browser checks

The development-only preview server injects a fixture fetch adapter only when `fixture=1` is requested. The page displays **LOCAL TEST · replies are fixtures**. It supplies a delayed successful reply or a deliberate 503 error. This script and these fixture endpoints are outside `public/`; they are not shipped with the production static assets.

Spoken replies were turned off before fixture chat checks. No real backend chat/TTS request was used to establish these results.

| Interaction | Observed result |
| --- | --- |
| Type `Draft 123`, then press `2` in the composer | Field contains `Draft 1232`; Thor remains selected |
| Switch Thor → Loki, create a Loki draft, return to Thor | Thor draft retained |
| Send fixture message | Thinking label appears; send button disabled while pending; reply appears and button recovers |
| Inspect successful reply | Paragraphs, list, code block and external reference link appear; bold text was corrected and confirmed in a subsequent reply |
| Send `simulate error` | Error shown; pending placeholder removed; send button re-enabled |
| Restore failed message | Original message returned to composer without sending automatically |
| Minimize/open conversation | Panel hidden and reopened; draft retained; focus returns to active composer |
| Open Settings, close with Escape | Dialog closes; focus returns to Settings button |
| Toggle spoken replies/still mode; change quality | UI values update; stored values observed in another page load |
| Open Settings at 320px | Icon-only button retains accessible name and keyboard focus outline |
| Inspect persona selection | Thor, Loki and Odin select their own headings, color accents and core module |

Voice overlap/timeout corrections were reviewed in source, not reproduced against real audio hardware. Full concurrent chat + speech + wake stress testing remains outstanding.

## Viewports and evidence

The browser has a fixed surrounding viewport. Exact app CSS viewports were created with a **development-only iframe wrapper**. These are desktop browser CSS-layout checks, not mobile-device emulation. The wrapper is not part of the deployed app.

| App CSS viewport | Inspection |
| --- | --- |
| 1440 × 900 | Baseline screenshot; upgraded desktop layout and fixture flow inspected earlier in the iteration; DOM width equals scroll width |
| 1280 × 900 | Final full-width desktop and conversation evidence, used to avoid the browser's oversized-capture issue; width/scroll width both 1280 |
| 1024 × 768 | Odin layout and corrected iris inspected; width/scroll width both 1024 |
| 390 × 844 | Loki phone layout inspected; final width/scroll width both 390; Start listening bounds observed at y=744–788 |
| 320 × 844 | Narrow layout and named Settings control inspected; width/scroll width both 320 |

During an earlier phone iteration a vertical scrollbar left 375px of content width in the 390px iframe. Reducing the scene/panel layout eliminated that initial overflow in the final 390px measurement. Long conversation content still intentionally scrolls inside its panel.

Image files are crops of genuine browser screenshots removing only the surrounding review page's white area. They are not image-generated mockups or composites. Some browser captures included the tool's pointer/focus overlay. Explicit oversized/clip screenshot requests intermittently timed out; default viewport captures succeeded and were cropped afterward.

- [Before desktop — 1440 × 900](evidence/before-desktop.jpg)
- [Before phone — 390 × 844](evidence/before-mobile.jpg)
- [After desktop — 1280 × 900, simplified still](evidence/after-desktop.jpg)
- [After conversation — 1280 × 900, fixture reply](evidence/after-conversation.jpg)
- [After compact desktop — 1024 × 768, simplified still](evidence/after-tablet.jpg)
- [After phone — 390 × 844, simplified still](evidence/after-mobile.jpg)
- [After narrow phone — 320 × 844, simplified still](evidence/after-narrow.jpg)

Final console samples showed browser-extension metadata errors originating from the cloud browser extension, rather than application script exceptions. Earlier WebGL initialization failure is separately recorded above. This is not a comprehensive certification of every console path.

## Geometry and resource evidence

The three core tests use the actual locally vendored Three.js geometry classes. Each core is initialized twice and exercised across four quality changes, five states, repeated updates and three camera sizes. Assertions inspect finite geometry attributes, valid indices, finite transforms, stable zero-time still poses, disposal events for reachable geometry/materials, root removal and harmless repeated disposal.

A separate CPU scene inspection at core quality 2 found:

| Core | Visible meshes | Triangles | Unique geometry objects | Materials |
| --- | ---: | ---: | ---: | ---: |
| Thor | 16 | 3,040 | 16 | 9 |
| Loki | 10 | 3,848 | 10 | 6 |
| Odin | 19 | 4,272 | 12 | 8 |

These counts include the core's own floor and exclude the host's architectural ribs. The still host hides the broad floor; High mode can enable reflection geometry. These are geometry counts, not measured draw calls or GPU memory. The local renderer/addon JavaScript totals approximately 788 KB uncompressed. No external model download was added.

Source-reviewed resource controls include one RAF owner, DPR caps, bounded frame deltas, hidden-page pause, a media-query listener, ResizeObserver cleanup, generation guards around persona imports, core disposal and fallback-image URL cleanup. The module registry is retained across sequential host creation so cached module imports remain usable. Concurrent multiple scene owners are not supported by these singleton core modules.

## Explicitly unverified

- GPU initialization on a supported Chromebook; environment maps, transparent floor/reflection ordering, physical materials and live state animation.
- Sustained frame time, battery usage, GPU memory and 30/60 FPS on a named physical device.
- Real microphone permission, recognition service, provider TTS and live backend success/billing.
- Hardware mobile keyboard, Safari/iOS voice differences, landscape device behavior and assistive-technology output.
- Actual operating-system reduced-motion toggling on a GPU-capable device. Still preference and core zero-time behavior were checked; the media-query integration was source-reviewed.
- Host-level repeated mount/unmount/context-loss stress and memory profiling. Core-level lifecycle tests are narrower.
- Production deployment and deployed cache behavior. Worker/config/backend code were not changed or deployed.

## Review gate

The change is suitable for a **draft review**, with a usable interface and documented evidence. Full acceptance of the rendered experience still requires a GPU-enabled browser pass and real-device voice/keyboard checks. Do not relabel those blocked checks as passed because the Node suite or screenshots succeeded.

## Remote delivery gate

An earlier review-branch push was blocked by automatic approval review for missing explicit upload authorization. No alternate path bypassed that rejection. Rayan subsequently approved GitHub upload and explicitly instructed: "push the changes directly to the main". That instruction supersedes the draft-PR plan.

Latest fetched `main`: `c9271f1a6df966ccc6a8015eace31e0c31f9aef2`. Its only divergent commit removes four backups; merging it into the prepared ASGARD result is conflict-free and produces an identical application tree. The final push must be a normal fast-forward update, never a force push. UI verification remains relative to the ASGARD baseline; prior ASGARD backend history brought onto the older main was not live-tested in this pass. No manual deployment is performed.
