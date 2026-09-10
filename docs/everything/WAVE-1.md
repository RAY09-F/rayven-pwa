# Wave 1 — tool discovery

Status: implemented and locally verified; live acceptance and deployment **BLOCKED** by the Wave 0 provider-credit failure. This is EVERYTHING Wave 1, not the old brain-brief numbering. Do not deploy main wholesale: it contains other undeployed waves.

## Corrections made

- Use the provider's exact BM25 tool name, `tool_search_tool_bm25`, with type `tool_search_tool_bm25_20251119`.
- Build one permitted catalogue for the entire tool loop. Restricted advisor catalogues also receive the search entry, so their deferred tools are discoverable. A provider-requested tool outside that restriction is still refused by the execution gate.
- When enabled, replace the old find_tools instruction with the server discovery instruction. Other persona rules remain intact. With the flag off, the existing instruction and schema behaviour remain.
- Preserve server search input/results/references unchanged when continuing the loop. Only client tool_use blocks receive tool_result replies. Streaming reconstruction preserves the same blocks, including search failures.
- An exhausted pause or tool loop now returns an explicit incomplete-work error with the list of tools already invoked. It cannot fall through to the chat route's generic Done response.

The existing alias layer remains ahead of all family renames. No family was activated or renamed. The public registry still respects concealed identities. Four client tools plus the server search are eager on main: util_context, web_search, search_memory, list_todos and the search entry. The rest remain deferred with no cache_control; the last eager tool carries the breakpoint. All permitted schemas are sent on every request. Main has 232/199/216 client tools for Thor/Loki/Odin; these are source counts, not production counts or token measurements.

## Verification

`npm test` passed 180 tests, including nine new integration/protocol tests in scripts/everything-tool-search.test.mjs. Those exercise the actual callClaudeWithTools loop and stream collector with intercepted provider responses. No real inference, external tool request or human message was made. The calculation test confirmed the existing task:log write; it is not falsely described as a zero-write execution.

These tests prove request construction, continuation, failure reporting and permission boundaries. They do not prove the configured model accepts discovery, model tool selection, cache hits, physical browser/Spotify operation or speed improvements. A funded live test must establish all of those before activation and a five-minute 10% canary.

Cross-turn history still stores readable final conversation text; full provider tool blocks are retained within a running tool loop, not across saved user turns. Do not claim that a new user turn reuses previously discovered inline references. The stable catalogue/system prefix is still cacheable, but actual cache usage remains unmeasured.

## Source reconciliation and deployment

Current provider documentation defines the name/response shape and cache rules used above: [Tool search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool). The source brief's fixed total of 223 tools (EVERYTHING lines 454/979/982) does not match either the live registry or main; derive totals from the permitted definitions. The compatibility table does not list the configured Sonnet 5 even though the model overview lists that model. Treat that as an unresolved documentation gap until a real request succeeds; no unsupported-model fallback or paid model swap was introduced.

No Wave 1 upload or traffic change occurred. Production remains bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f at 100%, floating-5129bddde7ea. Rollback command: `npx wrangler rollback bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f --name asgrard-backend`. Re-record the active version before any future deploy. Wave 2 can proceed with independent Bridge implementation while this live gate remains explicitly blocked.
