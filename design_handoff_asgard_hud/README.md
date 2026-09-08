# Handoff: ASGARD — Three-Realm Council HUD

## Overview
A single full-screen HUD shell for ASGARD, an AI advisory app with three "realms" (personas): **Thor**, **Loki**, **Odin**. One frame, three skins: switching realm re-themes color, display typeface, background motif, telemetry, council roster, conversation copy, and the left-hand data module. The center is a stage for a live 3D council render (a placeholder in the design). Each realm also carries a domain-specific data module: Odin = paper-trading desk, Loki = meetings/reminders, Thor = campaign/plan momentum.

## About the Design Files
The file in this bundle (`Asgard HUD.dc.html`) is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. It uses a custom streaming-template runtime (`<x-dc>`, `{{ }}` holes, `<sc-for>`, `<sc-if>`) that is **not** part of any normal stack; treat it as a spec, not a dependency.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, SwiftUI, etc.) using its established patterns, component library, and theming layer. If no environment exists yet, pick the most appropriate framework and implement there. The theming maps cleanly onto CSS custom properties + a `data-realm` attribute on the root element.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, motion timings, and copy. Recreate pixel-accurately at the reference canvas size, using the codebase's own primitives where they exist.

## Canvas & Scaling
- Reference artboard: **1600 × 900 px**, fixed. Design is not responsive; it scales to fit.
- Scaling in the prototype: outer host measures its own width, sets `transform: scale(min(hostWidth / 1600, 1.35))` with `transform-origin: 0 0` on the artboard, and sets host height to `round(900 * scale)`. Re-run on `ResizeObserver` and `window.resize`.
- In production, the same thing is achieved with a CSS `zoom`/`scale` wrapper or by making the layout fluid — but all internal values below assume the 1600×900 grid.
- Root grid rows: `58px | 1fr | 26px | 70px` (top rail | body | ticker | bottom rail). Body row = 746px.
- Body grid columns: `300px | 1fr (900px) | 400px`.
- Overflow is hidden at the artboard; **the left column content must fit within 746px** (it currently measures exactly 746 — verify after any content change).

## Design Tokens

### Per-realm theme variables
Set these on the root element per active realm. All child styles reference the vars only.

| Var | Thor | Loki | Odin (default) |
|---|---|---|---|
| `--acc` | `#7bb0ff` | `#3ddc84` | `#e8c06a` |
| `--acc2` | `#b79cff` | `#e9c46a` | `#f6e3a1` |
| `--ink` | `#dfeaff` | `#d8f6e6` | `#f2e8d5` |
| `--dim` | `rgba(210,227,255,.66)` | `rgba(200,240,218,.66)` | `rgba(242,232,213,.64)` |
| `--bg` | `#050a16` | `#04100a` | `#07060a` |
| `--panel` | `rgba(12,22,46,.5)` | `rgba(8,26,18,.5)` | `rgba(24,19,13,.55)` |
| `--line` | `rgba(123,176,255,.20)` | `rgba(61,220,132,.20)` | `rgba(232,192,106,.20)` |
| `--glow` | `rgba(123,176,255,.20)` | `rgba(61,220,132,.18)` | `rgba(232,192,106,.16)` |
| `--display` | `'Cormorant Garamond', serif` | `'Cormorant Garamond', serif` | `'Cinzel', serif` |
| `--anim` | `running` / `paused` | same | same |

`--anim` is a single global animation play-state, referenced by **every** animated element as `animation-play-state: var(--anim)`. One toggle freezes the whole HUD.

### Fixed crystal hues (council members, counsel card, stat deltas)
`violet #b98cff` · `crimson #ff6b6b` · `gold #f4d17a` · `azure #6ea8ff` · `jade #4ade80`
Delta colors: positive `#4ade80`, negative `#ff8a7a`, neutral `var(--ink)`.

