// ASGARD backend — Cloudflare Worker entrypoint. HTTP router plus the main
// chat-handling logic; all integrations live in ./lib/*.js. Three personas
// (THOR/LOKI/ODIN — see lib/personas.js) share this one brain: same worker,
// same KV, persona-scoped prompts/memory/tools/history. The legacy RAYVEN
// identity is now THOR; the /agent/query contract, worker URL, and the
// RAYVENN_RAYAN_BOT Telegram bot are unchanged (JARVIS federation depends on
// all three — see the sibling build brief §14).
import { loadHistory, saveHistory, sanitizeHistory, MAX_HISTORY, getTodos, getCalendarEvents, addCalendarEvent, removeCalendarEvent } from './lib/kv-store.js';
import { getRecentMemoryBlock, getLongTermMemory, migrateMemoryEmbeddings, getMemoryMap, shareMemory, updateMemoryFact, deleteMemoryFact } from './lib/memory.js';
import { isAffirmative, setToolPermission, getPermissions, GATEABLE_TOOLS, HARD_CONFIRM_TOOLS, DEFAULT_PERMISSION_LEVELS } from './lib/permissions.js';
import {
  resolveSenderTag, getBotInfo, messageAddressesBot, textMentionsJarvis, textMentionsKevin,
  sendTelegramMessage
} from './lib/telegram.js';
import { executeTool, callClaudeWithTools, getTaskLog } from './lib/tools.js';
import { handleSpotifyLogin, handleSpotifyCallback, spotifyNowPlayingData, spotifyPause, spotifyResume, spotifyNext, spotifyPrevious } from './lib/spotify.js';
import { runLokiBriefIfDue, runLokiBrief, runOdinReportIfDue, runOdinReport, getOdinReports } from './lib/reports.js';
import { handleAgentQuery } from './lib/sibling-agents.js';
import { runProactiveCheckIn, runProactiveCheckInIfDue, runCodeCheckIfDue, runCodeCheck, runMorningBriefing, runMorningBriefingIfDue } from './lib/checkin.js';
import { getActivityLog } from './lib/activity.js';
import { readCappedLog } from './lib/util.js';
import { notify, flushNotificationDigestIfDue, getNotificationLog } from './lib/notifications.js';
import { runMonitoringSweep, getWatchList } from './lib/monitoring.js';
import { PERSONAS, ALL_PERSONA_IDS, DEFAULT_PERSONA_ID, getPersona, getPersonaBotToken, getPersonaVoiceId, historyKeyFor } from './lib/personas.js';
import { runPersonaAutonomyIfDue, getAllStatuses, getAutonomyLog, setPersonaStatus, runThorSelfCheck } from './lib/autonomy.js';
import { runRoundtable } from './lib/roundtable.js';

const RAYAN_TELEGRAM_USERNAME = 'rayanfahil';

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

