# STRIKE ONE — hall hook anchors

Served hall file: `public/index.html` (wrangler `[assets] directory = "./public"`,
`run_worker_first = true`, `src/index.js` falls through unmatched GETs to
`env.ASSETS.fetch`). `index.html` at the repo root is a byte-identical copy
(`cmp` clean at survey time), so every patch is applied to both and
re-confirmed with `cmp`.

Line numbers are from the pre-patch file (383,923 bytes).

| Hook | Exists | Anchor (exact, unique) | Line | FX call |
|---|---|---|---|---|
| Wake sequence start, thor/loki/odin | yes | `function runWakeFx(personaId) {\n  const token = ++wakeFxToken;` | 3741 | `AsgardFX.wake(personaId)` |
| Wake sequence start, Hela | yes | `function _h9Reveal() {\n  _h9.stage = 'held';` | 5401 | `AsgardFX.wake('hela')` (fires when her room is revealed; the hall's own `_h9Wake` canvas at z-index 301 is opaque until then) |
| Speech recognition start (listening) | yes | `  beginRecognition(convoRecognition);\n  updateMicVisual();\n}` | 4460 | `AsgardFX.setState('listening')` — conversation listening only; wake-word listening while asleep stays visually idle on purpose |
| Speech recognition stop | yes | `function killRecognition() {\n  const r = liveRecognition;\n  liveRecognition = null;\n  if (!r) return;` | 3326 | `AsgardFX.setState('idle')` (only when a live instance was actually killed) |
| Request sent to backend (thinking) | yes | `  try {\n    const response = await fetch(BACKEND_URL, {\n      method: "POST",` (sendMessage) | 6113 | `AsgardFX.setState('thinking'); AsgardFX.pulse('send')` |
| TTS audio play start (ElevenLabs) | yes | `      source.start(0);\n      startAudioReactive();` | 4645 | `AsgardFX.setState('speaking')` — level is NOT passed; the hall already publishes it as `window.Reactor.audioLevel` and the `--voice` CSS property each frame, and the FX file reads that (no analyser added, Rule 5) |
| TTS audio play start (browser-voice fallback) | yes | `        synthPulseTimer = setTimeout(() => {}, 0); // marks synthetic-pulse mode\n        startAudioReactive();` | 4655 | `AsgardFX.setState('speaking')` |
| TTS audio end (ElevenLabs) | yes | `      source.onended = () => {\n        currentSource = null;\n        stopAudioReactive();` | 4639 | `AsgardFX.setState('idle')` |
| TTS audio end (fallback) | yes | `        const finish = () => {\n          if (synthPulseTimer !== null) { clearTimeout(synthPulseTimer); synthPulseTimer = null; }\n          stopAudioReactive();` | 4657 | `AsgardFX.setState('idle')` |
| TTS error path | yes | `      console.error('ElevenLabs TTS failed, browser voice fallback:', err);` | 4650 | `AsgardFX.pulse('error')` |
| API error path | yes | `    typingDiv.remove();\n    appendMsgDom('assistant', \`Connection error: ${err.message}\`);\n    sfxError();` | 6128 | `AsgardFX.pulse('error'); AsgardFX.setState('idle')` |
| Persona switch | yes | `  buildHUD(personaId);\n  clearCaption();\n  fireShockwave();\n  sfxSwitch();` (switchPersona) | 2815 | `AsgardFX.setPersona(personaId); AsgardFX.pulse('switch')` |
| Reply text arriving in transcript | yes | `    typingDiv.remove();\n    if (guestName) pushMsgLocalOnly('assistant', replyText); else pushMsg('assistant', replyText);` | 6121 | `AsgardFX.pulse('receive')` (word-by-word reveal itself is done by the MutationObserver in the FX file) |
| Hela vault open | yes | `function _h9Enter() {\n  if (_h9.stage !== 'dormant') return;\n  _h9.stage = 'opening';` | 5385 | `AsgardFX.pulse('vault-open')` |
| Hela vault close | yes | `function _h9Exit() {\n  if (_h9.stage === 'dormant') return;\n  _h9StopEar();` | 5823 | `AsgardFX.pulse('vault-close')` |
| Hela lock in / stand down | yes | `  if (changed && _h9.dom) {\n    _h9Shock(_h9.locked);` (_h9SetLocked) | 5805 | `AsgardFX.pulse(_h9.locked ? 'lock-in' : 'stand-down')` |
| Script tag + init | — | `})();\n</script>\n</body>` (file tail) | 7747 | `<script src="/fx/asgard-fx.js"></script>` + one `AsgardFX.init({ persona })` |

## Transcript container
`#chatLog` (a `div`). Each message is `div.msg.user` / `div.msg.assistant` with a
`span.label` first child followed by the text. The hall appends a `...` typing
placeholder as an assistant message and removes it when the reply lands.

## z-index range
- `#backdrop` 0 (persona weather CSS), `#reactorCanvas` 1, `#spectrumCanvas` 2, `#wakeFx` 8
- HUD panels and chrome: 5–30
- Lock screen 100, gesture panel 120, alert overlays 190–200
- Hela: `#h9Cell` 300 (opaque), `#h9Wake` 301, shock 320

FX canvases: backdrop canvas z-index 0 appended to the end of `<body>` so it
paints above `#backdrop` and under the reactor; overlay canvas z-index 60
(above every panel, below the lock screen). While the vault is open the overlay
is raised to 305 so it sits above the opaque cell and under the shock.

## Existing signals the FX file reads without a hook
- `document.documentElement[data-persona]` — current persona
- `window.Reactor.audioLevel` and `--voice` — smoothed TTS level 0..1
- `body.hud-hidden` — set while the vault is open
