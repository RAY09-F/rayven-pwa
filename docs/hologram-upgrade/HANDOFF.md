# Hologram upgrade — handoff

Prepared 2026-09-07 on local branch `codex/rendered-realms`, based on main `fc94ce516be0f7204fff24b4a488c92d007e3d34`. User authorized direct delivery to `RAY09-F/rayven-pwa` main. Read this file's containing commit for the delivered revision; do not assume a GitHub update deployed Cloudflare.

Completed: discovery, model/interface implementation, CPU visual review, fixture conversation, council dossier, narrow layout and automated verification. GPU review and live deployment remain blocked by environment/account access.

## Files

- `public/ui/hologram-persona.js`: original procedural busts, particle buffers, bounded assembly/state motion, disposal.
- `public/ui/hologram-projection.js`: same-buffer perspective software renderer.
- `public/ui/scene.js`: renderer lifecycle, switching, camera and motion ownership.
- `public/ui/app.js`: persona descriptions and honest motion label.
- `public/ui/interface.css`, `public/index.html`, `index.html`: focused layout and versioned entry assets; root is an exact mirror.
- `scripts/hologram.test.mjs`, `scripts/smoke-fx.mjs`: geometry/projection and asset checks.
- `docs/hologram-upgrade/`: current evidence. `docs/rendered-realms/` remains historical documentation for the retained tool expansion.

## Run locally

From repository root:

```sh
node scripts/ui-preview.mjs --host 0.0.0.0 --port 4173
```

Open `http://localhost:4173/?fixture=1` for clearly labeled mock replies, or the plain root for the existing frontend API configuration. The local preview does not proxy live services. `?renderer=canvas` explicitly selects software projection; `?renderer=fallback` exercises unavailable-renderer UI.

```sh
node --test scripts/hologram.test.mjs scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs
node scripts/smoke-fx.mjs --files
```

Last results: 29 passing tests, smoke all pass, entry mirrors identical, diff check clean. Browser: CPU projection, switching/draft retention, fixture reply, dossier, drag/reset, still mode, desktop and phone. No live deployment or sustained FPS proof.

## Next concrete action

Obtain connected deployment access for the existing Cloudflare account. Inspect the repository's current Wrangler configuration and deployed Worker before deploying the exact main revision. Preserve `asgrard-backend`, all KV/R2/Vectorize/AI/Durable Object bindings, migrations and `run_worker_first`. Do not create a second Pages project or rename the Worker to correct its spelling. After deployment verify an actual revision and the delivered hologram entry assets on the live app, then capture GPU screenshots on supported hardware.
