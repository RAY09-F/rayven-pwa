# ASGARD Council HUD

The three-realm HUD recreated from `design_handoff_asgard_hud/`. The handoff arrived in `Three-deity HUD system (1).zip`; the README was read in full before the prototype was opened.

The prototype ships without its `support.js` template runtime, so it renders as raw `{{ }}` holes as delivered. A throwaway shim (scratch only, not in the repo) implemented enough of `<sc-for>`, `<sc-if>` and the hole syntax to render all three realms in a browser and screenshot them as the comparison target.

## Where it lives

`/hud/` — a new page, served alongside the existing hall interface rather than replacing it. `public/index.html` is untouched. Promoting the HUD to `/` is a one-line change once you have looked at it.

## Files

- `public/hud/index.html` — the page shell: fonts, stylesheet, and the mount call.
- `public/ui/hud/hud-config.js` — one config object per realm. Theme vars, realm index, stage label, motif kind, nameplate, roster, telemetry, taglines, conversation, counsel and desk all live here, in the shape the README specifies.
- `public/ui/hud/hud.css` — the token table on `:root[data-realm]`, every keyframe, and all layout.
- `public/ui/hud/hud-view.js` — builds the DOM from a realm config. Nothing in it knows a realm by name.
- `public/ui/hud/hud-data.js` — fetches `/hud/summary` and merges live values over the design ones.
- `public/ui/hud/hud.js` — controller: realm state, hash routing, persistence, scene mounting, toggles, artboard scaling.
- `src/lib/hud.js` + `GET /hud/summary` — assembles the live panels from the subsystems that already hold the data.

## Theming

Every realm value is a CSS custom property on `data-realm` at the document root, transcribed from the README's table. No rule hard-codes a palette; the config module carries the same values for the parts JavaScript needs, and a test asserts the two agree.

`--anim` is the single shared play-state. Two details make it actually work:

- The declaration is `!important` and sits last. Every animation in the file is written with the `animation` shorthand, which resets `animation-play-state` to `running`; without that, any one shorthand would silently opt its element out of the freeze. This was caught by a browser check, not by reading the CSS.
- The `prefers-reduced-motion` rule carries a third attribute (`:root[data-realm][data-motion]`) so it outranks the realm rule. A media query contributes no specificity of its own, so the plain `:root` version the README implies never won.

Verified: all 56 animated nodes pause together on the toggle and under reduced motion, and resume.

## The 3D stage

The 520×300 octagon holds the app's real WebGL council, mounted from the existing scene factories — Astral Cartographer for Thor, Prism Foundry for Loki, Solar Throne for Odin. The octagon keeps its clip-path and `hudDrift`. Switching realms disposes the previous scene, so there is never more than one canvas.

Two scene behaviours are scoped down inside the HUD: the projected member labels are hidden, because the HUD already names the council in its own roster and nameplate and the labels spilled past the clip; and the click flash is made absolute rather than viewport-fixed. If the scene cannot start, the striped placeholder underneath stays visible and the rest of the HUD is unaffected.

## Live data

`GET /hud/summary` aggregates, in one round trip, the paper-trading desk, the todo list, the routines index and the activity log. It is read-only and unauthenticated, matching `/activity` and `/paper-trading/status`, which are its sources.

| Realm panel | Source | Wired |
|---|---|---|
| Odin PAPER DESK | `getPaperStatus` | Open positions, closed today, win/loss, net P/L, per-position rows, win-rate signal |
| Loki DAY BOARD | todos + routines index | Reminders, due today, open-reminder rows, due-today signal |
| Thor CAMPAIGN | todos + routines index | Active plans, steps done, on-track percentage and signal, plan rows |
| Ticker | activity log | Last eight events |

**A missing feed shows the design's number, never a blank or a zero.** The merge is per field: a stat the backend cannot source keeps its handoff value, and so does a row the backend did not supply. Two panels are only partly wired, and their remaining tiles are still design copy: Loki's FREE BLOCK and Thor's NEXT GATE have no source in this codebase, and Loki's MEETINGS currently counts enabled routines because there is no calendar integration.

