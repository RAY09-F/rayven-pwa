#!/usr/bin/env node
// scripts/smoke-fx.mjs <LIVE_BASE_URL>   (plain Node, no deps)
// Frontend smoke for the FX layer and its pages on the LIVE Worker: every file
// answers 200, the engine carries the cores layer, every core module registers
// under its own id, no core file exists for anything but the three visible
// gods, and the hall still loads exactly one FX tag. Exits non-zero on any FAIL.
const BASE = (process.argv[2] || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
let fails = 0;
const ok = (l, x = '') => console.log(`PASS  ${l}${x ? '  ' + x : ''}`);
const bad = (l, x = '') => { fails++; console.log(`FAIL  ${l}${x ? '  ' + x : ''}`); };
async function get(path) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
  try { const r = await fetch(BASE + path, { signal: c.signal }); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' }; }
  catch (e) { return { status: 0, text: '', error: e.message }; } finally { clearTimeout(t); }
}
const must = async (path, tests) => {
  const r = await get(path);
  if (r.status !== 200) return bad(`GET ${path}`, `status ${r.status}${r.error ? ' ' + r.error : ''}`);
  for (const [label, re] of tests) { if (re.test(r.text)) ok(`${path} ${label}`); else bad(`${path} ${label}`); }
  if (!tests.length) ok(`GET ${path}`, `${(r.text.length / 1024).toFixed(0)} KB`);
  return r;
};
await must('/fx/asgard-fx.js', [['has the cores layer', /registerCore/], ['is version 2+', /version: [2-9]/], ['still exposes init/setState/setPersona', /FX\.init = |FX\.setState = |FX\.setPersona = /]]);
await must('/fx-lab.html', [['loads the engine', /\/fx\/asgard-fx\.js/], ['opts in to cores', /cores: true/], ['has the four state buttons', /data-state="speaking"/]]);
// The Worker answers an unknown path with 200 + its text banner, so "missing" is judged by content type, not status.
const missing = r => r.status === 404 || !/javascript/.test(r.type);
for (const id of ['thor', 'loki', 'odin']) {
  const r = await get(`/fx/cores/${id}.js`);
  if (missing(r)) { ok(`core ${id}`, 'not built yet'); continue; }
  if (new RegExp(`registerCore\\('${id}'`).test(r.text)) ok(`core ${id} registers as itself`); else bad(`core ${id} registers as itself`);
}
{ const r = await get('/fx/cores/hela.js'); if (missing(r)) ok('no fourth core file', '(correct)'); else bad('no fourth core file', 'a JavaScript file answered — must not exist'); }
for (const p of ['/fx/thor.js', '/fx/loki.js', '/fx/odin.js']) await must(p, [['registers a realm', /registerRealm\(/]]);
await must('/halls-preview.html', [['three halls', /hall--odin/]]);
{
  const r = await get('/');
  if (r.status !== 200) bad('GET /', `status ${r.status}`);
  else {
    const tags = (r.text.match(/<script src="\/fx\/asgard-fx\.js"><\/script>/g) || []).length;
    if (tags === 1) ok('hall loads exactly one FX tag'); else bad('hall loads exactly one FX tag', `found ${tags}`);
    if (/AsgardFX\.init\(/.test(r.text)) ok('hall calls AsgardFX.init once'); else bad('hall calls AsgardFX.init');
  }
}
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
