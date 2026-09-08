# ASGARD — Wave 10 report

2026-09-08. Engineering checkpoint; the full brief is **not complete**. Tested implementation through Wave 9 was pushed to main at **3b42c7a**. No brain-wave release has been deployed. The existing Floating Realms release remains live.

## 1. What was actually wrong

Chat waited for a complete reply before showing words. Voice waited for a complete audio file. Tool lists changed with keywords, preventing a consistently reusable prompt prefix. Some background delegation started another model call. Smoke tests could consume pending approvals and write conversation state. External tools also had real access refusals, retired endpoints and shared request limits.

The model was **already Sonnet5** at the baseline; changing the model is not an achievement of this pass. The new code adds streaming, more stable cache configuration, scoped delegation, structured memory behind a switch, voice interruption safeguards, and a stopped-by-default conversation-copy trial. Review and tests caught additional audio races and screenshot handling issues.

Evidence: [baseline](PERF-BASELINE.md), [wave record](ASGARD-PROGRESS.md), [historical failures](../evals/real-failures.json), and [verification summary](verification/brain-checks.json).

## 2. The numbers

| Measurement | Before | New release |
|---|---|---|
| First reply byte / first word | Successful model response unavailable; historical failed request took about2,027ms | Unmeasured; not deployed |
| First sound | Unmeasured | Unmeasured; physical playback required |
| Tokens per turn | Unavailable | Unavailable |
| Core tool-schema tokens | Provider counting rejected the account balance; JSON sizes were12,963/12,760/10,801bytes for Thor/Loki/Odin, **not tokens** | Unavailable |
| Cache hit rate | Unavailable | Unavailable |
| Model round trips per real turn | Unmeasured | Unmeasured; inline-delegation fixture uses two ordinary requests and no nested councillor model |
| Backend tool entries |277 total |300 total:23 added across Waves2/7;246 visible in the existing public catalog |
| Automated checks | No comparable whole-suite baseline claimed |148 passed; five Chrome fixture checks passed |

Separate **existing-production** analytics:860 requests,0 recorded errors,3,127 subrequests in the sampled trailing24 hours. CPU processing p50 was1.278 ms and p99 was66.518 ms. These include mixed site/cron traffic; they do not measure how quickly a person hears an answer. On completed UTCSeptember7, ASGARD KV recorded1,833 writes and21,882 reads. Adaptive analytics may be estimated. [Raw evidence](CLOUDFLARE-DAILY-USAGE.json).

## 3. What is faster and why

The new reply path can show words as they arrive and avoids a separate councillor model call for inline delegation; an actual speed improvement has **not yet been measured**. No “10× faster,” token-saving percentage or sub-second voice claim is justified.

## 4. Every tool added

These are code entries, not23 verified live capabilities. Seven Wave7 adapters returned real public data from the development machine; provider-key tools remain unverified. [Actual adapter results](ARSENAL-TOOL-PROBES.json).

| Family / tool | What it does for you | Setup / verification |
|---|---|---|
| Context: `util_context` | Collects current time, tasks and service context in one place. | Existing services; local tests |
| Context: `plan_today` | Combines today's calendar, tasks and timers. | Existing stores; local tests |
| Context: `world_here` | Combines Bakersfield weather, air quality and alerts. | Existing readers; local tests |
| Documents: `doc_to_markdown` | Reuses the existing document reader to convert documents into text. | Disabled until allowance verified; images can consume AI allowance |
| Documents: `doc_ocr` | Reads text in an image or short PDF. | OCR.space key needed; disabled |
| Search: `web_firecrawl_search` | Finds public webpages through Firecrawl. | Key and free allowance verification needed; disabled |
| Search: `web_exa_search` | Finds related pages through Exa's search service. | Key and free allowance verification needed; disabled |
| Markets: `money_filings` | Lists a company's recent SEC filings. | SEC contact header needed; unverified |
| Markets: `money_fundamentals` | Reads a reported financial figure with units and dates. | SEC contact header needed; unverified |
| Markets: `money_treasury` | Reads the latest federal debt figures. | No key; real adapter check passed |
| Markets: `money_macro` | Reads economic observations such as unemployment. | Free FRED key needed |
| World: `world_recalls` | Finds FDA food recall notices. | No key; real adapter check passed |
| World: `world_drug_lookup` | Reads official medicine labeling. | No key; real adapter check passed |
| Developer: `dev_repo_status` | Checks repository activity and open issues. | Public read passed; optional GitHub token improves limits |
| Developer: `dev_actions_status` | Checks the latest GitHub workflow results. | Public read passed; repository had no workflow runs |
| Developer: `dev_self_check` | Checks the actual homepage, expected release and extension heartbeat. | Expected release must be configured; cron switch off; local failure tests |
| Knowledge: `util_openalex` | Finds scholarly works and source links. | Keyless adapter check passed |
| Knowledge: `util_pubmed` | Finds PubMed article identifiers and links. | Keyless adapter check passed |
| Media: `media_movie_lookup` | Finds movie summaries and release dates. | TMDB read token and terms acceptance needed |
| Media: `media_transcribe` | Submits public audio for transcription or reads its result. | AssemblyAI key and allowance verification needed; disabled |
| Browser: `browser_cloud_read` | Reads a public page using a cloud browser. | Scoped Cloudflare token/allowance needed; disabled |
| Browser: `browser_cloud_screenshot` | Captures a public webpage without using your logged-in Chrome. | Scoped Cloudflare token/allowance needed; disabled |
| Communications: `comms_push` | Reuses the existing phone-notification sender. | Explicit enable and 32-character secret topic required; disabled |

