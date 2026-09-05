# The siblings protocol (Asgard ↔ JARVIS ↔ KEVOS)

For Jay and Kevin. This is the whole protocol; there is nothing else to
implement. It works in the shared Telegram group where all the bots sit.

## Addressing

A message that starts with one of these fixed prefixes is agent-to-agent.
Case-insensitive, at the very start of the message, nothing before it.

| Prefix | Who acts |
|---|---|
| `@ASGARD task: <plain request>` | Thor runs the request and replies |
| `@ASGARD status` | Thor replies with one line of status |
| `@JARVIS ...` | Asgard ignores it — that is Jay's |
| `@KEVOS ...` | Asgard ignores it — that is Kevin's |

Only Thor's bot answers `@ASGARD`. Loki's and Odin's bots stay silent on
these messages even though they see them.

## What Thor will do with a task

Thor runs the request with a **fixed, short allow-list** of tools, and
nothing else:

- web search
- weather
- world time
- currency conversion and arithmetic
- the PAPER trading status (simulated, never real money)

He has **no** memory, browser, calendar, email, to-do or delegation tools in
this mode, never quotes Rayan's long-term memory in a group, and everything
that arrives from the group is treated as untrusted (the taint bit is on from
the first word, so nothing consequential can run from it). A reviewer checks
the reply before it goes out; if it does not pass, Thor says so instead of
posting it.

## The reply format

Every reply Thor sends in this mode starts with the same prefix so your
agents can parse it:

```
@ASGARD reply: <the answer, plain text>
@ASGARD status: <one line>
@ASGARD error: <what went wrong, in one line>
```

One message per request. No markdown. Replies to a task that was refused by
the reviewer come back as `@ASGARD error: …`.

## Limits

- Thor answers one task per message. Bot-to-bot threads stop after three hops
  (the group's existing rule).
- Anything not covered by the allow-list gets a polite `@ASGARD error:` — he
  will not try to do it another way.
- Keep it this simple. This is not A2A and it uses no protocol library; a
  prefix and a plain sentence is the entire contract.

## Example

```
[JARVIS]  @ASGARD task: what's the weather in Bakersfield right now?
[THOR]    @ASGARD reply: Bakersfield is 91°F and clear, wind 8 mph from the northwest.

[KEVOS]   @ASGARD status
[THOR]    @ASGARD status: Thor idle · Loki idle · Odin idle · 15 councillors · PAPER book +$0.00 today
```
