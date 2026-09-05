// THE VAULT EXPORT (asgard-upgrade Phase 5.1 / 5.2).
//
// Renders what Asgard knows as a folder laid out like an Obsidian vault:
// [{ path, content }]. A rendering -- every KV original is untouched. The hidden
// realm's material is included ONLY when the caller asks for it (header
// X-Asgard-Vault: hela on the admin route; always for the nightly R2 backup,
// because a backup that leaves her out is not a backup). Nothing here writes
// KV except the nightly marker, and nothing here ever deletes anything.
import { PERSONAS, ALL_PERSONA_IDS, historyKeyFor, SHARED_CORE } from './personas.js';
import { COUNCIL, readCouncilState } from './council.js';
import { getLongTermMemory } from './memory.js';
import { loadConversation } from './conversation.js';
import { readRoutinesIndex, readRoutineRaw } from './routines.js';
import { describeSchedule } from './schedule.js';
import { TOOL_DEFINITIONS, toolDefinitionsForPersona } from './tools.js';
import { getPaperStatus, getAgentStats, getTraderJournal, AGENTS } from './paperTrading.js';
import { helaCapabilities } from './hela.js';
import { readCappedLog } from './util.js';
import { checkPermission } from './permissions.js';

const HIDDEN = new Set(ALL_PERSONA_IDS.filter(id => PERSONAS[id].hidden));
const day = ts => new Date(ts || Date.now()).toISOString().slice(0, 10);
const md = (...lines) => lines.filter(l => l !== null && l !== undefined).join('\n') + '\n';
const fence = obj => '```json\n' + JSON.stringify(obj, null, 2) + '\n```';

