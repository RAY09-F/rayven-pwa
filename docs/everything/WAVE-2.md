# Wave 2 — Bridge in progress

This is a source checkpoint, not a finished Bridge or deployment. Wave 1 live acceptance remains explicitly blocked.

Before starting, read EVERYTHING Part 2/12.1 and the Cloudflare Agents README, state, scheduling and human-in-the-loop patterns. Reuse AsgardLedger, council records, approvals, conversation spools and cron. No SDK or second scheduler was installed. Consulted the installed ui-ux-pro-max skill for empty/loading/error states and accessibility; no palette or fonts generated.

Sources: https://github.com/cloudflare/agents ; https://developers.cloudflare.com/agents/runtime/lifecycle/state/ ; https://developers.cloudflare.com/agents/runtime/execution/schedule-tasks/ ; https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/ .

## Written and checked locally

- The homepage now mounts the Bridge. It reads `/bridge/state`; existing `/hall/` and `/hud/` remain available. NEEDS YOU, RUNNING NOW, SINCE YOU LEFT, hall cards, GLANCE, Talk/Type, visit/dismissal persistence and basic keyboard navigation are implemented. Full command palette remains Wave 3.
- REVIEW actions use the existing approvals store and permission checks. Edit saves literal supported fields without execution; approval requires the reviewed revision. Serialized execution claims in the existing ledger stop duplicate/stale execution, including legacy resolver calls. Unknown outcomes cannot automatically retry. This is not a second approval inbox. It does not make unrelated whole-list KV writes transactional.
- NOTIFY cards use recorded notifications and stable dismissal IDs. Real conversations, calendar, todos, cached weather, extension heartbeat and estimated recorded model costs are projected. Missing sources remain unavailable. Simulated trading stays labeled; unsupported metrics are absent.
- Hall cards use small captures of the existing real WebGL models. Starting three preview renderers delayed initial navigation, so the default Bridge starts none. The halls retain full interactive scenes. The capture script regenerates previews from geometry and excludes surrounding controls.
- Talk supports browser dictation with typing fallback; mock recognition checks are not physical microphone acceptance. Draft handoff never automatically sends or starts paid inference.
- Existing tool-loop processing now writes actual round/request boundaries to the existing ledger. Concurrent jobs retain independent records. A heartbeat renews a 90-second execution lease; expired/failed/cancelled jobs cannot be displayed as actively running. Percentages count recorded processing steps, not elapsed time or overall goal completion. Handling a tool request is not a claim that its requested external action succeeded. No scheduler or SDK added. No additional KV writes for this tracking.
- Six new execution tests exercise concurrency, expiration, hidden-owner filtering, the real tool loop with mocked provider responses, exhaustion and disabled tracking. Model and tool-processing boundaries are wired; richer objective plans and question pause/resume still need implementation.

## Evidence and limits

Prior checkpoint: 200 repository tests passed and Wrangler dry-run built successfully. Browser fixtures passed desktop/phone layouts, edit/approve controls, draft preservation, basic commands, microphone stop/mode switching, and failed-refresh recovery. Screenshots: output/playwright/bridge-desktop.png and bridge-phone.png. These are local fixtures, not live data or deployment evidence. After adding execution tracking, all 206 repository tests passed (zero failures), and a fresh Wrangler dry-run completed successfully. Evidence logs: /tmp/bridge-complete-tests.log and /tmp/asgard-bridge-build.log. No deployment occurred.

No paid inference, purchase, real-person send, deployment upload or traffic change was performed. The pending controlled-AI-test spending question remains unanswered.

## Next, before shipping

1. Implement actual QUESTION persistence and continuation through the existing runner. The current draft-to-hall UI is not a completed pause/resume flow and must not be represented as one.
2. Extend processing records into task-specific mutable plans where real objectives/steps exist; expose interrupted/failed outcomes without inventing successful completion.
3. Verify Worker/ledger routing, hall draft handoff, and the integrated page again after these changes. Physical voice and funded model acceptance remain separate gates.
4. Build an isolated Wave 2 release on the production lineage. Main contains other undeployed waves and must not be deployed wholesale. Record current version, 10% for five actual minutes, then 100% only after checks and separately verify the unpinned live index.

No Wave 2 deployment occurred. Current live checkpoint: bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f, floating-5129bddde7ea. Rollback: `npx wrangler rollback bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f --name asgrard-backend`; revalidate before deploying.
