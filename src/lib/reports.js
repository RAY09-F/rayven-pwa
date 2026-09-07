// Scheduled persona deliverables: LOKI's daily brief and ODIN's recurring
// business report. Both follow the house cron pattern (checkin.js): the 5-minute
// tick calls the *IfDue functions, each checks its own KV config + "last run"
// state and decides for itself. Both are OFF until Rayan sets a time in the
// settings panel (config keys below) — deliberately, so they don't double up
// with THOR's existing 8am morning briefing until he chooses times.
//
// Config keys (set via POST /assistant-config):
//   config:loki:brief:hour   — 0-23 Pacific, or '' = off
//   config:odin:report:day   — 'daily' | '0'..'6' (0=Sunday), or '' = off
//   config:odin:report:hour  — 0-23 Pacific (default 9 when day is set)
import { callClaudeWithTools } from './tools.js';
import { getPersona, getPersonaBotToken, DEFAULT_PERSONA_ID } from './personas.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { getRecentMemoryBlock } from './memory.js';
import { getTodos, getCalendarEvents } from './kv-store.js';
import { appendCappedLog, readCappedLog } from './util.js';
import { getWatchList } from './monitoring.js';

const TZ = 'America/Los_Angeles';

function pacificParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short'
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  const weekdayNum = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10), minute: parseInt(p.minute, 10), weekday: weekdayNum };
}

async function deliver(env, personaId, text) {
  const chatId = await getRayanPrivateChatId(env);
  if (!chatId) return { ok: false, reason: 'No private chat ID stored yet — message the legacy bot privately once first.' };
  const botToken = getPersonaBotToken(env, personaId) || env.TELEGRAM_BOT_TOKEN;
  const res = await sendTelegramMessage(env, chatId, text, botToken);
  return { ok: !!(res && res.ok), telegram: res };
}

// ---- LOKI daily brief ----

export async function runLokiBriefIfDue(env) {
  const hourRaw = await env.RAYVEN_KV.get('config:loki:brief:hour');
  if (hourRaw === null || hourRaw === '') return { ok: true, skipped: true, reason: 'Loki brief is off — no hour configured.' };
  const targetHour = parseInt(hourRaw, 10);
  const { date, hour, minute } = pacificParts();
  if (hour !== targetHour || minute >= 5) return { ok: true, skipped: true, reason: 'Not due.' };
  const last = await env.RAYVEN_KV.get('loki:brief:last_date');
  if (last === date) return { ok: true, skipped: true, reason: 'Already sent today.' };
  await env.RAYVEN_KV.put('loki:brief:last_date', date);
  return await runLokiBrief(env, true);
}

// Also runs on demand from the "brief me now" button (POST /loki/brief-now).
export async function runLokiBrief(env, sendToTelegram) {
  const persona = getPersona('loki');
  const today = pacificParts().date;
  const [todos, events, watches, memoryBlock] = await Promise.all([
    getTodos(env), getCalendarEvents(env), getWatchList(env), getRecentMemoryBlock(env, 'loki')
  ]);
  const openTodos = todos.filter(t => !t.done);
  const todayEvents = events.filter(e => e.date === today);
  const upcoming = events.filter(e => e.date > today).slice(0, 5);

  const task = `[SCHEDULED DAILY BRIEF — compose and return Rayan's brief for today, ${today}. This is real data from your own stores; do not invent anything beyond it. Cover: open to-dos (nag about anything that's been sitting), today's calendar, what's coming up, anything on the watchlist worth a word, and one short wellbeing nudge. Keep it tight — your register, no filler. Plain text only.]

OPEN TO-DOS (${openTodos.length}): ${openTodos.length ? openTodos.map(t => `"${t.text}" (added ${t.created.slice(0, 10)})`).join('; ') : 'none'}
TODAY'S CALENDAR: ${todayEvents.length ? todayEvents.map(e => `${e.time || ''} ${e.title}`.trim()).join('; ') : 'nothing scheduled'}
UPCOMING: ${upcoming.length ? upcoming.map(e => `${e.date} ${e.title}`).join('; ') : 'nothing'}
WATCHLIST: ${Array.isArray(watches) && watches.length ? watches.map(w => `${w.label || w.target || w.query || 'watch'} (${w.status || 'active'})`).join('; ') : 'empty'}`;

  const result = await callClaudeWithTools(env, persona.systemPrompt,
    'Scheduled brief being composed for delivery — not a live conversation turn.',
    memoryBlock, [{ role: 'user', content: task }], true, null, 'loki');
  if (!result.ok) return { ok: false, reason: 'Claude call failed.', details: result.data };
  const textBlock = result.data.content.find(b => b.type === 'text');
  const brief = textBlock ? textBlock.text : null;
  if (!brief) return { ok: false, reason: 'No text in Claude reply.' };

  await env.RAYVEN_KV.put('loki:brief:latest', JSON.stringify({ date: today, at: new Date().toISOString(), text: brief }));
  let delivery = { ok: true, skipped: true };
  if (sendToTelegram) delivery = await deliver(env, 'loki', brief);
  return { ok: true, brief, delivery };
}

