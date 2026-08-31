// ---------------------------------------------------------------------------
// AUDIT TRAIL
// ---------------------------------------------------------------------------
// Phase 1 added a boundary. This is how you find out whether it held.
//
// The question this file exists to answer, ninety days after the fact:
// "WHICH WEB PAGE CAUSED IT TO SEND THAT TEXT?"
// Without a causal chain that question is unanswerable, and an unanswerable
// question after a security event is the same as having no security event
// detection at all.
//
// Shape follows ARMO's minimum viable agent audit trail (1 Jun 2026). Two
// principles from it drive every decision below:
//
//   1. LOG PARAMETER SHAPES, NOT VALUES. "Storing parameter shapes preserves
//      the ability to baseline without retaining values, which is often where
//      PII enters." So this records that send_text was called with a `to` of 12
//      characters and a `message` of 340, plus a hash — never the number or the
//      words. A leaked audit log must not be a second breach.
//
//   2. CORRELATION IDS. Every event carries the index of the event that caused
//      it, so a chain runs from the inbound message, through the page that was
//      read, to the action that followed.
//
// One KV write per turn, not one per event. A turn can fire fourteen tool
// iterations; fourteen writes would be both slow and expensive, and KV is
// eventually consistent so ordering between them is not guaranteed anyway.
// ---------------------------------------------------------------------------

const RETAIN_DAYS = 90;
const MAX_EVENTS = 60;
const INDEX_KEY = 'audit:index';
const INDEX_KEEP = 400;

// Short, stable, non-reversible. Enough to prove two payloads were the same or
// different without storing either of them.
async function shortHash(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text || ''));
    return [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return '??'; }
}

// The shape of an argument object: which keys, what type, how big. Never what.
function argShape(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const k of Object.keys(input).slice(0, 12)) {
    const v = input[k];
    if (v == null) out[k] = 'null';
    else if (typeof v === 'string') out[k] = `str:${v.length}`;
    else if (typeof v === 'number') out[k] = 'num';
    else if (typeof v === 'boolean') out[k] = 'bool';
    else if (Array.isArray(v)) out[k] = `arr:${v.length}`;
    else out[k] = 'obj';
  }
  return out;
}

// A URL is the one value worth keeping in full: the whole point of the trail is
// being able to name the page that caused something. Query strings are dropped
// because that is where tokens and identifiers hide.
function safeUrl(input) {
  const raw = input && (input.url || input.videoUrl || input.link || input.target);
  if (!raw || typeof raw !== 'string') return null;
  try { const u = new URL(raw); return u.origin + u.pathname; } catch { return null; }
}

export function newTrace({ personaId, channel, sender, startTainted }) {
  return {
    id: crypto.randomUUID().slice(0, 8),
    at: new Date().toISOString(),
    persona: personaId,
    channel: channel || 'web',
    sender: sender || null,
    startTainted: !!startTainted,
    events: [],
    t0: Date.now()
  };
}

// `cause` is the index of the event that led to this one. That single field is
// what turns a list of things that happened into a chain you can follow.
export function record(trace, kind, name, detail = {}) {
  if (!trace || trace.events.length >= MAX_EVENTS) return -1;
  trace.events.push({
    i: trace.events.length,
    ms: Date.now() - trace.t0,
    kind, name,
    ...detail
  });
  return trace.events.length - 1;
}

export async function recordTool(trace, name, input, result, meta = {}) {
  if (!trace) return -1;
  const text = String(result == null ? '' : result);
  return record(trace, 'tool', name, {
    args: argShape(input),
    url: safeUrl(input),
    outBytes: text.length,
    outHash: await shortHash(text),
    tainted: !!meta.tainted,
    cause: meta.cause == null ? 0 : meta.cause,
    ok: meta.ok !== false
  });
}

