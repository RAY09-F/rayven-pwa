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
| 3.2 — Loki's hall | BUILT, deployed, smoke ALL PASS, **look unverified** | strike-three phase 2 |
| 3.3 — Thor and Odin | BUILT, deployed, smoke ALL PASS, **look unverified** | strike-three phase 3 |
| 3.4 — hub + council page | DONE as far as this branch allows (see below) | strike-three phase 4 |
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

## Phase 2 — Loki's hall (2026-09-05)

**The hall now gets the modeled core by default** (no hall edit: the engine
recognises the hall by `#coreCanvas` + `#chatLog` and opts in). What changed
on the live page, and only while WebGL2 + Three.js are actually available:
- The hall's own software-rendered centrepiece (`#coreCanvas`, canvas 2D) is
  made to yield: hidden by an injected class/style and shrunk to 1×1 so its
  untouched loop rasterizes nothing (its JS geometry pass still runs — a small,
  unmeasured cost). It comes straight back if the core is unmounted, fails,
  or the GL context is lost. `?fx=0` = the old page, untouched.
- `public/fx/cores/council.js` (2.1–2.3): five gems on plinths in a ring
  (radius 2.5, the front centre left open), one shared gem geometry with
  per-advisor colour, a vertex-coloured tether from each gem to the relic,
  four instanced markers per gem, names as HTML `<button>`s that ride their
  plinths at 15 Hz (transform only). **Selection** lights one tether and its
  markers and settles the rest; gem click (Raycaster), clicking the name, and
  keyboard focus are equivalent, focus lives on the HTML list, Escape clears.
  A small HTML sheet shows the advisor's four tool groups (+N more) — Odin's
  will show instrument / position / P&L / last trade, each tagged PAPER / SIM.
- **Real state (2.3a):** `/council/status` exists and is public, so the
  council polls it every 30 s; a gem ignites, streams a pulse down its tether
  and fires one ring **only** when a councillor's `lastRun` changed since the
  previous poll. The first poll only primes. A failed fetch leaves it dark.
- Panels (2.4): colour-only tuning of Loki's panels toward the blueprint
  (background, border, title colour); no layout property touched. Every panel
  keeps its data source. The transcript glow for Loki is now citrine.
- `public/fx/loki.js` (2.5): room palette retuned emerald → plum / petrol /
  citrine, values only (10 substitutions, structure untouched). The engine's
  fallback sky for Loki matches.
- Thor and Odin currently show their gems and tethers too once their cores
  exist (Phase 3); until then the hall keeps its software centre for them.

Verified without eyes: Node harness with a fake DOM — mount, 7.9k triangles
with the council at full quality, click-to-select through the real Raycaster,
Escape, focus mirroring, a poll that reports a new run → pulse → one ring,
15 Hz label transforms, dispose leaves nothing (0 objects, layer removed,
listeners removed). Deployed 53213cf6…; `smoke-fx` and backend `smoke` ALL
PASS. Chat, voice, wake word and persona switching were not touched by code:
the hall file is byte-identical to before Strike Three.

## Phase 3 — Thor and Odin (2026-09-05)

