# Prism Foundry — deployed and verified

Live on Cloudflare at 100% as of **2026-09-08 10:01:52 UTC**.

[Open Prism Foundry](https://asgrard-backend.rayanfahil2.workers.dev/?hall=loki). The existing [legacy address](https://rayven-backend.rayanfahil2.workers.dev/?hall=loki) also serves the verified release.

| Item | Recorded value |
|---|---|
| Worker | asgrard-backend |
| Active version | 806a7e9b-e716-4544-bfdd-3f9420d9e25d |
| Release | floating-5c8b8ac7e037 |
| Index source commit | fca0374 |
| Isolated release branch | deploy/prism-foundry |
| Previous full release | e0f22382-5553-4069-94bd-8b1e5acb2523 |
| Compatible old-index rollback version | 7993b681-c976-4e09-aa36-fc6d963ed459 |

## Rollout

1. Published the tested scene under `/ui/prism-v1/` while retaining the existing index. This prevents old and new pages from requesting mismatched files during percentage rollouts.
2. The asset preload passed 11 HTTP samples over 315 seconds at 10%, then moved to 100%. All 52 assets verified on the normal live host after edge propagation.
3. Switched only the index to the preloaded UI. This passed 11 HTTP samples over 361 seconds at 10%, plus the live browser checks, before promotion to 100%.
4. Verified the default live index and every release asset on both public addresses without a version override. Reloaded the browser without an override and confirmed the new release and real WebGL scene.

The prior active version was recorded before each upload/deployment/promotion. Raw records are in [evidence](evidence/).

## Evidence

- 86 tests passed against the isolated candidate, and again against the packaged versioned UI.
- 52 asset byte hashes and MIME types passed on each public address: [primary](evidence/live-primary.json), [legacy](evidence/live-legacy.json).
- Real live WebGL, three.js 184, five advisor crystals, projected labels, correct Hunter B-15 selection, and responsive 390px layout: [browser results](evidence/index-live-browser.txt).
- [Normal browser reload](evidence/unpinned-live-browser.txt) independently confirmed release `floating-5c8b8ac7e037` and `/ui/prism-v1/app.js?v=prism-1` after promotion.
- [Desktop screenshot](evidence/live-desktop.png) and [phone screenshot](evidence/live-mobile.png) were visually inspected.
- [Final traffic record](evidence/final-traffic.txt) confirms 100% on the new version.
- No JavaScript application errors appeared in the live browser checks. No Worker error events were observed by the independent error-tail during the rollout.

An HTTP sampling process received SIGTERM after its 190-second sample. The independent Worker error-tail remained connected, and sampling resumed from its saved start time. Promotion waited for the completed 361-second observation with every sample passing. Initial stale edge responses were rejected; they were not counted as successful live verification.

## What stayed unchanged

Backend `src/` and `wrangler.toml` exactly match the prior live backend at d349c75 (runtime 98dc2f1). Cloudflare's recorded bindings and runtime settings match the previous live version. The main branch's pending brain waves were not bundled into this deployment.

No KV data was deleted, no billing or plan changes were made, and no messages were sent to real people. Conversation behavior was checked using a local fixture; no paid provider chat was invoked. The previously documented provider-credit limitation is not resolved by a UI deployment.

The browser uses SwiftShader software graphics, so physical-device GPU performance remains unverified.

For a future gradual UI rollout, use a fresh versioned asset path instead of overwriting `/ui/prism-v1/`. Do not deploy the main branch's blocked backend waves as part of a UI update.
