# Handoff — Rendered Realms

Repository: `RAY09-F/rayven-pwa`. Local working branch: `codex/rendered-realms`. Starting main: `405d576696ef524b5e84a7b36df8d956207610e5`. Direct-to-main delivery was explicitly authorized by Rayan. Use a normal fast-forward update; never overwrite unrelated remote work or force-push. The delivery commit is the commit containing this report; the downloadable package README records its final SHA.

## Current state

Discovery, implementation, local/fixture verification and reports are complete for the coherent slice described in FINAL-REPORT.md. Genuine GPU review and real-service activation remain outstanding. No Cloudflare deployment was manually run. A repository push may interact with existing deployment automation; its production outcome must be checked separately rather than assumed.

Changed runtime files: root/public index mirrors; `public/ui/app.js`, `interface.css`, `scene.js`; `public/fx/cores/thor.js`, `loki.js`, `odin.js`; new `public/ui/arsenal.js`, `council-data.js`, `realm-architecture.js`, `tool-catalog.json`, `local-tools.js`, `expansion.js`, `expansion-catalog.json`. Added generator/tests and this report folder. Existing vendor files/licenses remain local. Backend source and wrangler configuration are not changed.

## Run locally

From the actual repository folder:

```sh
node scripts/ui-preview.mjs --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173/?fixture=1&hall=thor` for clearly labeled fixture replies. Without `fixture=1`, the existing app endpoint remains live; do not mistake a static preview server for a backend proxy. Review wrappers: `/__review?w=390&h=844&persona=loki&fixture=1` and widths 320 / 1024 as needed. To inspect the fallback deliberately, append `renderer=svg`. To test actual GPU output, omit that parameter and confirm `#presence-scene` reports `data-render="webgl"` in the DOM.

```sh
node scripts/build-ui-catalog.mjs
node --test scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs
node scripts/smoke-fx.mjs --files
```

No npm build is required to serve the browser UI. Node is used for development preview/tests/catalogue generation. Regenerate the checked-in backend catalogue whenever backend definitions or persona permissions change.

## Exact next action

Open the current homepage on a GPU-enabled Chromebook browser and record the actual render mode. Inspect all three cores, five advisor picks per core, scene dragging/reset, still motion, conversation open/closed and mobile framing. Measure frame times and memory while switching personas repeatedly. Fix observed materials/performance before promising concept-art fidelity. Then select one proposed monetization chain from MONETIZATION.md and implement it only against verified existing contracts and access.

The 186 proposals are plans. The 24 automation templates are draft preparation. Neither is a running autonomous system. Local utility results become chat content only when the user explicitly prepares and sends them. Actual tool side effects remain gated by the existing backend.

The package is a frontend overlay and handoff for this repository, not an independent copy of the entire backend. Preserve newer repository changes when applying it. Never copy only index.html; it imports the accompanying UI modules, cores and local renderer assets.