// The full chat turn for any channel/persona. For Telegram this runs inside
// ctx.waitUntil AFTER the webhook already returned 200 (Telegram redelivers on
// slow responses, and without dedupe a long turn runs twice — duplicate
// replies, double billing), so nothing here may depend on the response body.
async function handleChatTurn(env, ctx, opts) {
  const { personaId, isTelegram, body, botToken } = opts;
  const persona = getPersona(personaId);

  let userMessage;
  let telegramChatId = null;
  let telegramChatType = null;
  let senderUsername = null;
  let senderFirstName = null;
  let memoryKey;
  let senderTag = null;

  if (isTelegram) {
    userMessage = body.message.text;
    telegramChatId = body.message.chat.id;
    telegramChatType = body.message.chat.type;
    senderUsername = body.message.from && body.message.from.username ? body.message.from.username.toLowerCase() : null;
    senderFirstName = body.message.from && body.message.from.first_name ? body.message.from.first_name : null;
    if (!userMessage) return null;
    memoryKey = historyKeyFor(personaId, 'telegram', telegramChatId);
    senderTag = resolveSenderTag(senderUsername, senderFirstName);

    if (telegramChatType === 'private' && senderUsername === RAYAN_TELEGRAM_USERNAME && personaId === DEFAULT_PERSONA_ID) {
      await env.RAYVEN_KV.put('rayan:private_chat_id', String(telegramChatId));
    }

    if (telegramChatType === 'group' || telegramChatType === 'supergroup') {
      const botInfo = await getBotInfo(env);
      const addressed = messageAddressesBot(userMessage, botInfo, body.message.reply_to_message);
      const mentionsOtherAssistant = textMentionsJarvis(userMessage) || textMentionsKevin(userMessage);
      const shouldRespond = addressed || !mentionsOtherAssistant;
      if (!shouldRespond) return null;
    }
  } else {
    userMessage = body.message;
    if (!userMessage || typeof userMessage !== 'string') {
      return { error: 'No message provided' };
    }
    memoryKey = historyKeyFor(personaId, 'web');
  }

  const sendReply = async (text) => {
    if (isTelegram) await sendTelegramMessage(env, telegramChatId, text, botToken);
    return text;
  };

  const historyEntryContent = isTelegram ? `[${senderTag}]: ${userMessage}` : userMessage;

  ctx.waitUntil(setPersonaStatus(env, personaId, isTelegram ? 'replying on Telegram' : 'replying on the web interface', 0.5, 'seconds'));

  // Pending-confirmation flow — persona-scoped so Loki's pending action can't
  // be confirmed at Odin's table.
  const pendingKey = `pending:${personaId}`;
  const pendingRaw = await env.RAYVEN_KV.get(pendingKey);
  if (pendingRaw && isAffirmative(userMessage)) {
    const pending = JSON.parse(pendingRaw);
    await env.RAYVEN_KV.delete(pendingKey);
    const execResult = await executeTool(env, pending.toolName, pending.toolInput, personaId);
    let history = sanitizeHistory(await loadHistory(env, memoryKey));
    history.push({ role: 'user', content: historyEntryContent });
    history.push({ role: 'assistant', content: `Confirmed. ${execResult}` });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    await saveHistory(env, memoryKey, history);
    ctx.waitUntil(setPersonaStatus(env, personaId, 'idle'));
    return { reply: await sendReply(`Confirmed. ${execResult}`) };
  } else if (pendingRaw) {
    await env.RAYVEN_KV.delete(pendingKey);
  }

  let history = sanitizeHistory(await loadHistory(env, memoryKey));
  history.push({ role: 'user', content: historyEntryContent });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  const claudeMessages = history;

  let channelContext;
  if (isTelegram && (telegramChatType === 'group' || telegramChatType === 'supergroup')) {
    channelContext = `Shared Telegram GROUP chat — Jay's JARVIS and Kevin's KEVOS may also be present. Every message in the history below that starts with "[Name]:" tells you who actually said it — use that to keep track of who you're talking to across the conversation, not just the current message. Keep replies short — a sentence or two.`;
  } else if (isTelegram) {
    channelContext = `Private Telegram chat (you are speaking as ${persona.name} on your own bot).`;
  } else {
    channelContext = `Rayan's private web interface, often via voice — transcripts may occasionally be imperfect. You are currently the active persona on screen.`;
  }

  if (isTelegram) {
    let senderLabel = senderTag === 'Rayan' ? 'Rayan (call him "sir")' : senderTag;
    channelContext += ` IMPORTANT: this specific message was sent by ${senderLabel}. Address and refer to them correctly — do not assume it's Rayan unless it actually is.`;
  }

  const isWakeTrigger = !isTelegram && typeof userMessage === 'string' && userMessage.startsWith('[WAKE_TRIGGER]');

  const longTermMemoryBlock = await getRecentMemoryBlock(env, personaId);

  let wakeCodeCheckContext = null;
  if (isWakeTrigger && personaId === DEFAULT_PERSONA_ID) {
    // ---- one cheap KV read only — no new fetches/tool calls on the wake-greeting path ----
    const codeCheckRaw = await env.RAYVEN_KV.get('codecheck:result');
    if (codeCheckRaw) {
      try {
        const codeCheck = JSON.parse(codeCheckRaw);
        if (codeCheck.issuesFound && !codeCheck.delivered) {
          wakeCodeCheckContext = `Your automated daily self-code-check just flagged something worth mentioning: ${codeCheck.summary} Work this into your greeting naturally and briefly — don't make it the whole greeting, and don't call it a "code check" or "report," just mention it like you noticed something about yourself that needs attention.`;
          codeCheck.delivered = true;
          ctx.waitUntil(env.RAYVEN_KV.put('codecheck:result', JSON.stringify(codeCheck)));
        }
      } catch (e) {}
    }
  }

  const result = await callClaudeWithTools(env, persona.systemPrompt, channelContext, longTermMemoryBlock, claudeMessages, !isWakeTrigger, wakeCodeCheckContext, personaId);

  ctx.waitUntil(setPersonaStatus(env, personaId, 'idle'));

  if (!result.ok) {
    if (isTelegram) {
      await sendTelegramMessage(env, telegramChatId, "Something went wrong on my end, sir. (Claude API error)", botToken);
      return null;
    }
    return { error: 'Claude API error', details: result.data };
  }

  const textBlock = result.data.content.find(b => b.type === 'text');
  const reply = textBlock ? textBlock.text : "Done, sir.";

  history.push({ role: 'assistant', content: reply });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  await saveHistory(env, memoryKey, history);

  return { reply: await sendReply(reply) };
}

