# NEXT STEPS — things only Rayan can do

## Audit note — 2026-09-14
Actual secret names are TELEGRAM_BOT_TOKEN (Thor), TELEGRAM_BOT_TOKEN_LOKI, TELEGRAM_BOT_TOKEN_ODIN, and TELEGRAM_BOT_TOKEN_HELA. They are configured; rotation status is unknown. The bundle reports prior chat exposure, which a Git scan cannot disprove. Prefer `wrangler secret put NAME` and enter the value privately at the prompt; no plaintext temporary file is necessary. Do not delete a live companion secret store. The obsolete Ayrshare backup's exact path is not established; do not guess or delete unrelated files. Account cancellation/deletion and 2FA setup remain owner tasks, not completed changes.

Numbered. Each one says WHAT, WHY, and the EXACT step. Secret names
only, never values. Codex appends to this file as it works; done items
get "[done <date>]" and stay so the history is visible.

## Before Phase 1 (tonight — these are the three from the list)

1. Rotate the three Telegram bot tokens (entry 1301).
   WHY: the Hela, Odin and Loki tokens were pasted into chats; treat
   them as public.
   HOW: in Telegram open @BotFather → /mybots → pick the bot → API
   Token → Revoke current token. Copy the new token into a plain file
   named t.txt (Notepad / the terminal) — not into any chat. Then in
   the repo folder:
       wrangler secret put TELEGRAM_TOKEN_LOKI < t.txt
   (Codex's Phase 0 INVENTORY.md tells you the exact secret NAME each
   bot uses today — use that name, not this example.) Delete t.txt.
   Repeat for Odin and Hela. Then run the webhook script Codex writes
   in Phase 1 (scripts/set-webhooks.sh) or ask Codex to re-set the
   webhooks. Send each bot one message to prove it answers.

2. Delete the plaintext key backup (entry 1302).
   WHY: it holds Ayrshare API keys in the open, and a cancelled plan
   can still have a live key.
   HOW: delete the file, empty the bin, then log into Ayrshare and
   delete the account entirely (not just the plan). Same for Vizard.

3. Two-factor on everything (entry 1305).
   WHY: an account takeover costs more than any outage.
   HOW: both Gmail accounts, Cloudflare, GitHub, ElevenLabs, OpenAI,
   Anthropic, Telegram (Settings → Privacy → Two-Step Verification),
   Spotify. Use an authenticator app, not SMS, wherever offered. Print
   the backup codes and put them somewhere physical.

4. Put the docs in the repo and commit them (see START-HERE-CODEX.txt).

## During the run — Codex will add to this list

Expected items it will write (names only; you supply the values when
it asks here, never in the Codex chat):

- TELEGRAM_WEBHOOK_SECRET  — a random string you make up (Phase 1,
  entry 1308). Make it with: `openssl rand -hex 24 > s.txt`, then
  `wrangler secret put TELEGRAM_WEBHOOK_SECRET < s.txt`, then delete
  s.txt.
- BROWSER_POLL_SECRET — same recipe (Phase 1, entry 1309). The
  extension needs the same value once, in its options page; Codex
  writes where.
- AI Gateway base URL (Phase 2, entry 0229) — created in the
  Cloudflare dashboard; Codex tells you the two clicks.
- The second mailbox (Phase 6, entry 0604) — connect
  rayanfahil2@gmail.com the same way the other one is connected, or
  forward its receipts.
- Your master resume as docs/private/resume-master.md (Phase 6, entry
  0662) — Codex builds the three versions from it.
- Three screenshots and one paragraph for the portfolio page (Phase 6,
  entry 0663) — placeholders are marked in the page.
- Discord bot token, if you want 0018/0447/0448 (Phase 4) — optional.
- ElevenLabs: a second "quiet" voice per god (0342) and a voice for
  Hela (0362) if she has none — Voice Design, then the IDs go in as
  secrets by NAME (Phase 10).
- Cloudflare Access in front of the hub (Phase 9, entry 1311) — Zero
  Trust free tier, your Google login; Codex writes the steps.
- An outside uptime checker (Phase 13, entry 0592) — a free account;
  Codex gives the URL to paste.
- A second git remote for the mirror (Phase 13, entry 0585) — a
  private repo anywhere; Codex gives the one command.

## Always

- Reload the extension after any phase that touched it (Codex will say
  which). chrome://extensions → the reload arrow on ASGARD.
- Never paste a secret value into Codex, Claude, ChatGPT, or Telegram.
- One phase per session. No top-ups. If the limit hits, wait.
