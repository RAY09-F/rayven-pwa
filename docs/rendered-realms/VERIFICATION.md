# Verification — Rendered Realms

Date: 2026-09-07. Main baseline: `405d576696ef524b5e84a7b36df8d956207610e5`.

## Automated checks

- `node --test scripts/local-tools.test.mjs scripts/rendered-realms.test.mjs scripts/ui-state.test.mjs`: **23 tests pass, 0 fail**. The local-tools test exercises every one of the 36 implementations, plus expected-value and invalid-input assertions. The remaining tests cover catalogue permissions/schemas, typed fields, rendering geometry, state handling and cleanup.
- `node scripts/smoke-fx.mjs --files`: all source-asset checks pass. This is not an HTTP/live-service test.
- `node --check` on all changed/new JavaScript modules: pass.
- `git diff --check`: pass. Root/public HTML byte equality is included in the tests.
- `node scripts/build-ui-catalog.mjs`: regenerates the 223-entry backend catalogue without executing tools. The checked-in catalogue matches the actual public definitions.

Representative expected results include MRR 2,000 and annualized run rate 24,000 for 100 accounts at 20/month; break-even volume 50 for fixed cost 1,000 and contribution 20/unit; usage estimate 6 for the stated token/rate fixture; bounded retry delays [2,4,8,10]. Invalid denominators, malformed JSON, inconsistent score arrays and invalid URL protocols are rejected. CSV formula-like cells are escaped.

## Integrated browser checks

The local preview runs `scripts/ui-preview.mjs` and adds a clearly visible “LOCAL TEST · replies are fixtures” banner only for `fixture=1`. The adapter intercepts the existing Worker calls for test replies. No billed provider action or real external message was used to establish these results.

| Check | Observed result |
| --- | --- |
| Public persona layout | Thor, yellow Loki with green Sylvie, and Odin load their actual geometry modules |
| DNS search/category | Correct backend entry and real schema fields appear |
| Prepare tool request | Typed JSON enters the composer; it is not automatically submitted |
| Successful fixture request | Formatted reply, list, code and link appear; activity reports reply received |
| Save a tool | Filled field remains after Save; saved DNS entry survives page reload |
| Existing draft plus mission | Add/Replace/Cancel options appear; Add preserves original text |
| Council dock | Jane Foster dossier opens with roles, responsibilities and delegation preparation |
| Failed fixture request | HTTP 503 shows an error, activity says Request failed; Restore returns original text |
| Phone Chat shortcut | Composer receives focus on the 320px layout |
| Local MRR calculation | Browser renders 2,000 MRR and 24,000 annualized run rate from entered inputs |
| Proposal search | Subscription search returns labeled proposed integrations; detail shows requirements and acceptance |
| Arsenal sections | Backend/local/automation/build queue are separate named routes in the same modal |

## Viewports and screenshots

The surrounding cloud browser is approximately 1363×936; some captures have a 1348px content region because of a scrollbar. Exact smaller app CSS sizes use the development-only iframe wrapper: 1024×768, 390×844 and 320×844. These are layout checks in desktop Chrome, not physical-device emulation. White space outside the iframe in the saved originals belongs to the review wrapper. Screenshot files retain the actual browser capture and fixture labels; none is an image-generated mockup.

- [Thor chamber](evidence/thor.jpg)
- [Odin compact desktop](evidence/odin.jpg)
- [Loki phone](evidence/loki-phone.jpg)
- [Backend development tools](evidence/arsenal.jpg)
- [Local revenue calculator](evidence/revenue.jpg)
- [Narrow phone local workbench](evidence/narrow-tools.jpg)
- [Previous main design — historical evidence](evidence/prior-main-desktop.jpg)

Earlier Thor/Loki/Odin chamber screenshots were captured before the later addition of local-tool navigation. They accurately show the chamber geometry/layout; their header catalogue wording is from that earlier checkpoint. Revenue and final expanded Arsenal screenshots show the later expansion.

## Rendering limits

The test browser cannot initialize WebGL. It displays the explicitly labeled simplified geometry projection. **GPU lighting, transparent materials, animation appearance, context-loss recovery and sustained frame rate have not been verified on a GPU-enabled browser.** The implementation still uses actual Three.js meshes with the WebGL path as the primary renderer; it does not substitute concept JPEGs for geometry.

The core tests exercise two initialization cycles, multiple quality levels, states, sizes, finite attributes and resource disposal. Council tests cover all five advisor meshes per persona, picks, finite geometry, a stable nonanimated update and disposal. They do not prove host-level memory behavior or GPU output. Direct pointer picking/dragging is source-reviewed; the keyboard-accessible council route was browser-tested.

Source-reviewed controls include one frame-loop owner, DPR caps (1.25 balanced / 1.5 high), balanced frame scheduling, hidden-page pause, bounded delta, generation guards, listener teardown and core/realm disposal. There is no measured FPS claim.

## Remaining limits and corrections

No current live backend/provider audit, microphone/recognition/TTS hardware test, full assistive-technology audit, real iOS keyboard pass, billing-provider setup or production deployment was performed. Existing historical browser-extension metadata errors are described in the previous UI report; this iteration does not claim a clean full-console certification.

During development, intersecting fallback ribbons and a fallback-label collision were observed and corrected. A syntax error in one new template string was caught before browser verification and fixed. An unsupported browser helper method failed during a test; the DOM snapshot then confirmed the field value. None is recorded as a production failure. The browser's blocked alternate preview port was not bypassed.

Full acceptance of the visual rendering remains contingent on the GPU/device checks above. The local utility and browser fixture checks are a narrower, passing result.
