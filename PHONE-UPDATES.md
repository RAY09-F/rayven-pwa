# Proactive phone updates

## Live state — September 12, 2026

Enabled for the configured owner number ending 6680, using the verified existing Twilio number ending 2581. Thor's real test call completed (36 seconds), with two spoken replies recorded and persona audio used. No additional phone number was purchased.

Current policy: all recorded updates, questions, ideas, and problems may trigger a role-selected Thor, Loki, or Odin call, whether Home, Away, or Unknown. Calling hours are 11:00 AM through 3:00 AM America/Los_Angeles. No new calls start during 3:00–11:00 AM, and call duration is bounded to end before quiet hours. The fixed daily briefing is disabled. There is no daily call-count cap; nearby updates are grouped with a minimum ten minutes between call attempts. Provider usage charges apply.

## Behavior

Central notifications, meaningful activity, pending approvals, background job failures, and supported event-bus updates enter a bounded queue. Each main persona can also use notify_owner to ask or tell the owner something. This detects events recorded by these integrations, not arbitrary activity outside ASGARD. Scheduled checks run every five minutes. Identical updates are deduplicated; queue lifetime is 48 hours, maximum 200 entries, and calls combine up to five updates from one persona.

Existing SQLite ledger reservations prevent concurrent ticks from duplicating calls. Calls last at most three minutes, with no automatic redial after missed calls or uncertain submission failures. Signed Twilio callbacks record outcomes; queued does not mean answered.

ElevenLabs supplies persona speech when available; replies use Flash v2.5 and the Haiku response model for lower latency. Twilio speech is the fallback. There are no separate turn-taking announcements. Listening waits up to 15 seconds to begin speaking and uses a one-second end-of-speech pause. Speech replies are handled in up to eight ordered turns, and duplicate webhooks reuse saved responses. Phone replies can use an explicit role-filtered set of task, calendar, timer, note, monitoring, status, research, and music tools through the existing permission-aware dispatcher. They cannot change permissions or approve pending actions. Historical updates and tool content retain untrusted-content protection. Other-person make_call and send_text still require their existing confirmations.

## Controls and secrets

The scoped PHONE_SETUP_TOKEN is stored outside the repository at ~/.asgard-phone-setup-token. scripts/phone-operator.mjs reads it without printing it. Use provider or status for redacted readiness/history; configure accepts a private JSON file outside the repository. Receiving numbers and secrets must never be committed. Pause with enabled:false; resume with enabled:true. Live configuration includes allUpdates:true, awayOnly:false, dailyEnabled:false, maxDaily:null, callStart:11:00, callEnd:03:00, and timeZone:America/Los_Angeles.

Optional /phone/ mobile controls require a ten-minute single-use pairing link. Redemption rotates the owner device key. That page can view private call history, pause/resume, and report presence, but cannot change recipients or make arbitrary calls. Home coordinates remain in the phone browser; only Home/Away/Unknown is sent. Presence is optional under the current calling policy.

## Verification and recovery

Release checks: 129 unit tests passed; mobile fixture checks passed; all 179 live assets match workspace-dbb085853898. Production version: ec41f301-1a22-4073-abea-bbc1b37008ef. Previous version 6018310e-57cd-4166-bd48-3c644075fbaf is the rollback for this conversation update. A completed real test call and two recorded replies verify the two-way provider connection.

phone-updates.test.mjs covers authorization, atomic reservations, deduplication, limits, quiet hours, stale presence, pairing, signed callbacks, provider requests, persona tools, and ordered speech turns. phone-browser-qa.mjs verifies mobile controls using fixtures.

Pause before rollback if calling must stop. Pre-feature Worker version 1a5d4e5c-6992-4415-9c93-1be3b04f6af3 retains the setup secret and stops this scheduler; ledger data remains. Do not use the earlier phone-enabled implementation as a quiet-hours rollback because its scheduling rules differ.

Conversation upgrade verification: mocked signed callbacks verify asynchronous completion, one execution on repeated callbacks, and result retrieval. Tool tests verify task creation and rejection of out-of-scope tools. Long responses run behind signed polling callbacks to avoid holding a Twilio speech webhook open. Polling stops after 28 seconds without a completed result; no automatic action retry. Live conversational latency still depends on the providers and the requested tool.