// ---- ODIN recurring business report ----

export async function runOdinReportIfDue(env) {
  const dayRaw = await env.RAYVEN_KV.get('config:odin:report:day');
  if (dayRaw === null || dayRaw === '') return { ok: true, skipped: true, reason: 'Odin report is off — no day configured.' };
  const hourRaw = await env.RAYVEN_KV.get('config:odin:report:hour');
  const targetHour = hourRaw !== null && hourRaw !== '' ? parseInt(hourRaw, 10) : 9;
  const { date, hour, minute, weekday } = pacificParts();
  if (dayRaw !== 'daily' && parseInt(dayRaw, 10) !== weekday) return { ok: true, skipped: true, reason: 'Not the configured day.' };
  if (hour !== targetHour || minute >= 5) return { ok: true, skipped: true, reason: 'Not due.' };
  const last = await env.RAYVEN_KV.get('odin:report:last_date');
  if (last === date) return { ok: true, skipped: true, reason: 'Already sent today.' };
  await env.RAYVEN_KV.put('odin:report:last_date', date);
  return await runOdinReport(env, true);
}

async function readJsonKey(env, key) {
  try {
    const raw = await env.RAYVEN_KV.get(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

// Also runs on demand from Odin's "generate report" button (POST /odin/report-now).
export async function runOdinReport(env, sendToTelegram) {
  const persona = getPersona('odin');
  const today = pacificParts().date;
  const [kpis, goals, clipping, ideas, memoryBlock] = await Promise.all([
    readJsonKey(env, 'odin:kpis'), readJsonKey(env, 'odin:goals'),
    readJsonKey(env, 'clipping:accounts'), readJsonKey(env, 'content:ideas'),
    getRecentMemoryBlock(env, 'odin')
  ]);

  const task = `[SCHEDULED BUSINESS REPORT — compose Rayan's business report for ${today}. The numbers below are the real recorded state of his stores; do not invent figures. Where a section has no data, say so plainly and, if useful, name what he should start tracking. You may use web_search/tavily_research for market context. Structure: current numbers, movement worth noting, the clipping operation, one or two strategic observations, and the single question that matters most right now. Your register — measured, no padding. Plain text only.]

KPIs (${kpis.length}): ${kpis.length ? kpis.map(k => `${k.label}: ${k.value}${k.unit || ''} (updated ${String(k.updated || '').slice(0, 10)})`).join('; ') : 'none recorded yet'}
GOALS (${goals.length}): ${goals.length ? goals.map(g => `${g.title} — ${g.progress || 0}% toward ${g.target || 'target'}${g.due ? `, due ${g.due}` : ''}`).join('; ') : 'none recorded yet'}
CLIPPING ACCOUNTS (${clipping.length} of planned 60): ${clipping.length ? clipping.map(a => `${a.platform}/${a.handle}: ${a.status}, ${a.postsToday || 0} posts today, ${a.queued || 0} queued`).join('; ') : 'not launched — zero accounts registered'}
CONTENT IDEAS QUEUED: ${ideas.length}`;

  const result = await callClaudeWithTools(env, persona.systemPrompt,
    'Scheduled report being composed for delivery — not a live conversation turn.',
    memoryBlock, [{ role: 'user', content: task }], true, null, 'odin');
  if (!result.ok) return { ok: false, reason: 'Claude call failed.', details: result.data };
  const textBlock = result.data.content.find(b => b.type === 'text');
  const report = textBlock ? textBlock.text : null;
  if (!report) return { ok: false, reason: 'No text in Claude reply.' };

  await appendCappedLog(env, 'odin:reports', { date: today, at: new Date().toISOString(), text: report }, 40);
  let delivery = { ok: true, skipped: true };
  if (sendToTelegram) delivery = await deliver(env, 'odin', report);
  return { ok: true, report, delivery };
}

export async function getOdinReports(env) {
  return await readCappedLog(env, 'odin:reports');
}
