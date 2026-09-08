# Current status — deployed and verified

The floating realms correction is deployed. Read [DEPLOYMENT.md](DEPLOYMENT.md) for the current release, live asset hashes, browser evidence and limits; [VERIFICATION.md](VERIFICATION.md) explains the fixes. The original handoff below is retained as the acceptance brief, not an outstanding deployment checklist.

Outstanding external checks: physical Chromebook GPU performance, physical-phone/microphone behavior, and a new provider chat smoke after the existing Anthropic credit balance is restored. Cloudflare publication and real WebGL browser interaction checks are complete on the documented software-renderer environment.

---

# Continue the floating realms release

This brief supersedes the reference release's tabletop camera and whole-scene orbit. Read REPORT.md; the previous docs/reference-realms deployment receipt refers to an older release.

## Remaining work on an environment with WebGL

1. Inspect Thor, Loki and Odin in the actual index. Confirm all five names sit above stones without clipping at desktop, 390px and 320px layouts, including maximum drag bounds. Refine any collisions before deployment.
2. Confirm visible idle motion, separate ring motion, and holographic particles. Verify Pause/Resume and OS reduced motion. No motion on hover alone.
3. Drag one central model and each advisor; assert only that object moves and the camera remains fixed. Check click dossiers, pointer release/cancel, focus loss, touch release and Reset layout. Check touch scrolling outside the scene.
4. Exercise fixture chat and state transitions; inspect shader errors and sustained performance on the actual Chromebook. Do not silently disable animation or substitute pictures to mask problems.
5. Run `node --test scripts/reference-realms.test.mjs scripts/floating-realms.test.mjs scripts/ui-state.test.mjs scripts/conversation.test.mjs`.
6. After corrections, regenerate `node scripts/build-release.mjs`, commit and push. Preserve unrelated work and current remote commits.

## Existing Cloudflare deployment — run in authorized local Codex/Claude Code

Identify the exact user-facing host. Preserve `asgrard-backend`, wrangler.toml, its ASSETS routing, bindings and migrations. Do not create a replacement Worker/Pages project.

Use the existing installed Wrangler and authenticated account:

```sh
npx --no-install wrangler whoami
npx --no-install wrangler deploy --config wrangler.toml
node scripts/verify-release.mjs
```

Only deploy once browser checks above pass. Verify the new `/ui/release.json` fingerprint and all served assets. Check the actual index on the user's host. If the user opens a Pages URL, verify that host too; deploying the Worker alone is not proof that Pages changed. Report deployment ID and actual URL. Do not describe old deployment receipts as current. Existing provider credit failure is documented in the previous release; verify before claiming live replies work, and do not purchase credits.