### Typography
- Fonts (Google): **Cinzel** 400/600, **Cormorant Garamond** 300/400/600, **IBM Plex Mono** 300/400/500.
- Body/UI font: `'IBM Plex Mono', monospace` everywhere except display type.
- Display font: `var(--display)` — wordmark, realm name in top rail, big realm nameplate, stat tile values.
- Scale in use: `9.5px` micro-labels (telemetry, taglines, ticker, session readouts), `10px` section taglines, `10.5px` labels/pills, `11px` section headings + council names, `11.5–12px` message/counsel body, `18px` stat values, `19px` wordmark, `58–62px` nameplate.
- Letter-spacing is the signature: micro `.14–.2em`, labels `.22–.3em`, headings `.3em`, wordmark `.42em`, nameplate `.16–.2em`.
- **Every micro-label and tagline must be `white-space: nowrap`** — at 9.5px in flex rails they otherwise wrap mid-phrase.
- No border radius anywhere except circles (`50%`) and the voice pill (`22px`). Hairlines are `1px solid var(--line)`.

## Screens / Views
One screen, three realm states. Regions top to bottom:

### 1. Top rail (58px)
`display:flex; align-items:center; gap:20px; padding:0 24px; border-bottom:1px solid var(--line); background:linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,.25))`
- `ASGARD` wordmark — `var(--display)`, 19px, `.42em`, `var(--ink)`.
- 1px × 22px divider (`var(--line)`).
- Realm name (`THOR` / `LOKI` / `ODIN`) — `var(--display)`, 16px, `.34em`, `var(--acc)`, `text-shadow: 0 0 18px var(--glow)`.
- Realm index — 10px, `.26em`, `var(--dim)`. Thor `07 / THE ASTRAL CARTOGRAPHER`, Loki `09 / THE BIFROST PRISM FOUNDRY`, Odin `13 / THE SOLAR THRONE`.
- Spacer, then status cluster (9.5px, `.2em`, `var(--dim)`, nowrap, gap 16): pulsing 5px accent dot + `LINK STABLE` (ink), `SESSION ASG-441`, `LAT 18 MS` (values in `var(--acc)`), then a 5-bar equalizer (2px bars, 12px tall, `hudBar` 1.1–2.3s staggered).
- Divider, then nav: `COUNCIL` (active, `var(--ink)`, with a 4px rotated-45° accent diamond 9px below center), `CHANNEL`, `SYSTEM` (`var(--dim)`, hover → `var(--ink)`), 11px, `.2em`, gap 26.
- Divider, then 3-bar voice meter + `VOICE ON` + `⌘K` in a 1px box (4px 8px padding).

### 2. Left column (300px) — council + realm data module
`border-right:1px solid var(--line); padding:16px 20px 14px; flex column; gap:12px; background:linear-gradient(90deg,rgba(0,0,0,.45),transparent)`
1. Header: `COUNCIL` 11px `.3em` ink · flexible hairline · 4px accent diamond.
2. Two-line realm tagline, 10px, `.24em`, `line-height:1.7`, `var(--dim)`, nowrap:
   Thor `FIVE BEARINGS.` / `ONE HEADING.` — Loki `FIVE MIRRORS.` / `ONE WAY THROUGH.` — Odin `FIVE PERSPECTIVES.` / `A CLEARER TOMORROW.`