export async function buildVault(env, { includeHidden = false } = {}) {
  const files = [];
  const visible = ALL_PERSONA_IDS.filter(id => includeHidden || !HIDDEN.has(id));
  const now = new Date().toISOString();

  // ---- memory, per persona, dated, with provenance; and the condensed MEMORY.md
  const allMem = {};
  for (const id of visible) { try { allMem[id] = await getLongTermMemory(env, id) || []; } catch (e) { allMem[id] = []; } }
  const memLines = [];
  for (const id of visible) {
    const byDate = {};
    for (const m of allMem[id]) { const d = m.date || day(m.ts); (byDate[d] ||= []).push(m); }
    for (const d of Object.keys(byDate).sort()) {
      files.push({ path: `memory/${id}/${d}.md`, content: md(`# ${PERSONAS[id].name} — memory ${d}`, '', ...byDate[d].map(m => `- ${m.fact}${m.prov ? `  \n  _source: ${m.prov.source || 'unknown'} · trust: ${m.prov.trust || 'legacy'} · ${m.prov.ts ? new Date(m.prov.ts).toISOString() : ''}_` : '  \n  _legacy entry, no provenance_'}${m.supersededBy ? '  \n  _superseded by a newer memory_' : ''}`)) });
    }
    const recent = allMem[id].filter(m => !m.supersededBy).slice(-40);
    if (recent.length) memLines.push(`## ${PERSONAS[id].name}`, ...recent.map(m => `- [${m.date || day(m.ts)}] ${m.fact}`), '');
  }
  files.push({ path: 'MEMORY.md', content: md('# MEMORY — what an agent should know at session start', `_Rendered ${now} from Asgard's long-term memory. The KV originals are the record; this is the condensed view (the last 40 live entries per persona)._`, '', ...memLines) });

  // ---- USER.md
  files.push({ path: 'USER.md', content: md('# USER — Rayan', '', 'Rayan Fahil. Bakersfield, California (Kern County). Speaks to his assistants by voice and on Telegram; wants plain English, one step at a time, no jargon, and to be called "sir" by Thor. He has zero coding experience and never edits code by hand. He is job hunting. He runs a PAPER (simulated) trading book through Odin and has never asked for real trades.', '', '## Standing rules (the shared core every persona carries)', '', SHARED_CORE.trim(), '', '## Rules that never bend (from the build files)', '- Hard-confirm tools (texts, calls) always ask before acting; automation may queue them for approval but never send.', '- No real-money trading exists and nothing adds it; PAPER / SIM is labelled everywhere a number appears.', '- Long-term memory is never cleared or trimmed by code; compaction appends, never removes.', '- Anything read from outside content taints the session: consequential actions then wait for Rayan.') });

  // ---- personas
  for (const id of visible) files.push({ path: `personas/${id}.md`, content: md(`# ${PERSONAS[id].name}`, `_lane: ${PERSONAS[id].lane || ''} · history cap: ${PERSONAS[id].historyTurns || 30} turns${PERSONAS[id].hidden ? ' · concealed' : ''}_`, '', '## System prompt', '', PERSONAS[id].systemPrompt) });

  // ---- councils
  for (const [cid, c] of Object.entries(COUNCIL)) {
    if (!visible.includes(c.owner)) continue;
    let state = {}; try { state = await readCouncilState(env, cid); } catch (e) {}
    files.push({ path: `councils/${c.owner}/${cid}.md`, content: md(`# ${c.name} — ${c.role}`, `_owner: ${PERSONAS[c.owner].name} · tier: ${c.tier} · duty: ${c.duty ? 'scheduled' : 'on delegation'}${c.dutyNote ? ` — ${c.dutyNote}` : ''}_`, '', c.theme, '', '## Prompt', '', c.prompt || '_(none)_', '', '## Tools', '', ...(c.tools || []).map(t => `- ${t}`), '', '## State', '', fence({ lastRun: state.lastRun || null, lastSummary: state.lastSummary || null, runs: state.runs || 0 })) });
  }

  // ---- history: the web conversation and Rayan's private Telegram chat, rendered
  const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id').catch(() => null);
  for (const id of visible) {
    const parts = [];
    for (const [label, key] of [['web', historyKeyFor(id, 'web')], ...(chatId ? [['telegram', historyKeyFor(id, 'telegram', chatId)]] : [])]) {
      try { const c = await loadConversation(env, key); if (c && c.turns && c.turns.length) parts.push(`## ${label}`, '', ...c.turns.slice(-30).map(t => `**${t.role}:** ${typeof t.content === 'string' ? t.content : JSON.stringify(t.content).slice(0, 600)}`), ''); } catch (e) {}
    }
    files.push({ path: `history/${id}/latest.md`, content: md(`# ${PERSONAS[id].name} — recent conversation`, `_rendered ${now}_`, '', ...(parts.length ? parts : ['_no conversation yet_'])) });
  }

  // ---- trading (PAPER)
  try {
    const st = await getPaperStatus(env);
    const trades = await readCappedLog(env, 'paper:trades');
    files.push({ path: 'trading/journal.md', content: md('# PAPER trading journal — SIMULATED, no real money', `_cash $${Number(st.currentCash).toFixed(2)} · all-time ${st.allTime.pnl >= 0 ? '+' : '-'}$${Math.abs(st.allTime.pnl).toFixed(2)} over ${st.allTime.trades} trades_`, '', '| exit | trader | market | side | P&L | reason |', '|---|---|---|---|---|---|', ...trades.slice(-200).reverse().map(t => `| ${String(t.exitTime).slice(0, 16)} | ${t.agentName || t.agent} | ${t.market} | ${t.side} | ${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)} | ${String(t.exitReason || '').replace(/\|/g, '/').slice(0, 80)} |`)) });
    for (const id of ['freya', 'tyr', 'baldr', 'heimdall', 'vidar']) {
      const [s, j] = await Promise.all([getAgentStats(env, id), getTraderJournal(env, id)]);
      files.push({ path: `trading/${id}.md`, content: md(`# ${AGENTS[id].name} — ${AGENTS[id].label} (PAPER)`, AGENTS[id].theme || '', '', '## Stats', '', s ? fence({ ...s, equity: undefined }) : '_no closed trades yet_', '', '## After-close reviews', '', ...(j && j.length ? j.slice(-30).reverse().map(e => `- **${e.date}** ${e.text}`) : ['_none yet_'])) });
    }
  } catch (e) { files.push({ path: 'trading/journal.md', content: md('# PAPER trading journal', `_unavailable: ${e.message}_`) }); }

  // ---- routines
  try {
    const idx = await readRoutinesIndex(env);
    for (const e of idx) {
      const r = await readRoutineRaw(env, e.id); if (!r) continue;
      if (!visible.includes(r.owner)) continue;
      files.push({ path: `routines/${r.id}.md`, content: md(`# ${r.name}`, `_owner: ${r.owner} · ${r.enabled ? 'enabled' : 'paused'}${r.deleted ? ' · deleted (record kept)' : ''} · trigger: ${r.trigger && r.trigger.kind === 'event' ? `event ${r.trigger.event}` : describeSchedule(r.trigger || {})} · deliver: ${r.deliver}_`, '', r.intent || '', '', fence({ id: r.id, trigger: r.trigger, steps: r.steps, deliver: r.deliver, createdBy: r.createdBy, failures: r.failures || 0, lastRuns: (r.runs || []).slice(-3) })) });
    }
  } catch (e) {}

  // ---- tools
  const perms = {}; for (const t of TOOL_DEFINITIONS) { try { perms[t.name] = await checkPermission(env, t.name); } catch (e) { perms[t.name] = 'auto'; } }
  const vis = {}; for (const id of visible) for (const t of toolDefinitionsForPersona(id)) (vis[t.name] ||= []).push(id);
  const toolRows = TOOL_DEFINITIONS.filter(t => vis[t.name]).map(t => ({ name: t.name, description: t.description, permission: perms[t.name], personas: vis[t.name], input_schema: t.input_schema }));
  files.push({ path: 'tools/TOOLS.json', content: JSON.stringify({ generatedAt: now, count: toolRows.length, tools: toolRows }, null, 2) + '\n' });
  files.push({ path: 'tools/TOOLS.md', content: md('# Tools', `_${toolRows.length} tools as the models see them, ${now}_`, '', '| tool | permission | personas | description |', '|---|---|---|---|', ...toolRows.map(t => `| ${t.name} | ${t.permission} | ${t.personas.join(' ')} | ${String(t.description).replace(/\|/g, '/').slice(0, 140)} |`)) });

  // ---- the hidden realm's capabilities: only when asked
  if (includeHidden) { try { files.push({ path: 'capabilities/hela.md', content: md('# Saved capabilities (names, purposes, URLs — never secrets)', '', await helaCapabilities(env, 'hela')) }); } catch (e) {} }

  files.push({ path: 'MIGRATION.md', content: md('# Moving Asgard one day', '', 'The full plan lives in the repository at docs/MIGRATION.md (what copies straight across, what needs a machine Asgard does not have, what stays on Cloudflare and why, and the exact order to do it in — run both side by side for a month first).', '', `This folder was rendered ${now} by scripts/export-vault.mjs or the nightly backup. Re-render it rather than editing it; the KV originals are the record.`) });
  return files;
}

// Phase 5.2: the nightly backup to R2 — the same export INCLUDING the hidden
// realm, one object per night under asgard-vault/YYYY-MM-DD.json, 03:30 Pacific.
// One KV write (the day marker), one R2 put. Nothing is ever deleted by code.
const BACKUP_LAST_KEY = 'system:vault_backup_last';
export async function runVaultBackupIfDue(env) {
  if (!env.CLIPS) return { ok: true, skipped: 'no R2 binding' };
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`, minutes = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
  if (minutes < 3 * 60 + 30 || minutes >= 3 * 60 + 40) return { ok: true, skipped: 'not the window' };
  const last = await env.RAYVEN_KV.get(BACKUP_LAST_KEY).catch(() => null);
  if (last === date) return { ok: true, skipped: 'done today' };
  const files = await buildVault(env, { includeHidden: true });
  const key = `asgard-vault/${date}.json`;
  await env.CLIPS.put(key, JSON.stringify({ date, renderedAt: new Date().toISOString(), files }), { httpMetadata: { contentType: 'application/json' } });
  await env.RAYVEN_KV.put(BACKUP_LAST_KEY, date);
  return { ok: true, key, files: files.length };
}
