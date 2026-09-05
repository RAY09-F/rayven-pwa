# STRIKE THREE — progress file

Source spec: docs/ASGARD-MASTER.txt, Sections 1–3 (the design skill, the hall
blueprint, the arc cores). Branch: asgard-three-personas (the live branch).
Backup of the starting point: branch `pre-strike-three-backup` (2026-09-05, at
36436ec). If a session dies: "continue Strike Three from docs/STRIKE_THREE_PROGRESS.md".

Rayan was asleep for this run (2026-09-05, from ~05:50 Pacific). Nothing visual
has been seen by a human yet. Every frame rate and every look below is
**unverified** until he reads it back. The questions he needs to answer are
collected under NEEDS RAYAN'S EYES at the bottom.

## Where things stand

| Phase | Status | Commit |
|---|---|---|
| Section 1 — design skill | DONE: `.claude/skills/asgard-design/SKILL.md` installed and read | strike-three phase 1 |
| Section 2 — blueprint page | DONE minus the pictures: `public/halls-preview.html` is live; `public/img/{thor,loki,odin}.jpg` are MISSING (see below) | strike-three phase 1 |
| 3.0 — survey | DONE | strike-three phase 1 |
| 3.1 — the spike (Loki core on fx-lab) | BUILT, deployed, smoke ALL PASS, **look unverified** | strike-three phase 1 |
| 3.2 — Loki's hall | not started | |
| 3.3 — Thor and Odin | not started | |
| 3.4 — hub + council page | not started | |
| 3.5 — phone, still mode, access | not started | |

## Section 2 — the blueprint

`public/halls-preview.html` is the Section 2 page with the three `{{…}}`
placeholders replaced by `/img/thor.jpg`, `/img/loki.jpg`, `/img/odin.jpg`.
`public/img/` exists and is **empty**: the three approved pictures were not on
this machine, and the spec says never to substitute art. The page is live and
linked from nowhere; until the pictures land its stages show no art. **Rayan:
drop the three approved images into `public/img/` as `thor.jpg`, `loki.jpg`,
`odin.jpg` (1920×1080 JPEG, quality ~84) and redeploy — nothing else changes.**

Note on URLs: the Worker's asset handler redirects `/x.html` to `/x`, so the
links are `/halls-preview` and `/fx-lab`. Both spellings work in a browser.

## Phase 0 — survey (2026-09-05)

- Strike One is in place: `public/fx/asgard-fx.js` (v1 → now v2), the three
  realm backdrops, `scripts/patch.mjs`, `scripts/check-scripts.mjs`,
  `docs/STRIKE_ONE_ANCHORS.md`. The hall loads exactly one FX tag.
- **Strike Two is NOT on this branch**: `public/fx/hub.js` and `public/fx/team.js`
  do not exist, and there is no hub page under `public/`. `public/team.html`
  exists and is correct. Phase 4 has to account for this (see below).
- Served hall: `public/index.html` (wrangler `[assets] directory = ./public`);
  root `index.html` is a byte-identical copy. Neither was touched in this run.
- The hall already carries its own centrepiece: a **software-rendered 3D**
  block (canvas 2D, painter-sorted faces) drawing into `#coreCanvas`
  (z-index 3, opaque), which adds `html.machine-core`, hides `#reactorCanvas`
  and `#backdrop`, suspends the particle reactor and publishes
  `window.CoreFx`. It has no suspend API of its own; its loop follows
  `data-persona` and bails only on `body.hud-hidden` (the vault). This is what
  Phase 2 must make yield to the WebGL core — without a hall edit.
- The FX engine's back canvas is a raw WebGL context (webgl2 → webgl1 → 2D),
  half-resolution, created with `depth: false`, drawing the realm sky with a
  full-screen quad; an overlay 2D canvas at z-index 60 carries particles.
- Three.js: the hall pins `three@0.185.1` (ES module build) through
  `window.__loadThree` with the jsdelivr → unpkg → esm.sh mirror path.
- `public/team.html` CONFIG holds Odin's five (FRIGGA, FANDRAL, VOLSTAGG,
  HOGUN, HEIMDALL) with colours that differed from the skill's list; per Rule 8
  team.html wins, and the skill was corrected. Thor's and Loki's councillors
  are not in team.html; the skill's list applies to them. Their ids and names
  in `src/lib/council.js` match the skill.
- Live URL: https://asgrard-backend.rayanfahil2.workers.dev (the forwarder
  https://rayven-backend.rayanfahil2.workers.dev also serves it).
- `docs/asgard-design-book.pdf` is not present; the skill carries the spec.
- Pre-existing finding, not touched (Rule 13, nothing gets deleted): `public/`
  contains `hela3.html`, `h9.html`, and three `*3.html` / `*hud.html`
  experiments from August. Rayan should decide about the first two.

