# INTERACT-B conversation implementation

Implemented in `public/ui/app.js`, `public/ui/state.js`, and narrowly in `public/ui/arsenal.js`. No backend, HTML, CSS, scene, renderer, git, or deployment changes in this workstream.

## Conversation ownership and recovery

The existing POST remains `https://asgrard-backend.rayanfahil2.workers.dev/`, with JSON `{ assistant: hall, message: text }` and the existing `thor`, `loki`, `odin` namespace. An identity ledger prevents duplicate requests per persona. Replies resolve into their originating conversation. Only the currently selected persona can start response playback or resume its microphone from a completion.

Stop waiting aborts the browser fetch, retires its request identity, releases Send immediately, and ignores a late completion. It does not promise server cancellation. The cancellation notice and activity journal explicitly say server work may continue or is unconfirmed. A new request cannot be cleared by an old request's finally handler. Timeout and lost-connection notices identify uncertain server work. No automatic retry is performed.

Each failure/cancellation recovery button captures that request's text. Restoration adds it to an existing draft instead of overwriting the draft; one recovery button can only add once. Suggestions also preserve existing draft text. Recognized speech appends to an existing typed draft for review instead of replacing and sending it. Empty composers retain the existing hands-free behavior.

A manual transcript scroll disables following independently per persona. Incoming content respects that choice; Latest message returns to the bottom and focuses the transcript. Hidden conversations do not reinterpret hidden geometry as an explicit reader scroll. Send restores composer focus immediately; late replies never steal focus. Minimize/reopen and modal focus restoration retain their existing behavior.

## Safe replies and evidence

The shared formatter creates text nodes and a restricted set of elements for paragraphs, ordered/unordered lists, bold, inline code, fenced code, and HTTP(S) links. Ordered and unordered runs remain distinct. Unfinished fenced blocks retain literal code. HTML and unsupported URL schemes remain literal text; model content never enters innerHTML. Copy reply copies the original text through the Clipboard API and reports permission/unavailability honestly.

The inspected backend (`src/index.js`, chat return near line 1529 at implementation time) returns reply/persona, without a structured tool trace. Thus the compact reply receipt shows persona, “Reply received,” and local receipt time. It does not claim a tool ran. Implementation caveats are kept out of ordinary chat receipts; the activity panel explains its chat-only scope. No synthetic tool-execution receipt is emitted without a structured tool event. Activity records failed or cancelled browser requests separately from replies. Council dossiers explicitly identify activity as unknown. Existing preview fixtures remain separate and were not modified or claimed live.

## UI integration hooks

- `.conversation-controls` is inserted immediately before each `.composer`, containing `.cancel-reply` and `.latest-reply`; both use the native `hidden` attribute.
- `.response-actions` contains `.copy-response` and `.request-receipt` after a received reply.
- `.request-notice` is the browser-cancellation status notice. Existing `.errline` is retained for errors.
- `html[data-assistant-state]` mirrors the active persona's real state; existing `.workspace[data-state]` remains supported.
- `html[data-focus="composer"]` / `html[data-focus="none"]` follows actual composer focus.
- `html[data-mic-state]` is `off`, `pending`, `listening`, or `wake`. `html[data-speech-state]` is `idle`, `preparing`, or `speaking`.
- Microphone pending state precedes recognition's actual `onstart`; `onend`/error clear confirmed listening. Dead recognition callbacks cannot change state. Speech preparation stays distinct from actual playback `onplaying` or synthesis `onstart`. Stop speech and stop microphone remain separate controls.
- Settings reads `/ui/release.json` with `cache: no-store` and a ten-second timeout, populating the lead-owned `#release-diagnostics` with served metadata and current `presence.status()` renderer diagnostics. Unavailable/invalid release metadata is clearly labeled unavailable. No release identity is synthesized in this module.

## Verification and limits

`node --test scripts/conversation.test.mjs scripts/ui-state.test.mjs`: 22 passed, 0 failed. Conversation tests cover persona-specific duplicate guards, ownership through selection changes, cancellation/late completion versus replacement requests, malformed reply types, draft recovery, scroll threshold, literal hostile markup, safe links, ordered/unordered boundaries, and complete/incomplete code fences. Existing state and real geometry tests also pass.

`node --check public/ui/app.js`, `node --check public/ui/state.js`, and `node --check public/ui/arsenal.js`: passed.

The formatter test uses a small text-node DOM boundary, not a full browser layout engine. Request ledger tests are deterministic state tests, not live backend execution tests. Browser verification belongs to the lead to avoid concurrent browser memory pressure. In particular, verify actual Send/cancel controls and focus, scrolling after long replies, mobile keyboard geometry, clipboard permissions, real microphone permission/recognition events, playback, Settings metadata on the served host, and assistive technology announcements. No live provider operation, microphone capture, audible playback, backend cancellation, or tool execution is established by these tests.

## INTERACT-B2 targeted self-review

- Audio ownership: a queued error callback from retired audio could previously clear the current audio reference, even though fallback itself had a token guard. The error callback now checks ownership before any mutation; stop detaches playback and synthesis callbacks. A single guarded fallback handles both audio error and rejected play events, clearing old guards and preventing duplicate browser speech. Tests execute the actual production speech functions in an isolated VM with deterministic fake audio and transport; they establish callback behavior, not real playback.
- Cancellation: rechecked that retirement happens immediately, Send re-enables, and old finally handlers cannot affect a replacement request. Existing identity tests cover this boundary. No claim of server-side cancellation was added.
- Recovery: repeated recovery buttons already disable themselves after use. Draft merging additionally recognizes a failed message already appended as the final paragraph, preventing duplication when another failure offers the same text.
- Malformed responses: declared HTML pages are rejected rather than read aloud as chat. Invalid declared JSON is treated as an unreadable reply instead of falling through to a success string. Plain-text reply compatibility is retained. HTTP status errors retain the status message.
- Modal handoff: Arsenal shell closes open Settings before opening any Arsenal view, including mission briefs and Ctrl/Cmd+K, and retains the visible Settings trigger as the return-focus target. Settings' delayed close event restores focus only if no other dialog is open. This avoids nested modals and a close-event focus steal. Lead owns real browser verification of focus/tab/Escape behavior.
- Product receipt: changed ordinary reply footer to persona, “Reply received,” and local receipt time. Removed the distracting per-message implementation caveat; the existing activity description retains the accurate chat-only scope.

Rerun after this review: `node --test scripts/conversation.test.mjs scripts/ui-state.test.mjs` — 22 passed, 0 failed; `node --check` on app/state/arsenal — passed. No backend, deployment, or browser changes were made.

Release integration: app imports for Arsenal, state, and scene, plus Arsenal’s expansion import, use `?v=bifrost-aperture-1` to avoid reusing earlier cached module revisions.
