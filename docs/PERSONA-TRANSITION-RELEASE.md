# Smooth persona transformation — 2026-09-11

Version 677fdd29-1c35-4a48-8a94-7a8622826a59. Production source bb72572, branch codex/smooth-persona-transition in rayven-warden-release. Rollback a1209d89-2c59-4de4-b10b-d1d06ee69775. 176 assets, fingerprint workspace-12ed81de28ff.

Every actual Thor/Loki/Odin change runs a restrained 1.9-second particle dispersion and rebuild with the new palette. Smooth easing and current-amplitude restart avoid snapping during rapid selection. Same-persona clicks and initial load do not replay it. Existing lock-in pulse is attenuated during the switch to prevent stacked motion. Reduced-motion mode suppresses/cancels the effect. Controls and layout stay fixed; gold Thor visor and existing lock modes are preserved.

Validation: 119 unit tests; new real-WebGL persona-transition browser tests for each persona, same-persona suppression, rapid-switch continuity, keyboard support and reduced-motion cancellation; gold-visor/lock-surge and chat/mic/tool regressions passed. No backend, secrets or permission changes. Mirrored to development checkout e3c6034 while preserving unrelated backend work.

Cloudflare canary animation tests and all 176 asset hashes passed; promoted to 100% traffic.
