# ASGARD brain and arsenal progress

Current wave: 2, alias inventory and compatibility layer. Wave1 live acceptance is explicitly BLOCKED. Wave 0 completed its available read-only measurements; successful paid inference/audio measurements are explicitly BLOCKED.

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
