# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RAYVEN — Rayan's personal AI assistant: a single assistant, built as a Cloudflare Worker backend with a browser extension for computer control and a web/PWA frontend. It talks to Rayan over a private web interface and Telegram, runs Claude (Anthropic) tool-calling to take real-world actions (texting, calling, Spotify, browser control, maps, web research), and runs autonomous background jobs (proactive check-ins, a morning briefing, and a daily self-code-check) off a 5-minute cron trigger.

### The THOR/LOKI/ODIN revert (2026-08-15)

On 2026-08-14/15 this project was rebuilt as ASGARD — three personas (THOR/LOKI/ODIN) sharing one brain, a refactored `src/` backend, and three standalone product pages. **That work was reverted on 2026-08-15 and this branch is single-assistant RAYVEN again.**

Nothing was thrown away. The full multi-persona system is preserved on the **`thor-loki-odin-backup`** branch (also pushed to `origin`), including `src/` with `personas.js`, the `/thor/` `/loki/` `/odin/` pages, the ASGARD hub, and `README-ASGARD.md`. To look at it: `git show thor-loki-odin-backup:src/lib/personas.js`, or check the branch out.

Do not reintroduce persona routing, `src/` modules, or the per-assistant pages onto this branch unless Rayan asks to un-revert. If he does, that branch is the starting point — do not rebuild it from scratch.

## Commands

There is no package.json, bundler config, lint config, or test suite in this repo — it is deployed straight from source via Wrangler.

- `npx wrangler dev` — run the worker locally
- `npx wrangler deploy` — deploy to Cloudflare. Entrypoint is `worker.js` per `wrangler.toml`. This also publishes `public/`.
- `npx wrangler tail` — stream live logs from the deployed worker
- `npx wrangler secret put <NAME>` — set a secret (API keys live in Cloudflare secrets, not in this repo)
- `node --check worker.js` — syntax validation. There is no build step, so this is the only thing standing between a typo and a broken deploy. Run it before every deploy.

### The Worker name is `asgrard-backend` — do not "fix" it

**The live Worker is named `asgrard-backend`** (misspelled on Cloudflare), at `https://asgrard-backend.rayanfahil2.workers.dev`. It was renamed from `rayven-backend` on 2026-08-15. The code is RAYVEN again but the *name* stayed, because secrets, the workers.dev URL, and Telegram webhooks all attach to the script **name**, not to the code inside it.

`name` in `wrangler.toml` must match that exactly. Deploying under a name that doesn't exist silently creates a *second, empty* Worker with no secrets while the real one keeps serving — a very confusing way to lose an afternoon. `rayven-backend` still exists but is an unrelated stub holding none of the secrets.

Renaming back to `rayven-backend` for real is a deliberate migration, never a casual edit: re-add all 17 secrets, re-point the Telegram webhook, and update `BACKEND_URL` in `index.html` (and `public/index.html`), `background.js`, and the Spotify OAuth redirect URI.

### Worker topology — there are exactly two, and there should stay two

- **`asgrard-backend`** — the engine. Holds all the secrets, the KV/Vectorize/AI bindings, and the 5-minute cron. Deployed from the repo root.
- **`rayven-backend`** — a forwarder, deployed from `legacy-url-shim/`. It reclaims the original hostname (installed PWAs, bookmarks, the Chrome extension, the Spotify OAuth redirect, and JARVIS/KEVOS federation all still point there) and passes everything through over a `[[services]]` binding. It holds no secrets and no logic. Don't add any.

**`workers_dev = true` must stay set on the forwarder.** It was missing once, and the result was maximally confusing: the script deployed fine and its code was correct, but no hostname was bound to it, so the URL returned Cloudflare's own 404 and the forwarding code never ran. **A 404 with `server: cloudflare`, an HTML body, and no worker headers means nothing is listening on that hostname — not that the worker ran and 404'd.**

**A third Worker, `rayven-pwa`, existed until 2026-08-15 and was deleted.** It was auto-deploying from the GitHub repo via a dashboard-level connection (there is no `.github/workflows`), had zero secrets, but carried the same KV binding and its own cron — so it ran whatever `src/` happened to be on `main` against live data. The symptom was KV keys reappearing minutes after being deleted. If that ever recurs: read the key and check its timestamp rather than blaming eventual consistency, and remember `wrangler` has no "list all workers" command, so probe suspects with `wrangler deployments list --name <guess>`.

### Deploy checklist

1. `node --check worker.js`
2. `cp index.html public/index.html` — **`public/index.html` is a COPY.** Edit `index.html`, then re-copy, or the live page silently stays stale.
3. `npx wrangler deploy`
4. Verify against the live URL, not just locally. Cloudflare edge propagation takes ~30s, so a probe immediately after deploy can show the old version on some nodes.

## Architecture

### `worker.js` — the whole backend

`worker.js` at the repo root is the entire backend, a single monolith, and it **is** the deployed entrypoint (`main = "worker.js"` in `wrangler.toml`). This is a change from the ASGARD period, when `worker.js` was a dormant reference copy and `src/index.js` was live — on this branch there is no `src/`.

