# Unified ASGARD workspace

The Warden figure page now hosts conversation, voice, tools, missions, activity and council dossiers at `/`. Persona switching stays on this page. The old Enter links and decorative microphone have been removed. The figure starts idle; chat requests, speech recognition and playback drive its actual states.

`index.html` is mirrored to `public/index.html`, which Wrangler serves through the existing ASSETS binding. The controller is `public/ui/warden-workspace.js`; layout and dialog styles are in `public/ui/warden-workspace.css`. Existing arsenal, local utilities, safe response formatting, SSE parsing and backend tool approvals are reused. History loads from the existing `/history?persona=` endpoint; chat still posts to `/`, and voice still posts to `/tts`. No provider, memory namespace, webhook or secret name changed.

Legacy hall, HUD, hub, team and preview page URLs redirect to the same workspace, preserving persona bookmarks. API routes such as `/hud/summary` remain available. Old UI source assets are retained for rollback; they are no longer front doors. The release manifest fingerprints the actual root page and UI assets, not redirected HTML pages.

Validation:

- `node scripts/warden-workspace-qa.mjs`: mocked provider replies, all three histories/personas, late-response isolation, cancellation, SSE, invalid-key recovery, tool forms, mission drafts, council, settings, phone layouts, speech-to-send and mic cleanup.
- `node scripts/warden-voice-qa.mjs`: actual browser audio playback with a generated WAV fixture, measured particle audio energy, stop and persona-switch cleanup.
- `node --test --test-concurrency=1 scripts/*.test.mjs`: existing regression suites.
- Local Wrangler browser checks confirm old hall hashes and HUD/hub/team redirects reach the appropriate persona or panel.

Provider blocker discovered before installation: live POST `/` returned HTTP 500 with `Claude API error — API key is invalid.` Cloudflare deployment login does not replace the separate `ANTHROPIC_API_KEY` secret. A valid key must be entered securely by the account owner; do not place it in source, chat, screenshots or committed files. Until replacement is verified, fixture tests demonstrate interface behavior, not restored live AI replies.

Browser speech recognition requires support and microphone permission. Configured TTS uses the existing backend; browser speech synthesis is an explicitly identified fallback. Browser synthesis exposes no audio waveform, so it drives the speaking state only. Audio samples from the microphone and HTML audio playback drive measured glow. Stop cancels local waiting/playback; it cannot promise to cancel a backend tool already running.

Deployment: version `841e6ce2-032d-44c4-b262-83bee4811661` promoted to 100% on 2026-09-10 after canary verification. Production manifest `workspace-80e756f3485d` matched all 162 assets on both the main Worker and legacy forwarder. Hosted browser fixture suites passed. Live smoke requests for all three personas confirmed the same invalid API key; live Thor TTS returned HTTP 200 audio/mpeg (20,942 bytes) with the configured voice, not a fallback. Previous version: `5481a3d8-086c-488e-9805-34c6dd4a301f`.

Microphone update: a visible mic icon with Mic off / Mic on status now identifies the toggle. Voice capture still submits when speech finishes; toggling off releases the mic and preserves the draft. All-persona toggle tests pass. Deployed version `efb496b5-7a0d-43e2-ade0-8d434e7421c9`, replacing the account owner’s working-secret version `0cb6ba79-ded5-4dd2-a737-b2166d63c969`. The account owner replaced the expired Claude key and added credits; all three live replies and all three configured voice endpoints passed before this UI update.
