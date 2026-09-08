# Floating realms browser verification

Baseline: fetched `origin/main` at `e877cad` into the isolated `codex/floating-verified` worktree. Original checkout and untracked user files were preserved.

## Corrections

- Center dragging now keeps placement separate from the hover offset, preventing accumulated vertical jumps. Tethers update after center placement.
- Keyboard Arrange controls and pointer dragging share center root placement, status and per-persona saved position.
- Nameplates follow the actual animated stone tips. Collision resolution shifts labels sideways or upward, never down onto their stone. Layout measures the real label dimensions; compact labels use 32px targets to avoid crowding adjacent stones. Camera framing leaves room at the upper drag bounds while staying frontal and fixed during dragging.
- Animation advances with elapsed frame time up to a bounded 250ms step, so a slow renderer does not reduce motion to a barely perceptible crawl. Pause and reduced motion remain explicit.
- Release metadata and cache versions identify the Floating Realms correction.

The scene remains genuine Three.js geometry, including the hammer, faceted crystal, architecture, independently animated rings, advisor stones and GPU particle field. No reference photographs are loaded into the scene. Existing HUD, chat and backend routing are retained.

## Reproduction

Serve `node scripts/ui-preview.mjs --port 4173`. Use Playwright CLI with a real WebGL-capable Chrome session. Run `scripts/floating-browser-check.js` separately at 1440×900, 390×844 and 320×844; it checks the current viewport width and captures default and both drag-bound arrangements. Run `scripts/floating-pointer-check.js`, `scripts/floating-motion-check.js` and the existing `scripts/bifrost-browser-check.js` against the local fixture server.

Source checks:

```sh
node --test scripts/reference-realms.test.mjs scripts/floating-realms.test.mjs scripts/ui-state.test.mjs scripts/conversation.test.mjs scripts/nameplate-layout.test.mjs
node scripts/smoke-fx.mjs --files
```

Browser evidence is captured from Headless Chrome 152 using ANGLE SwiftShader on this Linux environment. This establishes actual WebGL shader execution and browser interaction; it does not certify physical Chromebook GPU performance, physical-phone touch feel or microphone permissions. Individual native touch events are exercised through Chrome's input protocol. Focus-loss cancellation is dispatched as a browser window blur event.

Final results and the separate Cloudflare deployment receipt will be recorded in DEPLOYMENT.md. Earlier `docs/reference-realms` receipts describe an older release.
