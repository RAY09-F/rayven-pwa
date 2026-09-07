# Design direction — The Quiet Core

## Intent

ASGARD is a place to speak and think with a recognizable assistant. A suspended, constructed object occupies the left side of a dark architectural space; a single readable conversation surface occupies the right. The new homepage uses real scene geometry instead of an illustration with controls painted into it. It retains Thor, Loki and Odin without introducing a modeling workspace or another product platform.

The provided concept images informed layered materials, sculptural cores and atmospheric space. They are not screenshots of this implementation. No unseen third-party project was inspected. Pixel-identical photorealism is not claimed, especially because this session's browser cannot initialize WebGL.

## Form and materials

The project already contained three authored cores. This change brings them into the primary experience and refines their presentation:

- **Thor:** a steel hammer with a white illuminated band, suspended within two pearl ribbons. The focused presentation narrows the ribbons and separates the hammer from their depth plane so more of the central silhouette remains visible.
- **Loki:** the existing yellow faceted crystal with pearl ribbons. The crystal remains yellow; emerald belongs to the interface accent. Ribbon widths are reduced in the focused presentation.
- **Odin:** a gold mechanical iris with a central light, bronze structure and pearl orbital pieces. The focused presentation corrects the blade orientation and uses beveled, tapered blade geometry so the aperture turns inward instead of producing outward spokes.

Each core rests above a layered dark plinth. Five receding architectural ribs establish depth around it. Steel and bronze are mostly opaque; pearl surfaces have restrained physical shading. Existing environment-map generation supplies the WebGL materials. ACES tone mapping controls the display; no bloom stack or added particle system is used.

These refinements are opt-in through the core context's `presentation: 'focused'`. Existing council/lab rendering retains its original presentation. The geometry remains development-owned; users receive no asset upload, export, editing or generation controls.

## Small design system

| Role | Treatment |
| --- | --- |
| Background | `#080D15`, with a subdued persona-tinted radial atmosphere |
| Surface | `#111A26`, slightly lighter conversation gradient |
| Primary text | `#E8EDF4` |
| Secondary text | `#A0ADBD` |
| Thor accent | `#A5D8F5` |
| Loki interface accent | `#9BE5C3` |
| Odin accent | `#E5C288` |
| Error surface/text | muted burgundy `#392323`, pale coral `#F1B8AA` |
| Type | Cinzel for identity and display headings; Inter for controls and conversation; system/Georgia fallbacks |
| Spacing | spacious desktop margins, compact mobile margins; consistent small internal gaps |
| Surfaces | 20px main-panel radius, smaller composer radius, restrained hairline borders |
| Focus | explicit two-pixel persona-colored outline; composer border also changes on focus |
| Controls | three persona choices, one Settings route, composer/send and existing voice input |

Fonts are requested from Google Fonts with display swap and local system fallbacks. No font files are redistributed. The renderer and its fallback are local pinned modules; font delivery is the remaining optional external visual dependency.

## Composition and interaction

The core retains its own area while conversation is open. Minimize conversation enlarges the available scene and exposes one obvious Open conversation button. Reopening restores focus to the active composer. Settings is a native modal dialog with spoken-output preference, still mode, rendering quality and links to existing Council/Bifrost pages.

There is no compulsory onboarding. Two small prompts fill the composer and let the user decide when to send. Empty conversation is intentionally quiet. Status text is always readable independently of movement or color. No tool counts, load percentages, fabricated connection indicator or background-work animation has been introduced.

## Motion and real state

The existing core modules receive idle, listening, thinking and speaking state. Listening is confirmed by the browser recognizer's start event; speech is confirmed by actual playback/start events. Pending microphone permission and TTS preparation have separate text. Chat pending state comes from the actual request lifecycle.

Audio amplitude remains zero because this frontend does not expose a measured amplitude source. No random values or invented audio reactivity were added. Consequently, the inherited audio-peak flares do not fire. Existing state-based geometry and light changes still apply on the WebGL path.

Balanced mode schedules at most about 30 render opportunities per second; High follows the browser animation callback. These are implementation limits, not measured frame-rate promises. DPR is capped at 1.25/1.5. Hidden pages stop rendering and reset elapsed-time accumulation. Still mode and the operating system's reduced-motion preference stop decorative animation.

## Mobile

The header and persona switcher stack above a compact core area. Conversation fills a separate lower panel with a 16px composer and touch-sized send/mic controls. Focusing conversation reduces the core area's height to leave more reading space. The transcript scrolls within its own surface. The document can scroll on short screens; the interface does not shrink the entire desktop composition.

At the inspected 390 × 844 layout, the Start listening control fits within the initial viewport. At 320 × 844, Settings retains a name despite showing only its icon. Physical on-screen keyboard behavior remains an explicit device check.

## Honest rendering fallback

WebGL is attempted first. If unavailable, the same mesh geometry is projected through the local Three.js SVG renderer and rasterized once into a 2D canvas. This avoids keeping thousands of SVG face nodes in the interactive DOM. The page labels this as a simplified still view. It does not pretend to offer GPU materials or continuous animation.

The still projection removes broad floor polygons and reflections that would occlude the model under painter ordering, and uses stable lower-intensity lights. If even that fails, a calm identity fallback keeps conversation usable. WebGL context loss currently enters that calm fallback; automatic context restoration is a follow-up.

## Provenance

The core geometry originated in this repository and was refined here. No third-party model asset was imported. Three.js 0.185.1, SVGRenderer and Projector are vendored under MIT; see `public/ui/vendor/THREE-LICENSE.txt` and [VENDOR-MANIFEST.json](VENDOR-MANIFEST.json). The two addon import paths were adjusted to the local module. No framework migration or frontend build step was added.
