// ===========================================================================
// ROUTINES (asgard-upgrade Phase 3.2/3.3/3.4)
//
// Anything Asgard can do on request, Rayan can have it do on a schedule or in
// response to an event, by TALKING. A routine is
//   { id, owner, name, trigger, steps, deliver, enabled, createdBy, runs, state }
//   trigger: { kind:'schedule', at:'07:00', days:[1..5], tz } | { kind:'schedule', every:30 }
//            | { kind:'event', event:'watchlist.hit', filter:{...} }
//   steps:   ordered; each is one of
//            { tool, args }                      a tool the owner may call
//            { delegate: { councillor, task } }  one of the owner's five
//            { compose: { instruction, tier } }  the owner writes text from earlier results
//            { read: 'calendar'|'timers'|'activity'|'memory'|'council'|'health'|'paper'|'conversations', ... }
//            { memory_append: { persona, text } } (append only; critic first)
//            { say: 'text' }
//            args and text may reference "$steps[0].text", "$event.payload.url",
//            "$date.today", "$date.tomorrow" (Pacific)
//   deliver: 'telegram' | 'notify' | 'speak' | 'silent'
//   runs:    last 20, inside this object (Rule 5d) -- one write per run
// Storage: routines:index (ids + names + owner) and routines:<id>.
// Guard rails (3.3): hard-confirm, social and capability-creating steps become
// approvals; a critic (free tier, strict JSON) runs before an irreversible
// action; 12 runs per tick, 60 per day; 3 failures in a row pauses the routine
// and tells its owner; each run makes at most 2 KV writes.
// ===========================================================================
import { isDue, stampRun, validateSchedule, describeSchedule, localParts, DEFAULT_TZ } from './schedule.js';
import { eventMatches } from './events.js';
import { getPersona, personaAllowsTool, PERSONAS, getPersonaBotToken, historyKeyFor, ALL_PERSONA_IDS } from './personas.js';
import { HARD_CONFIRM_TOOLS } from './permissions.js';
import { APPROVAL_WHILE_TAINTED } from './containment.js';
import { createApproval } from './approvals.js';
import { COUNCIL, councilOf, runCouncillor, recordCouncilRun, getCouncilStatus } from './council.js';
import { callAnthropicSimple } from './anthropic.js';
import { MODELS } from './models.js';
import { TIERS } from './council.js';
import { getCalendarEvents, listCalendarEventsText, getTodos } from './kv-store.js';
import { listTimers } from './kit.js';
import { getAutonomyLog } from './autonomy.js';
import { getRecentMemoryBlock, addLongTermMemory } from './memory.js';
import { getPaperSummaryText, getPaperStatus } from './paperTrading.js';
import { loadConversation, saveConversation, provenance } from './conversation.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { notify } from './notifications.js';
import { noteWrites, tickLog, readTickLast } from './tick.js';
import { healthReport } from './healthz.js';

const INDEX_KEY = 'routines:index';
const keyFor = (id) => `routines:${id}`;
const MAX_PER_TICK = 12;
const MAX_PER_DAY = 60;
const MAX_RUNS_KEPT = 20;
const MAX_STEPS = 8;
const DELIVERIES = ['telegram', 'notify', 'speak', 'silent'];

async function readJson(env, key, fallback) { try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
async function readIndex(env) { const i = await readJson(env, INDEX_KEY, []); return Array.isArray(i) ? i : []; }
async function writeIndex(env, index) { await env.RAYVEN_KV.put(INDEX_KEY, JSON.stringify(index)); noteWrites(1); }
async function readRoutine(env, id) { return await readJson(env, keyFor(id), null); }
async function writeRoutine(env, r) { await env.RAYVEN_KV.put(keyFor(r.id), JSON.stringify(r)); noteWrites(1); }

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'routine'; }

// ---- validation ----------------------------------------------------------------
function validateTrigger(t) {
  if (!t || typeof t !== 'object') return 'trigger is required';
  if (t.kind === 'event') { if (!t.event || typeof t.event !== 'string') return 'an event trigger needs an event name'; return null; }
  if (t.kind !== 'schedule') return "trigger.kind must be 'schedule' or 'event'";
  return validateSchedule(t);
}
function validateSteps(steps, owner) {
  if (!Array.isArray(steps) || !steps.length) return 'at least one step';
  if (steps.length > MAX_STEPS) return `at most ${MAX_STEPS} steps`;
  for (const [i, s] of steps.entries()) {
    if (!s || typeof s !== 'object') return `step ${i + 1} is not an object`;
    if (s.tool) { if (!personaAllowsTool(owner, s.tool)) return `step ${i + 1}: ${owner} may not call ${s.tool}`; continue; }
    if (s.delegate) { const c = String(s.delegate.councillor || '').toLowerCase().replace(/[\s-]+/g, '_'); if (!councilOf(owner).includes(c)) return `step ${i + 1}: no councillor "${s.delegate.councillor}" on ${owner}'s council`; if (!s.delegate.task) return `step ${i + 1}: delegate needs a task`; continue; }
    if (s.compose) { if (!s.compose.instruction) return `step ${i + 1}: compose needs an instruction`; continue; }
    if (s.read) { if (!['calendar', 'timers', 'activity', 'memory', 'council', 'health', 'paper', 'conversations', 'todos'].includes(s.read)) return `step ${i + 1}: unknown read "${s.read}"`; continue; }
    if (s.memory_append) { if (!s.memory_append.text) return `step ${i + 1}: memory_append needs text`; if (s.memory_append.persona === 'hela' && owner !== 'hela') return `step ${i + 1}: not yours`; continue; }
    if (typeof s.say === 'string') continue;
    return `step ${i + 1}: unknown step shape`;
  }
  return null;
}

