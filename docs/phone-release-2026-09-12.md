# Phone latency release — September 12, 2026

Production Worker: `asgrard-backend`
Version: `fe2e83dc-8dc5-4986-bc2f-5fd8c892b853`

Changes: fast binary R2 phone audio with expiring URLs and scoped cleanup; KV fallback; five-second fast TTS request timeout; shorter phone replies and exact social-phrase bypass; fast model/voice and explicit speech-end timing for legacy outbound calls; owner-call stage timings; completion checklist linked from Command Center. Kraken OHLC requests now have an eight-second deadline; rate-limit retries were not added.

Verification: 172 tests passed, zero failures; `git diff --check` passed. Published checklist visually inspected. Production completion checklist, command center and phone page returned 200. Unpaired phone status returned 401; unsigned turn POST returned 403; expired phone audio returned 404. Wrangler preserved existing Durable Object migrations and bindings.

Latest pre-deployment operational snapshot: paper scheduler OK after an earlier Kraken rate-limit failure; extension heartbeat connected; local helper responsive, sleep setting false, desktop matching true, GPU 34 °C. These observations are point-in-time, not guarantees.

Not verified: live end-to-end phone latency, actual voice output, full-duplex interruptions, physical RGB mapping, actual Fortnite performance or strategy profitability. No test call, purchase or provider booking was made. Current architecture still generates a complete spoken reply before playback.

Rollback: preceding deployed version `89c622de-3a3f-4bd3-b092-bfef89a21f49` already includes the paper ledger migration. Revert only this release's phone changes if call failures regress; preserve PAPER_LEDGER and current migration configuration. Never return paper writes to the old KV-only implementation.
