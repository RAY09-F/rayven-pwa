# Real-data council HUD deployment

The user requested that no fabricated readings or activity appear in the HUD. The public root now uses the council HUD, with the full working conversation and voice interface preserved at `/hall/`.

## Actual behavior

- No reference-number fallbacks, scripted conversation turns, prewritten advisor responses, false session/latency, fake listening state or unmeasured activity bars.
- Actual stored calendar/events and timers; paper-trading records and market snapshots; timestamped system event records; per-persona recorded conversation history.
- Missing sources say Unavailable. A failed refresh clears stale readings. A quiet available event log says No recent events. Snapshot refresh is every 60 seconds while visible; recorded market marks are not streaming prices.
- Thor has no connected plan/milestone tracker. Decorative telemetry, council load, session identification and unsupported calendar duration/free-time measurements remain unavailable.
- Microphone is off in the HUD. Open conversation and Voice links lead to the established chat/voice controls. Paper trading remains explicitly simulated, not real-money trading.
- Long recorded conversations scroll without hiding controls. Realm artwork, themes and genuine rendered WebGL models are preserved.

## Verification and release lineage

171 main repository tests, 106 isolated release tests, and 20 focused follow-up tests passed. Browser checks covered source fixtures, failed fetches, empty versus unavailable data, all three WebGL scenes, preserved scene mounts, long message scrolling, and non-overflowing fields. Real deployed browser check returned no application exceptions. No provider chat, outgoing human message or microphone capture was used in these checks. Private conversation content is omitted from published evidence. Physical-device GPU frame rate is not established by software graphics tests.

Implementation commits: be16987, 2dd4943. Isolated production source: 71abd14 on deploy/solar-hud. Only the read-only HUD adapter changed under src; main's blocked brain waves remain excluded. Production bindings and runtime were compared with the starting version and remained unchanged. No purchases, old KV deletion or real-person messages.

Original version: ca4425cf-7e0a-40c6-a754-8f4c5f5ba8e7.
Compatible asset preload: 9572fac7-3a3f-4203-b5fa-a7ea47513299.
Final index candidate: bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f.
Release fingerprint: floating-5129bddde7ea.

Every upload and traffic change has a preceding version record in real-data-evidence. Asset preload first encountered an immediately-after-upload propagation mismatch; that observation failed and the entire five-minute timer was restarted. The fresh observation passed 11 samples over 319 seconds, and all 162 asset hashes/MIME records were verified before promotion. The final index has a separate 10% canary before 100% promotion.

Final index passed 11 successful samples over 319 seconds and was promoted to 100% at 2026-09-09T01:45:58Z. Version bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f is active at 100%. Both existing public hosts independently passed all 162 asset hashes without version overrides. A normal browser reload without overrides confirmed floating-5129bddde7ea, real WebGL, actual source-backed fields, microphone off, and no application exceptions. No Worker error events were observed during the rollout.

[Open the live HUD](https://asgrard-backend.rayanfahil2.workers.dev/#loki). [Open the preserved conversation controls](https://asgrard-backend.rayanfahil2.workers.dev/hall/#loki).

Evidence: real-data-evidence/final-status.json, index-observation.json, live-primary-assets.json, live-legacy-assets.json, canary-browser.txt and public-browser.txt. The source branch is deploy/solar-hud. GitHub push and Cloudflare deployment were separately verified.
