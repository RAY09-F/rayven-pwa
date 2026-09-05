#!/usr/bin/env node
// scripts/gen-core.mjs — writes docs/CORE.md from the code: each god's CORE by exact tool name in the
// master order, the groups, and (when ~/.asgard-admin-token and the live Worker are reachable) the
// measured CORE token count from /admin/core-tokens. Plain Node, no deps.
import { writeFileSync, readFileSync } from 'node:fs'; import { homedir } from 'node:os';
const T = await import('../src/lib/tools.js'); const M = await import('../src/tools/meta.js');
const BASE = (process.argv[2] || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
let tokens = {}; try { const token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim(); const r = await fetch(BASE + '/admin/core-tokens', { headers: { 'X-Asgard-Admin': token } }); if (r.ok) tokens = await r.json(); } catch {}
const out = ['# CORE — what each god always sees', '', `_Generated ${new Date().toISOString()} by scripts/gen-core.mjs. CORE is at most ${M.MAX_CORE} tools, sent on every call in the master order. Everything else is in groups that open by keyword on a message or through find_tools, and close after ${M.CLOSE_AFTER_IDLE_TURNS} idle turns._`, ''];
for (const id of ['thor', 'loki', 'odin']) {
  const defs = T.toolDefinitionsForPersona(id); const core = M.coreFor(id, defs);
  const missing = (M.CORE_NAMES[id] || []).filter(n => !core.some(d => d.name === n));
  out.push(`## ${id.toUpperCase()} — ${core.length} tools${tokens[id] && tokens[id].inputTokens != null ? ` · ${tokens[id].inputTokens} input tokens measured (count_tokens)` : ''}`, '', core.map(d => `- \`${d.name}\` [${M.groupOf(d.name)}]`).join('\n'), '');
  if (missing.length) out.push(`_Listed but not available to this god (not in its allow-list or not a tool): ${missing.join(', ')}_`, '');
  const groups = {}; for (const d of defs) { const g = M.groupOf(d.name); if (g === 'hidden') continue; (groups[g] ||= []).push(d.name); }
  out.push(`Groups reachable by keyword / find_tools (${defs.length} tools allowed in total): ${Object.entries(groups).sort().map(([g, n]) => `${g} (${n.length})`).join(', ')}`, '');
}
out.push('## The concealed fourth', '', 'Keeps every tool she has today (no CORE cap) plus find_tools; the catalogue groups open for her the same way.', '');
writeFileSync('docs/CORE.md', out.join('\n')); console.log('docs/CORE.md written');
for (const id of ['thor', 'loki', 'odin']) { const n = M.coreFor(id, T.toolDefinitionsForPersona(id)).length; console.log(`${id}: CORE ${n}${tokens[id] ? ` · ${tokens[id].inputTokens} tokens` : ''}`); }
