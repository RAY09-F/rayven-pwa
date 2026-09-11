# Orbital Council release — 2026-09-11

Live: https://asgrard-backend.rayanfahil2.workers.dev/
Worker: asgrard-backend
Version: 9ae68388-092d-40e5-a5f1-b58d9e1a5e5a (100% traffic)
Production source: ../rayven-warden-release, branch codex/orbital-council-live, commit 0b0feaa.
Production asset fingerprint: workspace-effb2931d83e (169 assets).
Rollback version: afe125d5-f91d-4490-95c9-d43e98afe65b.

## Delivered
Orbital Council design 3 surrounds the unchanged original reactive humanoid with real council agents and the existing chat, mic, voice, tool and settings controllers. Read-only /workspace/snapshot supplies saved tasks, calendar, reminders and paper trading data. No demo dataset or scripted AI responses are used. Missing, stale and unavailable data are identified. Paper results retain original agent IDs and include profit, loss, net, closed trades and win rate. Cash-only history is not represented as a portfolio equity curve.

## Validation
Production checkout: 117 unit tests passed. Browser suites passed all three personas, mic permission/recognition fixtures, cancellation, chat isolation, tool controls, council agents, mobile layouts and live adapter fixtures. Original humanoid rendering script equality verified. All 169 production assets verified again after 100% rollout. Real smoke requests returned successful replies for Thor, Loki and Odin. Snapshot reads succeeded with 1 saved task and 31 retained trades. Smoke requests did not ask tools to take actions.

## Voice service limitation
Thor audio and a Loki retry returned audio. Other voice requests failed: ElevenLabs reported payment_required/payment_issue, and Workers AI fallback returned an internal error. Existing browser speech fallback is retained. Premium voice reliability requires fixing ElevenLabs billing. Microphone hardware was not physically tested; browser controller behavior was tested.

## Local source
The integration was mirrored into rayven-pwa while preserving its earlier development backend changes. Its 467 tests passed. That checkout includes additional undeployed features; production was built from the isolated release checkout above. CODEX-EVERYTHING.txt was left untouched. index.before-orbital.html preserves the previous page.
