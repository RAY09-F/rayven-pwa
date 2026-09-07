# Rendered Realms baseline

Date: 2026-09-07. Repository: RAY09-F/rayven-pwa. Starting main: `405d576696ef524b5e84a7b36df8d956207610e5`.

The latest instructions request real rendered persona models, a much broader tool interface, monetization utilities and automation ideas. These supersede the intervening picture-only direction and earlier small-tool-catalogue restriction. The picture-based work is preserved separately at local commit `7e20e0b`; it is not included in this change.

## Observed source state

The existing homepage uses vanilla HTML/CSS/ES modules, locally vendored Three.js and actual Thor/Loki/Odin core modules. It has no frontend build requirement. `public/index.html` is the deployed asset; root `index.html` is a required mirror. `public/ui/app.js` owns the conversation, persona routing, settings and existing voice controls. `public/ui/scene.js` owns the single rendering loop. The legacy hall, council and laboratory pages remain in the repository.

The backend defines tools in `src/lib/tools.js`, with persona filtering in `src/lib/personas.js` and category metadata in `src/tools/meta.js`. There are 223 distinct public tool definitions after filtering; this is not evidence that every external account is connected. Chat uses the existing `{assistant,message}` payload and Worker endpoint. `wrangler.toml` keeps the existing `asgrard-backend` name, `src/index.js` entry and `public` asset directory.

No unrelated uncommitted work was overwritten. The picture-based intermediate work was checkpointed before returning to the actual main tree. No repository instruction file or Sites hosting configuration was found.

## Preserved behavior

Typed chat, per-persona drafts, existing voice/output settings, backend approvals, private access boundaries, legacy pages, Worker routes, persistent backend data, and the locally shipped renderer remain in place. This iteration does not migrate the framework or backend.

## Design judgment

The previous focused interface was readable but had limited access to its extensive backend. The central models needed a larger inhabited stage and an explicit council. Reusing the existing renderers and exposing real tool schemas offered greater continuity than substituting another static concept image.

## Baseline evidence and limits

[Previous main design — historical screenshot](evidence/prior-main-desktop.jpg) is copied from the prior verified UI delivery's evidence. It is not a newly captured before image for this iteration. The prior detailed record remains in `docs/ui-upgrade/`.

The current testing browser has WebGL disabled. Layout and interactions are inspected using the application's honestly labeled simplified projection of the actual geometry. This does not establish GPU material appearance, sustained frame rate, physical phone keyboard behavior or live provider success. An attempt to open a separately served baseline on port 4174 was blocked by the browser environment; no result from that attempt is treated as evidence.
