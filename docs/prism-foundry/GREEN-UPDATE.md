# Loki green HUD update

Color-only change: Loki's interface accent becomes emerald #20AF73, including the floating LOKI name, heading, selected tab, buttons, borders and glow. The crystal, brass rings, advisor colors, geometry, animation, layout, controls and backend are unchanged. The optional question about also recoloring the 3D parts was unanswered; this update follows the HUD/text interpretation.

Only the active stylesheet and release manifest change in the deployed runtime. Browser computed colors match rgb(32,175,115); measured layout is identical; Thor remains #87dcff and Odin #edc78b. All86existing tests pass.

Previous active Cloudflare version:806a7e9b-e716-4544-bfdd-3f9420d9e25d at100%. Release candidate:floating-1e9b7365c2e9. Rollout pending10%forfiveactualminutes, then100%withliveverification.

The existing versioned path is retained because this is a backwards-compatible color substitution only: there are no new files, imports or HTML references that can mismatch during a gradual rollout.
