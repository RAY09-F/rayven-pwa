# ASGARD brain and arsenal progress

Current wave: 1, implementation and fixture tests. Wave 0 completed its available read-only measurements; successful paid inference/audio measurements are explicitly BLOCKED.

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
