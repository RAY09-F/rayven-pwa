# Wave 0: measured baseline and ground truth

Measured 2026-09-08 before any application source changes. Baseline source d349c75. Live version e0f22382-5553-4069-94bd-8b1e5acb2523, 100% traffic. Primary host https://asgrard-backend.rayanfahil2.workers.dev. Release floating-761d8ca5ef4f. Git remote is RAY09-F/rayven-pwa. Original branch asgard-three-personas is older than main and remains untouched; work uses an isolated checkout.

## Real requests, not estimates

| Request | HTTP | Response headers available | Complete body | Result |
|---|---:|---:|---:|---|
| Authenticated GET /admin/core-tokens |200|924.06ms|937.25ms|All three provider token-count attempts rejected: insufficient Anthropic credit balance|
| GET /browser/status |200|258.24ms|260.73ms|connected:false; lastPoll1787152761593|
| GET /ui/release.json |200|94.98ms|102.33ms|Expected floating release fingerprint|

These header times include network setup; they are not model time-to-first-token.

Required POST response-start/complete baseline: BLOCKED for successful inference. The preceding same-backend deployment check recorded an HTTP500 insufficient-credit response in2,027ms end-to-end; it did not separately measure response start, so this is historical failure evidence only, not a successful latency baseline. No paid inference was started for this task pending the user's spending decision. Existing smoke route also reads live history and can delete a pending approval before inference; it is not sufficiently isolated for repeated acceptance runs without correction.

Speech end to actual speaker sound: BLOCKED; no successful provider reply or physical microphone/output measurement available. Anthropic usage object, second-turn cache-read count and observed inference round trips: unavailable on rejection. Do not report missing values as zero. CPU milliseconds and daily KV writes: not yet observed, no inference that Free plan CPU is inadequate.

Exact provider token counting was attempted through the existing authenticated endpoint; provider refused despite counting being documented as free. No character-to-token guess substitutes for that result.

## What the source actually does

`src/index.js` serves GET/HEAD static assets through ASSETS, routes web POST and persona Telegram webhooks to the shared chat loop, polls/result-dispatches extension commands, proxies TTS, and uses a five-minute cron to drive existing jobs. Telegram acknowledges before background work. Existing approval, taint, sender and debug/admin gates must remain. Real smoke tests must not send or invoke consequential tools.

Wrangler uses asgrard-backend, compatibility_date2026-08-13, ASSETS/run_worker_first=true, RAYVEN_KV, CLIPS R2, VECTORIZE/rayven-memory, Workers AI, LEDGER/AsgardLedger SQLite with v1-ledger migration, LEDGER_BACKEND=do, existing webhook host and five-minute cron. No Queue binding. Ledger already exists; conversation history still uses KV.

Thor, Loki and Odin all call claude-sonnet-5 through src/lib/models.js, with max_tokens1400 and history cap30 messages (not thirty complete user/assistant exchanges). Their prompts respectively emphasize personal assistance, follow-through and paper/business research. The model ID is already current according to the official model overview; a retired model is not the demonstrated cause. There is an existing concealed fourth persona and council; preserve them without exposing them in public catalogues.

`src/lib/anthropic.js` sends exactly `{model, max_tokens, system, tools, messages}` with x-api-key and anthropic-version2023-06-01. It awaits complete JSON, does not request streaming or effort, retries transient responses once after700ms without honoring Retry-After, and logs raw provider error bodies. The tool loop allows14 model iterations and executes requested tools serially. No measured ordinary-turn round-trip count is available yet.

Caching is partially implemented already: a five-minute breakpoint on static persona text and a last-message breakpoint. Dynamic time/channel/memory blocks follow the static prompt. No tool breakpoint. Keyword-selected tool groups change the tools array; this invalidates downstream cache prefixes. The brief's claim that no caching exists is inaccurate.

Local backend import contains277 definitions. Thor allows209 and starts with39 core definitions/12,963 JSON bytes; Loki176 and38/12,760bytes; Odin193 and28/10,801bytes. These byte counts are NOT token counts. The premise that223 full definitions are sent on every web turn is inaccurate: existing keyword groups and find_tools dynamically load a subset.

The public tool catalog, arsenal forms and missions describe and request existing backend tools; expansion adds browser-local utilities, not new server capabilities. Council-data holds display identities and dossiers. They do not prove integrations work. The live homepage is the floating WebGL index and is outside this brief's redesign scope.

The paper engine retains the original five agents plus five named council wrappers and shared market feeds. All trading is simulated. HOGUN maps to backend heimdall; HEIMDALL maps to vidar. No identifiers or keys will change.

The repository DOES contain a Manifest V3 extension: manifest.json and background.js, read before any browser-tool changes. Its wire dispatcher uses actions navigate/click/type/probe/read/scroll/screenshot/click_coords/type_coords, not literal browser_* tool names. It tries both existing backend hosts. Live status says disconnected; the actually loaded ChromeOS extension folder/version has not been independently established. No browser tool renames may assume a reload occurred.

Voice currently waits for the complete chat reply, then complete TTS bytes, then creates an Audio element. This confirms buffering stages in code, not their measured physical latency.

## Brief corrections

Canonical lines73-77: actual environment has2,747MiB RAM AND2,047MiB swap; still run heavy work serially.
Part1.2/Part5.1: extension source exists here; backend tool count277; core web-call counts39/38/28. Do not use the223-schema estimate as a baseline.
Part4.1: desired Sonnet5 is already configured; no model swap needed solely to satisfy the brief.
Part7: council.js, schedules and delegation already exist. Improve them; do not create a second registry or scheduler.
AppendixC: user confirmed skill installed at .agents/skills/ui-ux-pro-max; skip install and leave all visual assets/CSS unchanged.

Sources checked: https://platform.claude.com/docs/en/models/overview ; https://platform.claude.com/docs/en/build-with-claude/token-counting ; https://platform.claude.com/docs/en/about-claude/pricing .

## Wave8 production analytics follow-up — 2026-09-08

Read-only GraphQL queries succeeded after refreshing Wrangler OAuth. Evidence: CLOUDFLARE-USAGE-CHECK.json and CLOUDFLARE-DAILY-USAGE.json. These are existing production traffic, not new-release results or successful model-turn measurements.

- Trailing24h: 860 Worker requests, 0 recorded errors, 3,127 subrequests. CPU p50 1.278ms; p99 66.518ms. The GraphQL schema itself confirms its CPU fields are microseconds; divided by1,000. Mixed HTTP/cron traffic cannot establish chat-only CPU requirements or first-token latency.
- ASGARD KV namespace on completed UTC date2026-09-07: 1,833 writes, 21,882 reads, 1 list. Partial2026-09-08: 578 writes, 6,485 reads, 1 list. Adaptive analytics may be sampled/estimated.
- The completed day's writes exceed the Free1,000/day allowance by833. No claim that memory mirroring reduces writes: it keeps the KV write until a later cutover, after seven full days.
- Billing plan cannot be established: account and script say usage_model=standard; subscriptions endpoint403. Do not call this confirmed Free or Paid. If currently Free, the $5/month Workers Paid plan is reasonable for this measured write volume; it includes1millionwrites/month, then$5/million. No upgrade performed.
- New-release first token, first sound, tokens, schema tokens, cache hit rate and round trips remain unavailable; no before/after speedup claimed.
