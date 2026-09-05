// ---------------------------------------------------------------------------
// HEALTH (asgard-upgrade Phase 3.4 SYSTEM duty + GET /healthz)
// ---------------------------------------------------------------------------
// Owned by THOR, tier free, reports to Rayan's private Telegram only when
// something is wrong. Every 30 minutes:
//   - webhooks for all four bots via getWebhookInfo. The correct host is the
//     wrangler var TELEGRAM_WEBHOOK_HOST -- never derived from a request URL.
//     A wrong one is re-set at most once per bot per day and Rayan is told.
//     HELA's webhook is checked and NEVER set.
//   - extension last-poll age (the throttled heartbeat)
//   - KV writes today: the upgrade's own counter (tick:last) always; the
//     account-wide figure only if CF_ANALYTICS_TOKEN + CF_ACCOUNT_ID exist
//   - presence of every secret NAME the code needs (names, never values)
// State key system:health, written only when the set of problems changes.
import { ALL_PERSONA_IDS, PERSONAS, getPersonaBotToken, DEFAULT_PERSONA_ID } from './personas.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { readTickLast, WRITE_CEILING_PER_DAY, noteWrites, tickLog } from './tick.js';
import { getAllStatuses } from './autonomy.js';
import { getPaperStatus } from './paperTrading.js';
import { visibleCouncil } from './council.js';

const STATE_KEY = 'system:health';

