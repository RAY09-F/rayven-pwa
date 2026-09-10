# Loki green HUD update

Color-only change: Loki's interface accent becomes emerald #20AF73, including the floating LOKI name, heading, selected tab, buttons, borders and glow. The crystal, brass rings, advisor colors, geometry, animation, layout, controls and backend are unchanged. The optional question about also recoloring the 3D parts was unanswered; this update follows the HUD/text interpretation.

Only the active stylesheet and release manifest change in the deployed runtime. Browser computed colors match rgb(32,175,115); measured layout is identical; Thor remains #87dcff and Odin #edc78b. All 86 existing tests pass.

Previous active Cloudflare version: `806a7e9b-e716-4544-bfdd-3f9420d9e25d` at 100% (rollback target).

Deployed at 100% on 2026-09-08 10:45:46 UTC: `614ed300-86a9-4479-917f-0ff396dce0c4`, release `floating-1e9b7365c2e9`, source commit `89d2898`. The 10% canary passed 11 HTTP samples over 443 seconds. Sampling stopped between seconds 126 and 287 and was restarted; the independent Worker error tail remained active throughout and recorded no error events. The previous traffic/version state was recorded before both traffic changes.

Both public hosts passed unpinned verification of the release and all 52 asset hashes/MIME types after promotion. The pinned live WebGL screenshot and computed colors passed. Evidence is in [green-evidence](green-evidence/). No backend code, bindings or settings changed, and main's blocked brain work was not deployed.

[Open Loki](https://asgrard-backend.rayanfahil2.workers.dev/?hall=loki).

The existing versioned path is retained because this is a backwards-compatible color substitution only: there are no new files, imports or HTML references that can mismatch during a gradual rollout.

Final normal browser reload (without version overrides) confirmed WebGL scene prism-foundry, green name/heading/send control, and release floating-1e9b7365c2e9.
