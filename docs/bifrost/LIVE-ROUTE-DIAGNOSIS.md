# Live route diagnosis — ROUTE-A

Observed 2026-09-08 00:06–00:12 UTC (2026-09-07 Pacific). This is the **pre-release baseline**, not a claim that the new interface has shipped. Read-only account/HTTP audit; no deploy, rollback, account change or source/config mutation was performed.

## Result and serving URLs

The existing production Worker serves an old **picture-based hall**, byte-for-byte identical to `index.html` and `public/index.html` at `22fc1e8`. The newer `9d2fb78` homepage and `/ui/` modules have not reached its asset deployment. This alone explains the reported picture with text box at the established Worker URL; it is not a browser-only cache theory.

| URL | Observed result |
| --- | --- |
| https://asgrard-backend.rayanfahil2.workers.dev/ | 200 `text/html`, legacy “The Halls of Asgard”; no redirect |
| https://rayven-backend.rayanfahil2.workers.dev/ | 200 `text/html`; existing service-binding proxy to the real Worker |
| https://asgrard-backend.rayanfahil2.workers.dev/thor/ | Redirects to `https://asgrard-backend.rayanfahil2.workers.dev/?persona=thor`, same legacy HTML; source specifies 301 |
| https://rayven-pwa.pages.dev/ | DNS resolution fails from this environment |

Authenticated account evidence: Pages projects list returns `success: true`, `result: []`, total 0; Worker custom domains list is empty; account zones list is empty. The Worker subdomain endpoint returns `enabled: true`, `previews_enabled: true`. There is no existing Pages project or zone route to update in the authenticated account. Do not create another project or change domains. The exact URL currently open in the user's browser was not supplied to this specialist; repository/account evidence identifies the first URL as the established app. Lead should resolve any remaining URL ambiguity with the user while continuing release work.

## Source and HTTP evidence

Repository `/home/rayanfahil2/asgard-bifrost`, remote `https://github.com/RAY09-F/rayven-pwa.git`, initial branch `codex/bifrost-aperture`, initial HEAD `9d2fb784f629f82463037a0aaf219e063299329a`. Working tree was clean at audit start; other owners began scoped changes during the audit. `22fc1e8` is an ancestor of `9d2fb78`. Source currentness here means the supplied current-main checkpoint; this specialist did not fetch or mutate Git refs.

| Content | Bytes | SHA-256 |
| --- | ---: | --- |
| Live GET `/`; both index mirrors at `22fc1e8` | 57,022 | `eb4003b58ca27c03c3b8d74f5cb516cdab61dfb6633fc8df3d10eae70577fa44` |
| Both index mirrors at `9d2fb78` | 11,875 | `eaf888c085d7bb43b93a9467c1c1cf75205833a7a2ea07f4fdeb5b6af72a2078` |
| Missing live `/ui/` asset response | 93 | `d99dbc6b622f4c0776f7810b1c19238b7b94515477545fd648e698b7ff9aa7f2` |

Live HTML references `/img/thor.jpg`, `/img/loki.jpg`, `/img/odin.jpg` and Google Fonts; it contains `<div class="scene"><img src="/img/thor.jpg" alt=""><canvas class="dust"></canvas>`. It does not reference the current hologram entry module.

Every tested current module/style URL below returned **200 `text/plain;charset=UTF-8`, 93 bytes**, containing the backend-running fallback instead of JavaScript/CSS. A status-only smoke test would incorrectly pass:

- `/ui/app.js?v=hologram-realms-1`
- `/ui/interface.css?v=hologram-realms-1`
- `/ui/scene.js`
- `/ui/hologram-persona.js`
- `/ui/hologram-projection.js`
- `/ui/realm-architecture.js`

A cache-busted GET `/?route-audit=20260908` with `Cache-Control: no-cache` returned the identical legacy hash. `/ui/vendor/three.module.min.js` and `/manifest.json` also returned the 93-byte text fallback; `/img/thor.jpg` returned 200 `image/jpeg`, 265,598 bytes.

`/ping` returned 200 `application/json` (38 bytes). Root HEAD returned `cache-control: public, max-age=0, must-revalidate`, `cf-cache-status: HIT`, no CSP header in the observed response. Initial Python urllib request received a 403; repeated curl GET/HEAD requests succeeded and supplied the evidence above. No credentials were included in public-site requests.

## Request mapping and hypotheses

`wrangler.toml` targets **asgrard-backend**, entry `src/index.js`, assets `./public`, binding `ASSETS`, `run_worker_first = true`. `src/index.js` lines 1459 onward handle legacy persona redirects and unmatched non-POST requests through `env.ASSETS.fetch(request)`. A missing asset falls back to the 93-byte backend text with status 200. POST `/` remains the chat/legacy Telegram endpoint. Preserve Worker-first routing.