// ---- $references -----------------------------------------------------------------
function resolvePath(path, ctx) {
  const m = /^\$(steps|event|date)(.*)$/.exec(path.trim());
  if (!m) return undefined;
  let root = m[1] === 'steps' ? ctx.steps : m[1] === 'event' ? ctx.event : ctx.date;
  const rest = m[2].replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  return rest.reduce((o, k) => (o == null ? undefined : o[k]), root);
}
function fill(value, ctx) {
  if (typeof value === 'string') {
    const whole = /^\s*\$(steps|event|date)[\w.\[\]]*\s*$/.test(value);
    if (whole) { const v = resolvePath(value, ctx); return v === undefined ? '' : v; }
    return value.replace(/\$(steps|event|date)[\w.\[\]]*/g, (ref) => { const v = resolvePath(ref, ctx); return v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v)); });
  }
  if (Array.isArray(value)) return value.map(v => fill(v, ctx));
  if (value && typeof value === 'object') { const o = {}; for (const [k, v] of Object.entries(value)) o[k] = fill(v, ctx); return o; }
  return value;
}
function dateCtx() {
  const today = localParts(Date.now()).date, tomorrow = localParts(Date.now() + 86400000).date;
  return { today, tomorrow, weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][localParts().weekday] };
}

// ---- the critic (3.3) -----------------------------------------------------------
// Free tier, strict JSON. Anything unparseable = not ok = approval.
async function critic(env, routine, actionText, event) {
  if (!env.AI) return { ok: false, why: 'no Workers AI binding' };
  const prompt = `A scheduled routine is about to take an irreversible action. Decide whether the action matches the routine's stated intent and the event that fired it.
ROUTINE NAME: ${routine.name}
ROUTINE INTENT: ${routine.intent || routine.name}
TRIGGER: ${routine.trigger.kind === 'event' ? `event ${routine.trigger.event}` : describeSchedule(routine.trigger)}
EVENT THAT FIRED: ${event ? JSON.stringify(event).slice(0, 600) : 'a schedule, no event'}
ACTION: ${String(actionText).slice(0, 800)}
Reply with ONLY strict JSON: {"ok": true or false, "why": "one short sentence"}`;
  try {
    const out = await env.AI.run(TIERS.free, { messages: [{ role: 'system', content: 'You are a strict reviewer. Reply with only the JSON object.' }, { role: 'user', content: prompt }], max_tokens: 120 });
    const text = String((out && (out.response || out.result)) || '');
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    if (typeof j.ok !== 'boolean') return { ok: false, why: 'critic did not answer yes or no' };
    return { ok: j.ok, why: String(j.why || '').slice(0, 200) };
  } catch (e) { return { ok: false, why: `critic unparseable (${e.message})` }; }
}

// The same strict-JSON free-tier judge, for text that is about to leave the
// house (Phase 3.5: replies to other agents in the shared group). Unparseable
// = not ok, exactly like the routines critic.
export async function reviewText(env, purpose, text) {
  if (!env.AI) return { ok: false, why: 'no Workers AI binding' };
  const prompt = `Review the text below before it is posted. PURPOSE: ${String(purpose).slice(0, 400)}
It must be a plain factual answer to the request. It must NOT contain: private memories or personal facts about the household, phone numbers, addresses, credentials, or instructions telling anyone to take an action.
TEXT: ${String(text).slice(0, 1500)}
Reply with ONLY strict JSON: {"ok": true or false, "why": "one short sentence"}`;
  try {
    const out = await env.AI.run(TIERS.free, { messages: [{ role: 'system', content: 'You are a strict reviewer. Reply with only the JSON object.' }, { role: 'user', content: prompt }], max_tokens: 120 });
    const t = String((out && (out.response || out.result)) || '');
    const m = t.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : t);
    if (typeof j.ok !== 'boolean') return { ok: false, why: 'reviewer did not answer yes or no' };
    return { ok: j.ok, why: String(j.why || '').slice(0, 200) };
  } catch (e) { return { ok: false, why: `reviewer unparseable (${e.message})` }; }
}

