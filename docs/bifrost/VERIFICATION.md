# Bifrost verification

Verified locally on September 7, 2026 (Pacific; September 8 UTC). Release proof is recorded separately in DEPLOYMENT.md.

## Source and browser checks

- Baseline: 29 existing tests and file smoke checks passed before changes.
- Final combined suite: **52 tests pass**, zero failures. `node --test scripts/hologram.test.mjs scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs scripts/conversation.test.mjs` — [log](evidence/tests.txt).
- **55 browser assertions pass**: [27 conversation/state checks](evidence/browser-interactions.txt), [21 rendering/layout checks](evidence/browser-visual.txt), [7 result/reading checks](evidence/browser-receipts.txt). Reproducible CLI files: `scripts/bifrost-{browser,visual,receipt}-check.js`.
- `node scripts/smoke-fx.mjs --files`, relevant module syntax, index mirror comparison and `git diff --check` pass. [Smoke log](evidence/smoke.txt).
- Wrangler 4.122.0 deployment dry run passes, preserving existing Worker-first assets, KV, R2, Vectorize, AI, ledger binding/migration and variables. [Dry run](evidence/deploy-dry-run.txt).
- `node scripts/index-backlog.mjs --check` reconciles 485 records: 445 capabilities plus 40 briefs/missions. Every public schema and persona list matches; no duplicate runtime IDs. [Inventory evidence](evidence/catalogue.txt).

Browser assertions cover per-persona drafts, duplicate-send prevention, late reply ownership, failure recovery without draft loss, cancellation scope, safe code/links, latest-message control, calculation and exported receipt, native dialog handoff/focus, still/reduced motion, repeated resource-stable switching, real orbit pixel changes, renderer failure with functioning chat, and no horizontal overflow at the tested widths. A phone defect found during review was fixed: focus stays within the compact conversation mode across controls and the visible viewport keeps Send reachable.

## Actual visual evidence

WebGL-path captures: [Thor](evidence/thor-desktop.png), [Loki](evidence/loki-desktop.png), [Odin](evidence/odin-desktop.png), [390px phone](evidence/loki-390x844.png), [320px phone](evidence/loki-320x844.png), [orbit](evidence/odin-orbit.png), [grayscale](evidence/odin-grayscale.png). Additional viewports: 1024×768 and 844×390. Still mode retains the full composition and stops the loop.

Interaction captures: [keyboard-sized viewport](evidence/phone-keyboard-viewport.png), [long conversation](evidence/long-conversation.png), [reply receipt](evidence/conversation-receipt.png), [recoverable failure](evidence/recoverable-error.png), [local action receipt](evidence/local-action-receipt.png). The [downloaded receipt](evidence/calculation-receipt.json) reconciles 100 × 25 = 2500 monthly and 30000 annualized; these are fixture inputs, not business metrics.

Fallbacks are separately tested: [software mesh projection](evidence/software-thor.png) and [renderer unavailable with working conversation](evidence/render-unavailable.png).

## Limits and measurements

The browser uses Three.js r185's actual WebGL renderer and compiles/paints the material shaders, but its ANGLE driver is **SwiftShader**, a CPU implementation of GPU APIs. This verifies WebGL shader/layout behavior; it is not physical GPU performance certification. The separate Canvas2D fallback uses shaded mesh triangles and depth-tested particles, with approximate painter ordering.

The environment has about 2.7 GiB RAM and swap. A 10-second balanced rendering sample is recorded in [performance.txt](evidence/performance.txt); it is a bounded measurement on this environment, not a 60 FPS claim. Repeated switching retains one canvas and stable per-persona renderer resource counts. Geometry disposal and hidden-document scheduling also have deterministic tests.

Local replies are explicitly labeled fixtures. They do not prove a live provider connection. Physical microphone/speaker behavior, a real phone's software keyboard, assistive technology and every external provider remain unverified. The keyboard test shrinks the visible viewport to 390×460 and checks actual Send bounds. Known provider credit, authentication, rate-limit and unavailable responses have bounded safe-message tests; hostile/oversized provider payloads are not exposed. Expected fixture 503 responses exercise errors; no uncaught application JavaScript errors pass the final interaction sweep.

CLI 0.153.4, Playwright CLI 0.1.19 and one reused headless Chrome browser were used. Three specialist agents had bounded disjoint assignments; heavy checks were serialized. No optimizer extension or global configuration change was made. Codex subscription/cache-token metrics were unavailable, so no token savings percentage is claimed.

## Final public release

Release `bifrost-9a1c6b9c4db0` matches all 19 public asset hashes/MIME, including root HTML. Query-versioned/no-cache fetches, legacy forwarder fingerprint and Thor redirect also pass. Six live browser UI assertions pass. The actual provider turn fails with insufficient credits, and the delivered UI displays the safe explanation and draft restoration. See [DEPLOYMENT.md](DEPLOYMENT.md), [live browser log](evidence/live-browser.json) and [live recording](evidence/live-bifrost.webm).
