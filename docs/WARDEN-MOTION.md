# Living Warden motion — 2026-09-10

This visual update changes the entrance only. The halls, backend, bindings and routes remain the same as the previous Warden release.

## Visual behavior

- Every armour point follows its own bounded current along the body surface. Moving energy bands sweep across the figure while its silhouette stays recognizable.
- Three fragmented orbital filaments rotate around the head and shoulders. Existing free particles orbit and drift.
- Two GPU draw passes combine crisp points with soft light halos. Listening charges the white highlights; speaking adds layered pulses, intensified further by the existing microphone/audio level input.
- Clicking or tapping the figure triggers a smooth 2.1-second charge pulse: the armour expands, rings open and light rises before settling back.
- Reduced-motion preference disables new particle displacement and the charge pulse. No extra frameworks, remote calls or dependencies were added.
- An inline SVG favicon removes the missing-icon request.

The entrance's automatic listening/speaking sequence is a visual preview. Microphone volume and the existing `ASGARD.state()` / `ASGARD.level()` API also drive it. Actual conversation and TTS remain in the halls.

## Verification

`scripts/warden-motion-qa.mjs` checks rendered pixel changes, brighter white highlights in listening/speaking states, both GPU draw passes, pointer charge and reduced motion. It writes screenshots and measurements under `output/warden-motion*`.

Local rendering measured about 4.2ms median frame spacing on this PC at both 1600×900 and 390×844. This is a viewport test on this PC, not a physical phone benchmark. Screenshots showed visibly brighter listening and speaking states for all three personas. Initial bloom was reduced after visual review so the face and individual dots remain readable.

The existing browser regression suite covers all three halls, keyboard controls, responsive layout, microphone denial/cancellation/grant and the 2D fallback. Release unit tests: 106 passed. Synchronized development checkout: 456 passed.

## Release identifiers

- Candidate Worker version: `5481a3d8-086c-488e-9805-34c6dd4a301f`.
- Fingerprint: `floating-2fa584f036cf`.
- Prior Worker version for rollback: `433c5e9b-7044-4a55-ba1d-72a62e4fbbe5`.
- Pre-motion release backup branch: `pre-warden-motion`; development backup: `pre-warden-motion-development`.
- Only `/index.html` differs among the 162 fingerprinted content assets; release metadata is regenerated.

The candidate passed all 11 rollout samples over 314 seconds and was promoted to 100% of traffic. Pinned live browser tests passed motion/glow, charge, reduced motion, navigation and microphone handling without JavaScript errors. All 162 pinned live asset hashes and MIME types matched the release manifest.
