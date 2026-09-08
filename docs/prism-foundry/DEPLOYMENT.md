# Prism Foundry staged deployment — in progress

Production backend is unchanged from d349c75 / runtime 98dc2f1. The pending brain waves are excluded. Candidate preparation commit: 327091d (86 tests passed).

Previous Cloudflare version: e0f22382-5553-4069-94bd-8b1e5acb2523 at 100%.

To avoid mixed old/new assets during percentage rollouts, first publish the new UI under /ui/prism-v1/ while keeping the old index. Observe 10% for five minutes, then 100%. Then switch only the index to the available versioned UI and repeat the 10% observation before 100%.

No KV deletion, billing changes, provider test calls or real-person messages.
