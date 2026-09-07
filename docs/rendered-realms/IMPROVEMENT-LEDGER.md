# Improvement ledger

Counting method: 13 coherent user-facing or rendering workstreams. Individual cards, calculator formulas and minor spacing changes are not each counted as a completed design feature.

| ID | Area | Original problem | Implemented change | User benefit | Files | Evidence / status |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | Persona identity | Cores needed clearer construction | Hammer details, crystal edges, indexed iris and larger relics | Distinct recognizable objects | `public/fx/cores/{thor,loki,odin}.js` | Geometry/lifecycle tests pass; GPU appearance unverified |
| R02 | Spatial council | Homepage lacked a physical council | Five gems per persona, pedestals, tethers, gateway and dais | Inhabited 3D composition | `realm-architecture.js`, `scene.js` | Node geometry tests and simplified screenshots; GPU unverified |
| R03 | Council access | Advisor context was remote from the core | Mesh picking, named dock and dossiers | Reach advisor roles and prepare delegation | `arsenal.js`, `council-data.js`, `scene.js` | Dossier browser-verified; direct mesh picking source-reviewed |
| R04 | Tool discovery | Existing backend breadth was hard to find | 223 schema-backed entries, persona/category/search filters | Find actual backend definitions | `tool-catalog.json`, generator, `arsenal.js` | Exact schema/permission tests and DNS browser search pass |
| R05 | Tool inputs | Free text hid required parameters | Schema-generated forms prepare chat requests | Correct field types with final review | `arsenal.js` | DNS fields and prepared request verified; no direct execution |
| R06 | Saved tools | Repeated discovery cost effort | Up to 30 saved IDs and field retention during save | Faster repeat use | `arsenal.js` | Reload persistence and field retention observed |
| R07 | Mission starts | Useful requests required composing from scratch | 16 editable mission briefs and draft protection | Faster researched requests | `arsenal.js` | Domain brief and Add to draft verified |
| R08 | Activity truth | No compact request history | In-memory chat status/timing journal | See real received/failed replies | `app.js`, `arsenal.js` | Successful fixture and 503 entries verified |
| R09 | Monetization workbench | No direct scenario utilities in the UI | 36 deterministic local tools | Revenue, cost, capacity and content calculations | `local-tools.js`, `expansion.js` | All 36 run in Node; MRR result browser-verified |
| R10 | Automation preparation | Recurring use cases lacked clear setup briefs | 24 editable automation templates | Specify triggers, data, approvals and failure behavior | `expansion.js` | Template inventory tested; browser preparation checked |
| R11 | Expansion planning | New ideas mixed with implied installed tools | 186 explicitly proposed integrations with requirements | A concrete implementation queue | `expansion-catalog.json`, `expansion.js` | Inventory/status tests and proposal browser inspection pass |
| R12 | Responsive access | Larger scope risked overwhelming phones | Stacked chamber/chat, shortcut, wrapping controls and modal sections | Usable small layouts | HTML, CSS, `app.js` | 390/320 CSS layouts inspected; physical devices unverified |
| R13 | Rendering fallback | Intersecting ribbons obscured the still view | Wire projection, label spacing, cleanup and single-loop integration | Clearer unsupported-GPU experience | `scene.js`, CSS | Simplified screenshots and core resource tests pass |

All backend execution and third-party integration health remain outside the fixture/browser verification. Proposed integrations are not completed features.
