# Aurum interface release — 2026-09-11

Live: https://asgrard-backend.rayanfahil2.workers.dev/
Version: 192baf47-b1cd-4c57-929e-f0c6de90f24a at 100%.
Production source: ../rayven-warden-release, codex/aurum-reference-live, c45191a.
Asset fingerprint: workspace-b1cd9f49a77b (171 assets).
Rollback version: 9ae68388-092d-40e5-a5f1-b58d9e1a5e5a.

Replaces the Orbital dashboard front page with an original composition inspired by the user's supplied screenshot: black and warm gold, open portrait stage, serif headline, orbital council agents, tool collection links and compact conversation composer. Preserves the original humanoid engine byte-for-byte. Tasks, calendar, reminders and paper performance live in the expandable Workspace. Conversations open on typed or dictated requests and can be toggled explicitly. All three personas and fifteen council advisors retained.

Validation: 117 unit tests; full chat/mic/browser suite; real-data adapter fixtures; all five collection links; workspace/conversation toggles; phone and desktop fit; 171 Cloudflare assets; real no-action smoke replies from Thor, Loki and Odin. No backend, binding, secret or model changes. Previous ElevenLabs billing limitation remains; this visual release does not resolve that external payment issue. Browser voice fallback retained.

Local rayven-pwa mirror commit: dc97dc5. Earlier development backend features preserved, not included in the production release. Previous index saved as index.before-aurum.html. CODEX-EVERYTHING.txt untouched.
