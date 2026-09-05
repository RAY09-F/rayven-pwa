# The arc core module contract (Strike Three)

An **arc core** is the modeled centrepiece of a god's hall: real geometry with
materials, lights and state-driven motion, rendered by Three.js **inside the
FX engine's own WebGL2 context** (the engine's back canvas). There is no
second canvas and no second context. The engine (`public/fx/asgard-fx.js`)
owns the renderer, the canvas, the frame loop, the quality tier and the
governor. A core module never creates a context, never calls
`requestAnimationFrame`, never resizes the canvas, and never touches the DOM
outside its own label layer.

## Files

- `public/fx/cores/<id>.js` — one file per visible god (`thor`, `loki`,
  `odin`). Loaded **by the engine** with a dynamic `import()` (falling back to
  an injected script tag), never by a tag in the hall. The file registers
  itself:

  ```js
  window.AsgardFX.registerCore('loki', { init, setState, select, update, resize, dispose, /* optional */ setQuality, draw2d });
  ```

- The engine ignores `registerCore` for any id that is not one of the three
  visible gods. No other persona has a core module, and none is created for
  one: when another persona is active the cores layer stays disposed and the
  engine's existing treatment carries the centre.

## The module

```js
{
  init(ctx)               // build geometry, materials, lights; add to ctx.scene
  setState(s, level)      // 'idle' | 'listening' | 'thinking' | 'speaking', level 0..1
  select(advisorId|null)  // light one tether + its markers, settle the rest (Phase 2)
  update(dt, ctx)         // called from the engine's frame loop; dt >= 0 seconds
  resize(w, h, ctx)       // CSS pixels of the page; set camera fov/aspect/position; NO canvas resize
  dispose()               // release EVERY geometry, material, texture and render target
  setQuality(q)           // optional; q = 0 (full) .. 4 (static). Drop cost as q rises
  draw2d(ctx2d, W, H, ctx)// optional; the 2D fallback, drawn on the engine's 2D back canvas
}
```

`update` is called with **`dt = 0` while motion is disabled** (reduced motion,
still mode, quality tier 4). A module that only integrates by `dt` therefore
freezes in place, lit and dimensional, without a special case. The engine also
stops re-rendering a still core once it has settled; the canvas keeps the
last frame.

`setState` may be called before `init` (the 2D path never calls `init`). It
must only record the state until there is something to apply it to.

## `ctx` — what the engine hands a core

```js
ctx = {
  THREE, renderer, scene, camera,   // the shared Three.js module and the engine's renderer/scene/camera
  tier: 'webgl2', persona: 'loki',
  palette: { pearl, plum, void, silver, petrol, uv, core, rim },   // hex numbers; core/rim are this god's own light
  reduced,                          // prefers-reduced-motion
  w, h, dpr, quality, still,        // live getters
  level, listen, think, speak,      // live getters: raw speech level 0..1 and the smoothed state weights
  t, state,
  ring(x, y, [r,g,b], speed, width, maxR),   // one expanding ring on the engine's overlay, CSS pixels
  flash(strength, [r,g,b], seconds),
  project(vec3, out) -> { x, y },   // world → CSS pixels through the current camera; `out` is reused, nothing is allocated
  sfx                               // the engine's WebAudio synth (respects mute)
}
```

The renderer is created with `autoClear = false`; the engine paints the sky
first, clears depth, then calls `renderer.render(scene, camera)` itself. A
core never calls `render`.

## Lifecycle, as the engine runs it

1. A page opts in: `AsgardFX.init({ persona, cores: true })` (the lab page
   does; the hall does not yet — that is a later phase and is done inside the
   engine, not with a hall edit).
2. Each frame the engine reconciles: if the active persona has a core and the
   tier is WebGL2, it loads Three.js (pinned `three@0.185.1`, ES module build,
   through the three mirrors jsdelivr → unpkg → esm.sh, sharing the hall's
   own loader when present so only one copy is ever fetched), loads the core
   file, creates one `WebGLRenderer` on the **existing** context, then calls
   `init`, `setQuality`, `resize`, `setState`.
3. While a core is up the back canvas runs at full resolution (it is
   half-resolution for the sky alone) and the realm's shader sky is rendered
   **once** into a half-size framebuffer and blitted each frame — the backdrop
   is on its static tier under a core, exactly as the design skill requires.
   It re-renders only on resize, tier change, persona change, or during a
   wake.
4. Persona change or `cores(false)`: `dispose()` is called, the scene is
   cleared, and the canvas returns to half resolution. Hiding is not
   releasing — a core must release everything it made.
5. Context loss: the engine drops to its 2D back canvas. The core's Three.js
   objects are dropped without calling GL, and the module's `draw2d` (if any)
   takes over on the 2D canvas.
6. Any exception from a core (init, update, render) is logged verbatim,
   surfaced on the `?debug=1` overlay as `CORE ERR …`, and the core is
   unmounted so the page keeps working.

## Tiers

| Engine tier | Core |
|---|---|
| WebGL2 | Three.js, real geometry |
| WebGL1 | `draw2d` on the 2D back canvas. Three.js r163+ needs WebGL2, so the whole FX layer drops to 2D on such a device (RENDER PATH reads 2D, honestly) |
| 2D / context lost | `draw2d` on the 2D back canvas |

## Rules a core must keep

- Real geometry with volume. Effects may surround it; the object stays
  recognizable as a solid thing.
- No per-frame allocation. Preallocate every vector, quaternion and output.
- Reuse geometry and materials; a mirrored or instanced copy shares them.
- Every animation has a deadline and force-completes.
- No text in the scene. Labels are HTML positioned by the engine.
- Keep under ~8k triangles per core. The reflection or any other extra is the
  first thing `setQuality` removes.
- Nothing in a core names, counts, fetches or hints at the fourth realm.

## Adding a core

Copy `public/fx/cores/loki.js`, keep the registration id equal to the
persona id, replace the geometry with that god's own (see the design skill's
per-god table), keep the state machine shape, and load nothing the engine did
not hand you.
