# Bifrost deployment evidence

The final frontend is live at https://asgrard-backend.rayanfahil2.workers.dev. UI delivery is verified; successful live conversation remains blocked by the existing Anthropic account balance.

| Evidence | Value |
| --- | --- |
| Source committed and pushed to GitHub main | `6bd0737d716ed9ff24db025a83a25aa1c1316956` |
| Cloudflare Worker | `asgrard-backend` |
| Active uploaded version | `6d6c87d5-bf48-4914-9b98-d38fb94b07d1` |
| Release ID | `bifrost-9a1c6b9c4db0` |
| Asset verification UTC | `2026-09-08T00:52:34.546Z` |
| Checked asset bytes and MIME | 19/19 pass, including actual root HTML |

[Deployment output](evidence/deploy.txt), [active version at 100% traffic](evidence/active-deployment.json), [asset verification](evidence/live-assets.json), [source/version proof](evidence/release-proof.json), [live browser results](evidence/live-browser.json), [cache/redirect checks](evidence/route-checks.json). GitHub push was non-force and `git ls-remote origin refs/heads/main` returned the full source revision above. A later documentation/evidence commit does not change deployed runtime assets.

The existing Worker serves both backend and static assets. The initial live version was `205b09d8-e582-4d8d-93d4-e6de5047a556`; its HTML matched old commit `22fc1e8`, while `/ui/*` returned backend fallback text. Deploying the complete existing Worker configuration fixed the serving path. First Bifrost release `80f406c1-51e4-4928-9a7d-ae12f3654da7` was followed by the final error-recovery correction above. No Worker rename, Pages project, domain migration or cache purge was needed. Backend `src/` and `wrangler.toml` remain byte-identical to the original live source. Existing assets, bindings, secrets, durable-object migration and cron are preserved.

## Live browser and chat

The delivered index was exercised in Chrome at 1440×900 and 390×844. All three persona meshes render through Three.js WebGL with one canvas. Phone capture has no horizontal overflow. The [live browser clip](evidence/live-bifrost.webm) shows persona switching and a drag through the actual interface; it is trimmed from the browser recording, not a rendered mockup. See [Thor](evidence/live-thor.png), [Loki](evidence/live-loki.png), [Odin](evidence/live-odin.png), [phone](evidence/live-loki-phone.png).

A real harmless POST requested a short reply with no tool use, memory recall, messages or data changes. Existing `X-Asgard-Smoke: 1` prevented chat-history persistence. The server returned HTTP 500 with Anthropic's explicit insufficient-credit error. This is **failed live chat verification**, not a simulated successful reply. The final UI identifies depleted credits and offers draft restoration; [actual screen](evidence/live-chat.png). Billing, credentials and provider selection were not changed. Add credits to the existing account, then rerun `scripts/bifrost-live-check.js` before marking conversation acceptance complete. Individual external tool connections and execution remain unverified.

## Reproduce and rollback

From the isolated worktree, `node scripts/verify-release.mjs` compares the current manifest against public bytes and MIME. Run the three local browser scripts through Playwright CLI with the preview server first; the live script targets production explicitly. Detailed checks and limitations are in [VERIFICATION.md](VERIFICATION.md).

If a UI regression requires rollback, the immediately prior Bifrost Worker version is `80f406c1-51e4-4928-9a7d-ae12f3654da7`. Wrangler supports `wrangler rollback VERSION --config wrangler.toml --message 'Restore previous Bifrost release'`. This is documented, not executed; it also restores the earlier generic provider error. Do not revert the ledger migration.
