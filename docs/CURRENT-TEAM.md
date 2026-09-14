# Current team — owner correction, 2026-09-14

Rayan's system is ASGARD (Thor, Loki, Odin and its existing supporting agents).
Jay's assistant is JARVIS. Kevin's assistant is ACHILLES.

This is the current roster and overrides older prompts, handoffs and historical team references. Do not restore retired teammates from old documents or conversation history.

Active source uses ask_achilles, ACHILLES_AGENT_URL and AGENT_KEY_RAYVEN_ACHILLES. Achilles needs its own verified endpoint and shared key before agent-to-agent communication works. No previous teammate's credentials are reused. Existing Cloudflare secret values have not been deleted or renamed in this change.

One matching retired-team memory was removed through the live ASGARD memory API. The source rename was deployed in Worker version 8880f41a-15e9-4b1e-9be2-ae0eb185c348 on September 14. Achilles's own endpoint/shared key still need configuration before federation works. Historical Git commits, archived briefs and this chat transcript are not erased.
