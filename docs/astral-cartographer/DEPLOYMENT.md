# Astral Cartographer rollout

Worker: `asgrard-backend`. The source backend and wrangler settings are unchanged from the prior production release. Main's blocked brain work is excluded.

- Previous full release: `614ed300-86a9-4479-917f-0ff396dce0c4` (Loki green).
- Asset preload: `af42d41e-ac84-4fad-8be7-5d4a37c9a43f`, source `a8a630d`, release `floating-fc6dd33eeea9`. Existing index retained; 10% observed for 315 seconds, 11 passing samples, then 100%. All 82 asset hashes and MIME types verified without overrides before changing the index.
- New index: `46f1a08b-a239-4a8a-a688-3fafceef488f`, source `0e1b803`, release `floating-c5ccb5e8f103`. Only two index references switch to the already available `/ui/astral-v1/` files. Its 10% rollout passed 11 samples over 318 seconds before promotion.
- The preloaded version is the compatible immediate index rollback target; the previous full release remains recorded above.

Previous traffic/version IDs were recorded before every upload and traffic change. The independent Worker error tail recorded no error events throughout both canaries.

## Verified behavior

155 tests passed in the implementation worktree; 90 passed against the isolated release package. Desktop, animated and 390px phone WebGL screenshots were inspected. Storm-bolt selection opens Valkyrie, dragging changes orbit and stops autorotation, animation advances, labels stay within the phone viewport and hide behind occluders. Rapid Thor/Loki switches leave exactly one canvas and six labels. Loki's name remains emerald green. The real deployed WebGL page passed the same scene/selection check with no application errors.

Conversation controls were tested using a browser-intercepted fixture response; the request targets Thor and the reply renders. Audio was disabled in the fixture. No paid provider call, real-person send, purchase or KV deletion occurred.

Automated-browser setup issues were corrected rather than counted as product failures: the dialog intentionally clears selection on close; the test originally compared against the earlier selected value. An about:blank visit triggered an old unguarded test-only localStorage initializer. The fixture originally confused an automatic TTS request with the chat request. Corrected checks passed. Software GPU load caused a Playwright pause-button pointer timeout; the same DOM button handler paused the animation successfully.

Physical-device GPU frame rate remains unverified. The source follows the specified rendering limits; browser checks ran on SwiftShader.

Deployed at 100% on 2026-09-08 11:42:35 UTC. Final unpinned verification passed: both hosts serve release `floating-c5ccb5e8f103`, all 82 asset hashes/MIME types match, and a normal browser reload renders Astral Cartographer with five advisors and the new module entry. Evidence: `evidence/live-primary.json`, `evidence/live-legacy.json`, `evidence/unpinned-browser.txt` and `evidence/final-status.txt`.

[Open Thor](https://asgrard-backend.rayanfahil2.workers.dev/?hall=thor)
