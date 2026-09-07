#!/usr/bin/env node
// scripts/smoke.mjs <LIVE_BASE_URL>   (plain Node, no deps)
// Checks the LIVE Worker — never wrangler dev (local has no KV, no secrets).
// Prints PASS / FAIL per line and exits non-zero on any FAIL.
// The admin token is read from ~/.asgard-admin-token (a file, never an argument).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
const BASE = (process.argv[2] || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
let fails = 0;
const ok = (label, extra = '') => console.log(`PASS  ${label}${extra ? '  ' + extra : ''}`);
const bad = (label, extra = '') => { fails++; console.log(`FAIL  ${label}${extra ? '  ' + extra : ''}`); };
const withTimeout = (ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; };
async function getJson(path) {
  const t = withTimeout(20000);
  try {
    const r = await fetch(BASE + path, { signal: t.signal });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch {}
    return { status: r.status, json: j, text };
  } catch (e) { return { status: 0, error: e.message }; } finally { t.done(); }
}
// 1. read-only JSON routes
for (const p of ['/status', '/todos', '/monitors', '/calendar', '/paper-trading/status', '/browser/status', '/spotify/now-playing']) {
  const r = await getJson(p);
  if (r.status === 200 && r.json !== null) ok(`GET ${p}`, '200 JSON'); else bad(`GET ${p}`, `status ${r.status}${r.error ? ' ' + r.error : ''}`);
}
// 2. one real turn per visible god, with the smoke header so nothing is saved
for (const persona of ['thor', 'loki', 'odin']) {
  const t = withTimeout(60000);
  const started = Date.now();
  try {
    const r = await fetch(BASE + '/', { method: 'POST', signal: t.signal,
      headers: { 'content-type': 'application/json', 'X-Asgard-Smoke': '1' },
      body: JSON.stringify({ message: 'reply with the single word OK', persona }) });
    const j = await r.json().catch(() => null);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (r.status === 200 && j && typeof j.reply === 'string' && j.reply.trim()) ok(`POST / ${persona}`, `${secs}s "${j.reply.trim().slice(0, 40)}"`);
    else bad(`POST / ${persona}`, `status ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  } catch (e) { bad(`POST / ${persona}`, e.message); } finally { t.done(); }
}
// 3. Hela is never messaged. Only that her routes answer.
{
  const r = await getJson('/memory?persona=hela');
  if (r.status === 200) ok('GET /memory?persona=hela answers', '(never messaged)'); else bad('GET /memory?persona=hela', `status ${r.status}`);
}
// 4. pages
for (const p of ['/team.html', '/']) {
  const t = withTimeout(20000);
  try {
    const r = await fetch(BASE + p, { signal: t.signal });
    const text = await r.text();
    if (r.status === 200 && /<html/i.test(text) && text.length > 1000) ok(`GET ${p}`, `${(text.length / 1024).toFixed(0)} KB html`); else bad(`GET ${p}`, `status ${r.status} ${text.length} bytes`);
  } catch (e) { bad(`GET ${p}`, e.message); } finally { t.done(); }
}
// 5. webhooks via the admin route
let token = '';
try { token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim(); } catch {}
if (!token) bad('admin token', '~/.asgard-admin-token missing — cannot check webhooks');
else {
  const t = withTimeout(30000);
  try {
    const r = await fetch(BASE + '/admin/webhooks', { headers: { 'X-Asgard-Admin': token }, signal: t.signal });
    const j = await r.json().catch(() => null);
    if (r.status !== 200 || !j || !j.bots) bad('GET /admin/webhooks', `status ${r.status}`);
    else {
      for (const [id, b] of Object.entries(j.bots)) {
        if (!b.configured) { ok(`webhook ${id}`, `no token (${b.tokenSecret})`); continue; }
        if (b.error) { bad(`webhook ${id}`, b.error); continue; }
        const line = `url=${b.url || '(none)'} pending=${b.pendingUpdates}${b.lastErrorMessage ? ` lastError="${b.lastErrorMessage}" at ${b.lastErrorAt}` : ''}`;
        // hela stays unregistered on purpose; everyone else must point at this worker
        if (id === 'hela') { if (!b.url) ok(`webhook ${id}`, 'unregistered (correct)'); else bad(`webhook ${id}`, 'REGISTERED — should be unregistered: ' + line); }
        else if (b.matches) ok(`webhook ${id}`, line); else bad(`webhook ${id}`, `points elsewhere: ${line} expected=${b.expected}`);
      }
    }
  } catch (e) { bad('GET /admin/webhooks', e.message); } finally { t.done(); }
}
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
