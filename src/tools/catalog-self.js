// CATALOGUE — MEMORY & SELF (asgard-upgrade Phase 7.12). Darcy, Mobius. Read-only over
// memory; the journal is appended, dated, never edited (Rule 5a2).
import { clip, capN } from '../lib/http.js';
import { getLongTermMemory, searchMemory } from '../lib/memory.js';
import { readRecentTicks, readTickLast } from '../lib/tick.js';
import { readCappedLog, appendCappedLog } from '../lib/util.js';
import { costReportText } from '../lib/cost.js';
const S = (props, required = []) => ({ type: 'object', properties: props, required });
const str = d => ({ type: 'string', description: d }), int = d => ({ type: 'integer', description: d });
const G = 'self';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const TOOLS = [
  { name: 'memory_timeline', group: G, taint: false, description: 'Your long-term memory between two dates (YYYY-MM-DD), newest first, read-only.', input_schema: S({ from: str('start date'), to: str('end date'), n: int('entries, default 15, max 20') }),
    async run(env, { from, to, n }, ctx) { const persona = (ctx && ctx.persona) || 'thor'; const mem = await getLongTermMemory(env, persona) || []; const sel = mem.filter(m => (!from || (m.date || '') >= from) && (!to || (m.date || '') <= to) && !m.supersededBy).slice(-capN(n, 15)).reverse(); return sel.length ? sel.map(m => `[${m.date}] ${m.fact}`).join('\n') : 'Nothing in memory for that window.'; } },
  { name: 'what_did_i_say_about', group: G, taint: false, description: 'What Rayan said about a topic, from long-term memory (semantic search, read-only).', input_schema: S({ topic: str('the topic') }, ['topic']),
    async run(env, { topic }, ctx) { const persona = (ctx && ctx.persona) || 'thor'; try { const r = await searchMemory(env, { query: topic }, persona); return typeof r === 'string' ? r : clip(JSON.stringify(r)); } catch (e) { return `what_did_i_say_about: ${e.message}`; } } },
  { name: 'journal_write', group: G, taint: false, description: 'Append a dated line to Rayan\'s journal (never edited, never deleted).', input_schema: S({ text: str('the entry') }, ['text']),
    async run(env, { text }) { const t = String(text || '').trim().slice(0, 1200); if (!t) return 'What should the journal say?'; await appendCappedLog(env, 'journal:entries', { date: today(), at: new Date().toISOString(), text: t }, 500); return `Journal: written for ${today()}.`; } },
  { name: 'journal_read', group: G, taint: false, description: 'Read the journal: one date (YYYY-MM-DD) or the most recent entries.', input_schema: S({ date: str('YYYY-MM-DD, optional'), n: int('entries, default 10, max 20') }),
    async run(env, { date, n }) { const list = await readCappedLog(env, 'journal:entries'); const sel = date ? list.filter(x => x.date === date) : list.slice(-capN(n)); return sel.length ? sel.map(x => `[${x.date}] ${x.text}`).join('\n') : (date ? `No journal entries on ${date}.` : 'The journal is empty.'); } },
  { name: 'self_stats', group: G, taint: false, description: 'How Asgard has been working: tool calls this week from the tick keys, KV writes today, routine runs today, and the model spend.', input_schema: S({}),
    async run(env) { const [ticks, last, cost] = await Promise.all([readRecentTicks(env, 60), readTickLast(env), costReportText(env, 7)]); const counts = {}; let calls = 0; for (const t of ticks) for (const e of [...(t.audit || []), ...(t.drained || [])]) { const name = e && (e.tool || (e.kind === 'audit' && e.tool)); if (name) { counts[name] = (counts[name] || 0) + 1; calls++; } } const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ×${v}`).join(', '); return `Recent ticks read: ${ticks.length}. Tool calls seen in them: ${calls}${top ? ` (${top})` : ''}. KV writes today (upgrade writers): ${last.writesToday || 0} of 2,500. Routine runs today: ${last.routineRunsToday || 0} of 60.\n${cost}`; } }
];
