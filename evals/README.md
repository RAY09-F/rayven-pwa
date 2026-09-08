# Acceptance evidence

These files separate offline correctness from actual model/device performance.

- `tool-selection.json`:60 authored prompts, including12 held-out prompts. They are **not** captured user utterances. Replace/validate against real user transcripts before calling this the final golden set. Every expected name exists in the300-tool registry.
- `persona.json`:45 authored prompts and five rubric dimensions. No model answers or speaking-quality scores have been generated.
- `real-failures.json`:30 recorded live failure observations covering21 tools, with exact source lines in the existing tool-test log. They are historical tool failures, not new model transcripts. Their failure excerpts were read; they show shared rate limits, withdrawn endpoints, access refusals, size caps and timeouts.
- `regression.json`:permanent bug-to-test references.
- `grade.mjs`:checks top-five **provider** search results from captured, reviewed transcripts and separates held-out results. Never substitutes local keyword ranking. `consistency()` computes observed any-success pass@k and all-success pass^k for exactly k trials per case.
- `latency.mjs`:requires20 actual release-labeled turns with first-token and first-audio timing and second-turn cache usage. Missing evidence exits2; a measured regression exits1. No input means BLOCKED, never zero latency.
- `npm test`:offline integration and existing renderer/state tests. `npm run test:release`:also requires actual timing and selection evidence via ASGARD_LATENCY_EVIDENCE and ASGARD_SELECTION_EVIDENCE paths. It currently refuses release because those files do not exist.

No automatic paid model runner was activated while the spending decision is pending. No real messages are test fixtures. Captured raw conversations must remain local/private; commit only redacted measurements. Persona voice requires human-calibrated labels or Unknown; no uncalibrated model judge is presented as a score.