3. **Council list** — 5 rows, `gap:8px`. Row: `display:flex; align-items:center; gap:12px; padding:6px 10px; border:1px solid var(--line); background:var(--panel)`; hover → `border-color:var(--acc)`. Contents: index `01`–`05` (9.5px, dim, 14px wide) · 11px square rotated 45° filled with the member hue + `box-shadow:0 0 14px <hue>` · name (11px, `.24em`, member hue) · domain (9.5px, `.16em`, dim, 3px top margin).

   | # | Hue | Thor | Loki | Odin |
   |---|---|---|---|---|
   | 01 | violet | SIF — STRATEGY · TERRAIN / MAPPING | SIGYN — LOYALTY · CONSTRAINT / TRUTH | FRIGGA — FORESIGHT · TRENDS / MOMENTUM |
   | 02 | crimson | TYR — DECISIONS · RISK / RESOLVE | FENRIR — APPETITE · SCALE / BREAK | VOLSTAGG — SUPPLY · GROWTH / PEOPLE |
   | 03 | gold | BALDR — CLARITY · SIGNAL / LIGHT | ANGRBODA — WILD IDEAS · CHANCE / SEED | HEIMDALL — WATCH · GEO / ALERTS |
   | 04 | azure | VALKYRIE — ROUTES · MOMENTUM / SPEED | JORMUNGANDR — LOOPS · SYSTEMS / RECURSION | HOGUN — MACRO · FLOW / DISCIPLINE |
   | 05 | jade | MODI — FORCE · EXECUTION / DRIVE | HEL — ENDINGS · CLEANUP / COST | FANDRAL — RISK · EXECUTION / NERVE |

4. Flexible spacer.
5. **Realm data module** — `padding:11px 12px; border:1px solid var(--line); background:var(--panel); flex column; gap:9px`.
   - Header: 5px accent diamond · title (10.5px, `.26em`, ink, nowrap) · hairline · meta (9.5px, `.16em`, dim, nowrap).
   - Stat grid `2×2`, `gap:9px`; tile = `padding:6px 9px; border:1px solid var(--line); background:rgba(0,0,0,.35)`; label 9.5px `.16em` dim; value `var(--display)` 18px, `line-height:1.2`, nowrap, colored by delta tone.
   - Three rows: label (dim, ellipsis on overflow) · flexible hairline · value (delta color), all 9.5px `.14em`.

   | | Thor — `CAMPAIGN` / `PLANS` | Loki — `DAY BOARD` / `TODAY` | Odin — `PAPER DESK` / `SIM` |
   |---|---|---|---|
   | Stats | ACTIVE PLANS 5 · STEPS DONE 23/31 · ON TRACK 74% ↑ · NEXT GATE 2D 06H | MEETINGS 4 · REMINDERS 9 · DUE TODAY 3 ↓ · FREE BLOCK 2H 40M ↑ | TRADES OPEN 7 · CLOSED TODAY 12 · WIN / LOSS 68 / 32 ↑ · NET P/L +$4,182 ↑ |
   | Rows | LAUNCH ROUTE · SIF → ON TRACK ↑ · HIRING LEG · MODI → AT RISK ↓ · CAPITAL RUN · TYR → CLEAR ↑ | 10:30 · STANDUP → 25M · 14:00 · DESIGN REVIEW → 1H · REMIND · CALL BACK KARI → 18:00 ↓ | ETH LONG · FRIGGA → +$612 ↑ · BTC SHORT · FANDRAL → −$188 ↓ · GOLD LONG · HEIMDALL → +$1,204 ↑ |

   All numbers are placeholders — wire to real feeds (portfolio/paper-trading API for Odin, calendar for Loki, plan tracker for Thor).
6. Footer: 3-segment hairline (middle segment `var(--acc)` at .6 opacity) + two-line realm footer, 9.5px `.22em` dim nowrap:
   Thor `THE MAP IS NOT THE STORM.` / `WALK IT ANYWAY.` — Loki `NOTHING IS FIXED.` / `THAT IS THE GOOD NEWS.` — Odin `DIFFERENT PERSPECTIVES.` / `A STRONGER YOU.`

