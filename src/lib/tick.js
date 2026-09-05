// ---------------------------------------------------------------------------
// THE TICK KEY (asgard-upgrade Phase 1.4, Hard Rule 5b/5e)
// ---------------------------------------------------------------------------
// All bookkeeping for one cron tick -- audit lines, autonomy-log entries,
// drained spool entries, events, "last checked" stamps -- goes into ONE key
// `tick:YYYY-MM-DD:HHMM`, written once at the end of the tick, only if it has
// anything in it. Never a shared daily key with read-modify-write.
//
// One small pointer key, `tick:last`, is the single-writer exception: it holds
// the previous tick's lastDrained stamp (so spools drain exactly once), the
// last 60 tick keys (so the audit tools can read recent history without a
// prefix scan), the Rule 5e write counter for the UTC day, and the R2 copy
// watermark. Only the tick writes it, so there is no overlapping writer.
import { loadConversation } from './conversation.js';
import { historyKeyFor, ALL_PERSONA_IDS } from './personas.js';

export const WRITE_CEILING_PER_DAY = 2500;   // Rule 5e: writers added by the upgrade stop here
const LAST_KEY = 'tick:last';
const RECENT_KEEP = 60;
const R2_AUDIT_AGE_DAYS = 30;

// In-isolate buffer for lines produced during THIS cron invocation.
const buffer = { audit: [], autonomy: [], events: [], notes: [], writes: 0 };

export function tickLog(kind, entry) {
  const list = buffer[kind] || buffer.notes;
  list.push({ ts: Date.now(), ...entry });
  if (list.length > 200) list.splice(0, list.length - 200);
}
// Every KV write a NEW writer makes goes through here so the ceiling is real.
export function noteWrites(n = 1) { buffer.writes += n; }

function utcDay(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }
function tickKeyFor(ts = Date.now()) { const d = new Date(ts); return `tick:${d.toISOString().slice(0, 10)}:${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`; }

