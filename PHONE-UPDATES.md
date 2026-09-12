# Proactive phone updates

ASGARD has an owner-only call channel, separate from the existing confirmation-gated `make_call` tool. This integration does not change permission to contact other people or grant agents new system-modification tools.

## Current activation state

Deployed with calling disabled and no receiving number configured. The user still needs to provide their receiving number, daily time/time zone, and pair their phone. No real outbound test call has been placed. Live Twilio credentials authenticate and the account owns exactly one voice-capable number, ending in 2581; the new owner-call channel selects that verified number. All 126 unit checks passed, mobile fixture checks passed, and 179 live assets matched the release manifest.

## Behavior

- Existing centralized notifications enter a bounded queue, independently of Telegram connectivity. Source selects Thor, Loki or Odin.
- High/critical events can cause calls when Home/Away status is Away and current. Scheduled checks run every five minutes; this is not an emergency-response service.
- Daily briefing: one Thor call covering available updates across the council and, when generation succeeds, one clearly labeled optional improvement idea. Suggestions never execute themselves.
- Default daily time is 18:00 America/Los_Angeles, pending the user's preference. Default maximum is three call attempts per local calendar day, with a ten-minute minimum interval. Calls last at most three minutes. No automatic retries after missed calls or ambiguous submission failures.
- The existing SQLite ledger applies reservations synchronously so concurrent cron ticks cannot duplicate calls. Reservations count toward the limit even if Twilio fails. State is additive under `phone:state`; existing ledger schemas and data are preserved.
- ElevenLabs persona audio is used when available. Twilio speech is the fallback. These are spoken announcements, not two-way phone conversations. A queued call is not reported as answered; signed Twilio callbacks record the final outcome.

## Presence and phone pairing

`/phone/` is the mobile control page. Home coordinates remain in that phone's browser storage. Geolocation compares against a 300-metre radius, accounts for accuracy, and sends only Home/Away/Unknown. Location observations expire after 30 minutes; manual status expires after 12 hours. A locked phone or closed browser can suspend tracking. Unknown does not trigger away-only calls. The daily briefing is independent of presence.

The setup operator uses a scoped `PHONE_SETUP_TOKEN` stored locally at `~/.asgard-phone-setup-token`. This is not the existing admin token. `scripts/phone-operator.mjs` reads it without printing it. Configure through a private JSON file outside the repository, e.g. `{to: internationalNumber, enabled: true, dailyTime: HH:mm, timeZone: IANAZone, maxDaily: 3}`. Run the configure command with that file path. Never commit receiving numbers or tokens.

The pair command creates a ten-minute single-use link. Open it on the receiving phone. Redemption replaces the previous owner device key; the server stores only a hash. That paired phone can update presence, view masked status, pause, or resume. It cannot change the call destination or issue arbitrary calls. Exact GPS coordinates are never sent to ASGARD or Twilio. The setup secret can view provider readiness, configure the destination, and issue a bounded test call.

## Verification and recovery

`node --test scripts/phone-updates.test.mjs` covers reservations, limits, duplicate suppression, stale presence, DST clock conversion, single-use pairing, authorization, callback signatures/order, and real call request construction with a mocked provider. `scripts/phone-browser-qa.mjs` uses fixtures to verify mobile controls and that coordinates stay local. These are not evidence of a real phone ringing.

Provider status is read-only (`node scripts/phone-operator.mjs provider`). A verified configured sender wins; if it does not match and the account owns exactly one voice-capable number, that number is used. Multiple ambiguous numbers or no number block calls. No numbers are purchased by this setup.

Pause through the paired phone or configure `{enabled:false}`. Previous pre-feature Worker version with the setup secret: `1a5d4e5c-6992-4415-9c93-1be3b04f6af3`; rollback preserves existing ledger data but stops this scheduler. Phone setup deployment: `4a2fc931-0b91-4142-a73e-7ade2395141d`, UI fingerprint `workspace-afc29c415fb2`.