export async function commitTrace(env, trace) {
  if (!trace || !trace.events.length) return;
  try {
    const day = trace.at.slice(0, 10);
    const key = `audit:${day}:${trace.id}`;
    const body = {
      id: trace.id, at: trace.at, persona: trace.persona, channel: trace.channel,
      sender: trace.sender, startTainted: trace.startTainted,
      durationMs: Date.now() - trace.t0,
      events: trace.events
    };
    await env.RAYVEN_KV.put(key, JSON.stringify(body), { expirationTtl: RETAIN_DAYS * 86400 });
    // A rolling index, because KV list() is not available on every plan path and
    // a bounded array is cheaper to read than a prefix scan.
    let idx = [];
    try { idx = JSON.parse(await env.RAYVEN_KV.get(INDEX_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(idx)) idx = [];
    idx.unshift({ k: key, at: trace.at, p: trace.persona, n: trace.events.length,
                  tainted: trace.events.some(e => e.tainted) });
    if (idx.length > INDEX_KEEP) idx = idx.slice(0, INDEX_KEEP);
    await env.RAYVEN_KV.put(INDEX_KEY, JSON.stringify(idx));
  } catch (e) {
    // An audit failure must never take the turn down with it. Losing a log line
    // is bad; losing the user's answer because logging threw is worse.
    console.log('audit write failed:', e && e.message);
  }
}

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

export async function auditRecent(env, { limit = 12 } = {}) {
  let idx = [];
  try { idx = JSON.parse(await env.RAYVEN_KV.get(INDEX_KEY) || '[]'); } catch (e) {}
  if (!idx.length) return 'Nothing recorded yet.';
  const rows = idx.slice(0, Math.min(Number(limit) || 12, 40)).map(r =>
    `  ${r.at.slice(0, 16).replace('T', ' ')}  ${String(r.p || '?').padEnd(5)} ` +
    `${String(r.n).padStart(2)} events${r.tainted ? '  ⚠ read untrusted content' : ''}  ${r.k.split(':').pop()}`);
  return [`${idx.length} turns recorded, most recent first:`, ...rows,
          '', 'Ask about any id to see what happened in it.'].join('\n');
}

export async function auditTrace(env, { id } = {}) {
  if (!id) return 'Which turn? Give me the short id from the list.';
  let idx = [];
  try { idx = JSON.parse(await env.RAYVEN_KV.get(INDEX_KEY) || '[]'); } catch (e) {}
  const hit = idx.find(r => r.k.endsWith(':' + String(id).trim()));
  if (!hit) return `No turn with id ${id} — it may have aged past the ${RETAIN_DAYS}-day window.`;
  let t;
  try { t = JSON.parse(await env.RAYVEN_KV.get(hit.k) || 'null'); } catch (e) {}
  if (!t) return `The index knows about ${id} but the record itself is gone.`;
  const lines = [
    `Turn ${t.id} — ${t.at.replace('T', ' ').slice(0, 19)}`,
    `${t.persona} on ${t.channel}${t.sender ? ` from ${t.sender}` : ''}, ${t.durationMs}ms, ${t.events.length} events`,
    t.startTainted ? 'Started tainted — the channel itself is untrusted.' : '',
    ''
  ].filter(Boolean);
  for (const e of t.events) {
    const args = Object.keys(e.args || {}).length
      ? '  ' + Object.entries(e.args).map(([k, v]) => `${k}=${v}`).join(' ') : '';
    lines.push(
      `  [${e.i}] +${String(e.ms).padStart(5)}ms  ${e.kind}:${e.name}` +
      `${e.tainted ? '  ⚠untrusted' : ''}${e.ok === false ? '  FAILED' : ''}`);
    if (e.url) lines.push(`         from ${e.url}`);
    if (args) lines.push(`       ${args}`);
    if (e.outBytes != null) lines.push(`         returned ${e.outBytes} bytes, hash ${e.outHash}`);
    if (e.cause != null && e.cause !== e.i) lines.push(`         caused by event [${e.cause}]`);
    if (e.note) lines.push(`         ${e.note}`);
  }
  return lines.join('\n');
}

// The question the whole file exists for.
export async function auditWhy(env, { tool = 'send_text', limit = 200 } = {}) {
  let idx = [];
  try { idx = JSON.parse(await env.RAYVEN_KV.get(INDEX_KEY) || '[]'); } catch (e) {}
  const out = [];
  for (const r of idx.slice(0, Math.min(Number(limit) || 200, 400))) {
    let t; try { t = JSON.parse(await env.RAYVEN_KV.get(r.k) || 'null'); } catch (e) { continue; }
    if (!t) continue;
    for (const e of t.events) {
      if (e.name !== tool) continue;
      const untrusted = t.events.filter(x => x.tainted && x.i < e.i);
      out.push(
        `${t.at.replace('T', ' ').slice(0, 19)}  turn ${t.id}  ${e.name}` +
        (untrusted.length
          ? `\n   AFTER reading untrusted content from: ` +
            untrusted.map(u => u.url || u.name).join(', ')
          : `\n   clean session — nothing untrusted had been read`));
    }
  }
  if (!out.length) return `No recorded use of ${tool} in the retained window.`;
  return [`Every recorded use of ${tool}, and what had been read first:`, '', ...out].join('\n');
}