`fetch()` is a manual if/else router (no framework) handling a debug/status route family (`/agent/query`, `/agent/log`, `/memory`, `/todos`, `/permissions`, `/tts`, `/browser/*`, `/spotify/*`, various `/debug-*`) and the chat endpoint (`POST /`, plus Telegram webhook traffic detected via `body.message.chat`). Both channels converge on the same logic: load history from KV, run the Claude tool-use loop, save the reply back to history, and either return JSON (web) or send a Telegram message.

Any unmatched non-POST request falls through to `env.ASSETS.fetch(request)`, which is how the PWA reaches the browser. **`run_worker_first = true` in `wrangler.toml` is required** — without it Cloudflare's asset handler claims `/` for every HTTP method, not just GET, and `POST /` (web chat *and* the Telegram webhook) starts returning a flat 405.

`scheduled()` fires every 5 minutes (`wrangler.toml` cron) and kicks off the background subsystems in parallel via `ctx.waitUntil`. Each one decides for itself whether it's actually due by checking its own "last run" KV key — proactive check-in, morning briefing (8am Pacific, timezone-aware via `Intl.DateTimeFormat`, not a fixed UTC offset), and the daily self-code-check that pulls `worker.js` and `index.html` fresh from GitHub (`RAY09-F/rayven-pwa`) and asks Claude to flag bugs. Follow this "check my own KV state" pattern for any new scheduled subsystem rather than adding cron expressions.

Adding a capability means adding a schema entry to the tool definitions array, a case to the tool dispatcher, and — if it should be gateable — an entry in `GATEABLE_TOOLS`.

### Contracts that must not regress

- **JARVIS federation**: the worker URL, `RAYVENN_RAYAN_BOT` on `POST /`, and `/agent/query` + HMAC. Never change these without telling Jay first. `POST /` specifically is the contract — the Telegram webhook and the sibling-agent channel both depend on that exact path.
- **Telegram**: webhooks must ack immediately and never await a full turn in the webhook response, and must return 200 for update types the bot doesn't handle (a 400 makes Telegram retry in a loop).
- **Permissions**: `send_text` and `make_call` always confirm before executing. `confirm`-level tools queue in KV and only run if the next user message reads as affirmative.

### Voice / TTS

`POST /tts` uses ElevenLabs. The original secret was `ELEVENLABS_VOICE_ID`; the ASGARD work replaced it with per-persona secrets (`ELEVENLABS_VOICE_ID_THOR|_LOKI|_ODIN`) and never restored the plain one, so the route reads `env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID_THOR`. That means voice works today on the THOR-era voice. To put RAYVEN's original voice back:

```
npx wrangler secret put ELEVENLABS_VOICE_ID --name asgrard-backend
```

The plain secret takes precedence once set.

### `index.html` — the frontend PWA

A single self-contained HTML file: the RAYVEN interface, wake-word listening, voice, and the WebGL reactor visual. Rayan owns visual/UI direction on it.

Wake matching is multi-variant + fuzzy (greeting word + misheard-name lists) — never reduce it to one exact phrase; that broke detection once before.

**Reactor rendering — do not reintroduce `THREE.WebGPURenderer`.** It was tried and is broken: on any machine without a real WebGPU adapter (most of them) it silently falls back to an internal WebGL2 path whose node-material auto-compiler requires a per-vertex `uv` attribute for textured Points that plain point sprites never carry — draw calls happen, vertex counts and FPS report fine, but literally zero pixels paint. The fix (live) is classic `THREE.WebGLRenderer` + a hand-written GLSL `ShaderMaterial` (`gl_PointSize`/`gl_PointCoord`, no node-graph compilation). Verify any renderer change against actual screenshot pixels, not a `drawImage()`-from-canvas probe (read-timing false-negative against a live WebGL context) and not just a forced 2D fallback path (that testing gap is what let the bug ship).

Frontend verification lives as a Playwright suite pattern — serve the file statically, mock the backend origin, assert on DOM/canvas. Rebuild that harness rather than eyeballing changes.

Repo of record: `github.com/RAY09-F/rayven-pwa` (public).

### Browser extension (`background.js` + `manifest.json`)

A Manifest V3 service worker that polls `/browser/poll` every ~6 seconds (`chrome.alarms`) for queued commands and executes them against the active tab: click/type by text match (`chrome.scripting.executeScript`), or exact-coordinate click/type via the `chrome.debugger` protocol (`Input.dispatchMouseEvent`/`dispatchKeyEvent`) for cases text-matching can't handle. Screenshots go through `chrome.tabs.captureVisibleTab`. Results are POSTed back to `/browser/result` keyed by command id.

Note that the backend's "connected" flag is a time-based heuristic (`lastPoll` within 60 seconds), not proof the extension is actively polling — a frozen extension can still read as connected for a minute.

### State model

Everything persists in one KV namespace (`RAYVEN_KV`) — there is no separate database. Conversation history is keyed per channel (`telegram:<chatId>`, `web:main`) and capped at 30 turns. Capped-array logs and lookup values (`permissions`, `todos`, `monitor:list`, etc.) are each a single JSON blob under a fixed key. When adding a new persistent feature, follow whichever existing pattern it resembles most rather than introducing a new storage convention.

The `VECTORIZE` and `AI` bindings are declared in `wrangler.toml` but unused — vector-backed memory arrived with the `src/` refactor that the revert undid. They stay declared so the `rayven-memory` index remains attached if that work is ever restored. KV holds the memory that RAYVEN actually reads.