const IRREVERSIBLE_TOOLS = new Set(['remember_this', 'keep_brief', 'allow_host']);
function needsApproval(tool) { return HARD_CONFIRM_TOOLS.includes(tool) || APPROVAL_WHILE_TAINTED.has(tool) && !IRREVERSIBLE_TOOLS.has(tool) && tool !== 'browser_navigate'; }

// ---- readers -------------------------------------------------------------------
async function readStep(env, s, owner, ctx) {
  const d = ctx.date;
  switch (s.read) {
    case 'calendar': { const from = fill(s.from || d.today, ctx), to = fill(s.to || s.from || d.today, ctx); return { text: await listCalendarEventsText(env, from, to), summary: `calendar ${from}..${to}` }; }
    case 'timers': return { text: await listTimers(env), summary: 'timers' };
    case 'todos': { const todos = (await getTodos(env)).filter(t => !t.done); const olderDays = Number(s.olderThanDays) || 0; const now = Date.now(); const rows = todos.filter(t => !olderDays || (now - Date.parse(t.created)) / 86400000 >= olderDays).map(t => `- ${t.text} (added ${String(t.created).slice(0, 10)})`); return { text: rows.length ? rows.join('\n') : `no open to-dos${olderDays ? ` older than ${olderDays} days` : ''}`, summary: `${rows.length} to-dos` }; }
    case 'activity': { const log = await getAutonomyLog(env); const n = Math.min(Number(s.n) || 12, 40); const rows = log.slice(-n).filter(e => e.persona !== 'hela').map(e => `${String(e.time).slice(0, 16).replace('T', ' ')} ${e.persona}${e.councillor ? '/' + e.councillor : ''}: ${e.summary}`); return { text: rows.join('\n') || 'nothing in the log', summary: `${rows.length} log lines` }; }
    case 'memory': return { text: await getRecentMemoryBlock(env, s.persona && s.persona !== 'hela' ? s.persona : owner), summary: 'recent memory' };
    case 'council': { const c = await getCouncilStatus(env); const rows = Object.entries(c.councils).flatMap(([g, list]) => list.map(x => `${g}/${x.name}: ${x.runs} runs, last ${x.lastRun ? x.lastRun.slice(0, 16).replace('T', ' ') : 'never'}${x.lastSummary ? ' — ' + x.lastSummary.slice(0, 80) : ''}`)); return { text: rows.join('\n'), summary: 'council status' }; }
    case 'health': { const h = await healthReport(env); const paper = h.paper ? `paper P&L all-time ${h.paper.allTimePnl >= 0 ? '+' : '-'}$${Math.abs(h.paper.allTimePnl).toFixed(2)}, today ${h.paper.todayPnl >= 0 ? '+' : '-'}$${Math.abs(h.paper.todayPnl).toFixed(2)}` : 'paper: unavailable'; return { text: [`KV writes by the upgrade today: ${h.kv.upgradeWritesToday} of ${h.kv.upgradeCeiling} (account-wide: ${typeof h.kv.account === 'string' ? h.kv.account : JSON.stringify(h.kv.account)})`, `model spend: ${h.modelSpend}`, `extension: ${h.extension.online ? 'online' : 'offline'}`, `missing secrets: ${h.secrets.missing.join(', ') || 'none'}`, `optional not set: ${h.secrets.optionalMissing.join(', ') || 'none'}`, `problems: ${h.problems.join('; ') || 'none'}`, paper].join('\n'), summary: 'health' }; }
    case 'paper': { const period = s.period || 'today'; return { text: await getPaperSummaryText(env, period), summary: `paper ${period}` }; }
    case 'conversations': {
      // today's turns from the named gods' web + private Telegram chats, text only, never Hela's
      const gods = (Array.isArray(s.personas) ? s.personas : ['thor', 'loki', 'odin']).filter(p => p !== 'hela' && PERSONAS[p]);
      const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
      const out = [];
      for (const g of gods) {
        const keys = [historyKeyFor(g, 'web')]; if (chatId) keys.push(historyKeyFor(g, 'telegram', chatId));
        for (const k of keys) { const { turns } = await loadConversation(env, k); const text = turns.filter(t => typeof t.content === 'string').slice(-16).map(t => `${t.role === 'user' ? 'Rayan' : g.toUpperCase()}: ${t.content.slice(0, 300)}`).join('\n'); if (text) out.push(`[${k}]\n${text}`); }
      }
      return { text: out.join('\n\n').slice(0, 9000) || 'no conversations today', summary: `${out.length} conversations` };
    }
    default: return { text: '', summary: 'unknown read' };
  }
}

