# ASGARD repair and council update — 10 September 2026

## What is live and what changed

The existing reactive humanoid is retained. The entire inline rendering script is byte-identical to `index.before-council.html`: particle motion, white glow, listening/speaking states, and persona crossfades remain intact. Fifteen agent controls were extracted from the newly supplied root `asgard.html`. The original uploaded file is untouched. This follows the owner's later instruction to add its agents while keeping the existing humanoid, rather than replace the page wholesale.

Agent controls open the existing council dossier, read `/council/status`, and prepare a delegation in the chat composer. The owner reviews and sends that draft. Example tasks, trades, percentage progress, and notifications in the supplied HTML are not presented as real activity. Displayed activity is explicitly the last recorded run, not a live progress meter. No scheduled sending, publishing, purchasing or trading was enabled by this UI change.

Odin controls say PAPER / SIM. Paper-agent IDs remain baldr → VOLSTAGG, vidar → HEIMDALL, tyr → FANDRAL, heimdall → HOGUN, freya → FRIGGA. These are mapped separately to the existing council delegation IDs; no KV keys were renamed.

## Job 1: chat errors

The earlier live failure was an expired Anthropic key and exhausted credits. The owner replaced the key and funded the account before this repair. Fresh live canary requests now returned HTTP 200 for Thor, Loki and Odin, each naming itself correctly. Credentials were not copied into source files.

The main catch returned an error response but did not log the exception; optional enrichment/history reads also have fallback catches. Added a `CHAT_FAILURE` log with credential and URL redaction, plus sanitized error responses. Added a stable selected-persona identity instruction; it does not change the selected model.

