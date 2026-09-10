# ASGARD INDEX — the front door

This folder is one thing: the new `index.html` for **rayanfahil/rayven-pwa**, plus the
two prompts that go with it.

```
ui/index.html                 the file. Self-contained. No build, no libraries, no CDN
                              except one Google font (it degrades to system fonts).
INSTALL-ASGARD-INDEX.md       give this to ChatGPT to review, then to Codex to install.
CLAUDE-DESIGN-PROMPT.txt      paste this into Claude Design when you want design variants.
preview/                      what it looks like right now.
```

## What it is

The Warden form — the armoured humanoid from the atomic set, #04 — built out of
**64,477 points** laid on **54 plates**. Each plate is flattened onto its own plane,
lifted clear of the body and rimmed in light; points near a cell boundary are dropped,
which is what carves the dark seams. That engine is unchanged from the design you liked.

What is new is that **one body carries all three personas.**

| | THOR | LOKI | ODIN |
|---|---|---|---|
| colour | blue / white, gold rims | green / black, acid-lime rims | white / gold, cold-white rims |
| tempo | 1.00 — steady | 1.22 — restless | 0.82 — slow, heavy |
| ground | `#04070F` | `#030805` | `#0A0805` |

Switching persona does **not** rebuild the armour. The five palette colours are shader
uniforms, so the figure crossfades temperature over 900ms and shifts tempo. Same guardian,
different mood. Click THOR / LOKI / ODIN, or press `1` `2` `3`.

## What reacts

- **Your voice.** Press the mic (or `M`). The page reads the level off the microphone and
  drives the visor bar, the plate lift, the rim burn and the turbulence off it —
  fast attack, slow release, so a word lands hard and decays. Deny the mic and the page
  just keeps breathing on its own timer and never mentions it again.
- **The pointer.** The guardian tracks you, slowly.
- **State.** IDLE → LISTENING → THINKING → SPEAKING, each with its own coherence, agitation,
  plate lift, core brightness and breath rate.
- **`prefers-reduced-motion`** is honoured — motion drops to ~18%.
- **No WebGL?** There is a real 2D canvas fallback, in the right colours.

## Wiring it to the backend

Nothing in the markup is hard-coded. Everything on screen comes from the `DATA` object
near the top of the script — search `===== DATA`. The page also exposes:

```js
ASGARD.persona('thor'|'loki'|'odin')  // switch, with the crossfade
ASGARD.state('idle'|'listening'|'thinking'|'speaking')
ASGARD.level(0..1)                    // drive the glow from ElevenLabs playback
ASGARD.auto()                         // hand control back to the timed cycle
ASGARD.say('text')                    // replace the prompt line
ASGARD.metric('m1', '98.4%')          // take over any readout
ASGARD.onPersona = function(id){ }     // fires when the user switches
ASGARD.onMic     = function(on){ }     // fires when the mic starts/stops
```

Codex should call those. It should not restructure the page to add a backend.