// ---- run one routine ----------------------------------------------------------
export async function runRoutine(env, routine, event, execute) {
  const owner = routine.owner;
  const ctx = { steps: [], event: event || null, date: dateCtx() };
  const t0 = Date.now();
  const run = { at: new Date().toISOString(), event: event ? event.event : null, steps: [], ok: true };
  let writes = 0;
  let lastText = '';
  for (const [i, raw] of routine.steps.entries()) {
    const s = fill(raw, ctx);
    let res;
    try {
      if (s.tool) {
        if (needsApproval(s.tool)) {
          const ap = await createApproval(env, { persona: owner, tool: s.tool, input: s.args || {}, tainted: false, sources: [], provenance: `routine "${routine.name}"${event ? ` on event ${event.event}` : ' (scheduled)'}`, channel: 'routine' });
          writes += 1; res = { text: ap.ok ? `queued for Rayan's approval (#${ap.id})` : `could not queue: ${ap.error}`, summary: `approval ${ap.ok ? ap.id : 'failed'}` };
        } else {
          if (IRREVERSIBLE_TOOLS.has(s.tool)) {
            const c = await critic(env, routine, `${s.tool} ${JSON.stringify(s.args || {})}`, event);
            if (!c.ok) { const ap = await createApproval(env, { persona: owner, tool: s.tool, input: s.args || {}, tainted: false, sources: [], provenance: `routine "${routine.name}" — critic said: ${c.why}`, channel: 'routine' }); writes += 1; res = { text: `held for approval (#${ap.id}): ${c.why}`, summary: 'critic held it' }; ctx.steps.push(res); run.steps.push({ i, kind: s.tool, summary: res.summary }); continue; }
          }
          const out = await execute(env, s.tool, s.args || {}, owner);
          const text = typeof out === 'string' ? out : JSON.stringify(out);
          res = { text, summary: `${s.tool}: ${text.slice(0, 60)}` };
        }
      } else if (s.delegate) {
        const cid = String(s.delegate.councillor).toLowerCase().replace(/[\s-]+/g, '_');
        const r = await runCouncillor(env, cid, s.delegate.task, {});
        await recordCouncilRun(env, cid, { summary: `Routine "${routine.name}": ${String(s.delegate.task).slice(0, 60)}`, detail: r.summary, didSomething: (r.actions || []).length > 0, patch: { lastRoutine: routine.id } });
        if ((r.actions || []).length) writes += 1;
        res = { text: r.summary, summary: `${COUNCIL[cid].name}: ${r.summary.slice(0, 60)}`, ok: r.ok };
        if (!r.ok) throw new Error(r.summary);
      } else if (s.compose) {
        const model = s.compose.tier === 'cheap' ? MODELS.haiku : MODELS.sonnet;
        const system = getPersona(owner).systemPrompt;
        const user = `[ROUTINE "${routine.name}" — you are composing, not chatting. Everything below is real data from your own tools; do not invent anything beyond it. Plain text only, no markdown. If there is genuinely nothing worth saying, reply with exactly NOTHING.]\n\n${s.compose.instruction}\n\nRESULTS SO FAR:\n${ctx.steps.map((st, k) => `[step ${k}] ${String(st.text).slice(0, 2500)}`).join('\n\n')}`;
        const r = await callAnthropicSimple(env, system, user, s.compose.maxTokens || 700, model);
        if (!r.ok) throw new Error(r.error);
        res = { text: r.text.trim(), summary: `composed ${r.text.trim().slice(0, 60)}` };
      } else if (s.read) {
        res = await readStep(env, s, owner, ctx);
      } else if (s.memory_append) {
        const persona = s.memory_append.persona && s.memory_append.persona !== 'hela' ? s.memory_append.persona : owner;
        const text = String(s.memory_append.text || '').trim();
        if (!text || /^NOTHING$/i.test(text)) res = { text: 'nothing to append', summary: 'nothing to append' };
        else {
          const c = await critic(env, routine, `append to ${persona}'s long-term memory: ${text.slice(0, 500)}`, event);
          if (!c.ok) { const ap = await createApproval(env, { persona: owner, tool: 'remember_this', input: { fact: text }, tainted: false, sources: [], provenance: `routine "${routine.name}" — critic said: ${c.why}`, channel: 'routine' }); writes += 1; res = { text: `held for approval (#${ap.id}): ${c.why}`, summary: 'critic held it' }; }
          else { await addLongTermMemory(env, text, persona, null, provenance(`routine:${routine.id}`, persona, 'trusted-tool')); writes += 2; res = { text: 'appended to memory', summary: 'memory appended' }; }
        }
      } else if (typeof s.say === 'string') {
        res = { text: s.say, summary: s.say.slice(0, 60) };
      } else throw new Error(`unknown step ${i + 1}`);
    } catch (err) {
      run.ok = false; run.error = `step ${i + 1}: ${err && err.message ? err.message : String(err)}`;
      run.steps.push({ i, error: run.error });
      break;
    }
    ctx.steps.push(res);
    run.steps.push({ i, summary: res.summary });
    lastText = res.text || lastText;
  }
  run.ms = Date.now() - t0;
  run.delivered = null;
  if (run.ok) {
    let text = String(lastText || '').trim();
    const skip = !text || /^NOTHING\.?$/i.test(text);
    if (!skip && routine.deliver !== 'silent') {
      if (routine.intro) text = `${text}\n\n(This is the "${routine.name}" routine, running on its own. Say "${getPersona(owner).name}, pause ${routine.name.toLowerCase()}" to stop it.)`;
      run.delivered = await deliver(env, owner, routine.deliver, text, routine);
      if (run.delivered === 'speak') writes += 1;
    } else run.delivered = skip ? 'nothing to deliver' : 'silent';
  }
  run.writes = writes;
  return run;
}

