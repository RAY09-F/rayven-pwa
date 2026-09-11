# Gold visor and lock surge — 2026-09-11

Version a1209d89-2c59-4de4-b10b-d1d06ee69775. Production source 0ab766c, branch codex/gold-visor-lock-surge in rayven-warden-release. Rollback cfb79b99-6b31-4383-9937-54d8216e48fd. 176 assets, fingerprint workspace-39ba5c91df7f.

Retains the approved layout. All three personas lock into red and white. Thor's normal visor particles and their local glow are gold; his body/rim palette stays blue and white. A new visor-only shader uniform isolates the change from body particles. Lock-in activates a 2.4-second outward particle spiral that smoothly returns to the existing geometry; it cancels on persona change/Stand down and respects reduced motion. Persisted lock-in does not replay the animation on reload. Existing chat/voice reactive animation remains.

Verification: 119 unit tests; existing chat/mic/tool browser suite; data-adapter/geometry checks; lock-in persistence/spacing suite; real WebGL uniform tests verify visor selection, unchanged Thor body channels, red/white palettes, rising/settling surge, cancellation and reduced-motion behavior. Local development mirror f90e4a5 preserves earlier backend features. No backend/secrets/permissions changed. Existing external voice-service billing limitation unchanged.

Cloudflare shader/effect tests and all 176 asset hashes passed; promoted to 100% traffic.
