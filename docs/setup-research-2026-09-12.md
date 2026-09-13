# ASGARD setup research â€” September 12, 2026

## Implemented in this pass

1. Public performance lab with local CSV processing, per-process/swap-chain selection, frame-time trace, average FPS, p95/p99, defined slowest-1% FPS and a saved baseline summary. Captures are not uploaded.
2. PapaParse 5.7.0 vendored from the official npm archive. SHA-512 matched npm integrity. MIT license included beside the library. Repository: https://github.com/mholt/PapaParse
3. PresentMon 2.5.1 console binary installed in `%LOCALAPPDATA%/ASGARD-Tools/PresentMon-2.5.1`. SHA-256 matched GitHub's release digest: `9bec3083069f58f911e6a512f4806db51a27bd096103087bc1d05ef54c80a191`. `--help` ran successfully; no live game capture was claimed. MIT license copied. No service, driver or startup item was installed.
4. A bounded `scripts/capture-fortnite.ps1` records 15â€“120 seconds of Fortnite frame timing on demand, without input tracking. It requires Fortnite running, preserves separate timestamped files and does not elevate or change Windows groups. Real capture remains to be verified during gameplay.
5. Three additional agent tools: `github_project_review`, `frame_time_report`, `paper_account_health`. Four main-page catalogs synchronized. Odin's mini-agents also receive paper-account health and GitHub review.
6. Setup guide and performance-lab links added to the command center.

The tool catalog contains implemented tools, local utilities and proposals. The combined count is not a count of installed integrations. This pass adds three implemented tools; no proposed tool was relabeled complete without implementation.

## Verified services and hardware

At the initial audit, the Chrome extension heartbeat and cloud paper scheduler were connected; Rainmeter and SignalRGB processes were running. CPU reported AMD Ryzen 7 5700X, GPU NVIDIA RTX 5060 Ti. Paper marked equity was $9,690.70 using dated cached marks. This does not verify every external provider, voice call or individual RGB LED. No calls were placed during the audit.

The existing command center separately reports task activity, extension heartbeat, RGB helper connection, last applied theme and local sensors. Configured agents are not necessarily busy; cached task markers do not establish that every model provider can currently answer.

## GitHub shortlist and decisions

Release metadata checked through GitHub's official REST API. These are dated observations, not permanent latest-version claims.