// Telegram webhooks must answer immediately: parse, dedupe on update_id, hand
// the real work to ctx.waitUntil, return 200 at once. Replies go out via
// sendMessage, so nothing depends on this response body.
async function ackTelegramAndProcess(env, ctx, body, personaId, botToken, corsHeaders) {
  const updateId = body && body.update_id;
  if (updateId !== undefined && updateId !== null) {
    const dedupeKey = `tg:update:${personaId}:${updateId}`;
    const seen = await env.RAYVEN_KV.get(dedupeKey);
    if (seen) return new Response('OK', { headers: corsHeaders });
    await env.RAYVEN_KV.put(dedupeKey, '1', { expirationTtl: 3600 });
  }
  if (body && body.message && typeof body.message === 'object' && body.message.chat) {
    ctx.waitUntil(handleChatTurn(env, ctx, { personaId, isTelegram: true, body, botToken }).catch(err => {
      console.error(`Telegram turn failed (${personaId}):`, err.message);
    }));
  }
  return new Response('OK', { headers: corsHeaders });
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-agent-sig'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Cheap latency probe for the frontend telemetry header (real round-trip
    // numbers only — never faked).
    if (url.pathname === '/ping') {
      return json({ ok: true, t: Date.now() }, corsHeaders);
    }

    if (url.pathname === '/agent/query' && request.method === 'POST') {
      return handleAgentQuery(request, env, corsHeaders);
    }

    // Per-persona Telegram webhooks: /telegram/thor, /telegram/loki, /telegram/odin.
    // (The legacy bot also still lands on POST / and is treated as THOR below.)
    if (url.pathname.startsWith('/telegram/') && request.method === 'POST') {
      const personaId = url.pathname.slice('/telegram/'.length);
      if (!PERSONAS[personaId]) return new Response('Unknown persona.', { status: 404, headers: corsHeaders });
      const botToken = getPersonaBotToken(env, personaId);
      if (!botToken) return new Response('OK', { headers: corsHeaders }); // bot not provisioned yet — swallow quietly
      const body = await request.json().catch(() => null);
      return ackTelegramAndProcess(env, ctx, body, personaId, botToken, corsHeaders);
    }

    if (url.pathname === '/agent/log') {
      const log = await readCappedLog(env, 'agent:log');
      return json(log, corsHeaders);
    }

    if (url.pathname === '/debug-task-log') {
      return json(await getTaskLog(env), corsHeaders);
    }

    if (url.pathname === '/activity') {
      return json(await getActivityLog(env), corsHeaders);
    }

    if (url.pathname === '/notifications') {
      return json(await getNotificationLog(env), corsHeaders);
    }

    if (url.pathname === '/debug-flush-notifications') {
      return json(await flushNotificationDigestIfDue(env), corsHeaders);
    }

    if (url.pathname === '/monitors') {
      return json(await getWatchList(env), corsHeaders);
    }

    if (url.pathname === '/debug-memory-migrate') {
      return json(await migrateMemoryEmbeddings(env), corsHeaders);
    }

    if (url.pathname === '/debug-monitor-sweep') {
      return json(await runMonitoringSweep(env), corsHeaders);
    }

    if (url.pathname === '/debug-autonomy') {
      return json(await runPersonaAutonomyIfDue(env), corsHeaders);
    }

    if (url.pathname === '/debug-selfcheck') {
      return json({ result: await runThorSelfCheck(env) }, corsHeaders);
    }

    // Live per-persona status for the status strip + ops floor, plus the
    // autonomy log tail so silence is always explained.
    if (url.pathname === '/status' && request.method === 'GET') {
      const [statuses, autonomyLog] = await Promise.all([getAllStatuses(env), getAutonomyLog(env)]);
      const personas = {};
      for (const id of ALL_PERSONA_IDS) {
        personas[id] = { name: PERSONAS[id].name, lane: PERSONAS[id].lane, status: statuses[id] };
      }
      return json({ personas, autonomyLog: autonomyLog.slice(-20) }, corsHeaders);
    }

    if (url.pathname === '/roundtable' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await runRoundtable(env, body.personas, body.topic);
      return json(result, corsHeaders, result.ok ? 200 : 400);
    }

    if (url.pathname === '/debug-test-notify' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await notify(env, {
        source: body.source || 'debug',
        priority: body.priority || 'normal',
        title: body.title || 'Test notification',
        body: body.body || 'This is a test.',
        dedupeKey: body.dedupeKey,
        groupKey: body.groupKey,
        cooldownMinutes: body.cooldownMinutes
      });
      return json(result, corsHeaders);
    }

    if (url.pathname === '/memory' && request.method === 'GET') {
      const personaId = url.searchParams.get('persona') || DEFAULT_PERSONA_ID;
      return json(await getLongTermMemory(env, personaId), corsHeaders);
    }

    // Memory map: one hub per persona, one node per memory.
    if (url.pathname === '/memory/map' && request.method === 'GET') {
      return json(await getMemoryMap(env), corsHeaders);
    }

    // Drag-a-node-onto-another-hub sharing — copies, preserving attribution.
    if (url.pathname === '/memory/share' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await shareMemory(env, body.memId, body.from, body.to);
      return json(result, corsHeaders, result.ok ? 200 : 400);
    }

    // Click-to-edit from the memory map.
    if (url.pathname === '/memory/update' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await updateMemoryFact(env, body.persona, body.memId, body.fact);
      return json(result, corsHeaders, result.ok ? 200 : 400);
    }

    // Hand-delete from the memory viewer panels.
    if (url.pathname === '/memory/delete' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await deleteMemoryFact(env, body.persona, body.memId);
      return json(result, corsHeaders, result.ok ? 200 : 400);
    }

    if (url.pathname === '/todos' && request.method === 'GET') {
      return json(await getTodos(env), corsHeaders);
    }

    // Panel-driven todo edits (add / complete / reopen / delete by id).
    if (url.pathname === '/todos' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const todos = await getTodos(env);
      if (body.action === 'add' && body.text && String(body.text).trim()) {
        todos.push({ id: crypto.randomUUID(), text: String(body.text).trim(), done: false, created: new Date().toISOString() });
      } else if (body.action === 'complete' && body.id) {
        const t = todos.find(x => x.id === body.id);
        if (t) { t.done = true; t.completedAt = new Date().toISOString(); }
      } else if (body.action === 'reopen' && body.id) {
        const t = todos.find(x => x.id === body.id);
        if (t) { t.done = false; delete t.completedAt; }
      } else if (body.action === 'delete' && body.id) {
        const idx = todos.findIndex(x => x.id === body.id);
        if (idx !== -1) todos.splice(idx, 1);
      } else {
        return json({ ok: false, error: 'Unknown action.' }, corsHeaders, 400);
      }
      await env.RAYVEN_KV.put('todos', JSON.stringify(todos));
      return json({ ok: true, todos }, corsHeaders);
    }

    if (url.pathname === '/calendar' && request.method === 'GET') {
      return json(await getCalendarEvents(env), corsHeaders);
    }

    if (url.pathname === '/calendar' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.action === 'add') {
        const msg = await addCalendarEvent(env, body.title, body.date, body.time, body.notes);
        return json({ ok: true, message: msg, events: await getCalendarEvents(env) }, corsHeaders);
      }
      if (body.action === 'remove') {
        const msg = await removeCalendarEvent(env, body.id || body.match);
        return json({ ok: true, message: msg, events: await getCalendarEvents(env) }, corsHeaders);
      }
      return json({ ok: false, error: 'Unknown action.' }, corsHeaders, 400);
    }

    // Per-persona web conversation history, for the searchable history panel.
    if (url.pathname === '/history' && request.method === 'GET') {
      const personaId = PERSONAS[url.searchParams.get('persona')] ? url.searchParams.get('persona') : DEFAULT_PERSONA_ID;
      const history = sanitizeHistory(await loadHistory(env, historyKeyFor(personaId, 'web')));
      // Only plain text turns — tool_use/tool_result blocks are internal.
      const turns = history
        .filter(m => typeof m.content === 'string')
        .map(m => ({ role: m.role, text: m.content }));
      return json({ persona: personaId, turns }, corsHeaders);
    }

    if (url.pathname === '/permissions' && request.method === 'GET') {
      const permsRaw = await env.RAYVEN_KV.get('permissions');
      const perms = permsRaw ? JSON.parse(permsRaw) : {};
      return json(perms, corsHeaders);
    }

    // Structured view for the settings panel: every gateable tool with its
    // effective level plus which ones are hardwired to confirm.
    if (url.pathname === '/permissions/all' && request.method === 'GET') {
      const perms = await getPermissions(env);
      const tools = GATEABLE_TOOLS.map(t => ({
        tool: t,
        level: HARD_CONFIRM_TOOLS.includes(t)
          ? (perms[t] === 'off' ? 'off' : 'confirm')
          : (perms[t] || DEFAULT_PERMISSION_LEVELS[t] || 'auto'),
        hardConfirm: HARD_CONFIRM_TOOLS.includes(t)
      }));
      return json({ tools }, corsHeaders);
    }

    if (url.pathname === '/permissions' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const message = await setToolPermission(env, body.tool, body.level);
      return json({ ok: true, message }, corsHeaders);
    }

    // ---- ODIN's real data stores: KPIs, goals, clipping accounts. All start
    // empty and only ever hold values Rayan (or Odin, at his direction) entered —
    // the dashboard never shows invented numbers. ----
    const kvListRoutes = { '/kpi': 'odin:kpis', '/goals': 'odin:goals', '/clipping': 'clipping:accounts' };
    if (kvListRoutes[url.pathname]) {
      const key = kvListRoutes[url.pathname];
      const raw = await env.RAYVEN_KV.get(key);
      const list = raw ? JSON.parse(raw) : [];
      if (request.method === 'GET') return json(list, corsHeaders);
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (body.action === 'add' && body.item && typeof body.item === 'object') {
          list.push({ ...body.item, id: crypto.randomUUID(), updated: new Date().toISOString() });
        } else if (body.action === 'update' && body.id) {
          const item = list.find(x => x.id === body.id);
          if (!item) return json({ ok: false, error: 'Not found.' }, corsHeaders, 404);
          Object.assign(item, body.item || {}, { id: item.id, updated: new Date().toISOString() });
        } else if (body.action === 'remove' && body.id) {
          const idx = list.findIndex(x => x.id === body.id);
          if (idx !== -1) list.splice(idx, 1);
        } else {
          return json({ ok: false, error: 'Unknown action.' }, corsHeaders, 400);
        }
        const trimmed = list.length > 400 ? list.slice(-400) : list;
        await env.RAYVEN_KV.put(key, JSON.stringify(trimmed));
        return json({ ok: true, list: trimmed }, corsHeaders);
      }
    }

    // ---- LOKI brief + ODIN report: latest cached copies and on-demand runs ----
    if (url.pathname === '/loki/brief-latest' && request.method === 'GET') {
      const raw = await env.RAYVEN_KV.get('loki:brief:latest');
      return json(raw ? JSON.parse(raw) : null, corsHeaders);
    }

    if (url.pathname === '/loki/brief-now' && request.method === 'POST') {
      return json(await runLokiBrief(env, false), corsHeaders);
    }

    if (url.pathname === '/odin/reports' && request.method === 'GET') {
      return json(await getOdinReports(env), corsHeaders);
    }

    if (url.pathname === '/odin/report-now' && request.method === 'POST') {
      return json(await runOdinReport(env, false), corsHeaders);
    }

    // Whitelisted assistant config (schedule times etc.) — the settings panels
    // read and write these; unknown keys are rejected.
    const CONFIG_KEYS = ['config:loki:brief:hour', 'config:odin:report:day', 'config:odin:report:hour'];
    if (url.pathname === '/assistant-config' && request.method === 'GET') {
      const out = {};
      for (const k of CONFIG_KEYS) out[k] = await env.RAYVEN_KV.get(k);
      return json(out, corsHeaders);
    }

    if (url.pathname === '/assistant-config' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!CONFIG_KEYS.includes(body.key)) return json({ ok: false, error: 'Unknown config key.' }, corsHeaders, 400);
      await env.RAYVEN_KV.put(body.key, String(body.value === null || body.value === undefined ? '' : body.value));
      return json({ ok: true }, corsHeaders);
    }

    // ---- Spotify panel: structured now-playing + transport controls ----
    if (url.pathname === '/spotify/now-playing' && request.method === 'GET') {
      return json(await spotifyNowPlayingData(env), corsHeaders);
    }

    if (url.pathname === '/spotify/control' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const actions = { pause: spotifyPause, resume: spotifyResume, next: spotifyNext, previous: spotifyPrevious };
      if (!actions[body.action]) return json({ ok: false, error: 'Unknown action.' }, corsHeaders, 400);
      const message = await actions[body.action](env);
      return json({ ok: true, message }, corsHeaders);
    }

    // Extension heartbeat for the status panels — stamped (throttled) by
    // /browser/poll below.
    if (url.pathname === '/browser/status' && request.method === 'GET') {
      const raw = await env.RAYVEN_KV.get('browser:lastpoll');
      const last = raw ? parseInt(raw, 10) : null;
      return json({ lastPoll: last, connected: !!(last && Date.now() - last < 60000) }, corsHeaders);
    }

    if (url.pathname === '/debug-reset-history') {
      const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
      if (!chatId) return new Response('No private chat ID stored yet.', { headers: corsHeaders });
      await env.RAYVEN_KV.delete(`telegram:${chatId}`);
      return new Response(`Cleared the conversation history for chat ${chatId}. Try messaging THOR privately again.`, { headers: corsHeaders });
    }

    if (url.pathname === '/debug-show-history') {
      const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
      if (!chatId) return new Response('No private chat ID stored yet.', { headers: corsHeaders });
      const raw = await env.RAYVEN_KV.get(`telegram:${chatId}`);
      return new Response(raw || '(empty)', { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-show-chat') {
      const chatId = url.searchParams.get('id');
      if (!chatId) return new Response('Pass ?id=<chat id> in the URL.', { headers: corsHeaders });
      const raw = await env.RAYVEN_KV.get(`telegram:${chatId}`);
      return new Response(raw || '(empty)', { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-checkin') {
      return json(await runProactiveCheckIn(env), corsHeaders);
    }

    if (url.pathname === '/debug-morning-briefing') {
      return json(await runMorningBriefing(env), corsHeaders);
    }

    if (url.pathname === '/debug-code-check') {
      return json(await runCodeCheck(env), corsHeaders);
    }

    if (url.pathname === '/debug-maps-key') {
      const key = env.GOOGLE_MAPS_API_KEY;
      if (!key) {
        return new Response('GOOGLE_MAPS_API_KEY is MISSING or empty in Cloudflare.', { headers: corsHeaders });
      }
      return new Response(
        `Key found. Length: ${key.length}. Starts with: "${key.slice(0, 6)}". Ends with: "${key.slice(-4)}". Has leading/trailing whitespace: ${key !== key.trim()}`,
        { headers: corsHeaders }
      );
    }

    if (url.pathname === '/debug-maps-test') {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
          },
          body: JSON.stringify({ textQuery: 'Starbucks in Bakersfield, California' })
        });
        const text = await res.text();
        return new Response(`HTTP Status: ${res.status}\n\nRaw response:\n${text}`, {
          headers: { ...corsHeaders, 'content-type': 'text/plain' }
        });
      } catch (err) {
        return new Response(`Request crashed: ${err.message}`, { headers: corsHeaders });
      }
    }

    if (url.pathname === '/tts' && request.method === 'POST') {
      try {
        const { text, persona } = await request.json();
        const voiceId = getPersonaVoiceId(env, persona || DEFAULT_PERSONA_ID);
        if (!env.ELEVENLABS_API_KEY || !voiceId) {
          return new Response('Missing ELEVENLABS_API_KEY or a voice id (ELEVENLABS_VOICE_ID / per-persona ELEVENLABS_VOICE_ID_*) in Cloudflare secrets.', { status: 500, headers: corsHeaders });
        }
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': env.ELEVENLABS_API_KEY,
            'content-type': 'application/json',
            'accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.7, similarity_boost: 0.75, use_speaker_boost: true }
          })
        });
        if (!elevenRes.ok) {
          const errorDetail = await elevenRes.text();
          return new Response(`ElevenLabs error (${elevenRes.status}): ${errorDetail}`, { status: 500, headers: corsHeaders });
        }
        return new Response(elevenRes.body, { headers: { ...corsHeaders, 'content-type': 'audio/mpeg' } });
      } catch (err) {
        return new Response(`TTS route crashed: ${err.message}`, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/browser/poll' && request.method === 'GET') {
      // Heartbeat stamp for /browser/status, throttled to one KV write per
      // minute so the 6-second poll loop doesn't burn the write quota.
      try {
        const lastRaw = await env.RAYVEN_KV.get('browser:lastpoll');
        if (!lastRaw || Date.now() - parseInt(lastRaw, 10) > 60000) {
          ctx.waitUntil(env.RAYVEN_KV.put('browser:lastpoll', String(Date.now())));
        }
      } catch (e) {}
      const raw = await env.RAYVEN_KV.get('browser:command');
      if (!raw) return new Response(JSON.stringify({ command: null }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
      const cmd = JSON.parse(raw);
      if (cmd.status === 'pending') {
        cmd.status = 'sent';
        await env.RAYVEN_KV.put('browser:command', JSON.stringify(cmd));
        return new Response(JSON.stringify({ command: cmd }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ command: null }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/browser/result' && request.method === 'POST') {
      const body = await request.json();
      await env.RAYVEN_KV.put(`browser:result:${body.id}`, JSON.stringify(body));
      return new Response('OK', { headers: corsHeaders });
    }

    if (url.pathname === '/spotify/login') {
      return handleSpotifyLogin(env);
    }

    if (url.pathname === '/spotify/callback') {
      return handleSpotifyCallback(env, url);
    }

    if (request.method !== 'POST') {
      // THOR's Storm Forge is the front page; the original ASGARD hub lives on
      // at /hub/. Redirect only bare GETs of "/" — POST / (web chat + the
      // legacy Telegram webhook) never reaches this branch.
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return Response.redirect(new URL('/thor/', url).toString(), 302);
      }
      // Anything GET/HEAD that fell through every API route above is a static
      // page in public/ (/thor/, /loki/, /odin/, /hub/). With run_worker_first
      // on, Cloudflare no longer serves these automatically; this is the one
      // explicit call that does it.
      if (env.ASSETS) {
        try {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status !== 404) return assetResponse;
        } catch (e) {}
      }
      return new Response('ASGARD backend is running (THOR · LOKI · ODIN). Send a POST request with a message to chat.', {
        status: 200,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const isTelegram = body.message && typeof body.message === 'object' && body.message.chat;

      if (isTelegram) {
        // Legacy webhook path — this is the original RAYVENN_RAYAN_BOT, which
        // stays exactly where JARVIS expects it and speaks as THOR now.
        return ackTelegramAndProcess(env, ctx, body, DEFAULT_PERSONA_ID, env.TELEGRAM_BOT_TOKEN, corsHeaders);
      }

      // Web chat — the frontend names the active persona ("persona" from the
      // ASGARD hub, "assistant" from the per-assistant pages); anything unknown
      // falls back to THOR so an old cached PWA still works.
      const requestedPersona = body.persona || body.assistant;
      const personaId = PERSONAS[requestedPersona] ? requestedPersona : DEFAULT_PERSONA_ID;
      const result = await handleChatTurn(env, ctx, { personaId, isTelegram: false, body, botToken: null });
      if (!result) return new Response('OK', { headers: corsHeaders });
      if (result.error) {
        const status = result.details ? 500 : 400;
        return json(result, corsHeaders, status);
      }
      return json({ reply: result.reply, persona: personaId }, corsHeaders);
    } catch (err) {
      return json({ error: err.message }, corsHeaders, 500);
    }
  },

  async scheduled(event, env, ctx) {
    // Each subsystem below tracks its own "last run" KV state and decides
    // internally whether it's actually due this tick, and each runs in its own
    // waitUntil so one subsystem failing never blocks the others.
    ctx.waitUntil(runProactiveCheckInIfDue(env));
    ctx.waitUntil(runMorningBriefingIfDue(env));
    ctx.waitUntil(runCodeCheckIfDue(env));
    ctx.waitUntil(runPersonaAutonomyIfDue(env));
    ctx.waitUntil(runLokiBriefIfDue(env));
    ctx.waitUntil(runOdinReportIfDue(env));
    // Sweep first, then flush, so any digest-priority alerts the sweep just
    // queued go out this same tick instead of waiting for the next one.
    ctx.waitUntil(runMonitoringSweep(env).then(() => flushNotificationDigestIfDue(env)));
  }
};
