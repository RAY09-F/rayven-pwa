# INSTALL THE ASGARD INDEX

Two audiences. Read the part that applies to you.

---

## PART A — FOR CHATGPT (review this before Codex touches anything)

You are reviewing a single self-contained HTML file, `ui/index.html`, before it is
installed as the front page of a live Cloudflare Pages site.

Context you need:

- Repo: `rayanfahil/rayven-pwa`. Frontend on Cloudflare Pages. Live at
  `https://rayven-pwa.pages.dev`.
- Backend: a Cloudflare Worker at `asgrard-backend.rayanfahil2.workers.dev`,
  Anthropic Messages API, tool-use loop, KV bound as `RAYVEN_KV`.
- The three halls already exist as their own pages: `public/thor/`, `public/loki/`,
  `public/odin/`. **This file does not replace those.** It replaces `public/index.html` —
  the door, not the rooms.
- Rayan has no coding experience. Anything you flag must come with the complete
  corrected file or the exact whole block to replace, never a "change line 412" note.
- Dev machine is a Chromebook, 2.7GB RAM, no swap. Nothing that needs a build step,
  npm install, or a bundler is acceptable.

What to check, in this order:

1. **Does it actually run?** Open it. Confirm you get a figure, not a black page.
   The single most common way this class of file dies silently is a GLSL compile error —
   `out`, `in`, `sample`, `filter`, `input`, `output` are reserved words in GLSL and a
   shader using one as a variable name fails to compile and renders nothing.
2. **Does the persona switch crossfade rather than snap?** It should take ~900ms.
   If it snaps, the palette uniforms are not being interpolated.
3. **Does the mic path fail safely?** Deny microphone permission. The page must keep
   running on its timed cycle with no error, no console noise, no dead button.
4. **Responsive.** 1600×900, 900×700, 390×844. Nothing may overflow horizontally.
   Nothing important may sit unreadable on top of the bright shoulders.
5. **Performance honesty.** It builds ~64k points at load on desktop, ~32k on a phone.
   That build is a couple of hundred milliseconds of CPU on a good machine and can be
   more on the Chromebook. Say so if you think it is too heavy; do not silently accept it.
6. **Security.** There are no network calls, no secrets, no `localStorage`, no third-party
   script. Confirm that is still true after any change you propose.

Do **not** rewrite the particle engine, add Three.js, add a framework, or "clean up" the
geometry code. That engine is the approved design. Your job is to catch what breaks it.

Output: either "clean, install as-is", or the complete corrected file.

---

## PART B — FOR CODEX (do the install)

Working directory: `~/rayven-pwa`. Read all of this before running anything.

### Step 1 — park the current state. Nothing gets deleted.

```
cd ~/rayven-pwa
git checkout -b pre-asgard-index-backup
git add -A && git commit -m "parked before asgard index install" || true
git checkout -
```

### Step 2 — find out which file is actually served as the front page.

Do not assume `public/index.html`. Read `wrangler.toml` / `wrangler.jsonc` and the Pages
build settings for the output directory. Whatever file is served at `/` is the target.
Say which one you used.

### Step 3 — install.

Copy `ui/index.html` over that file. Nothing else moves. Do not touch
`public/thor/`, `public/loki/`, `public/odin/`, `worker.js`, or the Chrome extension.

### Step 4 — point the three doors at the real halls.

Near the top of the script is a `DATA` object. Each persona has an `href`:

```js
thor: { ..., href: '/thor/',  enter: 'Enter Thor'  }
loki: { ..., href: '/loki/',  enter: 'Enter Loki'  }
odin: { ..., href: '/odin/',  enter: 'Enter Odin'  }
```

Correct those three paths to whatever the halls are actually served at. That is the only
edit required for the page to be functional. Everything else below is optional polish.

### Step 5 — optional: make the glow follow the real voice.

The index already reacts to the microphone on its own. If you want it to also pulse while
ElevenLabs is *speaking*, wire the existing TTS playback to the API:

```js
// when a reply starts playing
ASGARD.state('speaking');
// each animation frame while it plays, from an AnalyserNode on the audio element:
ASGARD.level(rms);           // 0..1
// when playback ends
ASGARD.level(0); ASGARD.auto();
```

And if the hall pages already know which persona is active, keep them in sync:

```js
ASGARD.onPersona = function(id){ /* remember the choice, or route */ };
```

Do not add a chat composer, a message list, or any backend fetch to this page. It is the
door. The conversation lives in the halls.

### Step 6 — check and ship.

```
node --check <(sed -n '/<script>/,/<\/script>/p' public/index.html | sed '1d;$d')
npx wrangler pages deploy public     # or whatever this repo's deploy command is
```

Then open the live URL and confirm, out loud, each of these:

- the figure renders (not a black page)
- THOR / LOKI / ODIN switch, and the colour **fades** rather than snaps
- keys `1` `2` `3` switch, key `M` toggles the mic
- ENTER opens the right hall for the persona currently selected
- on a phone-width window nothing overflows sideways and the ENTER button is reachable
- with the mic denied, the page still animates and shows no error

### What not to do

- Do not rebuild the 3D. Do not add Three.js, React, a bundler, or an npm install.
- Do not rename the Worker. A rename silently killed browser control once already.
- Do not force push. Do not `git reset --hard`. Do not delete files that look unused.
- Do not put any secret, key or token in this file. It is a public page.
- If something here conflicts with what the repo actually contains, stop and say so
  rather than guessing.
