# ASGARD HUD — corrected implementation

The 1600×900 reference is recreated with the existing vanilla JavaScript/three.js stack. The custom template runtime is not shipped. The supplied HTML was opened in a browser and rendered with a temporary, scratch-only interpreter because its support.js is absent.

## Entry points and design

The prepared root index serves the HUD with `/#thor`, `/#loki`, and `/#odin`; the hash takes precedence over the saved realm. `/hud/` remains an alias. The prior full conversation interface is preserved at `/hall/`, linked by CHANNEL. SYSTEM opens its existing settings. Root `index.html` and `public/index.html` remain mirrors.

The original per-realm config strings and metric examples are unchanged. Theme tokens, fonts, fixed dimensions and keyframes remain governed by the handoff. Fonts are self-hosted with their OFL licenses. Micro-labels stay nowrap; long council domains use ellipsis with the full string in the title. The README's seven-tick Thor ruler is authoritative over the prototype's eight bars, and the small nameplate subtitle is 9.5px as specified.

## Scene and motion corrections

The existing Astral Cartographer, Prism Foundry and Solar Throne render inside the 520×300 octagon. The same motion state now pauses CSS and WebGL, including reduced-motion preferences. Data/setting refreshes retain the complete mounted scene container, rather than moving only its canvas away from the listeners and ResizeObserver. Scene selection emits a council-select event with realm and agent key. Source scenes keep their own model identities; the HUD roster retains the handoff's exact display names.

Summary refreshes run once per minute while visible, coalesce concurrent requests, and stop on disposal. Scene resources are disposed on realm changes; the browser checks prove exactly one canvas remains.

## Correct data sources

- PAPER DESK reads real paper status and open positions. Per-position P/L uses an explicit unrealized value or the latest stored candle with entry price and quantity; absent marks return null, never a fabricated $0. The candle timestamp travels in the response. NET P/L is the existing realized all-time paper total. Unavailable trade history is not misread as zero.
- DAY BOARD reads calendar:events and kit:timers. Meetings and due-today reminders use America/Los_Angeles dates. Meeting durations and free blocks remain unavailable when the stored calendar lacks duration data.
- CAMPAIGN has no dedicated plan/milestone source in this repository. Its source availability is false. Todos and scheduled routines are not relabeled as plans or milestones.
- The ticker combines the actual system event records from recent ticks with the activity log, newest first. It refreshes with the summary.

## Pending copy decision — do not deploy yet

The user explicitly requires approval before changing copy or numbers. We asked whether missing real data should display “Unavailable” or retain the handoff's sample values with a demo label. No explicit choice has arrived. The existing fallback-to-reference behavior is therefore still present in the frontend and must be resolved before publishing the root HUD. The corrected backend reports missing fields explicitly; do not misrepresent those fallback examples as live data. Static reference status/session/latency/voice readouts likewise still need the approved presentation for unsourced values.

The prior claim that routines were meetings/plans was incorrect and has been removed. No deployment was performed during this correction pass.

## Verification

Real browser checks cover all three root hash routes, persistence, one WebGL canvas, exact 746px left-column fit, CSS and WebGL pause, reduced motion, and preservation of the canvas/container through data refresh and settings changes. No application errors occurred in those checks. The backend tests cover actual calendar/timer sources, missing plan availability, cached position P/L and absent marks. Screenshots and browser output are in evidence/.

Graphics verification used SwiftShader; physical-device frame rates remain unmeasured. The deliberately scaled desktop artboard is retained on narrow screens per the handoff, rather than redesigned as a responsive layout.