One subtlety worth keeping: `src/lib/hud.js` reads todos and the routines index straight from KV rather than through `kv-store`'s `getTodos` or `routines`' `readRoutinesIndex`. Both of those swallow read errors and return an empty array, which the HUD cannot tell apart from "you genuinely have none" — so a KV failure would have rendered a confident `0`. Reading directly lets the error propagate, the realm reports nothing, and the design value stays on screen. A test covers exactly this.

## Deep links and persistence

`/hud/#thor`, `/#loki`, `/#odin`. The hash wins on load, then the last realm from `localStorage`, then Odin. Switching updates both the hash and storage; `hashchange` is honoured, so back/forward work.

## Fidelity

Artboard is a fixed 1600×900 scaled with `transform: scale(min(width/1600, 1.35))` under a `ResizeObserver`, as the README specifies. The left column measures exactly 746px against the 746px body row — the README calls this out as the constraint to re-verify after any content change, and a browser check asserts it.

Compared against the rendered prototype at the same size, excluding the octagon (placeholder there, live scene here):

| Realm | Mean absolute difference | Pixels differing > 24 levels |
|---|---|---|
| Thor | 2.29 / 255 | 1.91% |
| Loki | 2.27 / 255 | 2.05% |
| Odin | 2.60 / 255 | 2.05% |

The residual is animation phase: the two captures catch the ticker, orbit satellites, scan band, twinkles and radar sweep at different points.

One knowing deviation: the README describes Thor's nameplate ruler as "7-tick ... heights 9/5/5/12/5/5/9", but the prototype renders eight bars (9/5/5/12/12/5/5/9). The prototype is what the design looks like, so the port matches it.

## Verification

169 repository tests pass, eight of them new: the token table against an independent transcription and against the stylesheet, the keyframe inventory and its timings, the config shape for all three realms, deterministic bar timings, the live-value merge including per-field fallback, the ticker fallback, the backend assembler against a stubbed KV, and the degraded path where KV throws.

`scripts/hud-browser-check.js` asserts the artboard size, the 746px fit, that no micro-label wraps, and then for each realm: the accent token, display font, hash, persisted value, exactly one canvas, the mounted scene, roster and desk counts, and the switcher's pressed state. It then proves the freeze toggle and reduced motion pause every animated node. The live-data path was exercised separately against a stub backend; all three desks took live values while unsourced tiles kept their design copy.

Rendering used SwiftShader software graphics; frame rate on real hardware is unverified.

## Deployment

Live as of 2026-09-08 on `asgrard-backend`, version `ca4425cf-7e0a-40c6-a754-8f4c5f5ba8e7`. Rollback point is `46f1a08b-a239-4a8a-a688-3fafceef488f`.

Shipped from `deploy/solar-hud`, branched off `deploy/prism-foundry` — the deployed lineage, which deliberately excludes main's held-back backend work. Main's `src/` changes were **not** deployed; the only backend change in this release is the read-only `/hud/summary` route.

The index moved off the frozen `/ui/astral-v1/` copy back to `/ui/` with a `solar-hud-1` cache-buster. `astral-v1` stays in the bundle so clients holding a cached index keep working.

One bug reached production and was fixed in a follow-up deploy: Odin's desk rows read `unrealizedPnl` off open positions, but an open position in the paper payload carries only qty, entry price and stop — no mark price, so no P/L. Every row printed `+$0`. Rows now come from closed trades, which carry realised `pnl` alongside market and agent name. A test asserts no row can render `+$0` from an open position.

Known cosmetic issue, not fixed: switching realms disposes the previous scene, which calls `forceContextLoss()`, and three.js then logs a burst of `INVALID_OPERATION: object does not belong to this context` while releasing resources. It is noisy in the console but harmless — the incoming scene mounts and renders. The same disposal path is used by the main hall's switcher, so this predates the HUD.