export async function readTickLast(env) {
  try { const raw = await env.RAYVEN_KV.get(LAST_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}

// Rule 5e. Conversation-history writes are never blocked; this is only for the
// writers this upgrade adds (approvals, councillor state, routines, ticks).
export async function writeBudget(env) {
  const last = await readTickLast(env);
  const today = utcDay();
  const used = last.day === today ? (last.writesToday || 0) : 0;
  return { ok: used < WRITE_CEILING_PER_DAY, used, ceiling: WRITE_CEILING_PER_DAY, warned: last.day === today && !!last.warned };
}

// The conversation keys whose spools the tick drains: the four web keys and
// each persona's private Telegram chat with Rayan. Group chats are not
// drained (their spool lines still ride in their own history object).
async function conversationKeys(env) {
  const keys = ALL_PERSONA_IDS.map(id => historyKeyFor(id, 'web'));
  try {
    const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
    if (chatId) for (const id of ALL_PERSONA_IDS) keys.push(historyKeyFor(id, 'telegram', chatId));
  } catch (e) {}
  return keys;
}

// Drain every spool entry newer than lastDrained WITHOUT rewriting the history
// key. Entries are tagged with the conversation they came from.
async function drainSpools(env, lastDrained) {
  const out = [];
  let newest = lastDrained;
  for (const key of await conversationKeys(env)) {
    const { meta } = await loadConversation(env, key);
    for (const e of (meta && Array.isArray(meta._spool) ? meta._spool : [])) {
      if (!(e && typeof e.ts === 'number') || e.ts <= lastDrained) continue;
      out.push({ ...e, conversation: key });
      if (e.ts > newest) newest = e.ts;
    }
  }
  return { drained: out, newest };
}

// Once a day, COPY the tick keys of the day that is now 31 days old into R2
// under asgard/audit/YYYY-MM-DD.json. Never deletes anything from KV.
async function r2AuditCopyIfDue(env, last) {
  if (!env.CLIPS) return null;
  const target = utcDay(Date.now() - (R2_AUDIT_AGE_DAYS + 1) * 86400000);
  if (last.r2CopiedThrough && last.r2CopiedThrough >= target) return null;
  if (last.r2AttemptDay === utcDay()) return null;    // one attempt per day
  const r2Key = `asgard/audit/${target}.json`;
  try {
    const exists = await env.CLIPS.head(r2Key);
    if (!exists) {
      const listed = await env.RAYVEN_KV.list({ prefix: `tick:${target}:`, limit: 1000 });
      const ticks = [];
      for (const k of listed.keys) { try { const raw = await env.RAYVEN_KV.get(k.name); if (raw) ticks.push(JSON.parse(raw)); } catch (e) {} }
      if (ticks.length) await env.CLIPS.put(r2Key, JSON.stringify({ day: target, copiedAt: new Date().toISOString(), ticks }), { httpMetadata: { contentType: 'application/json' } });
    }
    return { r2CopiedThrough: target, r2AttemptDay: utcDay() };
  } catch (e) {
    console.error('tick: R2 audit copy failed:', e && e.message);
    return { r2AttemptDay: utcDay() };
  }
}

// Called once at the very end of scheduled(), after every other job settled.
// hooks.onDrained(drained) runs BEFORE the key is written, so anything it
// produces (queued delegations running, Phase 2; events, Phase 3) lands in the
// same tick.
export async function runTick(env, hooks = {}) {
  const last = await readTickLast(env);
  const today = utcDay();
  const lastDrained = typeof last.lastDrained === 'number' ? last.lastDrained : 0;
  const { drained, newest } = await drainSpools(env, lastDrained);
  if (drained.length && typeof hooks.onDrained === 'function') { try { await hooks.onDrained(drained); } catch (e) { console.error('tick hook failed:', e && e.message); } }
  const r2 = await r2AuditCopyIfDue(env, last);

  // writes made by new writers on the reply path ride in their spool entries
  const spoolWrites = drained.reduce((s, e) => s + (Number(e.writes) || 0), 0);
  const writesThisTick = buffer.writes + spoolWrites;
  const empty = !drained.length && !buffer.audit.length && !buffer.autonomy.length && !buffer.events.length && !buffer.notes.length && writesThisTick === 0;
  const next = {
    day: today,
    writesToday: (last.day === today ? (last.writesToday || 0) : 0) + writesThisTick,
    warned: last.day === today ? !!last.warned : false,
    lastDrained: newest,
    recent: Array.isArray(last.recent) ? last.recent.slice(-RECENT_KEEP) : [],
    r2CopiedThrough: (r2 && r2.r2CopiedThrough) || last.r2CopiedThrough || null,
    r2AttemptDay: (r2 && r2.r2AttemptDay) || last.r2AttemptDay || null
  };
  if (empty && !r2) return { ok: true, skipped: 'empty tick' };

  const key = tickKeyFor();
  let wrote = false;
  if (!empty) {
    const body = { key, at: new Date().toISOString(), lastDrained: newest, drained, audit: buffer.audit, autonomy: buffer.autonomy, events: buffer.events, notes: buffer.notes, writesThisTick };
    try { await env.RAYVEN_KV.put(key, JSON.stringify(body)); wrote = true; next.writesToday += 1; next.recent.push(key); if (next.recent.length > RECENT_KEEP) next.recent = next.recent.slice(-RECENT_KEEP); }
    catch (e) { console.error('tick write failed:', e && e.message); }
  }
  next.writesToday += 1;   // the pointer write itself, counted before it is stored
  try { await env.RAYVEN_KV.put(LAST_KEY, JSON.stringify(next)); } catch (e) {}
  buffer.audit.length = 0; buffer.autonomy.length = 0; buffer.events.length = 0; buffer.notes.length = 0; buffer.writes = 0;
  return { ok: true, key: wrote ? key : null, drained: drained.length, writesToday: next.writesToday };
}

// For the audit tools: the last n tick bodies, newest first.
export async function readRecentTicks(env, n = 12) {
  const last = await readTickLast(env);
  const keys = (Array.isArray(last.recent) ? last.recent : []).slice(-Math.max(1, Math.min(n, RECENT_KEEP))).reverse();
  const out = [];
  for (const k of keys) { try { const raw = await env.RAYVEN_KV.get(k); if (raw) out.push(JSON.parse(raw)); } catch (e) {} }
  return out;
}