async function deliver(env, owner, how, text, routine) {
  const god = getPersona(owner).name;
  if (how === 'notify') { await notify(env, { source: owner, priority: 'normal', title: `${god} — ${routine.name}`, body: text.slice(0, 1500), dedupeKey: `routine:${routine.id}:${Date.now()}`, cooldownMinutes: 0 }); return 'notify'; }
  if (how === 'speak') {
    // spoken next time the hall opens: rides in the god's web conversation object
    const key = historyKeyFor(owner, 'web');
    const c = await loadConversation(env, key);
    c.meta.pendingSpeech = [...(c.meta.pendingSpeech || []), { at: new Date().toISOString(), routine: routine.name, text: text.slice(0, 1200) }].slice(-5);
    await saveConversation(env, key, c.turns, c.meta);
    return 'speak';
  }
  const chatId = await getRayanPrivateChatId(env);
  const token = getPersonaBotToken(env, owner) || env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return 'telegram: no chat/bot';
  const r = await sendTelegramMessage(env, chatId, text.slice(0, 3900), token);
  return r && r.ok ? 'telegram' : `telegram failed: ${r && r.description}`;
}

// ---- the runner (3.3) ----------------------------------------------------------
export async function runRoutinesIfDue(env, events, execute) {
  const index = await readIndex(env);
  if (!index.length) return { ran: 0 };
  const last = await readTickLast(env);
  const today = new Date().toISOString().slice(0, 10);
  let today_runs = last.routineRunsDay === today ? (last.routineRunsToday || 0) : 0;
  let ran = 0; const results = [];
  for (const entry of index) {
    if (ran >= MAX_PER_TICK) { results.push({ id: entry.id, skipped: 'per-tick cap; rolls forward' }); continue; }
    if (entry.enabled === false || entry.deleted) continue;
    const r = await readRoutine(env, entry.id);
    if (!r || r.enabled === false || r.deleted) continue;
    let fired = null;
    if (r.trigger.kind === 'event') { fired = (events || []).find(ev => eventMatches(r.trigger, ev)) || null; if (!fired) continue; }
    else {
      let trig = r.trigger;
      if (trig.atFromConfig) { const v = await env.RAYVEN_KV.get(trig.atFromConfig.key); const hour = v !== null && v !== '' ? parseInt(v, 10) : null; trig = { ...trig, at: hour != null && hour >= 0 && hour <= 23 ? `${String(hour).padStart(2, '0')}:${(trig.atFromConfig.minute || '05')}` : (trig.atFromConfig.defaultAt || trig.at) }; }
      if (!isDue(trig, r.state || {})) continue;
      if (r.onlyIf) { const v = await env.RAYVEN_KV.get(r.onlyIf.key); if (String(v) !== String(r.onlyIf.equals)) { r.state = stampRun(trig, r.state || {}); await writeRoutine(env, r); continue; } }
      r.state = stampRun(trig, r.state || {});
    }
    if (today_runs >= MAX_PER_DAY) { results.push({ id: r.id, skipped: 'daily cap' }); tickLog('notes', { routine: r.id, note: 'daily routine cap reached' }); await writeRoutine(env, r); continue; }
    const run = await runRoutine(env, r, fired, execute);
    ran++; today_runs++;
    r.runs = [...(r.runs || []), run].slice(-MAX_RUNS_KEPT);
    r.failures = run.ok ? 0 : (r.failures || 0) + 1;
    if (!run.ok && r.failures >= 3) {
      r.enabled = false; r.pausedReason = `3 failures in a row; last: ${run.error}`;
      const idx = index.find(e => e.id === r.id); if (idx) { idx.enabled = false; await writeIndex(env, index); }
      try { const chatId = await getRayanPrivateChatId(env); const token = getPersonaBotToken(env, r.owner) || env.TELEGRAM_BOT_TOKEN; if (chatId && token) await sendTelegramMessage(env, chatId, `${getPersona(r.owner).name}: I paused the "${r.name}" routine — it failed three times in a row. Last error: ${run.error}. Say "resume ${r.name}" once it is fixed.`, token); } catch (e) {}
    }
    if (r.intro && run.delivered && /^(telegram|notify|speak)$/.test(run.delivered)) r.intro = false;
    await writeRoutine(env, r);
    tickLog('autonomy', { persona: r.owner, councillor: null, summary: `Routine "${r.name}" ${run.ok ? 'ran' : 'FAILED'}${fired ? ` on ${fired.event}` : ''}: ${run.delivered || run.error || ''}`, time: run.at });
    results.push({ id: r.id, ok: run.ok, delivered: run.delivered, error: run.error });
  }
  // patchLast only when something ran -- otherwise the pointer key would be
  // rewritten on every empty tick.
  return { ran, todayRuns: today_runs, results, patchLast: ran ? { routineRunsDay: today, routineRunsToday: today_runs } : null };
}

