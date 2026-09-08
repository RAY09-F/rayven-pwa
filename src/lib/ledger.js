// THE LEDGER ACCESSOR (asgard-upgrade Phase 9.3). Every reader and writer of the
// upgrade's own state goes through here so they switch together. LEDGER_BACKEND
// (wrangler var) = 'kv' (default: exactly today's behaviour) | 'do' (the SQLite
// Durable Object). Copy-forward: with 'do', new ticks / audit / events / cost /
// routine runs are written to the ledger only (single path behind the flag), while
// routines and councillor state are DUAL-written (KV and ledger) for the trial.
// Nothing in KV is ever deleted or read-migrated. Memory, history, the paper book,
// capabilities and config are not in scope here at all.
export function ledgerBackend(env) { return env && env.LEDGER_BACKEND === 'do' && env.LEDGER ? 'do' : 'kv'; }
export function ledgerAvailable(env) { return !!(env && env.LEDGER); }

async function call(env, body) {
  if (!env.LEDGER) throw new Error('no LEDGER binding');
  const id = env.LEDGER.idFromName('asgard');
  const stub = env.LEDGER.get(id);
  const res = await stub.fetch('https://ledger/op', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!j || !j.ok) throw new Error((j && j.error) || `ledger HTTP ${res.status}`);
  return j.result;
}
export const ledger = {
  conversationMirror: (env,key,raw) => call(env,{op:'conversationMirror',key,...(raw===undefined?{}:{raw})}),
  ping: env => call(env, { op: 'ping' }),
  counts: env => call(env, { op: 'counts' }),
  putTick: (env, key, at, body) => call(env, { op: 'putTick', key, at, body }),
  recentTicks: (env, n) => call(env, { op: 'recentTicks', n }),
  ticksForDay: (env, day) => call(env, { op: 'ticksForDay', day }),
  putAudit: (env, tickKey, lines) => call(env, { op: 'putAudit', tickKey, lines }),
  putEvents: (env, events) => call(env, { op: 'putEvents', events }),
  putRoutine: (env, id, owner, body) => call(env, { op: 'putRoutine', id, owner, body }),
  getRoutine: (env, id) => call(env, { op: 'getRoutine', id }),
  listRoutines: env => call(env, { op: 'listRoutines' }),
  putRun: (env, routineId, run) => call(env, { op: 'putRun', routineId, run }),
  putCouncil: (env, id, body) => call(env, { op: 'putCouncil', id, body }),
  getCouncil: (env, id) => call(env, { op: 'getCouncil', id }),
  putCost: (env, day, body) => call(env, { op: 'putCost', day, body }),
  costDays: (env, n) => call(env, { op: 'costDays', n }),
  put: (env, key, value) => call(env, { op: 'put', key, value }),
  get: (env, key) => call(env, { op: 'get', key })
};
// Fire-and-forget dual writes never take a caller down.
export async function mirror(env, fn) { if (ledgerBackend(env) !== 'do') return null; try { return await fn(); } catch (e) { console.error('ledger mirror failed:', e && e.message); return null; } }
