# ASGARD continuation handoff

## Working state

Repository: `RAY09-F/rayven-pwa`. Base branch: `asgard-three-personas`. Base commit: `22fc1e85db1dec5d0e08eef7a5287b3cbaeaf34b`. Implementation branch: `codex/quiet-core-ui`.

The isolated checkout started clean. No edits were made to Rayan's Chromebook checkout, so its uncommitted state is unknown and must be inspected before any local checkout/switch operation. Do not reset, overwrite or deploy that machine's work based on this report.

## Completed waves

1. Discovery and baseline: actual branch, instructions, homepage, existing geometry, chat/voice contracts, root/public mirror and deployment configuration inspected; baseline screenshots captured.
2. Visual foundation: new restrained layout, local WebGL scene owner, existing core integration and focused geometry refinements implemented.
3. Interaction clarity: safe reply formatting, error recovery, state labels, persona draft behavior, settings and voice separation implemented.
4. Responsive/comfort: stacked phone layout, focus behavior, still preference, reduced-motion integration and rendering resource controls implemented.
5. Integrated verification: browser fixture checks, multiple responsive screenshots, geometry/state tests and corrections completed within environmental limits.
6. Documentation: baseline, design direction, ledger, verification, guide, final report, this handoff, vendor manifest and screenshot evidence recorded.

The GPU/real-device portions of waves 4–5 remain blocked, not passed.

## Files changed

- `index.html` and `public/index.html`: byte-identical focused homepage.
- `public/ui/interface.css`: design tokens, desktop/mobile composition and comfort styles.
- `public/ui/app.js`: existing chat/voice contract adaptation, DOM controls and actual state handling.
- `public/ui/state.js`: small pure routing/preferences/status functions.
- `public/ui/scene.js`: one renderer owner, local core loading, quality/motion/visibility management and explicit fallback.
- `public/ui/vendor/`: pinned Three.js 0.185.1, SVGRenderer, Projector and MIT license.
- `public/fx/cores/thor.js`, `loki.js`, `odin.js`: SVG environment guard and opt-in focused geometry adjustments. Other presentations remain intact.
- `package.json`: dependency-free local preview and test commands only. No framework or frontend build requirement.
- `scripts/ui-preview.mjs`: development-only static server, exact-viewport iframe review wrapper and opt-in local chat fixtures.
- `scripts/ui-state.test.mjs`: 10 focused state/core lifecycle tests.
- `scripts/smoke-fx.mjs`: updated homepage contract and explicit file-only option.
- `docs/ui-upgrade/`: all reports and visual evidence.

Backend files, Worker configuration, Durable Object migrations, extension configuration and production deployment were not changed.

## Run locally

From the repository root on a machine with Node installed:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Open the printed local address in that machine's browser. This is a static frontend preview; ordinary chat still targets the existing live ASGARD backend and may incur existing provider usage. For isolated UI checks, use `http://127.0.0.1:4173/?fixture=1` and turn Spoken replies off first. The fixture banner must be visible. Sending `simulate error` produces a local 503 response; other messages receive a delayed fixture reply.

For a deterministic fallback check, append `&renderer=svg`; for a calm renderer-failure check, append `&renderer=fallback`. Remove these flags for the required real WebGL review. These flags are diagnostics, not user-facing settings.

The development-only `__review?w=390&h=844&persona=loki&renderer=svg&fixture=1` route embeds the actual page in an exact CSS-size iframe. It does not emulate a phone's hardware, browser permissions or on-screen keyboard.

In the original supervised cloud environment the server was started with `sites-preview start <checkout>` instead of an unsupervised process. Its internal browser URL is not a shareable deployed site. Do not use a Sites deployment to replace the existing Cloudflare architecture.

## Checks

```bash
npm run test:ui
node scripts/smoke-fx.mjs --files
node scripts/check-scripts.mjs public/index.html
node --check public/ui/app.js
node --check public/ui/scene.js
node --check public/ui/state.js
cmp index.html public/index.html
git diff --check
```

On a machine where the preview is reachable from the terminal, also run `node scripts/smoke-fx.mjs http://127.0.0.1:4173`. File-only checks do not establish HTTP delivery. Avoid running live `smoke.mjs`, `mcp-smoke.mjs`, tool tests or vault/export scripts merely to verify appearance.

## Last verification

10 Node tests passed; local source-asset checks, syntax and mirror checks passed. Integrated browser fixture flow and responsive DOM/screenshots were inspected. See VERIFICATION.md for exact assertions and evidence. None of these proves live provider success or GPU performance.

## Exact blockers

The cloud browser's GL renderer/vendor were disabled, so WebGL initialization failed. Hardware voice, actual phone keyboard behavior, GPU performance and automatic context restoration were not verified. The current still fallback remains functional. The terminal could not directly reach the supervised preview for HTTP smoke; the browser could.

## Next concrete action

Review this branch in a **GPU-enabled browser**, using the ordinary page without a forced renderer query. Confirm `#presence-scene` has `data-render="webgl"` in developer tools, then visually inspect all three personas and conversation states. Record actual device/browser, screenshots and measured performance. Do not report the simplified still evidence as GPU proof.

After that, exercise real voice and phone keyboard paths, correct observed issues, and update the ledger/report. Prepare the concrete result for Rayan's deployment approval. Do not merge or deploy solely because a draft review exists.

## Delivery status

Implementation commit: `00e563e282a14e89c57509c091fa4e3671da04cd`, followed by documentation commits. Rayan explicitly authorized a direct push to `main`; no draft PR is requested now. The prepared branch incorporates remote main `c9271f1a6df966ccc6a8015eace31e0c31f9aef2` without file conflicts or application changes. Its backup removals remain preserved.

The UI delta is based on `asgard-three-personas` at `22fc1e85db1dec5d0e08eef7a5287b3cbaeaf34b`. Main was an older single-assistant revision, so integration also carries the already-existing ASGARD history, backend and configuration. Do not describe the entire main comparison as newly authored UI work or claim its backend was live-tested here.

The existing downloadable `asgard-ui-upgrade-review.zip` remains the earlier change package against the ASGARD baseline, with historical delivery notes. Git history and these updated reports govern the direct-main delivery. Check remote main against the integration commit to confirm push completion. No manual production deployment is authorized by this delivery record; automatic deployment status is unverified.