// ---- tools -----------------------------------------------------------------------
function visibleTo(owner, entry) { return entry.owner === owner; }   // a god sees only his own; Hela hers only

function describeRoutine(r) {
  const when = r.trigger.kind === 'event' ? `when ${r.trigger.event}${r.trigger.filter ? ' ' + JSON.stringify(r.trigger.filter) : ''} happens` : describeSchedule(r.trigger.atFromConfig ? { ...r.trigger, at: r.trigger.atFromConfig.defaultAt } : r.trigger);
  const what = r.steps.map(s => s.tool ? s.tool : s.delegate ? `ask ${s.delegate.councillor}` : s.compose ? 'write it up' : s.read ? `read ${s.read}` : s.memory_append ? 'append to memory' : 'say').join(', then ');
  return `"${r.name}": ${when}, ${what}, ${r.deliver === 'telegram' ? 'send it on Telegram' : r.deliver === 'speak' ? 'say it next time the hall opens' : r.deliver === 'notify' ? 'notify' : 'silently'}.`;
}

export async function routineCreate(env, owner, input = {}) {
  const name = String(input.name || '').trim().slice(0, 60);
  if (!name) return 'A routine needs a name.';
  const trigger = input.trigger; const err1 = validateTrigger(trigger); if (err1) return `Trigger problem: ${err1}.`;
  const err2 = validateSteps(input.steps, owner); if (err2) return `Step problem: ${err2}.`;
  const deliver = DELIVERIES.includes(input.deliver) ? input.deliver : 'telegram';
  const r = { id: `${owner}-${slug(name)}-${Date.now().toString(36).slice(-4)}`, owner, name, intent: String(input.intent || name).slice(0, 300), trigger, steps: input.steps, deliver, enabled: true, createdBy: 'rayan', createdAt: new Date().toISOString(), runs: [], state: {}, failures: 0 };
  if (!input.confirmed) return `Read this back to Rayan before saving — ${describeRoutine(r)} If he agrees, call routine_create again with the same fields and confirmed: true.`;
  const index = await readIndex(env);
  if (index.filter(e => !e.deleted).length >= 40) return 'Forty routines is the ceiling. Delete one first.';
  await writeRoutine(env, r);
  index.push({ id: r.id, name: r.name, owner, enabled: true });
  await writeIndex(env, index);
  return `Saved. ${describeRoutine(r)} It runs on the next tick it is due (within five minutes of the time).`;
}

export async function routineList(env, owner) {
  const index = (await readIndex(env)).filter(e => visibleTo(owner, e) && !e.deleted);
  if (!index.length) return 'No routines yet. Describe one and I will set it up.';
  const rows = [];
  for (const e of index) { const r = await readRoutine(env, e.id); if (!r) continue; const lastRun = (r.runs || []).slice(-1)[0]; rows.push(`${r.enabled ? '●' : '○'} ${describeRoutine(r)}${lastRun ? ` Last run ${lastRun.at.slice(0, 16).replace('T', ' ')} ${lastRun.ok ? 'ok' : 'FAILED'}.` : ' Not run yet.'}${r.pausedReason ? ` PAUSED: ${r.pausedReason}` : ''}`); }
  return rows.join('\n');
}

async function findMine(env, owner, match) {
  const index = (await readIndex(env)).filter(e => visibleTo(owner, e) && !e.deleted);
  const m = String(match || '').toLowerCase().trim();
  const hit = index.find(e => e.id === m) || index.find(e => e.name.toLowerCase() === m) || index.find(e => e.name.toLowerCase().includes(m));
  return { index, hit };
}

async function setEnabled(env, owner, match, enabled) {
  const { index, hit } = await findMine(env, owner, match);
  if (!hit) return `No routine matching "${match}".`;
  const r = await readRoutine(env, hit.id); if (!r) return 'That routine is missing.';
  r.enabled = enabled; if (enabled) { r.failures = 0; delete r.pausedReason; }
  hit.enabled = enabled;
  await writeRoutine(env, r); await writeIndex(env, index);
  return `${enabled ? 'Resumed' : 'Paused'} "${r.name}".`;
}
export const routinePause = (env, owner, m) => setEnabled(env, owner, m, false);
export const routineResume = (env, owner, m) => setEnabled(env, owner, m, true);

export async function routineDelete(env, owner, match) {
  const { index, hit } = await findMine(env, owner, match);
  if (!hit) return `No routine matching "${match}".`;
  const r = await readRoutine(env, hit.id);
  if (r) { r.enabled = false; r.deleted = true; r.deletedAt = new Date().toISOString(); await writeRoutine(env, r); }
  hit.enabled = false; hit.deleted = true; await writeIndex(env, index);
  return `Deleted "${hit.name}". (Its record and run history are kept, marked deleted.)`;
}

