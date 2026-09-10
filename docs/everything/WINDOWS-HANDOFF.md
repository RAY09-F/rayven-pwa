# Current Windows continuation

Updated 2026-09-10 UTC. This is the current PC status record; historical deployment receipts remain historical evidence. No deployment or push was performed in this continuation.

Latest goal continuation: see [GOAL-CURRENT.md](GOAL-CURRENT.md) for the new live-realm Bridge, 100 runnable tools, website/automation service studio, presentation/manual and the five-cycle refinement programme (all five accepted locally). Latest suite now **456 passed, zero failures** (`output/goal/latest-tests.log`), with final Worker dry-run (`output/goal/dry-run.log`), tool/browser/scene checks and hall draft handoff passing. Changes remain local and uncommitted on the same continuation branch; production is unchanged.

## Setup and migration

Repository: `C:\Users\Hoengager\Desktop\ASGARD\rayven-pwa`

Remote: `https://github.com/RAY09-F/rayven-pwa.git`. Main and origin/main were both `94ad76bb894edce7441bd9adb8d4011c7262c6dd` at clone time. Work continues on `codex/windows-wave2-continuation`. The parent folder's user handoff was preserved. No prior checkout, stash or local worktree existed in this fresh clone. A depth-limited scan of Desktop, Documents, Downloads and OneDrive found no other ASGARD checkout or backup; this is not an exhaustive disk inventory.

Native Windows/PowerShell; Git 2.53.0.windows.3; bundled Node 24.19.0. No repository AGENTS.md found. `npm` was absent from PATH; bundled pnpm's npm runner successfully performed `npm ci --ignore-scripts --no-audit --no-fund` from the existing package-lock.json. Three remains pinned at 0.184.0; no package manifest/lockfile changes. Wrangler 4.122.0 was run through pnpm's package runner, matching the documented tool version. No global tool install or WSL setup.

| Item | Status |
| --- | --- |
| Committed GitHub history and remote branches | Recovered in fresh clone |
| Existing Windows handoff | Preserved outside repository |
| Windows dependency installation and baseline tests | Verified; 224 baseline tests pass |
| GitHub terminal identity | Unverified; Git Credential Manager lists no accounts; public cloning is anonymous |
| Cloudflare identity/current traffic configuration | Blocked locally; Wrangler whoami reports unauthenticated |
| Chromebook local edits, branches, stashes, ignored files | Unverified; user has no backup and does not believe important files remain. Recovery is optional and does not block development |
| Downloads, design packs, browser-local drafts/configuration | Unverified; keep Chromebook unchanged |
| EVERYTHING Part 2/12.1 original source brief | Not found in tracked checkout or supplied handoff; current WAVE-2 scope is explicit |

Recovery checklist: `C:\Users\Hoengager\Desktop\ASGARD\CHROMEBOOK-RECOVERY.md`. Restore into a separate recovery folder and reconcile before merging. Do not copy ACHILLES configuration or secrets into ASGARD.

## Production comparison

Documented production source: `71abd14`, release `floating-5129bddde7ea`; remote deploy/solar-hud ends at documentation commit `b973617`. Main differs from the production source across 270 files, including other undeployed backend waves. Its committed manifest is `floating-dde08d30be0d` and is not proof of a deployed main build.

On 2026-09-10 UTC both established hosts independently returned production-matching root, /hall/, /hud/ and release.json bytes. All 162 manifest assets per host passed SHA-256 and applicable MIME checks. Evidence: `output/windows/live-comparison.json`, `output/windows/live-assets.json`. These are public byte checks, not authenticated proof of the current Cloudflare version or traffic allocation. The last documented version remains `bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f` at 100%.

DO NOT DEPLOY MAIN WHOLESALE. Preserve the existing asgrard-backend Worker name, bindings, migration and scheduler. Future release work requires the production lineage, authenticated current version inspection, the documented canary and outstanding acceptance gates.

## Local checks and preview

From the repository in PowerShell:

```powershell
node --test --test-concurrency=1 scripts/*.test.mjs
node scripts/ui-preview.mjs --port 4191
```

Preview: http://127.0.0.1:4191/ . The static preview has no live backend proxy; empty/unavailable records are expected. Browser fixture data is not live data. Full conversation lives at /hall/ and HUD at /hud/.

Existing Bridge browser checks passed in headless Microsoft Edge 152.0.4191.66 on Windows at 1440x1000 and 375x812: edit/review/approve, repeated questions, councillor attribution, preserved drafts, keyboard controls, mock microphone lifecycle and failed-refresh recovery; zero application errors. Screenshots were visually inspected. Evidence: `output/windows/browser-check.json`, `output/playwright/bridge-desktop.png`, `output/playwright/bridge-phone.png`. This does not certify physical microphone or hall GPU performance.

Final Wrangler dry-run succeeded after implementation; output in `output/windows/final-dry-run.log`. A dry-run performs no release upload or traffic change. Output evidence is ignored local material; preserve it during migration.

## Implementation checkpoint

Completed routine-start tracking in src/lib/routines.js, src/lib/routine-continuation.js and src/lib/bridge-runs.js, with ten focused regression tests in scripts/bridge-routine-start.test.mjs. Ordinary routines publish their task plan before their first step, claim their start atomically, retain one parent execution through councillor work and batches, and settle their terminal outcome only after the outer receipt is saved. Lost progress acknowledgements become unknown and block automatic replay. Legacy batches without tracking receipts retain their existing behavior. No model calls or scheduler were added.

Final full suite: 234 passed, zero failures (`output/windows/final-tests.log`); git diff --check passed. Final Bridge fixtures and Worker dry-run also passed. Separate Edge navigation check transferred a Bridge draft into the hall composer, consumed its transfer record once, and recorded zero POST requests or page errors (`output/windows/hall-handoff.json`). Changes are local and uncommitted on the continuation branch.

## Next coherent slice

The read-only recovery review identified concrete remaining issues:

- An initial receipt failure retains a not-ready question and fences duplicate runs; the Bridge already reports unknown inbox count, but the hidden waiting item needs an explicit recovery state.
- A second-question receipt failure during resume can set the execution unknown, leaving its saved question outside existing activation/answer paths. Reconcile receipt state idempotently without rerunning steps.
- Transient routine verification read failures in question and batch continuation are currently conflated with verified changed/disabled definitions and may mark work failed; uncertainty must retain the replay fence.
- Terminal receipt pruning does not delete checkpoint payloads. Bound superseded/orphaned payloads while retaining compact unresolved-work fences.
- Conversation history still uses read/modify/replace KV writes in question answers, ordinary chat and routine speech. Strict reads and the optional mirror do not prevent simultaneous writers from losing updates. Cover every writer in a separate concurrency correction.

Use fault injection for writes failing before commit versus committed writes with lost acknowledgements. Keep recovery and retention scoped; do not activate an answer before its outer receipt is confirmed. Current routine-start changes address execution progress ambiguity, not all external action or storage uncertainty.

Remaining broader gates: bounded checkpoint retention, explicit interrupted/unknown recovery, simultaneous conversation-write correctness, integrated Worker/ledger and hall handoff checks, funded provider acceptance, physical voice/hardware checks and an isolated production-based release. No paid inference, external human message, purchase or live mutation was used for this continuation.
