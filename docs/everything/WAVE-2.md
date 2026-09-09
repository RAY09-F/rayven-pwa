# Wave 2 — Bridge in progress

This is a source checkpoint, not a finished Bridge or deployment. Wave 1 live acceptance remains explicitly blocked.

Before starting, read EVERYTHING Part 2/12.1 and the Cloudflare Agents README, state, scheduling and human-in-the-loop patterns. Reuse AsgardLedger, council records, approvals, conversation spools and cron. No SDK or second scheduler was installed. Consulted the installed ui-ux-pro-max skill for empty/loading/error states and accessibility; no palette or fonts generated.

Sources: https://github.com/cloudflare/agents ; https://developers.cloudflare.com/agents/runtime/lifecycle/state/ ; https://developers.cloudflare.com/agents/runtime/execution/schedule-tasks/ ; https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/ .

## Written and tested

src/lib/bridge.js projects existing approvals, visible conversations, council activity, calendar, todos, extension heartbeat and recorded model cost. Not connected to the router or homepage yet. Eight tests in scripts/bridge.test.mjs pass. Fixtures never become displayed data.

- Successful empty reads and unavailable sources differ. Reviews cap at five with full pending count retained; expired/private/foreign council records are excluded.
- Activity retains recorded times, deduplicates spool/legacy copies and applies the since boundary. No invented overnight work.
- Calendar uses America/Los_Angeles; cached weather keeps its age. Recorded model usage cost is explicitly estimated and excludes speech/search/hosting.
- Existing replying status writes a fixed progress=0.5. This is not measured 50% progress and is excluded. Plans require real steps and an unexpired execution lease; producer instrumentation remains unfinished.
- Failed ledger reads cannot revive stale KV costs as current values. Reading never executes an approval, starts a model, sends a notification or writes storage.

## Next, before shipping

1. Finish NOTIFY/QUESTION producers and actions; REVIEW edit/approve/reject through existing approval gates; safe retries/outcome records. Do not build a second approval store or send to people in acceptance tests.
2. Instrument actual task boundaries in the existing runner and persist plan/failure/interruption state.
3. Build the actual Bridge homepage: NEEDS YOU, RUNNING NOW, SINCE YOU LEFT, hall cards, GLANCE, pinned Talk/Type bar. Preserve /hall/ and /hud/. Full command palette belongs to Wave 3; no broken control may pretend it works.
4. Persist visit/dismissal state; keyboard/focus/errors/offline recovery; no more than five inbox items or one active-step pulse.
5. Real browser/phone checks, integration tests, then an isolated Wave 2 release on the production lineage. Record version, 10% for five actual minutes, 100%, separately verify unpinned live index.

No Wave 2 deployment occurred. Current live checkpoint: bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f, floating-5129bddde7ea. Rollback: `npx wrangler rollback bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f --name asgrard-backend`; revalidate before deploying.
