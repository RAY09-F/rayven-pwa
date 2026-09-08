# ASGARD brain and arsenal progress

Current wave: 5, structured memory and post-response extraction. Wave4 live acceptance is explicitly BLOCKED. Wave3 live acceptance is explicitly BLOCKED. Wave2 activation is explicitly BLOCKED. Wave1 live acceptance is explicitly BLOCKED. Wave 0 completed its available read-only measurements; successful paid inference/audio measurements are explicitly BLOCKED.

## Rules carried forward

Work in order 0 through 10. One wave per commit/release; tool renames also one family per release. Before EVERY deployment record current Cloudflare version here, upload a candidate, deploy 10%, observe at least five real minutes, then promote only with passing evidence. Never change halls, artwork, CSS, persisted key names or paper-trader identities. No KV deletion, money, paid-plan change or real messages without explicit user approval. Already-installed design skill is not reinstalled.

## Baseline

- Worktree: /home/rayanfahil2/asgard-brain, branch codex/asgard-brain, baseline d349c754cf20172835e90049f868729ef8101724. Original checkout untouched.
- Canonical brief recovered from newer root `ASGARD-CODEX-BRAIN-AND-ARSENAL (1).md`; requested docs path was absent locally and on main. Full 1,986-line brief read first.
- Git remote: https://github.com/RAY09-F/rayven-pwa.git.
- Live Worker: asgrard-backend; current version e0f22382-5553-4069-94bd-8b1e5acb2523 at100%; deployment72677f35-51d2-4a8c-a0d9-add75b63d756. Existing release floating-761d8ca5ef4f matches source assets.
- No deployment performed in this brain task yet. Rollback if needed: `npx --no-install wrangler versions deploy e0f22382-5553-4069-94bd-8b1e5acb2523@100% --yes` (verify CLI syntax before executing).
- Wave0: BLOCKED for successful inference/voice/usage baseline: Anthropic rejects even the free count-tokens endpoint for insufficient balance; physical microphone/speaker timings unavailable. See PERF-BASELINE.md. No fabricated token counts or latency claims.
- Spending approval question pending: up to$5 existing API credits only; no purchases/top-ups/plan changes authorized. Continue free implementation/fixtures while paid acceptance is blocked.

## Next action

Wave1: implement the shared Messages API streaming/parser/error handling and stable cache configuration with fixture tests. Preserve JSON callers, approval gates and all existing tools. Do not enable or deploy a change without the required live acceptance; mark unmet checks blocked and continue waves in order.

## Wave 1 — implementation tested; live acceptance BLOCKED

- Added provider SSE reconstruction and browser progressive reply handling; legacy JSON requests remain supported. Tool JSON parses only at block stop; thinking/signatures stay internal. Midstream errors never replay a partially emitted reply. HTTP 429 honors Retry-After, spending caps do not retry, and overload errors use bounded backoff.
- Sonnet 5 remains the existing model, with low effort/adaptive thinking for ordinary turns and high effort for research/planning. Haiku extraction now uses a strict facts schema. Existing hidden workflows have not been rewritten without their own verification.
- Stable persona/tool cache markers use one hour; current-context facts move to the first user envelope. Existing usage logging now exposes cache reads/writes and prices mixed cache lifetimes correctly. Wave2 must replace the changing keyword tool arrays before the cache prefix is stable across tool discovery.
- Smoke requests now use an empty conversation, skip approvals and delivered-status writes, and disable server tool execution. This corrects a pre-existing test isolation bug.
- Interrupted turns retain completed-action metadata and finalize status. Aborting cannot undo a tool already in flight.
- Evidence: 10 dedicated offline stream/integration tests, existing conversation/state tests, 5 Chrome browser fixture checks, and Wrangler dry-run build. Real Worker handler is exercised with mocked provider and KV; no provider or real-person requests were made. Browser fixture verifies incremental rendering and cancellation, not live latency.
- Deployment BLOCKED: no successful baseline or current provider inference is available; live cache-hit, speed and five-tool model acceptance cannot pass while Anthropic rejects the account balance. Spending approval is still pending. No candidate uploaded, no traffic changed, no 10% timer claimed. Authenticated Wrangler access confirmed. Current production remains e0f22382-5553-4069-94bd-8b1e5acb2523.
- Correction to brief §5.4 (lines 624–628): extension source is in this repository and dispatches action verbs, not literal browser tool names; actual loaded extension is nevertheless disconnected, so browser renames remain blocked.
- Next: Wave2 alias layer and tool-name inventory first. Wave1 is explicitly blocked before Wave2 starts. Later commits must not be bundled into a multi-wave deployment; each blocked release will need its own acceptance/canary when prerequisites return.