- `public/fx/cores/thor.js` — a hammer assembly: brushed-steel head with a
  cold-white (#EAF8FF) band of light held in it, silver striking faces,
  plum-wrapped haft with silver collar, ring and pommel, hovering inside two
  wide interlocking pearl shells with silver edges (placed by a numeric search:
  0.29 and 0.66 from the hammer, 0.46 apart, above the plinth). Storm-blue
  (#66C7FF) rim light. Thinking draws the shells in to 80% once and holds;
  speaking peaks land as **one discrete strike** — the hammer drops 0.14 and
  rebounds, the edges flash, one ring, a faint blue screen flash. 5.9k
  triangles with the reflection, 3.7k without.
- `public/fx/cores/odin.js` — a nested iris: eight gold (#D8AE5A) aperture
  blades hinged on a bronze ring over a light held at the centre, inside three
  nested toroidal pieces (pearl, bronze, pearl) that precess slowly. Listening
  opens the iris wider; **thinking closes it** in one 1.8 s build, holds, then
  opens to rest — it resolves, it never loops; speaking tracks level at the
  centre light, peaks flare once. Amber-bronze (#A56429) rim. 8.0k triangles
  with the reflection, 4.8k without.
- Both share Loki's plinth, floor, reflection, lighting rig and camera
  framing, so the three halls read as one world. Both have `draw2d` fallbacks.
- Realm switch (3.4): the engine already disposes the outgoing core and
  mounts the next behind the existing 600 ms wipe; the council is rebuilt for
  the new god (Odin's five with team.html's colours and PAPER / SIM rows).
  The fourth persona gets no core and the cores layer stays disposed while
  it is active.
- Verified without eyes: the Node harness mounted thor → loki → odin with the
  council three times over — no non-finite geometry, no NaN transforms,
  nothing left in the scene after any dispose, identical counts each cycle
  (no growth). Deployed cc230380…; `smoke-fx` and backend `smoke` ALL PASS.

## Phase 4 — the hub and the council page (2026-09-05)

- **4.1 The hub: nothing to do here.** There is no hub page on this branch
  (no `public/hub/`, nothing under `public/` calls itself the hub) and Strike
  Two's `public/fx/hub.js` was never built. The conditional FPS measurement
  the spec asks for therefore has no page to run on. Logged, not invented.
  (Part B's 6.8 wants a hub with three links; see that phase.)
- **4.2 team.html:** its renderer and CONFIG are untouched. New
  `public/fx/team.js` (one tag added before `</body>`) adds only overlays:
  palette alignment of the HTML chrome with the halls' base palette (ground
  → void #0B0A12, lines → plum), a static depth-of-field vignette and room
  dim (one CSS gradient, composited once), and a pointer light that follows
  the cursor as one pre-painted element moved by transform, ≤30 Hz, fading
  out after 2.5 s. It goes dark while the vault is open (follows the page's
  own `hidden` attribute). `prefers-reduced-motion` stops the light following;
  `?fx=0` does nothing at all. The realm-shift wipe was **not** added: the
  page's door links navigate away, and a wipe would only delay them.
  The council page shares the halls' palette and mood, not their geometry.
- Verified without eyes: `node --check`, `check-scripts` on team.html (its
  one script block still PASS), deployed fd557e6a…, `smoke-fx` (team.js live,
  exactly one overlay tag, CONFIG intact) and backend `smoke` ALL PASS.

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
2. **Loki's hall.** Open https://asgrard-backend.rayanfahil2.workers.dev/?persona=loki&debug=1
   (terminal closed). (1) FPS and RENDER PATH; (2) the CORE line — `loki three`
   or `CORE ERR …`; (3) is the centre the yellow relic on its plinth, with five
   gems and names around it — or the old software centre, or both at once?
   (4) click one gem, then a name, then press Tab a few times: does only that
   advisor's line light up and the rest settle, and does the little sheet
   appear? (5) say the wake word, send a message, get a spoken reply — all
   still fine? (6) switch to Thor and back to Loki three times — anything
   stutter, go black, or get slower? (7) do any of the labels sit on top of a
   panel or the chat box?
3. **Thor and Odin.** `/?persona=thor&debug=1` then `/?persona=odin&debug=1`:
   (1) FPS and the CORE line for each; (2) does Thor's centre read as a hammer
   held in two shells, and Odin's as an aperture ring inside rings — solid, not
   flat? (3) press speak to Thor and watch for the single strike on loud
   syllables; ask Odin something and watch the iris close once while he thinks;
   (4) switch Thor → Loki → Odin → Thor three times: anything stutter, go
   black, or get slower each time? (5) click an Odin gem: does the sheet show
   instrument / position / P&L / last trade, each marked PAPER / SIM?
4. **The council page.** Open `/team.html`: is the room a touch darker at the
   edges with a soft gold light under the cursor, and is everything you could
   do before still there (agents, tools, the console, VOICE ON)? Open the vault
   there once — does the overlay stay out of it?
5. **The blueprint.** Put the three approved pictures in `public/img/` (see
   above), then open https://asgrard-backend.rayanfahil2.workers.dev/halls-preview
   and confirm the three halls look like the pictures.
