# ASGARD — setup notes for Rayan

RAYVEN is now **ASGARD**: three assistants — **THOR** (personal, the default, formerly RAYVEN), **LOKI** (to-dos, reminders, wellbeing), **ODIN** (business, revenue, strategy) — sharing one worker, one KV, one home. Plus one thing that is not listed anywhere.

## What already works with zero new setup

- Web chat with all three personas (the frontend sends `persona` with each message; unknown/missing falls back to THOR, so old cached PWAs keep working).
- The existing Telegram bot (RAYVENN_RAYAN_BOT) still lands on `POST /` and now speaks as THOR. **Its username, the worker URL, and the `/agent/query` contract are unchanged — the JARVIS federation link is intact.**
- Telegram webhooks now ack immediately with `update_id` dedupe — long turns can no longer double-fire.
- Per-persona memory namespaces (THOR inherits the old `memory:longterm` store — nothing was lost), per-persona history, tool allow-lists enforced at dispatch, tool loop raised 6 → 14.
- `send_text` / `make_call` are hardwired to **confirm** — not policy-editable.
- New endpoints: `GET /ping`, `GET /status`, `POST /roundtable`, `GET /memory/map`, `POST /memory/share`, `POST /memory/update`, `POST /telegram/<persona>`, `GET /debug-autonomy`, `GET /debug-selfcheck`.
- Per-persona autonomy on the 5-min cron (capped 3/day each, 9am–9pm Pacific): LOKI's nag engine (overdue to-dos escalate, never repeat), ODIN's strategy pulse, THOR's real-call integration self-check. All visible on the ops floor / `GET /status`.

## Where the app lives

**The PWA is live at https://asgrard-backend.rayanfahil2.workers.dev/** — served straight from the worker (`[assets]` in wrangler.toml, from `public/index.html`, a copy of the repo-root file). `run_worker_first = true` is required in that config: without it Cloudflare's static-asset handler claims `/` for every HTTP method, not just GET, which silently 405'd both web chat and the Telegram webhook the first time assets were turned on. All POST routes (chat, Telegram webhooks, `/agent/query`) are otherwise untouched by asset serving.

Source of truth on GitHub: **https://github.com/RAY09-F/rayven-pwa** (public). The daily self-code-check in `src/lib/checkin.js` still points at the old placeholder `rayanfahil` account — update `fetchGitHubSource`'s URLs to `RAY09-F/rayven-pwa` when you want that check to actually run against real source instead of silently 404ing.

## Frontend (index.html)

- **Unlock passphrase: `bifrost`** — change the `UNLOCK_PASSWORD` const near the top of the HUD script. Boot cinematic plays on real password entry only; typing `lock` (exactly) locks instantly.
- Ctrl+K opens the command palette — every command lives there.
- Voice: "Hey Thor / Hey Loki / Hey Odin" wakes that persona ("Hey RAYVEN" still works and routes to THOR). "Switch to <name>" changes the floor, typed or spoken.
- "ragnarok" → alert mode (auto-clears in 18s; "stand down" clears it early). "showtime" → scripted tour, any keypress interrupts.
- "show me the hammer" → live projection. "open the bay" / "open the memory map" / "open the ops floor" / "open gesture control" also work typed.
- Reactor renders on classic `THREE.WebGLRenderer` with a hand-written shader — **not** `THREE.WebGPURenderer`. That was tried first and is broken: on any machine without a WebGPU adapter (most of them), it silently falls back to an internal WebGL2 path whose Node-material auto-compiler chokes on textured point sprites (`Vertex attribute "uv" not found`) — geometry drew, vertex counts and FPS reported fine, but literally zero pixels ever painted. Don't reintroduce `three/webgpu` for the reactor, the bay, or the projection panel. `?reactor=2d` in the URL forces the Canvas 2D fallback if a machine ever misbehaves.
- The previous frontend is preserved at `index-pre-asgard-backup.html`.

## Gesture control

Ctrl+K → "Open gesture control" (or type/say "open gesture control", "open the camera"). Fully on-device hand tracking via MediaPipe Tasks Vision (`GestureRecognizer`) — the camera stream and every inference pass stay in the browser tab, nothing is uploaded anywhere.

Camera and gestures are two deliberately separate steps: **Enable Camera** just starts the feed and draws the live hand skeleton so you can see yourself framed and confirm tracking looks right — no action fires yet, even if a gesture is recognized. **Arm Gestures** (disabled until the camera is running) is the second, explicit step that lets a recognized pose actually do something.

| Gesture | Action |
|---|---|
| ✋ Open palm | Wake the active persona |
| ✊ Closed fist | Stop speaking |
| ✌️ Peace sign | Open the command palette |
| ☝️ Point up | Cycle to the next persona |
| 👍 Thumbs up | Confirm a pending action |
| 👎 Thumbs down | Cancel a pending action |
| 🤟 I love you | Toggle mic mute |

Closing the panel (or Project H taking the room) fully stops the camera stream, not just hides the panel — the webcam indicator light goes off with it.

## The concealed fourth

Her trigger phrase and key are defined **only** inside the paired `⟦PROJECT-H⟧` comment markers in `index.html` — read them there; they are deliberately not repeated in this file or anywhere else. She is frontend-only, exists in no registry, makes zero network requests, and the daily code check strips her region before any model sees the source. To leave her room, seal the vault.

**Heads up now that the repo is public:** the redaction only hides her from the in-app AI personas and the automated code-review pipeline — it does nothing to hide her from a human reading the raw source on GitHub. If you want her genuinely secret from other people too (not just from Thor/Loki/Odin), say the word and that block can be kept out of what gets pushed publicly.

## Secrets to add when you're ready (all optional — graceful without them)

```
npx wrangler secret put TELEGRAM_BOT_TOKEN_LOKI     # from @BotFather — new bot for LOKI
npx wrangler secret put TELEGRAM_BOT_TOKEN_ODIN     # from @BotFather — new bot for ODIN
npx wrangler secret put TELEGRAM_BOT_TOKEN_THOR     # optional: only if you ever want THOR on a separate bot
npx wrangler secret put ELEVENLABS_VOICE_ID_THOR    # falls back to ELEVENLABS_VOICE_ID
npx wrangler secret put ELEVENLABS_VOICE_ID_LOKI
npx wrangler secret put ELEVENLABS_VOICE_ID_ODIN
```

Then point each new bot's webhook at its persona route:

```
curl "https://api.telegram.org/bot<LOKI_TOKEN>/setWebhook?url=https://asgrard-backend.rayanfahil2.workers.dev/telegram/loki"
curl "https://api.telegram.org/bot<ODIN_TOKEN>/setWebhook?url=https://asgrard-backend.rayanfahil2.workers.dev/telegram/odin"
```

**Do not change** the existing RAYVENN_RAYAN_BOT webhook — it stays on `POST /` where JARVIS expects the system to live.

## Print pipeline

The inspection bay's spec panel has **EXPORT OPENSCAD** — it emits a `.scad` (voids as `difference()`, radii not diameters, one final rotate to stand the part up) plus bed-fit/mass estimates. Feed that to OpenSCAD → STL → your slicer when a printer shows up.