| Plausible cause | Finding |
| --- | --- |
| Old Pages URL | No Pages project in authenticated account; historical address fails DNS. Exact user browser URL still needs confirmation if different from established Worker URL. |
| Old Cloudflare deployment/assets | **Confirmed:** live index equals old source, current modules absent. |
| Another branch/output pipeline | No `.github` workflow directory at baseline. Existing config explicitly uploads `public/`. Deployment metadata has no revision/message, so original deploy source branch is unknown. |
| Root/public divergence | Ruled out at both compared revisions: mirrors match exactly. |
| Legacy route/redirect | Root has no redirect; shim proxies same Worker; persona redirects preserve persona query. |
| Service worker/browser cache | Cannot explain independently fetched stale server response. No page service-worker registration/PWA manifest reference found in either compared root HTML. Root `manifest.json` is the browser-control extension manifest, not a PWA launch manifest. Existing browser registrations were not inspected or cleared. |
| Image/stylesheet covers canvas | The deployed page intentionally loads hall JPGs and dust canvas; it does not load current renderer. New layout stacking remains a browser-review concern after release. |
| Canvas initialization fails behind fallback | Current renderer never requested by deployed HTML. Future initialization must still be browser-tested. |
| Missing assets/CSP/import/MIME | Current assets are missing and return wrong MIME. No root CSP observed. Current renderer imports local `vendor/three.module.min.js`; deploy complete dependency tree, including its core module. |
| Renderer hidden/offscreen/transparent | Cannot explain absent entry module; browser inspection of integrated new renderer remains required. |

## Account, previous version and preservation

`npx --no-install wrangler --version`: **4.122.0**. `wrangler whoami`: existing OAuth login associated with `rayanfahil2@gmail.com`, account **a7d5a290f230e15f409cdec51fec9522**, Workers and Pages write scopes available. No login or token disclosure is needed. Authenticated API checks used the existing credential in memory, returned only account/routing metadata and binding names/types, and never printed secret values.

`wrangler deployments list` and `wrangler versions view` identify active pre-release version:

- **205b09d8-e582-4d8d-93d4-e6de5047a556**, created **2026-09-07T04:19:46.792Z**.
- Deployment **2026-09-07T04:19:47.444Z**, **100%** traffic, source `Unknown (deployment)`; no revision tag/message.
- Prior history entry: **8814056d-e4ee-40b5-a82e-bf734e5c4f56**, deployed **2026-09-07T04:13:45.007Z**.

Live version confirms fetch/scheduled handlers, compatibility date `2026-08-13`, `ASSETS`, `LEDGER`/`AsgardLedger`, `RAYVEN_KV`, `VECTORIZE`/`rayven-memory`, `CLIPS`/`asgardclips`, `AI`, ledger backend `do`, established Telegram host and existing secrets. Preserve all of them, the five-minute cron and `v1-ledger` SQLite migration. Do not rename the misspelled Worker or remove the ledger migration.

## Suggested release and rollback commands (not executed)

Run from `/home/rayanfahil2/asgard-bifrost` only after lead integrates and reviews the approved source, builds its release fingerprint, synchronizes index mirrors and passes tests. First re-check current deployment in case another writer has deployed since this audit:

```sh
npx --no-install wrangler whoami
npx --no-install wrangler deployments list --config wrangler.toml
npx --no-install wrangler deploy --config wrangler.toml
```

This config uploads the Worker **and all of `public/`**, including `index.html`, `ui/interface.css`, `ui/app.js`, all imported UI modules, JSON catalogues, vendored Three.js modules and retained supporting assets. Uploading only the repository-root HTML cannot fix the live page. No Pages command is indicated by current account evidence.

If the reviewed release regresses, existing CLI help confirms this rollback syntax:

```sh
npx --no-install wrangler rollback 205b09d8-e582-4d8d-93d4-e6de5047a556 --config wrangler.toml --message 'Restore pre-Bifrost production version'
```

Record the immediately previous version again before deploying; replace the target above if production changed. Rollback is documented, not exercised, and would restore the old picture interface. Keep schema/bindings compatible. Do not use Git reversion of the durable migration as rollback.

## Required lead verification and limitations

After deployment, verify exact live root and every transitive script/style by MIME and byte hash against delivered files, including query-versioned entry URLs; confirm release fingerprint and renderer mode from the delivered build. Verify both normal and no-cache requests. Check the established shim and persona redirects, then perform the authorized harmless chat turn and browser interaction tests at desktop/phone sizes. API `/ping` is only a routing check, not chat proof. No POST, chat/provider invocation, browser, screenshot, production mutation, cache purge or service-worker unregister was performed in this audit.

Tools/tests used: git status/branch/log/show/merge-base reads; local config/module/manifest inspection; Wrangler whoami, deployments list, versions view, pages project list and rollback help; authenticated GET API pages/projects, workers/domains, Worker subdomain/settings, account zones; curl GET/HEAD/redirect checks and Python SHA-256 comparison. No visual evidence paths exist for this read-only HTTP assignment. Lead owns visual testing and post-release evidence. This report is the only file written by ROUTE-A.