// Names only. A misnamed secret (ELEVENLABS_VOICE_ID_THOR_ with a trailing
// underscore) once broke Thor's voice; this catches that class of mistake.
export const REQUIRED_SECRETS = [
  'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN_LOKI', 'TELEGRAM_BOT_TOKEN_ODIN', 'TELEGRAM_WEBHOOK_SECRET',
  'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID_THOR', 'ELEVENLABS_VOICE_ID_LOKI', 'ELEVENLABS_VOICE_ID_ODIN',
  'DEBUG_SECRET', 'ADMIN_TOKEN', 'SERPAPI_KEY', 'TAVILY_API_KEY', 'GOOGLE_MAPS_API_KEY',
  'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
  'TWELVE_DATA_API_KEY', 'AGENT_KEY_JARVIS_RAYVEN', 'AGENT_KEY_RAYVEN_KEVOS'
];
export const OPTIONAL_SECRETS = ['OPENROUTER_API_KEY', 'JARVIS_AGENT_URL', 'KEVOS_AGENT_URL', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_VOICE_ID_HELA', 'TELEGRAM_BOT_TOKEN_HELA', 'TELEGRAM_BOT_TOKEN_THOR', 'AYRSHARE_API_KEY', 'UPLOAD_POST_API_KEY', 'VIZARD_API_KEY', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'CF_ANALYTICS_TOKEN', 'CF_ACCOUNT_ID'];

export function webhookHost(env) {
  return String(env.TELEGRAM_WEBHOOK_HOST || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
}

async function readState(env) { try { const raw = await env.RAYVEN_KV.get(STATE_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }

async function checkWebhooks(env, state, { fix = false } = {}) {
  const host = webhookHost(env);
  const out = {}; const problems = []; const fixed = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ALL_PERSONA_IDS) {
    const token = getPersonaBotToken(env, id);
    const expected = id === DEFAULT_PERSONA_ID ? `${host}/` : `${host}/telegram/${id}`;
    if (!token) { out[id] = { configured: false }; continue; }
    try {
      const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
      const r = info.result || {};
      const entry = { configured: true, url: r.url || '', expected, matches: (r.url || '') === expected, pending: r.pending_update_count || 0, lastError: r.last_error_message || null, lastErrorAt: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : null };
      if (PERSONAS[id].hidden) { entry.expected = '(unregistered on purpose)'; entry.matches = !r.url; if (r.url) problems.push(`${id}: webhook is registered and should not be`); }
      else if (!entry.matches) {
        problems.push(`${id}: webhook points at ${entry.url || 'nothing'}`);
        const fixedToday = (state.webhookFixed || {})[id] === today;
        if (fix && !fixedToday) {
          const setUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(expected)}` + (env.TELEGRAM_WEBHOOK_SECRET ? `&secret_token=${encodeURIComponent(env.TELEGRAM_WEBHOOK_SECRET)}` : '');
          const res = await (await fetch(setUrl)).json().catch(() => ({}));
          entry.reset = !!res.ok; entry.telegramSaid = res.description || null;
          if (res.ok) fixed.push(id);
        }
      }
      out[id] = entry;
    } catch (err) { out[id] = { configured: true, error: err.message }; problems.push(`${id}: ${err.message}`); }
  }
  return { bots: out, problems, fixed };
}

async function kvUsage(env) {
  const last = await readTickLast(env);
  const today = new Date().toISOString().slice(0, 10);
  const upgradeWrites = last.day === today ? (last.writesToday || 0) : 0;
  const base = { upgradeWritesToday: upgradeWrites, upgradeCeiling: WRITE_CEILING_PER_DAY, upgradePct: Math.round(upgradeWrites / WRITE_CEILING_PER_DAY * 100) };
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return { ...base, account: 'unavailable (set CF_ANALYTICS_TOKEN + CF_ACCOUNT_ID to enable)' };
  try {
    const q = `{ viewer { accounts(filter:{accountTag:"${env.CF_ACCOUNT_ID}"}) { kvOperationsAdaptiveGroups(limit:20, filter:{date:"${today}"}) { sum { requests } dimensions { actionType } } } } }`;
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) });
    const j = await r.json();
    const rows = j.data.viewer.accounts[0].kvOperationsAdaptiveGroups;
    const account = {}; for (const row of rows) account[row.dimensions.actionType] = row.sum.requests;
    return { ...base, account };
  } catch (e) { return { ...base, account: `unavailable (${e.message})` }; }
}

export async function healthReport(env, { fixWebhooks = false } = {}) {
  const state = await readState(env);
  const [webhooks, kv, statuses, paper] = await Promise.all([checkWebhooks(env, state, { fix: fixWebhooks }), kvUsage(env), getAllStatuses(env).catch(() => ({})), getPaperStatus(env).catch(() => null)]);
  let lastPoll = null; try { const raw = await env.RAYVEN_KV.get('browser:lastpoll'); lastPoll = raw ? parseInt(raw, 10) : null; } catch (e) {}
  const extensionAgeMin = lastPoll ? Math.round((Date.now() - lastPoll) / 60000) : null;
  const missing = REQUIRED_SECRETS.filter(n => !env[n]);
  const optionalMissing = OPTIONAL_SECRETS.filter(n => !env[n]);
  const problems = [...webhooks.problems];
  if (missing.length) problems.push(`missing secrets: ${missing.join(', ')}`);
  if (extensionAgeMin == null || extensionAgeMin > 10) problems.push(`extension offline (${extensionAgeMin == null ? 'never polled' : extensionAgeMin + ' min'})`);
  if (kv.upgradePct >= 70) problems.push(`upgrade KV writes at ${kv.upgradePct}% of the daily ceiling`);
  const godsAwake = Object.values(statuses).filter(s => s && s.task && s.task !== 'idle').length;
  return {
    checkedAt: new Date().toISOString(), webhookHost: webhookHost(env), webhooks: webhooks.bots, webhooksFixed: webhooks.fixed,
    extension: { lastPoll: lastPoll ? new Date(lastPoll).toISOString() : null, ageMinutes: extensionAgeMin, online: !!(extensionAgeMin != null && extensionAgeMin <= 10) },
    kv, secrets: { required: REQUIRED_SECRETS.length, missing, optionalMissing },
    gods: { visible: ALL_PERSONA_IDS.filter(id => !PERSONAS[id].hidden).length, awake: godsAwake, statuses: Object.fromEntries(Object.entries(statuses).filter(([id]) => !PERSONAS[id].hidden).map(([id, s]) => [id, s && s.task])) },
    councillors: visibleCouncil().length,
    paper: paper ? { label: paper.label, todayPnl: paper.today.pnl, allTimePnl: paper.allTime.pnl, cash: paper.currentCash, open: Object.keys(paper.openPositions).length } : null,
    modelSpend: 'not tracked yet',
    problems
  };
}

// The public shape for the hub page: nothing else, ever.
export function publicHealth(h) {
  return { gods_awake: h.gods.awake, councillors: h.councillors, extension_online: h.extension.online, paper_pnl: h.paper ? h.paper.allTimePnl : null };
}

// The SYSTEM duty. Telegram only when the problem set changes; state written
// only then too (Rule 5c).
export async function runSystemCheckIfDue(env) {
  // First tick of every half hour, by the clock -- no "last run" write needed.
  if (Math.floor(Date.now() / 60000) % 30 >= 5) return null;
  const state = await readState(env);
  const h = await healthReport(env, { fixWebhooks: true });
  const sig = h.problems.slice().sort().join(' | ');
  const changed = sig !== (state.problemSig || '');
  tickLog('autonomy', { persona: 'thor', councillor: 'system', summary: h.problems.length ? `SYSTEM: ${h.problems.length} problem(s): ${sig.slice(0, 200)}` : 'SYSTEM: all clear', time: h.checkedAt });
  if (h.webhooksFixed.length || changed) {
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...state, lastRunAt: Date.now(), problemSig: sig, problems: h.problems, webhookFixed: { ...(state.webhookFixed || {}) } };
    for (const id of h.webhooksFixed) next.webhookFixed[id] = today;
    try { await env.RAYVEN_KV.put(STATE_KEY, JSON.stringify(next)); noteWrites(1); } catch (e) {}
    try {
      const chatId = await getRayanPrivateChatId(env);
      if (chatId && (h.problems.length || h.webhooksFixed.length || state.problemSig)) {
        const lines = [];
        if (h.webhooksFixed.length) lines.push(`Re-pointed the Telegram webhook for: ${h.webhooksFixed.join(', ')} (once per bot per day).`);
        lines.push(h.problems.length ? `SYSTEM check — ${h.problems.length} problem(s):\n- ${h.problems.join('\n- ')}` : 'SYSTEM check — all clear again.');
        await sendTelegramMessage(env, chatId, `THOR / SYSTEM\n${lines.join('\n')}`, env.TELEGRAM_BOT_TOKEN);
      }
    } catch (e) {}
    return { ok: true, changed, problems: h.problems, fixed: h.webhooksFixed };
  }
  return { ok: true, changed: false, problems: h.problems };   // nothing changed: no write
}
