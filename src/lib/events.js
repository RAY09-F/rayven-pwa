// ---------------------------------------------------------------------------
// THE EVENT BUS (asgard-upgrade Phase 3.1)
// ---------------------------------------------------------------------------
// In-Worker, typed, and deliberately small. Existing systems emit where the
// thing happens. An event raised during a REQUEST rides in the conversation's
// _spool (Rule 5a) and is drained by the next tick; an event raised inside
// CRON is handled in the same invocation. No separate event key, no firehose.
import { spoolPush } from './conversation.js';
import { tickLog } from './tick.js';

export const EVENT_KINDS = [
  'watchlist.hit', 'monitor.changed', 'timer.done', 'calendar.upcoming',
  'email.received',            // declared; nothing emits it yet (email access is draft-only and there is no reader)
  'telegram.message',          // { from: 'rayan'|'jay'|'kevin'|'other', chat: 'private'|'group', persona }
  'paper.trade.opened', 'paper.trade.closed', 'paper.report.sent',
  'extension.offline', 'extension.online', 'kv.quota.warning',
  'councillor.finished', 'approval.created', 'approval.resolved',
  'clip.posted',               // report only
  'hall.opened'                // the hall woke a god after a long idle
];

// Events raised inside this cron invocation, consumed by the routines runner.
const pending = [];

let seq = 0;
function eventId() { return `${Date.now().toString(36)}-${(++seq).toString(36)}`; }

// emit(kind, payload, ctx?) -- ctx.meta present = reply path (spool), absent = cron.
export function emit(kind, payload = {}, ctx = null) {
  if (!EVENT_KINDS.includes(kind)) { console.warn('unknown event kind', kind); return null; }
  const ev = { id: eventId(), event: kind, at: new Date().toISOString(), payload: safePayload(payload) };
  if (ctx && ctx.meta) { spoolPush(ctx.meta, 'event', ev); return ev; }
  pending.push(ev);
  if (pending.length > 100) pending.shift();
  tickLog('events', ev);
  return ev;
}

function safePayload(p) {
  try { const s = JSON.stringify(p || {}); return s.length > 2000 ? { truncated: true, head: s.slice(0, 2000) } : JSON.parse(s); } catch (e) { return {}; }
}

// The runner takes everything raised so far in this invocation, once.
export function takePendingEvents() { const out = pending.splice(0, pending.length); return out; }

// Events drained from spools by the tick have kind:'event' and the fields above.
export function eventsFromDrained(drained) {
  return (drained || []).filter(e => e && e.kind === 'event' && e.event).map(e => ({ id: e.id, event: e.event, at: e.at, payload: e.payload || {}, conversation: e.conversation }));
}

// { filter: { 'payload.from': 'rayan' } } -- every listed path must equal.
export function eventMatches(trigger, ev) {
  if (!trigger || trigger.kind !== 'event' || trigger.event !== ev.event) return false;
  const f = trigger.filter;
  if (!f || typeof f !== 'object') return true;
  for (const [path, want] of Object.entries(f)) {
    const got = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ev);
    if (String(got) !== String(want)) return false;
  }
  return true;
}
