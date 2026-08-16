// Per-persona autonomy — each persona does real work on a schedule, capped
// (~3/day each), writing to a visible log ('agent:autonomy:log', same capped-KV
// pattern as agent:log/activity:log). Also owns the live status strip data
// (status:<personaId> keys) that the ops floor and status strip read via
// GET /status, and the nag engine: overdue to-dos escalate rather than repeat
// identically. Runs off the same 5-minute cron as everything else, deciding for
// itself whether each persona's job is actually due (the standard "check my own
// KV state" pattern).
import { PERSONAS, ALL_PERSONA_IDS, getPersonaVoiceId } from './personas.js';
import { appendCappedLog, readCappedLog } from './util.js';
import { getTodos } from './kv-store.js';
import { getContentIdeas } from './kv-store.js';
import { notify } from './notifications.js';
import { callAnthropicSimple } from './anthropic.js';
import { addLongTermMemory, getRecentMemoryBlock } from './memory.js';

const AUTONOMY_LOG_KEY = 'agent:autonomy:log';
const AUTONOMY_LOG_CAP = 200;
const MAX_RUNS_PER_DAY = 3;
const MIN_GAP_MS = 3.5 * 60 * 60 * 1000; // ≥3.5h between runs per persona

// ---- live status strip ----

export async function setPersonaStatus(env, personaId, task, progress = null, eta = null) {
  try {
    await env.RAYVEN_KV.put(`status:${personaId}`, JSON.stringify({
      personaId, task, progress, eta, at: new Date().toISOString()
    }), { expirationTtl: 6 * 3600 });
  } catch (e) {}
}

export async function getAllStatuses(env) {
  // One round trip instead of one per persona — the frontend polls this.
  const raws = await Promise.all(ALL_PERSONA_IDS.map(id => env.RAYVEN_KV.get(`status:${id}`)));
  const statuses = {};
  ALL_PERSONA_IDS.forEach((id, i) => {
    let status = null;
    try { status = raws[i] ? JSON.parse(raws[i]) : null; } catch (e) {}
    statuses[id] = status || { personaId: id, task: 'idle', progress: null, eta: null, at: null };
  });
  return statuses;
}

export async function getAutonomyLog(env) {
  return await readCappedLog(env, AUTONOMY_LOG_KEY);
}

async function logAutonomy(env, personaId, summary, detail) {
  await appendCappedLog(env, AUTONOMY_LOG_KEY, {
    time: new Date().toISOString(), persona: personaId, summary, detail: detail || null
  }, AUTONOMY_LOG_CAP);
}

// ---- scheduling ----

function todayStamp() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

function pacificHour() {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(new Date()), 10);
}

async function personaIsDue(env, personaId) {
  const hour = pacificHour();
  if (hour < 9 || hour >= 21) return false; // daytime only
  const raw = await env.RAYVEN_KV.get(`autonomy:${personaId}:state`);
  let state = { day: null, count: 0, lastRun: 0 };
  try { if (raw) state = JSON.parse(raw); } catch (e) {}
  const today = todayStamp();
  if (state.day !== today) { state.day = today; state.count = 0; }
  if (state.count >= MAX_RUNS_PER_DAY) return false;
  if (Date.now() - state.lastRun < MIN_GAP_MS) return false;
  state.count += 1;
  state.lastRun = Date.now();
  await env.RAYVEN_KV.put(`autonomy:${personaId}:state`, JSON.stringify(state));
  return true;
}

export async function runPersonaAutonomyIfDue(env) {
  const results = {};
  for (const personaId of ALL_PERSONA_IDS) {
    try {
      const job = AUTONOMY_JOBS[personaId];
      if (!job) { results[personaId] = 'no autonomy job defined'; continue; }
      if (!(await personaIsDue(env, personaId))) { results[personaId] = 'not due'; continue; }
      results[personaId] = await job(env);
    } catch (err) {
      results[personaId] = `error: ${err.message}`;
      await logAutonomy(env, personaId, `Autonomy run failed: ${err.message}`);
    } finally {
      await setPersonaStatus(env, personaId, 'idle');
    }
  }
  return results;
}

// ---- the jobs (keyed by persona id — derived list, never hand-written) ----

// LOKI: the nag engine. Overdue items escalate rather than repeat identically —
// dedupeKey carries the escalation level so each level fires exactly once.
async function runLokiSweep(env) {
  await setPersonaStatus(env, 'loki', 'sweeping the task ledger for overdue items', 0.3, '~1 min');
  const todos = (await getTodos(env)).filter(t => !t.done);
  const now = Date.now();
  let nagged = 0;
  for (const todo of todos) {
    const ageDays = (now - new Date(todo.created).getTime()) / 86400000;
    let level = null, tone = null;
    if (ageDays >= 7) { level = 3; tone = `Day ${Math.floor(ageDays)}. "${todo.text}" is now officially a lifestyle, not a task. Shall we finally end it?`; }
    else if (ageDays >= 4) { level = 2; tone = `"${todo.text}" has been sitting for ${Math.floor(ageDays)} days. I've seen glaciers with more momentum. Want a hand?`; }
    else if (ageDays >= 2) { level = 1; tone = `Gentle poke: "${todo.text}" is still open (day ${Math.floor(ageDays)}).`; }
    if (level) {
      const result = await notify(env, {
        source: 'loki',
        priority: level >= 3 ? 'high' : 'normal',
        title: 'LOKI — overdue item',
        body: tone,
        dedupeKey: `loki:nag:${todo.id}:level${level}`,
        cooldownMinutes: 60 * 24
      });
      if (result && (result.sent || result.reason === 'queued_for_digest')) nagged++;
    }
  }
  const summary = todos.length
    ? `Nag sweep: ${todos.length} open item(s), ${nagged} escalation(s) queued.`
    : 'Nag sweep: ledger clean, nothing to needle.';
  await logAutonomy(env, 'loki', summary);
  return summary;
}

