# The halls install — progress file

Source: `~/INSTALL-HALLS.txt` (Rayan, 2026-09-06). Branch: asgard-three-personas.
The starting point is parked on branch `pre-halls-install-backup` (= 557853c); the
old 3D hall is that commit's `public/index.html` and is also in git history.

## What is live (deployed 2026-09-06, versions 8814056d… then 205b09d8…)

- `public/index.html` is the concept-art page "The Halls of Asgard": three halls
  (Thor, Loki, Odin) rendered from `public/img/{thor,loki,odin}.jpg` (1920×1080),
  a fixed 1920×1080 stage scaled to the window, the persona switcher at the
  bottom (THOR / LOKI / ODIN, keys 1/2/3), and a chat composer wired to the
  Worker. The root `index.html` is a byte-identical copy (repo convention; it
  keeps the "cp index.html public/index.html" checklist step from clobbering the
  live hall).
- Chat wiring (Step 3): `POST /` with `{ assistant, message }`, reply read from
  `reply`. Matches `src/index.js` (`body.persona || body.assistant`, `{ reply }`).
- Step 4 ports, all inside the existing `send()` / mic button, no new UI:
  1. TTS playback of replies via `POST /tts` `{ text, persona }`, browser
     SpeechSynthesis fallback, barge-in, guard timeout.
  2. Microphone / SpeechRecognition into the composer, stop phrases, single
     recognizer per page with retry, listening resumes after a reply.
  3. Wake word — per-hall phrases plus the legacy RAYVEN variants, exact then
     Levenshtein ≤ 1 fuzzy match, switch phrases, sleep phrases, fixed entrance
     lines.
  4. Vault phrases — swallowed on device; never reach the transcript or the
     backend.
  Each was verified with a Playwright harness against a mocked backend
  (2026-09-06, ~04:24–04:34) before the install session ended.
- **Added at deploy time (not in the delivered file):** `<!DOCTYPE html>`,
  `<html lang="en">`, `<head>` … `</head><body>` … `</body></html>`,
  `<meta charset="utf-8">`, `<meta name="viewport" …>`. The delivered page had no
  document shell, so it rendered in quirks mode with a windows-1252 charset. No
  colour, font, position, size or label was touched.
- The page loads **no FX engine** by design (no `/fx/asgard-fx.js`, no Three.js
  cores, no still-mode tray). `/fx-lab`, `/halls-preview`, `/hub`, `/team.html`
  and `public/fx/` are untouched and still live.
- `scripts/smoke-fx.mjs`: the two hall assertions now check the concept-art
  page (title, three pictures, the voice port, no FX tag).

## Verified live (2026-09-06 evening)

- `GET /` on both hostnames returns the new page (57,022 bytes, doctype first).
- `/img/*.jpg` return `image/jpeg` at the exact local sizes.
- Playwright against the live URL: boots into Thor, all three pictures decode at
  1920×1080, zero console errors on load, `HallsVoice` present, typing to Thor
  sends to the backend and shows the backend's real error on screen.
- `scripts/smoke-fx.mjs` ALL PASS. `scripts/mcp-smoke.mjs` ALL PASS.
- `scripts/smoke.mjs`: everything passes except the three `POST /` probes, which
  return 500 "Your credit balance is too low to access the Anthropic API". That
  is billing, not code — top up at console.anthropic.com and they pass again.

## Not done / for Rayan

- Look at the page on the Chromebook and the phone (the layout is only verified
  at 1280×720 in headless Chromium).
- The Anthropic credit balance (blocks every reply, every councillor, every
  routine on the 5-minute tick until topped up).
- Voice on the live page (mic, wake word, TTS) was verified with mocks, not on
  real hardware.
