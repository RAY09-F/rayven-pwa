# Moving Asgard one day — what copies, what needs a machine, what stays

Plain English, for Rayan and for whichever agent does the move. Asgard is NOT
moving today; it stays on Cloudflare. This file exists so that if it ever does
move — to Hermes Agent on a small computer at home, with an Obsidian vault as
its notebook — the move is a COPY, not a rebuild.

## What copies straight across (already exported by `scripts/export-vault.mjs`)

Run `node scripts/export-vault.mjs` on any machine with the admin token file
and you get `~/asgard-vault/`, a folder that opens in Obsidian as-is and can be
dropped into a Hermes install as its notes:

- `MEMORY.md` — the shared long-term memory, condensed to what an agent should
  know at the start of a session. A rendering; the originals in KV are untouched.
- `USER.md` — who Rayan is, how he wants to be spoken to, the standing rules.
- `personas/thor.md`, `loki.md`, `odin.md` (and `hela.md` only with `--hela`) — the full system prompts.
- `councils/<god>/<councillor>.md` — each councillor's prompt, tools, duty and the last thing it did.
- `memory/<god>/YYYY-MM-DD.md` — dated long-term memory entries with provenance (who said it, when, how trusted).
- `history/<god>/latest.md` — the recent conversation, rendered.
- `trading/journal.md`, `trading/<councillor>.md` — the PAPER trade log and each trader's stats and reviews.
- `routines/<id>.md` — every routine as a sentence plus its JSON.
- `tools/TOOLS.md`, `tools/TOOLS.json` — the tool registry as the model sees it.
- `capabilities/hela.md` — her saved capabilities (names, purposes, URLs; never a secret), only with `--hela`.
- `MIGRATION.md` — this file.

Every night the SYSTEM duty also writes the same export — including the hidden
realm, because it is a backup — as one JSON object to R2 under
`asgard-vault/YYYY-MM-DD.json`. Nothing there is ever deleted by code.

## What needs a machine Asgard does not have

- **Hermes Agent itself.** It is a long-running program that keeps a model
  session open, loads `MEMORY.md` and `USER.md` into its system prompt at
  session start and treats a vault folder as notes it can read and write. A
  Cloudflare Worker cannot host it (Workers run for seconds per request, not
  for days). Per Hermes's own community install notes at the time of writing,
  the smallest machine that runs it comfortably is a **Raspberry Pi 4 with 4 GB
  or more** — verify that against the current notes before buying anything.
- **Obsidian itself.** A desktop/phone app. It only needs the folder above.
- **The browser extension's host.** The extension runs in Rayan's Chrome and
  polls the Worker; wherever the brain lives, something still has to run a
  browser Rayan is logged into.

Nothing about this Chromebook changes: none of those install here (2.7 GB of
RAM, no swap; heavy installs crash the whole container).

## What stays on Cloudflare no matter what, and why

- **KV** — the memories, the routines, the paper book, the logs. It is the
  system of record; the vault is a rendering of it.
- **R2** — nightly vault backups and the audit copies. Cheap, durable, never
  deleted by code.
- **The Worker as an MCP server** (`POST /mcp`). Any future agent — Hermes,
  JARVIS, KEVOS — calls Asgard's tools through it with the same containment
  rules Thor lives under, and less power (no confirm-level tools at all). This
  is what lets the tools stay put while the "brain" moves.
- **Cron** — the five-minute tick: routines, councils, paper trading, health.
  It runs in the cloud so it never depends on a machine at home being on.

That shape is right because the parts that must never sleep (cron, storage,
the tool surface) stay where they already run for free, and the part that
would benefit from a persistent, local, notes-driven agent (the conversation
brain) is the only thing that moves.

## The order to do it in

1. Buy or set up the small machine. Install Hermes Agent and Obsidian on it
   per their current docs. Do not touch Asgard yet.
2. Run `node scripts/export-vault.mjs --hela` here once and copy
   `~/asgard-vault/` to the new machine. Open it in Obsidian. Read `USER.md`
   and `MEMORY.md` — that is what the new brain will wake up knowing.
3. Point Hermes at that folder as its notes, and at
   `https://asgrard-backend.rayanfahil2.workers.dev/mcp` as an MCP server with
   the admin token as the Bearer token. Ask it for the weather. If it answers
   through Asgard's tool, the tool surface is shared.
4. **Run both side by side for a month.** Keep talking to Asgard on Telegram
   and the hall as before; talk to Hermes on the new machine in parallel.
   Compare answers. Re-run the export nightly (or read the R2 copy) so the
   vault keeps up with what Asgard learns.
5. Only when the new one has been better for a month: decide what the
   Telegram bots should point at. Nothing before that is a commitment, and
   nothing in this file deletes anything.

## Honest notes

- The two facts this plan leans on — Hermes loads `MEMORY.md`/`USER.md` at
  session start and reads a vault folder; MCP can be served statelessly over
  plain HTTP by a Worker — were the documented shapes when this was written
  (2026-09-05) and should be re-checked against current docs before the move.
- The MCP server here speaks the 2025-06-18 shape of the protocol (sessions
  optional, JSON-RPC 2.0 over POST, `initialize` / `tools/list` /
  `tools/call`). Newer clients negotiate down to it. If a client insists on a
  newer revision, the `initialize` response tells it which versions the server
  speaks.
