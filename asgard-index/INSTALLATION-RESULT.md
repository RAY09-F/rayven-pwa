# Warden installation — 2026-09-10

The entrance is installed in both `index.html` and `public/index.html`. The Worker serves `public/index.html`; root HTML is its maintained copy. The supplied `asgard-index/ui/index.html` remains the original reference.

## Preserved work and release scope

- Backup branch: `pre-asgard-index-backup`, commit `0cc7219` preserves all previously modified and untracked project files. Ignored dependencies and output remain on disk.
- Working branch: `codex/install-asgard-index`, including the uploaded package from GitHub main.
- Deployment worktree: `C:\Users\Hoengager\Desktop\ASGARD\rayven-warden-release`, branch `deploy/warden-index`, based on production source `71abd14`.
- Do not deploy this development checkout wholesale: it contains additional backend/tool/Bridge work that has not been part of this front-page release.
- The release changes the front page and release metadata. All 161 other fingerprinted assets, hall pages, backend sources, Worker configuration and extension are preserved from production.
- The previous production Council dashboard remains at `/hud/`. The newer local Bridge is preserved on the backup branch.

## Corrections to the supplied page

- Hall links are `/hall/#thor`, `/hall/#loki`, `/hall/#odin`.
- Legacy persona query strings and hashes select the correct Warden; invalid values are ignored.
- Enter opens the selected hall; 1/2/3 select personas; M toggles the microphone glow. Keyboard handling respects focused controls and editing fields.
- Microphone permission denial, cancellation, delayed permission grants, errors, hidden tabs and page exit release audio resources safely.
- Footer entries now link to the halls, Council and settings.
- External Google Font requests were removed. The entrance uses system fonts and has no backend calls, remote scripts, storage or secrets.
- Frame time is labelled accurately. Preview states describe an animated entrance; the microphone measures volume and does not recognize speech. Conversation prompts explicitly refer to the hall.
- Added keyboard focus/pressed states, safe-area spacing and a top scrim for legible small-screen labels.
- Retained the approved particle geometry and palette engine. The 2D fallback supports timed state/colour changes and microphone glow; reduced-motion rendering limits movement.
- Fixed the documented `ASGARD.metric('latency', value)` alias.

## Checks

- Development checkout: 456 tests passed; release lineage: 106 tests passed.
- Real WebGL rendering visually inspected at 1600×900, 900×700, 390×844 and 320×568; all personas, no horizontal overflow and reachable Enter control.
- Browser checks cover smooth 900ms fades, keyboard navigation to each real hall, invalid/legacy URLs, denied/cancelled/granted simulated microphone input, audio API and no-WebGL fallback. No JavaScript page errors.
- Measured initial frame around 70–230ms on this Windows PC. About 64,477 desktop points and 32,262 phone points; not a performance certification for a Chromebook or a physical microphone test.
- `scripts/warden-browser-qa.mjs` runs the browser checks; set `ASGARD_QA_URL`, `ASGARD_QA_OUT` and optionally `ASGARD_QA_VERSION` for a pinned production version.
- Output evidence is in `output/warden*`. Deployment receipt and live asset checks are in the release worktree's `output/warden`.

The install document's Pages deployment command, repository owner, Chromebook path and separate persona directories were outdated. This release uses the existing `asgrard-backend` Worker and preserves its bindings and triggers.

## Completed production deployment

Worker version `433c5e9b-7044-4a55-ba1d-72a62e4fbbe5` is serving 100% of traffic. It passed 11 canary samples over 316 seconds before promotion. Release commit: `b1f7385` on `deploy/warden-index`; release fingerprint: `floating-8bfd66b61ee9`.

Both https://asgrard-backend.rayanfahil2.workers.dev/ and https://rayven-backend.rayanfahil2.workers.dev/ passed all 162 asset hash and MIME checks without version overrides. The complete public-browser suite also passed without an override, with no JavaScript page errors. Local and release work are committed; no GitHub push was performed.

## Living-particle visual update

The subsequent user-requested visual update adds individual flowing particle currents, moving energy bands, three orbital filaments, soft white halos for listening/speaking and a click/tap charge pulse. The silhouette, navigation and existing hall/backend behavior are preserved. The entrance remains a visual preview, with real microphone amplitude support; it does not itself conduct conversations.

The source copies are synchronized with release branch `deploy/warden-index`. New browser coverage is in `scripts/warden-motion-qa.mjs`; measurements and screenshots are in the release worktree's `output/warden-motion*`. The release's `docs/WARDEN-MOTION.md` records the visual changes and identifiers. The previous versions remain on `pre-warden-motion` and `pre-warden-motion-development`.

Latest production version: `5481a3d8-086c-488e-9805-34c6dd4a301f`, release `floating-2fa584f036cf`, promoted to 100% after 11 passing samples over 314 seconds. The live motion/glow tests, charge interaction, reduced-motion checks, existing browser regression suite and all 162 pinned asset checks passed. Development suite remains 456 passing tests; release suite remains 106 passing tests.
