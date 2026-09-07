# ASGARD interface baseline

Baseline branch: `asgard-three-personas`
Baseline commit: `22fc1e85db1dec5d0e08eef7a5287b3cbaeaf34b`
Scope: the integrated homepage, its conversation and voice script, serving configuration, and relevant existing checks. This report describes the starting implementation before the UI upgrade.

## Evidence and inspection limits

The parent implementation session captured the actual page at desktop 1440 × 900 and in a phone iframe viewport of 390 × 844. These are browser appearance observations, not measurements on Rayan's Chromebook or physical phone.

- [Desktop baseline](evidence/before-desktop.jpg)
- [Phone baseline](evidence/before-mobile.jpg)

The bounded contract audit was read-only. It did not call the live backend, request microphone permission, play real provider speech, or exercise private integrations. Browser evidence and source inspection are distinguished below. Hardware voice, current provider billing, live conversation success, and sustained device performance remain unverified.

## Observed interface

At 1440 × 900, the homepage scales a fixed 1920 × 1080 stage to fit the window. Large hall JPGs provide the apparent model, architecture and substantial baked interface content. Live chat is layered over that image. The captured page shows faint duplicate text where baked labels or UI remain beneath live content.

At 390 × 844, the entire desktop stage shrinks to approximately 219 pixels tall in the middle of the viewport. The capture shows very small text and controls with extensive unused space above and below. This is a scaled desktop composition, not a separately adapted phone layout.

Source inspection confirms that the homepage uses `/img/thor.jpg`, `/img/loki.jpg` and `/img/odin.jpg`, with Canvas 2D dust and a pointer light. It does not load a real-time 3D core renderer. The pictures are attractive art-direction references but do not provide interactive geometry.

## Existing identity and behavior to preserve

- Three visible personas: Thor, Loki and Odin, with blue, emerald and gold visual identity respectively. The new visual direction may refine the core materials while retaining recognizable persona distinctions.
- Per-persona composer and transcript DOM. Switching personas preserves those drafts and displayed messages within the current page session.
- JSON chat requests to `https://asgrard-backend.rayanfahil2.workers.dev/` with `{ assistant, message }`. The backend also accepts the `persona` alias and returns `{ reply, persona }`.
- Per-persona busy guards, pending reply treatment, error messages, and send-button recovery. Reply content is inserted with `textContent` rather than unsanitized HTML.
- TTS through `POST /tts` with `{ text, persona }`, browser speech fallback, interruption of earlier playback, and stale-callback guards.
- Existing SpeechRecognition wake mode, persona wake/switch phrases, sleep and stop phrases, single-recognizer lifecycle, and handling of microphone permission refusal.
- Existing concealed-realm interception remains on-device before transcript or network use. Its vocabulary and entry points must not be advertised in the primary interface.
- Backend persona-scoped memory/history and all existing confirmation boundaries. No backend changes are required to improve this interface.
- Existing secondary pages and graphics modules remain available; they should not become an enlarged default toolbox.

The homepage currently has no localStorage or sessionStorage persistence, no reload restoration of its displayed transcript, and no PWA service-worker registration. Backend history remains independent of that limitation.

## Source-observed issues

| Finding | Evidence | Effect |
| --- | --- | --- |
| Number shortcuts run while typing | Global keydown handler responds to `1`, `2`, `3` without checking the focused field | Ordinary messages can switch persona |
| Legacy persona URLs disagree with boot parsing | Worker redirects to `?persona=loki`; homepage reads `?hall=` or the hash | A saved persona link can open Thor instead |
| Mic control is a clickable span in Thor only | `.thor-input .mic` event binding | Limited keyboard access and no equivalent primary voice control in other halls |
| Permission failures can leave stale mic presentation | `voiceOff()` does not itself update `aria-pressed`; refusal message is sent to Thor | Displayed state can diverge from current voice state |
| Initial and completion focus is forced | Homepage boot focuses the composer; send completion focuses the originating input | Mobile keyboard can open unexpectedly; focus can target a hidden hall after switching |
| Speech input and output are not separately controlled | Every reply attempts TTS; mic toggle also stops speech | Users lack a clear independent output-mute action |
| Network requests lack bounded fetch timeouts | Chat and TTS fetch paths have no AbortController deadline | A hung request can leave interaction pending |
| Motion handling is incomplete | Dust RAF lacks a hidden-page pause; reduced motion checked only when dust starts | Decorative work may continue while hidden; preference changes are not handled immediately |

These are source findings. They were not all individually reproduced in the baseline browser session. Their corrective checks belong in the integrated verification report.

## Design judgments and opportunities

The existing hall images establish ambition, persona color and spatial depth. Their strongest qualities should inform a real rendered presence. The highest-impact changes are an original, readable 3D silhouette, honest assistant-state feedback, a deliberately small action set, and a phone layout that prioritizes usable conversation instead of scaling every desktop element down.

The interface should gain visual depth through geometry, material separation and restrained lighting. Additional dashboards, tools, modeling controls or new backend systems would not address the observed problems and are outside this assignment.

## Architecture and instruction hazards

The current application is vanilla HTML/CSS/JavaScript, served from Worker static assets in `public/`. Root `index.html` and `public/index.html` are a required mirror. Existing instructions copy root over public, so editing only the latter can be overwritten later.

`wrangler.toml` must retain Worker name `asgrard-backend`, `run_worker_first = true`, existing asset binding, and Durable Object configuration/migration. The unusual Worker spelling is intentional; changing it is not a visual upgrade. Removing worker-first routing can disrupt `POST /`, which also supports existing Telegram traffic.

`docs/HALLS_INSTALL.md` describes the current concept-art homepage. `README-ASGARD.md` contains substantial older frontend guidance about an unlock flow, modeling bay, command palette and reactor; those descriptions do not establish that such controls exist on the current homepage. The root `manifest.json` is a browser-extension manifest, not the current page's PWA manifest. Historical deployment and billing notes were not reverified against production.

## Baseline checks

| Check | Result | Limit |
| --- | --- | --- |
| `git status --short` during initial audit | Clean | Describes the checkout before implementation work |
| `cmp index.html public/index.html` | Pass | Confirms mirror equality at baseline |
| `node scripts/check-scripts.mjs public/index.html` | Pass, inline block 1 at line 494 | JavaScript syntax only; not browser or backend success |
| Desktop and mobile appearance | Captured and inspected | Specific viewports only; mobile is an iframe viewport |
| Live chat, real microphone and provider TTS | Not run | No claim of current live success |

`scripts/smoke-fx.mjs` can run against an explicit local static server without live API effects, but its homepage assertions intentionally require the previous three-picture design. Those superseded assertions need updating when the real renderer replaces that design. Legacy static-asset checks remain useful.

`scripts/smoke.mjs`, `mcp-smoke.mjs` and `tool-tests.mjs` invoke actual provider or tool behavior and were not run. Export and generation scripts may read credentials, private data or backend routes and are not necessary for this frontend slice.

## Baseline conclusion

The starting page preserves usable conversation and substantial voice logic, but its visual anchor is a still image and its phone composition is unsuitable for everyday interaction. The upgrade should preserve those existing contracts while replacing the visual presentation, fixing the highest-impact interaction defects, and validating the integrated result with mocked network contracts clearly separated from live behavior.