export async function routineRunNow(env, owner, match, execute) {
  const { hit } = await findMine(env, owner, match);
  if (!hit) return `No routine matching "${match}".`;
  const r = await readRoutine(env, hit.id); if (!r) return 'That routine is missing.';
  const run = await runRoutine(env, r, null, execute);
  r.runs = [...(r.runs || []), run].slice(-MAX_RUNS_KEPT);
  await writeRoutine(env, r);
  return run.ok ? `Ran "${r.name}": ${run.delivered}. ${run.steps.map(s => s.summary).filter(Boolean).slice(-2).join(' / ')}` : `"${r.name}" failed: ${run.error}`;
}

export async function routineHistory(env, owner, match) {
  const { hit } = await findMine(env, owner, match);
  if (!hit) return `No routine matching "${match}".`;
  const r = await readRoutine(env, hit.id); if (!r) return 'That routine is missing.';
  const runs = (r.runs || []).slice(-10).reverse();
  if (!runs.length) return `"${r.name}" has not run yet.`;
  return `"${r.name}" — last ${runs.length} runs:\n` + runs.map(x => `${x.at.slice(0, 16).replace('T', ' ')} ${x.ok ? 'ok' : 'FAILED ' + (x.error || '')}${x.event ? ` on ${x.event}` : ''} → ${x.delivered || ''} (${x.ms} ms)`).join('\n');
}

// ROUTINE_TOOL_DEFINITIONS lives in routineTools.js (no imports) so tools.js
// can append it at evaluation time without an import cycle.


