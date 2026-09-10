import {logUsage} from './usage-log.js';
import { anthropicFetch } from './anthropic-gateway.js';
// THE MESSAGE BATCHES WRAPPER (asgard-upgrade Phase 6.2, first used by Phase 4.3).
//
// Work that is not time-sensitive goes off the live bill: submit a batch of
// requests, remember the batch id, and collect the results on a later tick
// (batches can take up to 24 hours). Plain fetch, no client library. Pending
// batches live in ONE key, system:batches -- one write when a batch is
// submitted, one when it is collected. Never used for anything Rayan is
// waiting on; the morning brief, evening glance and market notes stay live.
const API = '/v1/messages/batches';
const STATE_KEY = 'system:batches';
const HEADERS = env => ({ 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });

// requests: [{ custom_id, model, max_tokens, system, messages }]
export async function submitBatch(env, requests) {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY not set' };
  if (!Array.isArray(requests) || !requests.length) return { ok: false, error: 'no requests' };
  const body = { requests: requests.map(r => ({ custom_id: String(r.custom_id).slice(0, 64), params: { model: r.model, max_tokens: r.max_tokens || 400, system: r.system, messages: r.messages } })) };
  try {
    const res = await anthropicFetch(env,API, { method: 'POST', headers: HEADERS(env), body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.id) return { ok: false, error: `Batches API ${res.status}: ${JSON.stringify(j).slice(0, 300)}` };
    return { ok: true, id: j.id, status: j.processing_status };
  } catch (e) { return { ok: false, error: `network: ${e.message}` }; }
}

export async function batchStatus(env, id) {
  try {
    const res = await anthropicFetch(env,`${API}/${encodeURIComponent(id)}`, { headers: HEADERS(env) });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) return { ok: false, error: `Batches API ${res.status}: ${JSON.stringify(j).slice(0, 300)}` };
    return { ok: true, status: j.processing_status, resultsUrl: j.results_url || null, counts: j.request_counts || null, expiresAt: j.expires_at || null };
  } catch (e) { return { ok: false, error: `network: ${e.message}` }; }
}

// The results file is JSONL: one { custom_id, result } per line.
export async function batchResults(env, resultsUrl) {
  try {
    const u = new URL(resultsUrl); if(u.origin!=='https://api.anthropic.com')throw Error('Unexpected batch results host');
    const res = await anthropicFetch(env,u.pathname, { headers: HEADERS(env) });
    if (!res.ok) return { ok: false, error: `results ${res.status}` };
    const text = await res.text();
    const out = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const r = j.result || {};
        if (r.type === 'succeeded') { logUsage(r.message?.model,r.message?.usage,'batch'); const blk = r.message && r.message.content && r.message.content.find(b => b.type === 'text'); out.push({ custom_id: j.custom_id, text: blk ? blk.text : '', error: null, usage: (r.message && r.message.usage) || null }); }
        else out.push({ custom_id: j.custom_id, text: null, error: r.type === 'errored' ? JSON.stringify(r.error).slice(0, 200) : r.type });
      } catch (e) { out.push({ custom_id: null, text: null, error: 'unparseable line' }); }
    }
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: `network: ${e.message}` }; }
}

// ---- the pending list (one key) --------------------------------------------------
export async function readBatchState(env) {
  try { const raw = await env.RAYVEN_KV.get(STATE_KEY); return raw ? JSON.parse(raw) : { pending: [], collected: [] }; } catch (e) { return { pending: [], collected: [] }; }
}
export async function writeBatchState(env, state) {
  state.collected = (state.collected || []).slice(-30);
  await env.RAYVEN_KV.put(STATE_KEY, JSON.stringify(state));
}
// Submit and remember in one step. kind: what the results are for; meta: anything the collector needs.
export async function submitAndRemember(env, kind, requests, meta = {}) {
  const r = await submitBatch(env, requests);
  if (!r.ok) return r;
  const state = await readBatchState(env);
  state.pending = (state.pending || []).filter(p => p.id !== r.id);
  state.pending.push({ id: r.id, kind, meta, submittedAt: new Date().toISOString(), customIds: requests.map(x => x.custom_id) });
  await writeBatchState(env, state);
  return { ok: true, id: r.id };
}
// Poll every pending batch; hand finished ones to handlers[kind](env, entry, results).
// Batches older than 26 h that never ended are dropped and noted. One state write
// per tick at most, and only when something changed.
export async function collectBatchesIfAny(env, handlers = {}) {
  const state = await readBatchState(env);
  if (!state.pending || !state.pending.length) return { ok: true, pending: 0 };
  let changed = false; const keep = [];
  for (const entry of state.pending) {
    const st = await batchStatus(env, entry.id);
    if (!st.ok) { keep.push(entry); continue; }
    if (st.status !== 'ended') {
      if (Date.now() - Date.parse(entry.submittedAt) > 26 * 3600000) { changed = true; state.collected.push({ ...entry, outcome: `dropped: still ${st.status} after 26 h` }); continue; }
      keep.push(entry); continue;
    }
    const rr = st.resultsUrl ? await batchResults(env, st.resultsUrl) : { ok: false, error: 'no results_url' };
    let outcome = rr.ok ? `collected ${rr.results.length} result(s)` : `results failed: ${rr.error}`;
    if (rr.ok && typeof handlers[entry.kind] === 'function') { try { const h = await handlers[entry.kind](env, entry, rr.results); if (h && h.note) outcome += ` — ${h.note}`; } catch (e) { outcome += ` — handler failed: ${e.message}`; } }
    state.collected.push({ ...entry, collectedAt: new Date().toISOString(), outcome }); changed = true;
  }
  if (changed) { state.pending = keep; await writeBatchState(env, state); }
  return { ok: true, pending: keep.length, changed };
}
