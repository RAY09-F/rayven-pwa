# Verified reference realm deployment

The reference-based 3D index is live at **https://asgrard-backend.rayanfahil2.workers.dev**. GitHub push and Cloudflare deployment were separately verified. Live UI passes; the existing chat provider still reports insufficient credits.

| Gate | Evidence |
| --- | --- |
| Implemented and non-force pushed source | `899ee544fb147dd84cc85fd731caa7913d2cbe0c` |
| GitHub main | `RAY09-F/rayven-pwa`, remote SHA matched the pushed source before deployment |
| Cloudflare Worker | Existing `asgrard-backend` |
| Deployed version | `734b939b-87d0-4ee6-bc38-1392d3e31342` |
| Active traffic | 100%, confirmed by deployments list |
| Deployment time | 2026-09-08 04:57:21 UTC |
| Release | `realms-664dc11e7020` |
| Live HTML/module verification | 23/23 expected SHA-256 hashes and MIME types pass |
| Live browser | 9 UI checks pass; all three realms render and respond to orbit; phone has no horizontal overflow |
| Actual chat smoke | HTTP 500, explicit Anthropic insufficient-credit response |

A later evidence-only commit does not change the deployed runtime source above. The manifest's sourceBase identifies the pre-build Git base, not a self-referential release commit. [Source/version/hash proof](evidence/release-proof.json), [upload output](evidence/deploy.txt), [active deployment](evidence/active-deployment.json), [live assets](evidence/live-assets.json), [live browser](evidence/live-browser.json), [route/cache checks](evidence/route-checks.json).

## Actual public visuals

[Thor](evidence/reference-live-thor.png), [Loki](evidence/reference-live-loki.png), [Odin](evidence/reference-live-odin.png), [phone](evidence/reference-live-loki-phone.png), [actual chat error/recovery](evidence/reference-live-chat.png). The [110-second browser recording](evidence/reference-live.webm) shows actual deployed realm switching/orbit and the smoke check. It is recorded browser output, not a modeled demonstration video or reference-art animation.

The browser uses Three r185 WebGL through CPU SwiftShader. Still captures render at full resolution; software-driver animation uses the documented reduced-cost path. Physical GPU performance and device microphone/speaker behavior remain unverified. See REPORT.md for measured performance, geometry proportions, 58 source tests and 97 local browser assertions.

## Preserved backend and existing route

All backend src/ files and wrangler.toml are byte-identical to the pre-change main source. Existing POST chat, webhook routing, ASSETS, KV/R2/Vectorize/AI, ledger Durable Object binding/migration and the five-minute cron were preserved. No renamed Worker, new Pages project, domain move, provider/billing change or cache purge occurred. The established legacy forwarder returns the same fingerprint; /thor/ redirects to the correct persona query. No-cache/query-versioned root/app/scene/model fetches match the delivered source.

The authorized harmless chat smoke requested a short reply with no tool use, memory recall, messaging or data changes. The existing X-Asgard-Smoke header prevented chat-history persistence. Anthropic rejected the request for insufficient credits. This release therefore does **not** claim successful live replies or certify individual external tools. The delivered frontend shows the credit explanation and lets the user restore the draft. Replenish the existing account and rerun the live smoke to clear that acceptance blocker; no purchase was made.

## Reproduce or roll back

From the isolated worktree:

```sh
node --test scripts/reference-realms.test.mjs scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs scripts/conversation.test.mjs
node scripts/smoke-fx.mjs --files
node scripts/verify-release.mjs
```

Use Playwright CLI with scripts/reference-live-check.js for the actual host; local fixture scripts require `node scripts/ui-preview.mjs --port 4173`. The reference build needs no extra frontend bundler or package install. Future deployment uses the existing authenticated workflow: `npx --no-install wrangler whoami`, then `npx --no-install wrangler deploy --config wrangler.toml`, followed by hash/MIME and live-browser checks.

The previous version is `6d6c87d5-bf48-4914-9b98-d38fb94b07d1`. If an actual regression warrants rollback: `npx --no-install wrangler rollback 6d6c87d5-bf48-4914-9b98-d38fb94b07d1 --config wrangler.toml --message 'Restore previous ASGARD UI'`. This documented command was not run; it restores the prior humanoid UI. Do not revert the Durable Object migration.