Interactive chat uses `claude-sonnet-5`. Background Haiku uses `claude-haiku-4-5-20251001`. Both are listed in the [Anthropic model documentation](https://platform.claude.com/docs/en/models/overview). The previous five application commits concerned the Warden page, motion, workspace and microphone; they did not change the Anthropic key name or KV binding.

Cloudflare binding is exactly `RAYVEN_KV`, namespace `ee3cce96335249a9a4cc990cdfd8a2a5`. `LEDGER_BACKEND=do` sends the newer accounting records to the existing Durable Object ledger. The Worker remains `asgrard-backend`.

### Secret names checked (never values)

Configured names: ADMIN_TOKEN, AGENT_KEY_JARVIS_RAYVEN, AGENT_KEY_RAYVEN_KEVOS, ANTHROPIC_API_KEY, AYRSHARE_API_KEY, DEBUG_SECRET, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_THOR, ELEVENLABS_VOICE_ID_LOKI, ELEVENLABS_VOICE_ID_ODIN, ELEVENLABS_VOICE_ID_HELA, GOOGLE_MAPS_API_KEY, OPENROUTER_API_KEY, SERPAPI_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TAVILY_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_TOKEN_LOKI, TELEGRAM_BOT_TOKEN_ODIN, TELEGRAM_BOT_TOKEN_HELA, TELEGRAM_WEBHOOK_SECRET, TWELVE_DATA_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, VIZARD_API_KEY.

Optional/fallback names referenced by the application but not configured include ELEVENLABS_VOICE_ID, TELEGRAM_BOT_TOKEN_THOR, CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN, UPLOAD_POST_API_KEY, NASA_API_KEY, LIVE_BROKER_KEY and DISCORD_WEBHOOK_URL. The dedicated trio voice IDs are configured; Thor's Telegram token uses its existing generic fallback. Optional integrations are not proof of a chat failure. No bare `ELEVENLABS_VOICE_ID_` typo was found. `env.KEY` in an explanatory comment is not a runtime secret read.

To inspect logs: open the Cloudflare dashboard, Workers & Pages, then **asgrard-backend**. Open its Logs/Observability area and start the real-time log stream. Send a short message on ASGARD. `CHAT_FAILURE` identifies failures; `ANTHROPIC_USAGE` shows model, source, input/output tokens and cache tokens. Do not share screenshots containing unrelated sensitive logs.

## Job 2: measured costs and changes

Before changes, a fresh conversation exposed approximately 39 tools for Thor, 38 for Loki and 28 for Odin. Tools plus the system prompt were approximately 5,934, 5,486 and 5,481 tokens respectively, estimated from characters divided by four. Actual provider tokenization differs and includes additional context. These were not 100 tools on every request.

Caching already existed. The production version used five-minute boundaries, including a message boundary after a changing time/context section. Changed this to one-hour cache boundaries on stable tool definitions and the stable first system block, with time, memory and messages afterwards. There are two boundaries, under the provider limit of four. Opening a different tool group can still legitimately change the prefix.

Live evidence: the first Thor canary request created 12,262 cache tokens; the next reused 12,262, created zero, and had 2,918 uncached input tokens. Interactive chat stayed on Sonnet. This demonstrates reuse, not a guarantee of a particular monthly bill. One-hour writes cost more than ordinary input, so savings depend on repeated use; the cost calculation includes that write multiplier.

The former main loop allowed fourteen model rounds. It now allows six, reserving the last for an answer and logging when the ceiling is reached. Provider transport retries remain separately bounded. Long textual tool results are clipped with an explicit notice; images remain intact. Ordinary chat output stays capped at 1,400 tokens. No tool was removed.

History was already capped at thirty messages, rather than growing forever. Older completed messages now become a short Haiku summary while approximately twelve exchanges remain verbatim. The summary and usage records travel with the existing conversation save. On a summary failure, the summarizer returns the existing history and the pre-existing storage cap still applies. Unfinished tool sequences are not summarized.

Usage logs cover successful Anthropic calls and batch results, using the existing conversation spool or scheduled tick buffer for accounting rather than an added KV write per chat. Cost reports now read the Durable Object ledger when enabled instead of stale legacy KV totals.

The scheduler checks every five minutes (288 ticks per day), but each job has its own due check: this does not mean 288 model calls per job. Proactive check-ins are at most every four hours, the morning brief and code review are daily, autonomy runs on its own cadence, and watch checks only classify relevant changes. Routine background model calls, monitoring classifiers, reports, autonomy summaries, memory extraction and the private background duties now use Haiku. Explicit difficult council delegation retains Sonnet; cheap council work already used Haiku or Workers AI. Existing paper-trading ticks are deterministic, with Haiku batch reviews.

The daily nonurgent code review now uses the existing Batch API collector. Trader reviews already use Batch; routine composition supports explicit Batch scheduling. Time-sensitive briefs and interactive multi-step tool jobs still run directly, so not every scheduled request has been converted into a deferred batch. No measured monthly total or $20/month claim is available yet. Browser screenshots remain an explicit tool action, not an attachment to every browser action.

## Job 3: actual serving configuration and verification

The supplied file was found at `rayven-pwa/asgard.html`, not at the path in the instructions. Wrangler serves assets from `public` with `run_worker_first=true`; unmatched GET requests go through `ASSETS`. The live front-page asset is `public/index.html`, synchronized from root `index.html`. Editing only the root would not update that asset. The current front is the working Warden chat workspace, not the Bridge page. Legacy hall URLs route to the corresponding persona on the main workspace.

Release work was isolated on `codex/repair-and-reduce-costs`, based on the previously deployed source, so unrelated unfinished backend features in the working repo were not deployed. The pre-install checkpoint is `eef5156` (`parked before asgard install`); the front-page backup is `index.before-council.html`. Changes were also adapted into `rayven-pwa` without overwriting its earlier work.

Checks: 113 release unit tests and 463 working-repo tests passed; browser tests covered all three personas, chat errors, drafts, cancellation, streaming, tool forms, missions, microphone toggles and cleanup. Separate council checks covered fifteen controls, HOGUN mapping, recorded-status rendering, review-before-send and desktop/phone layouts. All 165 release assets matched their expected hashes in the live canary. Live chat requests, not only mocked UI requests, returned HTTP 200 for all three personas.

Release fingerprint: `workspace-17c0745dbb32`. Canary Worker version: `afe125d5-f91d-4490-95c9-d43e98afe65b`. Last known-good rollback version with the replaced key: `efb496b5-7a0d-43e2-ade0-8d434e7421c9`. Do not use earlier versions that carry the expired credential.

Owner check: refresh ASGARD, switch Thor/Loki/Odin, open an agent, then turn on the microphone and speak. The figure should react while listening and speaking; the council lights should react with it. Agent delegation prepares text in the composer for review.
