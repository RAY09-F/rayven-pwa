# Floating realms deployment receipt

Verified live on **2026-09-08 at 06:07 UTC** through the existing Cloudflare setup.

| Item | Verified value |
|---|---|
| Primary index | https://asgrard-backend.rayanfahil2.workers.dev/ |
| Existing legacy host | https://rayven-backend.rayanfahil2.workers.dev/ |
| Source correction commit | `75a1dd40b0e4fa9a7e938e64ac3b9c931cced524` |
| Deployed runtime / manifest commit | `98dc2f1` |
| Release | `floating-761d8ca5ef4f` |
| SHA-256 fingerprint | `761d8ca5ef4f4b9b219d23cd752b297d8a2fbb656471963c40b42cfab57dadfe` |
| Cloudflare version | `e0f22382-5553-4069-94bd-8b1e5acb2523` |
| Cloudflare deployment | `72677f35-51d2-4a8c-a0d9-add75b63d756` |
| Traffic | 100% to that version |

Wrangler 4.122.0 deployed the existing `asgrard-backend` Worker after authentication and browser checks. No replacement Worker or Pages project was created. Backend source, ASSETS routing, bindings, Durable Object migration and cron match the fetched `e877cad` baseline.

## Verification

- **59 Node tests passed**, including geometry/resource ownership, state/conversation behavior and the new collision regressions. Local asset smoke checks passed.
- **357 layout/drag assertions passed** across 1440×900, 390×844 and 320×844. Each width covers Thor, Loki and Odin; all six objects; isolated movement; fixed camera; both drag extremes; nameplate bounds, separation and stone-tip clearance; reset; absence of shader/JavaScript errors and raster image requests.
- **11 pointer checks passed:** mesh-click dossier, focus loss, release outside the canvas, native touch selection/release/cancel, outside-scene touch scrolling and keyboard placement continuity across persona switches.
- **10 motion checks passed:** rendered canvas pixels change at idle, animation time advances, Pause freezes pixels even on hover, and OS reduced motion stops rendering continuously. Geometry tests separately check independent ring/particle clocks and resource cleanup.
- **27 existing conversation checks passed** against the local fixture server, including drafts, late reply ownership, errors/recovery, cancellation, focus, settings and responsive behavior.
- **25 asset hashes and MIME checks passed on each public host**, including the actual `/` index. The new release manifest was fetched independently of GitHub. The previous host fingerprint was `realms-664dc11e7020`.
- **12 live browser assertions passed**, including all three real WebGL scenes, six objects per realm, independent advisor dragging with fixed camera, and a 390px layout. Live screenshots were visually inspected.

Raw results, captures and the active traffic record are in [evidence](evidence/). [VERIFICATION.md](VERIFICATION.md) describes corrections and reproduction. Documentation and QA-only commits after `98dc2f1` do not change the deployed runtime fingerprint.

## Remaining limits

A real, non-persisting live chat smoke request (`X-Asgard-Smoke: 1`) returned **HTTP 500** with Anthropic's insufficient-credit error. This is the existing provider-account blocker; no credits were purchased and no provider or backend contract was changed. Live provider replies are **not verified working**. After the account balance is restored, rerun the harmless smoke check.

WebGL ran in Headless Chrome 152 using ANGLE SwiftShader, not a physical Chromebook GPU. Samples measured Thor 4.06 FPS over 9.12s, Loki 7.74 FPS over 6.59s and Odin 2.14 FPS over 13.53s. This confirms actual shader rendering and motion but is not a smoothness certification for physical hardware. Physical-device performance, real microphone permissions and physical-phone touch feel remain unverified.

Cloudflare publication is complete; no further deployment step is required for the two verified hosts. The original user checkout and unrelated local files were preserved in place; implementation used `/home/rayanfahil2/asgard-floating`.