Existing weather, vehicle recalls, holidays, books, currency, DNS, packages, image generation and MeloTTS were reused. They are not counted as new tools. No existing tool family has been renamed or activated under its new alias; the compatibility layer was built first.

## 5. Written, pushed, deployed and verified

- **Written and locally verified:** implementation checkpoints through Wave 9;148 automated tests, five Chrome fixture checks, seven real public-data adapter checks, and a successful Worker dry-run build (936.80 KiB;257.23 KiBcompressed).
- **Pushed:** main includes the implementation at 3b42c7a. Report/presentation commits follow it. The original checkout and its local files were preserved.
- **Deployed and verified:** the earlier Floating Realms release, `floating-761d8ca5ef4f`, on the [actual live index](https://asgrard-backend.rayanfahil2.workers.dev/). Its25 asset hashes and content types matched the baseline on both actual and legacy hosts. [Actual host evidence](verification/live-primary.json), [legacy host evidence](verification/live-legacy.json).
- **Not deployed:** every brain wave. Current production version is `e0f22382-5553-4069-94bd-8b1e5acb2523` at 100%. No candidate was uploaded, no 10% traffic trial was started, and no five-minute observation was claimed. Local frontend fingerprint is `floating-bba551eb5f92`.

## 6. What is blocked and the smallest next step

1. **Model/voice acceptance:** the provider reported insufficient balance, even for free token counting. The earlier request to use up to $5 of existing credits is unanswered. Authorize a small test allowance; if the account truly has no credits, you decide whether to fund it. I have not purchased or topped up anything.
2. **Gateway setup:** the current login returns403 for AI Gateway management. Grant a scoped AI Gateway management credential; then I can create the gateway and set its limit before any traffic. Do not paste credentials into a public issue or report.
3. **Billing:** the login can read Worker settings and analytics but cannot read subscriptions. Confirm the Workers plan in Cloudflare Billing. If it is Free, the measured1,833dailywrites make the **$5/month Paid plan** a reasonable recommendation. That includes 1 millionKVwrites/month, then $5/million; it is not unlimited free storage. No upgrade was made. [Official pricing](https://developers.cloudflare.com/kv/platform/pricing/).
4. **Optional services:** provide only the keys for services you want enabled; the table above lists them. No card-based signup is needed to finish the core free code work.
5. **Physical voice and browser:** reconnect the Chrome companion and use the Chromebook microphone/speakers for the acceptance session. Automated browser replies cannot verify echo cancellation or heard-word timing.
6. **Conversation trial:** after the early waves pass, deploy the disabled-copy feature in its own release, then start dual-writing and observe seven full days. Any disagreement stops the trial. Old KV deletion remains a separate decision for you.

Remaining deployment sequence is an implementation task for me: replay each wave checkpoint in order; satisfy that wave's live acceptance; record the current version; upload only that wave; put10% traffic on it; observe five real minutes; promote to 100%only after passing; verify actual release bytes and behavior. Do not deploy the combined main branch as one multi-wave release. Corrective commits must be included in the relevant wave candidate before its acceptance tests. Missing measured acceptance is the blocker, not ordinary Wrangler deployment access.

## 7. What I deliberately did not do

I did not change the halls, artwork or CSS; delete old memory; change paper-trader identities; enable real brokerage orders; send a message/call; buy a plan; or bundle waves into a deployment. No renamed tool family was forced through a failed acceptance gate.

Programmatic tool execution, new MCP/OAuth federation, Agents SDK migration and speech-to-speech remain phase2. The existing MCP and scheduling systems were kept. No new Workflows integration is claimed: crash recovery and the five-job delegation drain still need work.

No duplicate Todoist store, Google card-based pollen account, paid Pushover, Brave Search or Alpha Vantage integration. No invented package, flight, gas-price or outage API. Jina fallback, FMP earnings/ETF entitlements, SEC full-text revival, AirNow replacement, Transitland coverage, Podcast Index and Wolfram setup remain unresolved rather than claimed complete. Semantic Scholar's failed shared-quota adapter stays dropped.

Corrections are recorded in the progress file: brief lines 1498–1499, 1510, 1519 and 1577–1578now reflect separate internal-service quotas, actual KV pricing and safe gateway fallback. Earlier sections also had an impossible one-request fresh-research claim and an MP3-fragment decoding approach that needs a different implementation.

## 8. What I am least sure about

The biggest unknown is real voice behavior on your Chromebook: delay, speaker echo and exact heard-word tracking. Next are Sonnet5's live deferred-tool/context-editing compatibility, simultaneous conversation writes, and public APIs behaving the same from Cloudflare as from this machine. The new memory and conversation paths stay off until those tests pass. The60 selection prompts are authored drafts, not a real-user golden set, and there are no fabricated persona or performance scores.

The next useful ideas are a visible release/connection health indicator, a real voice benchmark session, durable recovery for queued research, and later permissioned assistant-to-assistant collaboration. These are future work, not deployed features.