### 3. Center stage (flex 1, ~900px)
`position:relative; flex column; align-items:center; justify-content:center; gap:26px`
- Four 44px corner brackets inset 18px, `1px solid var(--acc)`, opacity .55.
- Vertical rotated label `THE THREE REALMS` at left (`writing-mode:vertical-rl`, 9.5px, `.44em`, dim).
- Telemetry: two readouts top-left (74px in, 30px down) and two top-right, `key` dim + `value` accent, 9.5px `.2em`, gap 7:
  Thor `BEARING 041.6°`, `ALTITUDE 12 400`, `DRIFT 0.03`, `WIND 7 KT` — Loki `PHASE 0.618`, `FACETS 07`, `VARIANTS 12`, `SEED 4A9` — Odin `AURUM 1.000`, `COUNCIL 5/5`, `DEPTH IX`, `RING 09`.
- Stage label bottom-center, hairline–text–hairline, 9.5px `.3em` dim: Thor `CHART / SECTOR IV`, Loki `FORGE / PRISM 03`, Odin `THRONE / SOLAR RING`.
- **Stage container** 640 × 430, centered. Layered back to front:
  1. 600px degree-tick ring: `repeating-conic-gradient(from 0deg, var(--acc) 0 .35deg, transparent .35deg 5deg)` masked to a ring via `radial-gradient(circle, transparent 0 289px, #000 289px 300px, transparent 300px)`, opacity .5, `hudSpinR 160s linear infinite`.
  2. 340px breathing halo: `radial-gradient(circle, var(--glow), transparent 70%)`, `hudBreathe 6s`.
  3. Three orbit rings (600 / 520 / 440px) each rotating (`hudOrbit` 24s, 17s reverse, 31s) with one satellite pinned at 12 o'clock: 8px accent diamond, 6px `--acc2` dot, 5px ink dot; all with matching glows.
  4. Realm motif (see below).
  5. Two callout tags with connector line + 5px diamond — top-left and bottom-right, `padding:5px 9px; border:1px solid var(--acc); background:rgba(0,0,0,.6)`, 9.5px `.22em` accent: Thor `NODE 03 / LOCKED` + `VECTOR / +0.42`, Loki `FACET 07 / SPLIT` + `VARIANT / 12`, Odin `RING 09 / SEALED` + `AURUM / 1.000`.
  6. 560 × 340 pulsing target brackets (four 26px L-corners, `hudPulse 3s` staggered .4s).
  7. **Render placeholder** 520 × 300: `border:1px solid var(--line)`, striped `repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 2px, transparent 2px 10px)` over `rgba(0,0,0,.5)`, octagon `clip-path: polygon(26px 0, calc(100% - 26px) 0, 100% 26px, 100% calc(100% - 26px), calc(100% - 26px) 100%, 26px 100%, 0 calc(100% - 26px), 0 26px)`, `hudDrift 12s`. Holds a 22px rotated square outline + `COUNCIL RENDER · 3D STAGE` + `DROP THE REALM SCENE HERE`. **Replace with the live 3D council scene** (the app's existing WebGL/three.js view) — keep the octagon clip and drift.
- **Realm motif layers** (only the active realm's):
  - *Thor (astral cartographer)*: 420px solid ring, 520px dashed ring (`hudSpin 90s`), 520px radar sweep `conic-gradient(from 0deg, var(--glow), transparent 28%)` at opacity .5 (`hudSpin 9s`), plus full-width/height crosshair hairlines fading at the ends.
  - *Loki (prism foundry)*: 470px accent ring `hudSpin 40s` (.28), 430px `--acc2` ring `hudSpinR 26s` (.26), 380px square rotated 45° `hudSpin 60s` (.16), and a 300px blurred prism `conic-gradient(from 200deg, var(--acc), transparent 30%, var(--acc2), transparent 70%)`, opacity .14, `filter:blur(18px)`, `hudSpinR 18s`.
  - *Odin (solar throne)*: 560px four-lobe sun-ray `conic-gradient` of `var(--glow)` at opacity .45 (`hudSpin 70s`), 420px ring (.3), 340px ring (.18), and a 200px aperture `conic-gradient(var(--acc), #3a2b10, var(--acc2), #3a2b10, var(--acc))` at .22 with `blur(6px)`, `hudSpin 34s`.
- **Nameplate** — distinct per realm (this is the main typographic personality):
  - *Thor*: `THOR` in `var(--display)` 300 weight, 62px, `.16em`, ink, `text-shadow:0 0 40px var(--glow)`; below, gradient hairline + `PRINCE OF ASGARD · THE NORTH VOICE` (9.5px `.34em` accent) + hairline; then a 7-tick ruler (1px bars, heights 9/5/5/12/5/5/9); then `MAP THE NEXT STEP.` (9.5px `.26em` dim).
  - *Loki*: two stacked copies of `LOKI` — a `--acc2` ghost at opacity .5 with `hudSplit 5s` offset, over an ink copy with `hudFlick 7s steps(1,end)`; below, diamond outline + `GOD OF MISCHIEF · THE ONE WHO MAKES` + second diamond; then `GIVE POSSIBILITY A SHAPE.` deliberately offset 26px right (off-axis on purpose).
  - *Odin*: double gradient rules above (260px + 180px), `ODIN` in Cinzel 600, 58px, `.2em`, `var(--acc2)`, `text-shadow:0 0 46px var(--glow)`, flanked by two 8px glowing accent diamonds 22px out; `ALL FATHER · THE SOURCE` (9.5px `.4em` accent); mirrored double rules below; `PAPER / SIM · FIVE PERSPECTIVES` (9.5px `.26em` dim).

### 4. Right column (400px) — conversation
`border-left:1px solid var(--line); padding:22px 20px 20px; flex column; gap:16px; background:linear-gradient(270deg,rgba(0,0,0,.45),transparent)`
- Header: `CONVERSATION` (11px `.3em` ink) · hairline · micro tag (9.5px `.2em` dim, nowrap): Thor `STEADIER HANDS. TRUER LINES.` — Loki `STRANGER ANGLES. BETTER ODDS.` — Odin `CLEARER THINKING. BRIGHTER MOVES.`
- Messages (gap 12):
  - *Assistant*: 26px circle avatar `1px solid var(--acc)` on `rgba(0,0,0,.5)` holding a 7px pulsing accent diamond (`hudPulse 3.4s`); realm name label above (9.5px `.26em` accent); bubble `padding:11px 13px; border:1px solid var(--line); background:var(--panel)`, 12px, `line-height:1.65`, ink, `text-wrap:pretty`.
  - *User*: right-aligned, `max-width:78%`, `border:1px solid var(--acc); background:var(--glow)`.
  - Copy — Thor: "The chart is live. Where are we going?" / "Turn this idea into a plan." / "Give me the goal. I'll lay the route — five bearings, one heading." · Loki: "What's on your mind?" / "Show me another way through this." / "Every shape holds another. Let me find the one no one expected." · Odin: "Ready when you are." / "Help me shape the next step." / "Let's look at this with all five perspectives and find the clearest path forward."
- Listening strip: 26px empty circle + 26-bar waveform (22px tall, `hudBar` .6–1.7s staggered, accent at .6) + `LISTENING` (9.5px `.2em` dim).
- `COUNSEL` header + micro tag: Thor `FIVE BEARINGS. ONE HEADING.` — Loki `FIVE MIRRORS. ONE WAY THROUGH.` — Odin `FIVE PERSPECTIVES. ONE DIRECTION.`
- Counsel card: `padding:14px; border:1px solid var(--line); background:var(--panel)`, hover → accent border; 14px rotated diamond in the member's hue with glow; member name (11px `.26em`, hue); body (11.5px, `line-height:1.7`, dim, `text-wrap:pretty`); `›` chevron.
  Thor — **VALKYRIE** (azure): "The fastest route is not the surest. Two waypoints cost you a day and save you a week." · Loki — **JORMUNGANDR** (azure): "You have solved this before. The loop is the lesson — break it or ride it." · Odin — **VOLSTAGG** (crimson): "Consider where supply, growth, and people dynamics align for the next step."
- Spacer, then composer: `padding:12px 14px; border:1px solid var(--line); background:rgba(0,0,0,.45)`; placeholder `Speak to <Realm>…` (11.5px dim); 32px mic circle (hover → accent border); 32px send circle filled `var(--acc)`, glyph `#0b0803`, `box-shadow:0 0 22px var(--glow)`.
- Footer row: `ENTER TO SEND` / realm index, 9.5px `.2em` dim.

### 5. Ticker row (26px)
`overflow:hidden; border-top:1px solid var(--line); background:rgba(0,0,0,.5)`. Two duplicated nowrap spans, 9.5px `.3em` dim, `hudTicker 46s linear infinite` (`translateX(0 → -50%)`), padding `0 24px`:
`COUNCIL SYNCED · FIVE PERSPECTIVES ONLINE · BIFROST LINK STABLE · YGGDRASIL INDEX 0.997 · MEMORY WRITTEN 14:02 · RAVENS DISPATCHED · WELLS DEEP · GATES OPEN ·` (repeat). Swap for live system events in production.

### 6. Bottom rail (70px)
`display:flex; align-items:center; gap:22px; padding:0 24px; border-top:1px solid var(--line); background:linear-gradient(0deg,rgba(0,0,0,.75),rgba(0,0,0,.2))`
- 34px circle (`1px solid var(--acc)`) containing an 11px rotated square outline in `var(--acc2)`.
- 240px `COUNCIL LOAD` meter: label row (dim / value in accent — Thor `ON TRACK 74%`, Loki `3 DUE TODAY`, Odin `WIN RATE 68%`), then 6 segments 4px tall gap 3: three filled accent with glow, one at .55 opacity pulsing (`hudPulse 2.6s`), two `var(--line)`.
- Spacer, then **realm switcher**: three pills `padding:11px 40px; border:1px solid var(--line)`, 10.5px `.34em`, dim, hover → ink, gap 14. Active pill gets an inset overlay `inset:-1px; border:1px solid var(--acc); box-shadow:0 0 26px var(--glow), inset 0 0 22px var(--glow)`.
- Spacer, then voice pill: `padding:9px 15px; border:1px solid var(--line); border-radius:22px`, 4-bar meter + `VOICE` + `⌄`.
- Three-line realm tagline, right-aligned, 9.5px `.24em`, `line-height:1.9`, dim, nowrap: Thor `CHART IT. / HOLD THE LINE. / STRIKE ONCE.` — Loki `TWIST IT. / TEST IT. / TAKE IT.` — Odin `THINK DEEPER. / SEE FURTHER. / MOVE WISER.`

### Global overlays (all `pointer-events:none`)
1. Vignette + glow: `radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.05), transparent 60%)` + `radial-gradient(90% 70% at 50% 110%, var(--glow), transparent 65%)`, opacity .5.
2. 40px hairline grid from two `linear-gradient`s, opacity .16.
3. Perspective floor: bottom-fading vertical lines every 79px + bottom glow, masked `linear-gradient(180deg, transparent 62%, #000)`, opacity .5.
4. 1180px triple rune ring centered at 44% height, `hudSpin 220s`, opacity .35.
5. Six twinkling 2px star points (`hudTwinkle` 3.6–7s, staggered) at fixed percentages.
6. Left/right 14px edge tick rails: `repeating-linear-gradient(180deg, var(--line) 0 1px, transparent 1px 26px)`.
7. Scanlines (toggleable): 1px/3px `repeating-linear-gradient(rgba(255,255,255,.03))` with `mix-blend-mode:overlay`, plus a 120px glow band sweeping top→bottom (`hudScan 7.5s`), both `z-index:9`.
8. Inner shade: `box-shadow: inset 0 0 200px rgba(0,0,0,.85)`, `z-index:10`.

## Interactions & Behavior
- **Realm switch** — clicking a bottom-rail pill sets the active realm: swaps all theme vars, display font, motif, nameplate, council, telemetry, taglines, conversation, counsel, and data module. Instant in the prototype; a 200–300ms cross-fade of the theme vars is a reasonable production upgrade. Deep-link it (`/#thor`, `/#loki`, `/#odin`) and persist last realm.
- **Hover** — council rows and the counsel card lighten their border to `var(--acc)`; nav items and switcher pills go `var(--dim)` → `var(--ink)`; the mic circle border goes accent.
- **Motion inventory** (all CSS keyframes, `animation-play-state: var(--anim)`):
  `hudSpin` / `hudSpinR` rotate 360° (9s radar → 220s rune ring) · `hudOrbit` satellites 17/24/31s · `hudPulse` opacity .3→.95 (2.2–3.4s) · `hudBar` `scaleY(.25→1)` (.6–2.4s, staggered) · `hudTicker` `translateX(0→-50%)` 46s · `hudTwinkle` opacity .12→.85 · `hudBreathe` opacity + `scale(1.04)` 6s · `hudFlick` step-flicker for Loki's wordmark 7s · `hudSplit` 3px/-2px chroma offset 5s · `hudDrift` ±5px 12s · `hudScan` scanline band 7.5s.
- **Reduced motion** — respect `prefers-reduced-motion` by setting `--anim: paused` (the prototype exposes this as a `motion` toggle).
- **Toggles exposed in the prototype** (keep as settings or props): `god` (`thor|loki|odin`), `scanlines` (bool), `telemetry` (bool, shows/hides the four center readouts), `motion` (bool).
- Not built (deliberate): real chat send, voice capture, nav routing to Channel/System, drilling into a counsel card, 3D scene interaction.

## State Management
- `realm: 'thor' | 'loki' | 'odin'` — the only real UI state; everything else derives from a per-realm config object.
- `scanlines`, `telemetry`, `motion` — booleans.
- `scale` — derived from container width; recompute on resize (`ResizeObserver` + `window.resize`).
- Config shape per realm (mirror this in the target codebase):
  `{ vars, realm, stageLabel, signal, tagA, tagB, leftTag[2], foot[2], bottom[3], microTag, counselTag, telemetry[4]{k,v}, council[5]{name,domain,hue}, msgs[3]{bot|user,text}, counsel{name,hue,line}, desk{title,meta,stats[4]{k,v,t},rows[3]{k,v,t}} }`
- Data fetching to wire up: paper-trading positions/P&L (Odin), calendar + reminders (Loki), plan/milestone tracker (Thor), system event stream (ticker), voice/connection status (top rail).

## Assets
- **Fonts**: Google Fonts — Cinzel, Cormorant Garamond, IBM Plex Mono. Self-host in production.
- **No images or icon files.** Every mark is CSS: rotated squares for crystals/diamonds, circles for avatars/buttons, gradients for rings and rays, 1px divs for bars and ticks. Text glyphs used: `⌘K`, `➤`, `›`, `⌄`.
- **The 3D council render is missing** — the 520 × 300 octagon is a placeholder for the app's existing three.js council scene.
- Reference screenshots of the original app (Thor / Loki / Odin) live in the project's `uploads/` folder; they informed the copy and color, not the layout.

## Files
- `Asgard HUD.dc.html` — the full HUD prototype (all three realms, switcher in the bottom rail). Template markup + a logic class holding the per-realm config; theme vars are applied to the root element imperatively on realm change.

## Note on naming
Council members use Norse-mythology names (Sif, Tyr, Baldr, Modi, Sigyn, Fenrir, Angrboda, Jormungandr, Hel, Frigga, Volstagg, Heimdall, Hogun, Fandral). If the product uses different advisor names, they are pure config — swap the strings in the realm config, keep the hues.