// ODIN: a strategy pulse — reads the content queue + his own memory and, when
// there's substance, distills one strategic nudge into the digest and his memory.
async function runOdinPulse(env) {
  await setPersonaStatus(env, 'odin', 'weighing the content queue and market position', 0.4, '~1 min');
  const ideas = await getContentIdeas(env);
  const memBlock = await getRecentMemoryBlock(env, 'odin');
  if (!ideas.length && memBlock.includes('currently empty')) {
    const summary = 'Strategy pulse: no content queue and no standing context — held counsel.';
    await logAutonomy(env, 'odin', summary);
    return summary;
  }
  const ideaText = ideas.slice(-15).map(i => `[${i.platform}] ${i.idea}`).join('\n') || '(queue empty)';
  const res = await callAnthropicSimple(env,
    PERSONAS.odin.systemPrompt,
    `Autonomous strategy pulse (no one asked — this is your scheduled counsel). Content idea queue:\n${ideaText}\n\nYour recent memory:\n${memBlock}\n\nGive ONE concrete, non-obvious strategic observation or move for Rayan's clipping business, in your own register, 2-3 sentences. If there is genuinely nothing worth saying, reply exactly: HOLD.`,
    300);
  if (!res.ok) { await logAutonomy(env, 'odin', `Strategy pulse failed: ${res.error}`); return res.error; }
  const counsel = res.text.trim();
  if (counsel === 'HOLD' || counsel.startsWith('HOLD')) {
    await logAutonomy(env, 'odin', 'Strategy pulse: nothing worth saying — held counsel.');
    return 'held';
  }
  await notify(env, {
    source: 'odin', priority: 'low',
    title: 'ODIN — counsel', body: counsel,
    dedupeKey: `odin:pulse:${todayStamp()}`
  });
  await addLongTermMemory(env, `Strategy counsel I gave on ${todayStamp()}: ${counsel}`, 'odin');
  await logAutonomy(env, 'odin', 'Strategy pulse delivered.', counsel);
  return counsel;
}

// THOR: the self-check — exercise every integration with a REAL call, not a
// presence test ("secret is set" ≠ "secret works"; an if(env.KEY) check reports
// green while every call 401s).
export async function runThorSelfCheck(env) {
  await setPersonaStatus(env, 'thor', 'probing live integrations with real calls', 0.2, '~2 min');
  const probes = [];

  // Anthropic — a real 1-token message call.
  try {
    const res = await callAnthropicSimple(env, 'Reply with the single word OK.', 'ping', 5);
    probes.push({ name: 'Anthropic', ok: res.ok, detail: res.ok ? 'live' : res.error });
  } catch (e) { probes.push({ name: 'Anthropic', ok: false, detail: e.message }); }

  // Telegram — a real getMe against the live bot token.
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await res.json().catch(() => ({ ok: false }));
    probes.push({ name: 'Telegram', ok: !!data.ok, detail: data.ok ? `@${data.result.username}` : `HTTP ${res.status}` });
  } catch (e) { probes.push({ name: 'Telegram', ok: false, detail: e.message }); }

  // ElevenLabs — probe the exact capability the system uses: a 1-character TTS
  // render. Keys are permission-scoped, so listing endpoints 401 even when TTS
  // works; only a real synthesis call proves the voice path is alive.
  try {
    const voiceId = getPersonaVoiceId(env, 'thor');
    if (!env.ELEVENLABS_API_KEY || !voiceId) {
      probes.push({ name: 'ElevenLabs', ok: false, detail: 'missing key or voice id' });
    } else {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ text: '.', model_id: 'eleven_turbo_v2_5' })
      });
      probes.push({ name: 'ElevenLabs', ok: res.ok, detail: res.ok ? 'TTS live' : `HTTP ${res.status}` });
      if (res.ok && res.body) { try { await res.body.cancel(); } catch (e) {} }
    }
  } catch (e) { probes.push({ name: 'ElevenLabs', ok: false, detail: e.message }); }

  // Workers AI embedding — a real embed call (memory search depends on it).
  try {
    const r = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: ['ping'] });
    probes.push({ name: 'Workers AI', ok: !!(r && r.data && r.data[0]), detail: 'embedding live' });
  } catch (e) { probes.push({ name: 'Workers AI', ok: false, detail: e.message }); }

  const failures = probes.filter(p => !p.ok);
  const summary = failures.length
    ? `Self-check: ${failures.length} integration(s) DOWN — ${failures.map(f => `${f.name} (${f.detail})`).join('; ')}`
    : `Self-check: all ${probes.length} probed integrations answered live.`;
  if (failures.length) {
    await notify(env, {
      source: 'thor', priority: 'high',
      title: 'THOR — integration failure', body: summary,
      dedupeKey: `thor:selfcheck:${failures.map(f => f.name).join(',')}`,
      cooldownMinutes: 240
    });
  }
  await logAutonomy(env, 'thor', summary, JSON.stringify(probes));
  return summary;
}

const AUTONOMY_JOBS = {
  thor: runThorSelfCheck,
  loki: runLokiSweep,
  odin: runOdinPulse
};