## Wave 2 — compatibility foundation implemented; activation/renames BLOCKED

- Before runtime changes, recorded all 277 existing names and intended final names in TOOL-NAMES.md and TOOL-RENAME-MAP.md. Commit f8b896e adds reversible alias resolution to dispatch, persona boundaries and stored permission lookup. No stored key changes. No family has been activated/renamed. Legacy schema retention has no automatic expiry; its minimum 30 days starts only at each actual family deployment.
- Added provider BM25 request construction, complete deferred schema array and last-non-deferred cache marker. It remains behind TOOL_SEARCH_ENABLED, unset in production, because the current official compatibility table surprisingly omits Sonnet5 and the account cannot run a compatibility check. Do not claim an unsupported request is verified. Existing discovery remains the fallback until that acceptance succeeds.
- Added util_context, plan_today and world_here composition using existing readers, with partial failures labeled. Outside-content results taint subsequent actions. Tool results now have conservative UTF-8 byte caps below 25,000 tokens; byte counts are not presented as measured token counts.
- Offline tests pass for all name round trips, every public persona's alias permission parity, hidden-persona isolation, retained legacy schemas, stable deferred arrays and cache placement. Five core names are eager under provider discovery; legacy spellings remain until their individual family releases.
- BLOCKED: model schema-token count and 70% comparison, cache hits, 60-utterance live selection score, extension/email/screenshot and Spotify end-to-end checks. Real misuse evidence has not established a defensible “15 most misused” ranking; examples will not be falsely described as measured. Family renames cannot proceed through their required deploy-and-verify gates. No Wave2 release uploaded or deployed, and no combined Wave1+Wave2 deployment attempted.
- Deferred explicitly: programmatic tool execution sandbox (brief §5.7). This remains phase2.
- Next Wave3: persona prose and examples. Wave2 is explicitly blocked before that work begins.

## Wave 3 — spoken prompts implemented; measured persona acceptance BLOCKED

- Replaced the three public prompts with stable prose: role, spoken-output guidance, concise default, individual relationship, tool categories, permissions, four diverse examples and the requested formatting block. Kept sender privacy, Chrome/internal-calendar limits, simulated trading and the existing retired-clipping business state. Removed hardcoded market statistics from the public prompt in favor of current verification; no user data or hidden-persona prompt was rewritten.
- Increased public reply headroom to 4,096 tokens; the prompt governs length rather than cutting answers mid-thought. No halls, artwork or CSS changed.
- Eight offline prompt/alias checks passed. These verify structure and boundary preservation, not whether generated replies sound good.
- BLOCKED: fifteen actual outputs per persona and the 80% speaking-quality score need funded model access and spending authorization. No invented pass rate. No release uploaded/deployed; production remains the recorded floating release. Wave3 explicitly blocked before Wave4 starts.

## Wave 4 — inline council boundary and queued hall delivery implemented; live acceptance BLOCKED

- Reused the existing council registry, keys, schedules and paper-trading wrappers. Added profile metadata without changing roster order or trader IDs. Inline delegation now selects a narrow server-owned execution scope instead of starting a nested model. Subsequent tools in the same batch and later rounds are checked against it. Background toolsOverride is enforced too. Communication sends are refused by councillor scope.
- Queued tasks carry objective, output format, allowed tools and stopping boundaries. Reports use the existing pendingSpeech hall inbox, not Telegram. Existing unrelated standing duties were preserved; no new outgoing-notification schedule was enabled.
- Twenty-two combined offline checks passed. Integration fixtures prove no nested model call for inline delegation, a logged server refusal for Kang attempting an aliased SMS, a queued research report reaching the hall inbox, and all five historical paper IDs.
- Brief correction §7.3/7.6 (around lines 874–875 and 925–926): fetching a client-side tool result and answering from it necessarily needs another Messages API round trip. Removing a separate councillor model does not make fresh research literally one API request or zero latency. The fixture performs the ordinary two requests (tool selection, final answer), without a nested agent.
- Brief family exception: Sylvie's standing FX duty requires the existing money_convert tool although her listed families say world/util. Kept that narrow existing capability. Corrected the Wave3 description that had mistakenly called Sylvie a communications profile; she handles the outside world.
- BLOCKED: actual sourced research, actual cron delivery and live latency comparisons need funded API access; no real-person test sent. Standing-duty expansion is not activated without those checks. The existing five-delegation-per-tick drain also needs overload/recovery verification before claiming reliable bulk queuing. No Wave4 deployment. Wave4 explicitly blocked before Wave5 starts.