| Repository | Release checked | Decision |
|---|---|---|
| [PapaParse](https://github.com/mholt/PapaParse) | 5.7.0, Aug 24 | Integrated. Handles quoted CSV correctly; avoids a fragile handwritten CSV parser. |
| [PresentMon](https://github.com/GameTechDev/PresentMon) | v2.5.1, Jun 29 | Console installed and capture script prepared. Frame data can identify poor consistency; it does not promise higher FPS. |
| [Rainmeter](https://github.com/rainmeter/rainmeter) | v4.5.26.3894, May 20 | Already running. Keep the existing ASGARD desktop widgets; no replacement or duplicate desktop system installed. |
| [PowerToys](https://github.com/microsoft/PowerToys) | v0.101.2362.0, Aug 25 | Recommended optional install for FancyZones and keyboard utilities. Not installed in this pass; existing workspace/launcher customization should be reviewed before adding overlapping shortcuts. |
| [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) | v0.9.6, Feb 14 | Candidate for CPU temperature. Deferred: some sensors require elevated hardware access; current NVIDIA telemetry already works. Use the official GitHub project, not similarly named unofficial sites. |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | 2.5.4, Sep 11 | Candidate for an independent monitor on a separate always-on host. Not installed on this PC, since it cannot alert about this PC being off if it is also off. Current dashboard health is already active. |

The selected integrations add CSV analysis and on-demand frame capture. Existing RGB and desktop controllers remain in use.

## Physical setup: prioritized shortlist

Products are recommendations, not purchased items. Exact pricing, shipping and fit need checking before purchase; this pass does not invent quotes.

| Priority | Item | Why it fits / what to check |
|---|---|---|
| 1 | [UPLIFT wire-management tray](https://www.upliftdesk.com/wire-management-tray-by-uplift-desk/) | Hides power bricks and excess cable under the desk. Verify mounting method, desk thickness and leg clearance. |
| 2 | [UPLIFT wire-management accessories](https://www.upliftdesk.com/desk-accessories/wire-management/) | Reusable ties, sleeves and a vertical channel create one intentional cable route. Magnetic channels need a suitable steel surface. |
| 3 | [Ergotron desk monitor arm](https://www.ergotron.com/en-us/products/mounts/desk-mounts) | Clear the desktop and align displays. Match actual monitor weight, VESA pattern, curvature and desk clamp range before choosing LX/LX Pro. |
| 4 | [BenQ ScreenBar Halo 2](https://www.benq.com/en-us/lighting/monitor-light/screenbar-halo-2.html) | Useful task lighting with less desk clutter. Check monitor shape and camera clearance. |
| 5 | [Elgato Stream Deck Neo](https://www.elgato.com/us/en/p/stream-deck-neo) | Physical buttons for opening Asgard, the command center and capture instructions. Agent/RGB actions need an explicit local integration; they are not already wired to this unowned device. |
| 6 | [Govee gaming lights](https://us.govee.com/collections/gaming-lights) | One restrained wall wash behind the display. Verify the exact model's local-control/SignalRGB support before buying for agent sync. No universal compatibility claim. |
| 7 | Large charcoal desk mat | Visually connects mouse and keyboard. Measure usable desk width and choose a washable surface. |
| 8 | Under-desk headphone hook | Frees desk space; mount away from knee and chair paths. |
| 9 | Cable labels at both ends | Label monitor, PC, speakers, dock and power adapters so maintenance is simple. |
| 10 | Surge protection or UPS selected by measured load | Choose capacity and physical fit from actual connected load. No wattage or runtime claim from GPU model alone. |

Design direction: dark neutral surfaces, one accent color per agent, hidden power bricks, aligned monitor tops, one light source behind the screen and warm task lighting on the desk. Hardware decluttering will improve the appearance more than adding several competing RGB devices.

## In-home cable-management providers

Local company selection is waiting for the user's city or ZIP. A phone area code is not enough to assume service location. No address was disclosed and no booking/message was sent.

- [Taskrabbit services](https://www.taskrabbit.com/services): lists computer help and office tech setup. Ask a local tasker explicitly whether under-desk cable routing and mounting are included; not every computer-help task is an in-home cable-management appointment.
- [HelloTech](https://www.hellotech.com/geek-squad-isnt-best): advertises in-home technical service. Desk-only cable organization and service coverage must be confirmed before booking; this is a candidate provider, not a verified local quote.
- [Thumbtack wiring professionals](https://www.thumbtack.com/k/wiring-installation/near-me/): directory for comparing local installers once a location is supplied. Its page requires JavaScript verification, so individual providers were not verified here.

Message to send when requesting quotes:

> I need in-home cable management for a gaming desk and PC setup: route and label monitor/peripheral cables, secure power bricks in an under-desk tray, create one tidy cable path, leave enough service slack, and test every connected device afterward. Please quote labor and materials separately, confirm whether desk mounting is included, share relevant before/after photos, and state your minimum visit charge. This request is for external desk cables; do not open or rewire the PC unless separately agreed.

Use a suitable licensed professional if the scope expands to mains electrical work or in-wall wiring. For ordinary desk organization, request photos, a written scope and a clear materials list.

## Next useful updates

1. Record three comparable Fortnite runs and compare frame times, not only peak FPS.
2. Audit startup impact before disabling anything; preserve SignalRGB, ASGARD helper and required input/audio utilities.
3. Measure CPU/GPU busy time before selecting a CPU or GPU upgrade.
4. Add a compact optional Rainmeter service-health widget, avoiding duplicate clocks already running.
5. Add a hardware button surface only after the model is selected.
6. Confirm exact Lian Li model and LED map before ring-only lighting changes.
7. Validate paper strategies on longer stock history and new forward data.
8. Add an on-chain holder-concentration provider before claiming meme screening is complete.
9. Place independent uptime monitoring on an always-on host if desired.
10. Use written cable-routing labels and photos as a maintenance map after physical work.

## Business experiments, not income forecasts

- Offer a small local gaming-desk cleanup and software setup package after measuring how long the work takes; use explicit scopes and before/after photos.
- Build a paid dashboard customization service using the reusable ASGARD status/performance pages, with customers supplying their own provider credentials.
- Offer benchmark comparison reports using repeatable captures; sell measurement and diagnosis, not promised FPS increases.
- Test a local photographer workflow dashboard with one pilot customer before building a general platform.

No new subscriptions, hardware purchases or business outreach were made in this pass.

## Validation and remaining hands-on work

- 167 automated checks passed, including mixed-process separation, invalid frame data, FPS arithmetic, GitHub input validation, absent release handling, existing trading checks and persona rendering checks.
- The deployed performance lab read a clearly labeled 200-row synthetic CSV and returned the expected 465.12 average FPS and 200 slowest-1% FPS. These are test-fixture results, not measurements of this PC. Baseline save/clear worked, and the synthetic baseline was removed.
- The GitHub review tool queried PresentMon's live metadata successfully. Browser control and the cloud scheduler remained connected on final check. Paper accounting still reconciled to floating-point rounding.
- C: had approximately 554.7 GB free out of 930.5 GB at inspection; no cleanup deletion was needed.
- To capture actual Fortnite performance, start a repeatable game scene, then run the installed `Capture Fortnite.ps1` in `%LOCALAPPDATA%/ASGARD-Tools/PresentMon-2.5.1`. It saves CSV files to Documents/ASGARD-Captures. Import one into the performance lab. Capture permission and real gameplay remain to be verified when the user is back.
- Exact fan-ring mapping still requires the fan model or a physical LED test. In-home cable-management coverage still requires a city or ZIP.