## Phase 1 — the spike (2026-09-05)

**Renderer decision (1.2):** Three.js, pinned `0.185.1`, the **ES module
build** (`build/three.module.js`, which imports `three.core.js` beside it) via
dynamic `import()` through the three mirrors. The spec's "UMD/min build" no
longer exists — Three.js removed it at r160 — so the module build is the only
option; it is the same file the hall already pins, so the browser fetches one
copy. Gem picking (Phase 2) will use `THREE.Raycaster`. Three.js r163+
requires WebGL2, so the core exists on the WebGL2 tier only; WebGL1 and 2D
tiers get the core's composed 2D fallback (`draw2d`) on the engine's 2D back
canvas (RENDER PATH then honestly reads 2D).

**Built:**
- `docs/CORE_MODULE_CONTRACT.md` — the contract (1.1), with what the engine
  hands a core and how it runs it.
- `public/fx/asgard-fx.js` v2 — the cores layer: `registerCore`, Three.js
  loading, one `WebGLRenderer` created **on the engine's existing context**
  (the context now asks for a depth buffer), full-resolution back canvas while
  a core is up, the realm sky rendered once into a half-size framebuffer and
  blitted each frame (the backdrop's static tier under a core), raw-GL ↔
  Three.js state hand-off each frame (`resetState`), quality-tier hooks,
  context-loss teardown, `?fx=0`, reduced motion, still frames skipped when
  nothing moves, `CORE …` line on the `?debug=1` overlay, `FX.status().core`.
  Pages opt in with `AsgardFX.init({ cores: true })`; **the hall does not opt
  in yet**, so nothing about the live hall changed.
- `public/fx/cores/loki.js` — the Loki arc core: a hexagonal bipyramid citrine
  crystal (flat-shaded, emissive from within, its own point light), three
  interlocking pearl ribbons with silver edges (a numeric search placed them so
  nothing touches: closest loop-to-loop 0.33, loop-to-crystal 0.43, all above
  the plinth), a three-step plum plinth with a silver rim, a dark polished
  floor with the relic mirrored beneath it as the "restrained reflection", a
  small baked environment map for the pearl/silver/floor, one key + one cool
  fill + one rim + hemisphere bounce. 6,816 triangles with the reflection,
  ~3,700 without. Idle drift ±3.4° over 34 s and slow ribbon spin; listening
  tightens the shell 10% and dims ambient; thinking is one quarter-turn over
  2.4 s that resolves; speaking tracks level and fires one ring + silver flare
  per peak (0.6 s refractory). Every pose has a 1.5 s deadline. `update(0)` is
  still mode.
- `public/fx-lab.html` — the spike page: engine + Loki core, `?debug=1`
  forced on, four state buttons (also keys 1–4), `?fx=0` shows a plain page.
- `scripts/smoke-fx.mjs` — the frontend smoke (live files, registrations, no
  fourth core file, the hall still loads one FX tag).

**Conservative defaults for unverified hardware (Rayan's instruction):**
DPR cap 1.25 (was 1.5); a browser with no stored tier starts at quality 2
(particles halved, bloom off); at quality ≥ 2 the core drops its floor
reflection, at ≥ 1 it drops ribbon iridescence. `?debug=1&q=0` shows the full
look for comparison.

**Verified without eyes:** `node --check` on every file; `check-scripts` on
both new pages; a Node harness ran the Loki module against the real
`three@0.185.1` build — 14 meshes, 6,816 triangles, no non-finite values,
2,160 frames across every state at ~40 µs of JS per frame, hostile deltas
(0, −1, NaN) rejected, dispose leaves nothing in the scene. Deployed
(version 332dbd2f…), `smoke-fx` and the backend `smoke` both ALL PASS
against the live URL.

**Not verified (cannot be, from here):** that it draws at all on a real GPU,
the frame rate, the look, whether the raw-GL/Three.js hand-off has a visual
glitch. These are the first questions below.

## NEEDS RAYAN'S EYES

1. **The spike.** Close the Linux terminal first. Open
   https://asgrard-backend.rayanfahil2.workers.dev/fx-lab?debug=1 on the
   Chromebook. Tell me: (1) the FPS number, (2) whether RENDER PATH says
   WebGL2 or 2D, (3) the CORE line — does it say `loki three tris …` or does it
   show `CORE ERR …` (read me the error), (4) does it look like a solid object
   sitting in a room, or flat, (5) press each of the four buttons — does
   anything look broken or cheap? Then the same page with `&q=0` on the end
   (full quality, reflection and iridescence on): FPS again, and does it look
   better enough to keep?
2. **The blueprint.** Put the three approved pictures in `public/img/` (see
   above), then open https://asgrard-backend.rayanfahil2.workers.dev/halls-preview
   and confirm the three halls look like the pictures.
