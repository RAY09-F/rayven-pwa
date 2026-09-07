#!/usr/bin/env node
// scripts/gen-tools-json.mjs [LIVE_BASE_URL]  — saves docs/TOOLS.json from the
// live Worker's GET /admin/tools.json (token from ~/.asgard-admin-token).
// Falls back to importing src/lib/tools.js locally when no token file exists.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
const BASE = (process.argv[2] || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
let token = ''; try { token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim(); } catch {}
let data;
if (token) {
  const r = await fetch(BASE + '/admin/tools.json', { headers: { 'X-Asgard-Admin': token } });
  if (!r.ok) { console.error('admin route answered', r.status); process.exit(1); }
  data = await r.json();
} else {
  const t = await import('../src/lib/tools.js'); const p = await import('../src/lib/personas.js');
  data = { generatedAt: new Date().toISOString(), source: 'local import', count: t.TOOL_DEFINITIONS.length,
    perPersona: Object.fromEntries(p.ALL_PERSONA_IDS.map(id => [id, t.toolDefinitionsForPersona(id).map(x => x.name)])), tools: t.TOOL_DEFINITIONS };
}
writeFileSync(new URL('../docs/TOOLS.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`docs/TOOLS.json: ${data.count} tools (${token ? 'from ' + BASE : 'local import'})`);