// ---- 3.4 the pre-built routines -------------------------------------------------
// Seeded once (by fixed id) if missing. All enabled; each says so in its first
// message. The "while you were away" recap is built into the wake greeting
// (index.js) rather than stored here, because it has to be spoken in the same
// request the hall opens with.
const SEEDS = [
  { id: 'loki-morning-brief-weekday', owner: 'loki', name: 'Morning brief', intent: 'the weekday morning brief: calendar, reminders, weather/air/FX, stale to-dos, one headline', trigger: { kind: 'schedule', at: '07:00', days: [1, 2, 3, 4, 5], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'calendar', from: '$date.today', to: '$date.today' }, { read: 'timers' }, { delegate: { councillor: 'sylvie', task: 'Morning readout for Bakersfield, California: today\'s weather in two lines, the air quality in one, and the EUR to USD rate in one. Numbers from tools only.' } }, { read: 'todos', olderThanDays: 3 }, { delegate: { councillor: 'hunter_b15', task: 'One headline from the last 24 hours that a solo builder running AI assistants on Cloudflare and paper-trading would want to know, one line with the source.' } }, { compose: { instruction: 'Write Rayan\'s morning brief for $date.today: today\'s calendar (from step 0), timers due (step 1), Sylvie\'s weather/air/FX (step 2), to-dos that have sat three days or more (step 3 — needle him about them, once), and Hunter\'s headline (step 4). Your register, tight, no filler. If a section has nothing, skip it.', tier: 'owner' } }] },
  { id: 'loki-morning-brief-weekend', owner: 'loki', name: 'Weekend brief', intent: 'the weekend morning brief', trigger: { kind: 'schedule', at: '09:00', days: [0, 6], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'calendar', from: '$date.today', to: '$date.today' }, { delegate: { councillor: 'sylvie', task: 'Weekend readout for Bakersfield, California: today\'s weather in two lines, the air quality in one, and the EUR to USD rate in one. Numbers from tools only.' } }, { read: 'todos', olderThanDays: 3 }, { delegate: { councillor: 'hunter_b15', task: 'One headline from the last 24 hours worth a solo builder\'s attention, one line with the source.' } }, { compose: { instruction: 'Write Rayan\'s weekend brief for $date.today from steps 0-3, shorter than a weekday one. Your register.', tier: 'owner' } }] },
  { id: 'loki-evening-glance', owner: 'loki', name: 'Tomorrow at a glance', intent: 'the 21:00 look at tomorrow', trigger: { kind: 'schedule', at: '21:00', days: [0, 1, 2, 3, 4, 5, 6], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'calendar', from: '$date.tomorrow', to: '$date.tomorrow' }, { read: 'todos' }, { compose: { instruction: 'Two or three sentences on tomorrow ($date.tomorrow): what is on the calendar (step 0) and the one to-do (step 1) that most deserves tomorrow. If both are empty, say NOTHING.', tier: 'cheap' } }] },
  { id: 'odin-market-open', owner: 'odin', name: 'Market-open note', intent: 'the 06:35 Pacific weekday note as the NYSE opens, paper only', trigger: { kind: 'schedule', at: '06:35', days: [1, 2, 3, 4, 5], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'paper', period: 'today' }, { compose: { instruction: 'The market is opening. In three sentences: what the PAPER book holds going in (step 0), anything open, and the running total. Label it PAPER · SIMULATED. Never a recommendation, never a real signal.', tier: 'cheap' } }] },
  { id: 'odin-market-close', owner: 'odin', name: 'Market-close report', intent: 'the market-close PAPER report; replaces the old daily paper report; honours config:paper:report:hour', trigger: { kind: 'schedule', at: '13:05', days: [1, 2, 3, 4, 5], tz: DEFAULT_TZ, atFromConfig: { key: 'config:paper:report:hour', minute: '05', defaultAt: '13:05' } }, deliver: 'telegram', intro: true,
    steps: [{ read: 'paper', period: 'today' }, { read: 'council' }, { compose: { instruction: 'The PAPER TRADING REPORT for today. Open with "PAPER · SIMULATED — no real money." Then: today\'s P&L, trades, wins/losses, win rate; what is open; the running total since start; one line per councillor that traded today (from step 1). If today was a losing day, say so plainly. Never a recommendation.', tier: 'cheap' } }] },
  { id: 'odin-state-of-realm', owner: 'odin', name: 'State of the realm', intent: 'the Sunday 17:00 report: paper P&L by councillor, KV writes, model spend, what is waiting on Rayan', trigger: { kind: 'schedule', at: '17:00', days: [0], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'paper', period: 'week' }, { read: 'council' }, { read: 'health' }, { compose: { instruction: 'STATE OF THE REALM, Sunday. Sections in prose, no markdown: the PAPER week by councillor (steps 0 and 1; label PAPER · SIMULATED); the house — KV writes today vs the cap and model spend (step 2; say "model spend: not tracked yet" if that is what it says); what is waiting on Rayan — missing secrets by NAME, plans, and the Ayrshare situation reported only (step 2). Measured, no padding.', tier: 'owner' } }] },
  { id: 'thor-jane-world-note', owner: 'thor', name: 'World note', intent: 'Jane\'s Sunday 18:00 note on what changed this week in the subjects Rayan\'s memory shows he cares about', trigger: { kind: 'schedule', at: '18:00', days: [0], tz: DEFAULT_TZ }, deliver: 'telegram', intro: true,
    steps: [{ read: 'memory', persona: 'thor' }, { delegate: { councillor: 'jane_foster', task: 'From these recent memories, pick the three subjects Rayan clearly cares about most, and for each find what actually changed THIS WEEK (search the news). Report three short paragraphs, each with a source. If a subject had no real news, say so in one line.\n\nMEMORIES:\n$steps[0].text' } }, { compose: { instruction: 'Relay Jane\'s world note (step 1) in your own voice, four or five sentences, no headings.', tier: 'cheap' } }] },
  { id: 'thor-darcy-hygiene', owner: 'thor', name: 'Memory hygiene', intent: 'Darcy\'s 03:00 pass: read the day\'s conversations with Thor, Loki and Odin (never Hela) and APPEND a dated summary to long-term memory; never remove anything', trigger: { kind: 'schedule', at: '03:00', days: [0, 1, 2, 3, 4, 5, 6], tz: DEFAULT_TZ }, deliver: 'silent', intro: false,
    steps: [{ read: 'conversations', personas: ['thor', 'loki', 'odin'] }, { compose: { instruction: 'From the day\'s conversations (step 0), write ONE dated line for long-term memory beginning "Day summary $date.today:" — decisions, plans, preferences and facts worth keeping, third person ("Rayan ..."), at most 60 words. If nothing durable was said, reply NOTHING.', tier: 'cheap' } }, { memory_append: { persona: 'thor', text: '$steps[1].text' } }] },
  { id: 'hela-gorr-weekly', owner: 'hela', hidden: true, name: 'Capability audit', intent: 'Gorr\'s weekly test of Hela\'s saved capabilities; flags broken ones, deletes nothing', trigger: { kind: 'schedule', at: '02:00', days: [0], tz: DEFAULT_TZ }, onlyIf: { key: 'hela:locked', equals: '1' }, deliver: 'silent', intro: false,
    steps: [{ delegate: { councillor: 'gorr', task: 'Test every saved capability with use_capability using sensible sample arguments. For each, report name, whether it answered, and the exact error if not. Then call flag_capability for each broken one with that error. Never forget or delete anything.' } }] }
];

export async function seedRoutinesIfMissing(env) {
  const index = await readIndex(env);
  const missing = SEEDS.filter(s => !index.some(e => e.id === s.id));
  if (!missing.length) return 0;
  for (const s of missing) {
    const r = { ...s, enabled: true, createdBy: 'asgard-upgrade 3.4', createdAt: new Date().toISOString(), runs: [], state: {}, failures: 0 };
    await writeRoutine(env, r);
    index.push({ id: r.id, name: r.name, owner: r.owner, enabled: true });
  }
  await writeIndex(env, index);
  return missing.length;
}

// Phase 5.1: the vault export reads routines raw.
export { readIndex as readRoutinesIndex, readRoutine as readRoutineRaw };
