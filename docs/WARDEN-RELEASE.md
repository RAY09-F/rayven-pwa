# Warden entrance release — 2026-09-10

Live Worker: `asgrard-backend`; primary URL: https://asgrard-backend.rayanfahil2.workers.dev/

This worktree is based on verified production source `71abd14`. It deliberately excludes the additional undeployed backend and Bridge work in the development checkout.

## Release

- Worker version: `433c5e9b-7044-4a55-ba1d-72a62e4fbbe5`.
- Release: `floating-8bfd66b61ee9`.
- Prior version for rollback: `bf8ac0d6-5ae6-49f6-8041-fb95e1a6276f`.
- A 10% canary completed 11 successful samples over 316 seconds, followed by promotion to 100%.
- Cloudflare confirms identical bindings and runtime settings. Backend source, configuration, extension and hall files have no changes from production.
- `/index.html` is the only changed content asset among the 162 fingerprinted assets. `/ui/release.json` records the new fingerprint.

## Behavior

The Warden entrance opens `/hall/#thor`, `/hall/#loki`, `/hall/#odin`. The Council dashboard remains at `/hud/`, accessible in the footer. The entrance has no backend calls, storage, remote fonts or external scripts. The microphone controls visual glow only; conversation remains in the halls.

The supplied particle geometry is preserved. The install corrects routes, legacy persona links, Enter-key handling, microphone lifecycle, keyboard accessibility, footer navigation, small-screen legibility, reduced motion and 2D fallback behavior.

## Verification

- Release suite: 106 tests passed. Development suite: 456 passed.
- Local and pinned live browser checks: 1600×900, 900×700, 390×844, 320×568; all personas render, palette fades, no overflow, reachable Enter link.
- 1/2/3/M and Enter navigation; valid and invalid legacy links; denied/cancelled/granted simulated microphone input; external audio API; 2D fallback; zero JavaScript page errors.
- All 162 candidate assets matched expected hashes and MIME types.
- Initial-frame measurements are from this PC, not a Chromebook benchmark. Simulated microphone tests do not certify physical audio hardware or external voice services.
- The existing HUD summary reports plans unavailable; that state was present throughout the observation and is unrelated to the entrance.

Evidence is in `output/warden` here and `../rayven-pwa/output/warden-live`. The public traffic checks use `node scripts/warden-verify-live.mjs` with no version pin. Browser verification is `node scripts/warden-browser-qa.mjs` with `ASGARD_QA_URL` set to the target host.

## Rollback

From this worktree, use Wrangler versions deploy with the prior version at 100%. Do not remove or reverse Durable Object migrations. Existing Worker triggers were not redeployed or changed.

The complete pre-install development state is preserved on branch `pre-asgard-index-backup` at `0cc7219`. The development installation is on `codex/install-asgard-index`; this release is on `deploy/warden-index`.
