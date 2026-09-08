# Prism Foundry staged deployment — in progress

Production backend is unchanged from d349c75 / runtime 98dc2f1. The pending brain waves are excluded. Candidate preparation commit: 327091d (86 tests passed).

Previous Cloudflare version: e0f22382-5553-4069-94bd-8b1e5acb2523 at 100%.

To avoid mixed old/new assets during percentage rollouts, first publish the new UI under /ui/prism-v1/ while keeping the old index. Observe 10% for five minutes, then 100%. Then switch only the index to the available versioned UI and repeat the 10% observation before 100%.

No KV deletion, billing changes, provider test calls or real-person messages.

## Asset preload

- Upload/source: e0d5fc7; version 7993b681-c976-4e09-aa36-fc6d963ed459.
- 10% started successfully; 90% retained e0f22382-5553-4069-94bd-8b1e5acb2523.
- All52asset hashes/MIME types verified against the candidate using version override and fresh query strings. Initial unqualified cached asset response was rejected; no false pass was recorded.
- Local final-index browser check loaded `/ui/prism-v1/app.js?v=prism-1`, rendered Prism Foundry with revision184 and five advisors, and completed a local fixture conversation. No provider calls.
- Five-minute observation records live in evidence/assets-observation.json. No promotion before its final successful sample.

Asset preload observation passed11/11samples over315seconds. Promoted to100%; edge propagation initially returned the previous manifest, then the unpinned live manifest and all52assets verified successfully before changing the index.
