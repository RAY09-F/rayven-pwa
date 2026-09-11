# Command identity release — 2026-09-11

Version c33096c1-17ef-4fd9-a4fe-7666f2dac76a. Production source commit 48ff3d0, codex/command-identity-live, rayven-warden-release. Asset fingerprint workspace-f12afeae9747, 175 assets. Rollback version f6527f4c-5377-484e-aeb9-77376074906f.

Composition: full-screen central humanoid, tools on the left, persona identity/purpose/capabilities on the right, diamond-shaped advisors around segmented orbital rings, compact bottom conversation. Public Achilles index and stylesheet inspected as visual reference; its source was not copied into this release.

Thor: blue and white. Loki: black and green. Odin: gold and white. Direct typed or speech-to-text lock-in commands change the active humanoid and UI to red and white. Stand down/unlock or the visible button restores the normal palette. Each persona stores its own mode locally. This is a visual state, not a permissions change or autonomous backend action. Commands still follow the existing chat flow. Animation geometry/shaders preserved; an explicit palette API was added to the original engine.

Validation: 119 unit tests; existing chat/mic/tools browser checks; real-data adapter checks; new typed/simulated voice lock-in, stand-down, per-persona persistence and palette tests. Centered canvas, no horizontal overflow and no overlapping agent/status/side controls at 1920/1600/1024/768/390/320 viewport widths. Existing ElevenLabs billing limitation unchanged. Local development mirror c825ac8 retains unrelated development backend features.

Cloudflare canary: all 175 asset hashes and command-scene browser suite passed, including lock persistence after reload. Promoted to 100% traffic.
