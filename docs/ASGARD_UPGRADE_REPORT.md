# What's new in Asgard — the plain-English report

Written 2026-09-05 at the end of an overnight build. Everything here is live on
https://asgrard-backend.rayanfahil2.workers.dev unless it says otherwise.
Anything visual is **unverified** until you have looked at it — the exact
questions are in `docs/STRIKE_THREE_PROGRESS.md` under NEEDS RAYAN'S EYES.

## The halls (Strike Three)

- **The centre of each hall is real 3D now.** Loki's citrine relic inside three
  pearl ribbons, Thor's hammer inside two shells, Odin's gold iris inside three
  rings — each on a plinth over a dark reflective floor, lit like an object in
  a room. They breathe when idle, lean in when listening, do one slow move when
  thinking (Loki's shell turns a quarter, Thor's shells draw in, Odin's iris
  closes) and track your voice when speaking. Open the hall as usual; it is on
  by default. `?fx=0` on the address gives you the old page untouched.
- **Five advisor gems** sit around each core with their names on their plinths.
  Click a gem or a name, or press Tab: only that advisor's line to the core
  lights up, and a small card shows what they do. A gem lights up **only** when
  the backend says that councillor actually ran.
- **Two small buttons, lower-left:** FX SOUND and STILL. STILL stops all motion
  and keeps the room lit (good for a slow day or a hot laptop).
- The test page for the core alone: `/fx-lab?debug=1`. The blueprint page:
  `/halls-preview` (needs your three pictures in `public/img/`).
- **The hub is back:** `/hub` — three doors and a live pulse.

## The brains (Section 4, Part B)

What to say, and what happens:

| Say | What happens |
|---|---|
| "Odin, halt trading" / "resume trading" | The PAPER book stops opening new positions / starts again. Open positions keep their stops. Nothing real. |
| "Odin, how ready are we?" | `trading_readiness`: **mode paper, no live path exists**, and the five gates a real-money switch would need, none met. |
| "Odin, trading status" | The risk caps (3% daily loss cap, 20% position cap, no new trades in the last 10 minutes), the fill costs assumed, cash and open positions. |
| "Odin, backtest VOLSTAGG" | Replays that trader's strategy over the candles already cached — no new data spent. Says "insufficient cached history" honestly when there is too little. |
| "Thor, what did you cost this week?" | `cost_report`: estimated dollars by persona and tier, today and the last seven days. Tracking began 2026-09-05. |
| `/council` (private Telegram, to any of the three bots) | That god's five councillors and when each last ran. |
| In the shared group: `@ASGARD task: …` or `@ASGARD status` | Thor answers other agents (JARVIS, KEVOS) with a short fixed tool set; replies start `@ASGARD reply:`. The full contract for Jay and Kevin: `docs/SIBLINGS_PROTOCOL.md`. |
| An approval arrives on Telegram | It now has **APPROVE / REJECT buttons**. Only you, in your private chat, can press them. Typing still works. |

Also running on their own:
- After every NYSE close, each of Odin's five traders writes a two-sentence
  self-review (off the live bill, through the batch API); Odin quotes them in
  the close report and on Sundays. Per-trader stats (win rate, drawdown) show
  in the council page's cards and in `/paper-trading/status`.
- The Sunday "State of the realm" now includes the week's model spend.
- Thor's weekly world note and Darcy's 03:00 memory hygiene compose their text
  through the batch API (cheaper; results arrive within the day).
- A nightly copy of everything Asgard knows goes to R2 (`asgard-vault/…`).
- On the first of March, June, September and December Thor sends one line:
  time to re-run the architecture review.

The Obsidian/Hermes foundation: `node scripts/export-vault.mjs` writes
`~/asgard-vault/` — a folder you can open in Obsidian today. `docs/MIGRATION.md`
says how a move would go (copy, not rebuild; run both for a month). Asgard is
also an MCP server at `/mcp` so a future agent can use its tools with the same
rules Thor has.

## What costs money and roughly how much

- Claude: Sonnet 5 for the gods ($2 / $10 per million tokens), Haiku for the
  councillors' cheap tier ($1 / $5). Batches are half price. Ask Thor for the
  running number; the first full week of tracking ends 2026-09-12.
- Everything else added tonight is on free tiers: Workers AI (critic, free
  councillor tier), KV within the daily write budget, one R2 put a night.

## Still waiting on you

- **Eyes.** Frame rates and looks for every page (the list is in
  `docs/STRIKE_THREE_PROGRESS.md`). Below 45 fps on the Chromebook, say so and
  the page drops a tier by default.
- **The three hall pictures** for `/halls-preview` (`public/img/thor.jpg`,
  `loki.jpg`, `odin.jpg`).
- **Secrets by name, none required:** `JARVIS_AGENT_URL` / `KEVOS_AGENT_URL`
  (ask_jarvis / ask_kevos stay off without them); `CF_ANALYTICS_TOKEN` +
  `CF_ACCOUNT_ID` (optional; account-wide KV usage on /healthz);
  `ELEVENLABS_VOICE_ID` (the original RAYVEN voice, optional).
- **Twelve Data key:** set. **Ayrshare:** report-only, the clipping business is
  retired; nothing was changed.
- **Two files in `public/` named for the hidden realm** (`hela3.html`,
  `h9.html`) predate this work. Nothing deletes anything without you; say the
  word.

## Not built, and why

- 6.1 tool subsets — superseded by Part C's toolbox mechanism.
- 6.4 new embedding index — the current embedder is already the free Workers
  AI model, so the spec says defer.
- 6.5 Cloudflare Browser Rendering as a reader — needs either an npm package
  or a REST token this repo may not add; skipped and noted.
- The hub's 3D cores — no hub existed when Strike Three ran; the new `/hub` is
  a plain page. Measure its FPS first if you ever want more there.
