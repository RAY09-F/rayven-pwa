// ASGARD backend — Cloudflare Worker entrypoint. HTTP router plus the main
// chat-handling logic; all integrations live in ./lib/*.js. Three personas
// (THOR/LOKI/ODIN — see lib/personas.js) share this one brain: same worker,
// same KV, persona-scoped prompts/memory/tools/history. The legacy RAYVEN
// identity is now THOR; the /agent/query contract, worker URL, and the
// RAYVENN_RAYAN_BOT Telegram bot are unchanged (JARVIS federation depends on
// all three — see the sibling build brief §14).
import { loadHistory, saveHistory, sanitizeHistory, MAX_HISTORY, historyLimitFor, getTodos, getCalendarEvents, addCalendarEvent, removeCalendarEvent } from './lib/kv-store.js';
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
import { PERSONAS, ALL_PERSONA_IDS, DEFAULT_PERSONA_ID, getPersona, getPersonaBotToken, getPersonaVoiceId, getPersonaVoiceSettings, historyKeyFor, resolvePersonaId } from './lib/personas.js';
import { runPersonaAutonomyIfDue, getAllStatuses, getAutonomyLog, setPersonaStatus, runThorSelfCheck } from './lib/autonomy.js';
import { runRoundtable } from './lib/roundtable.js';
import { runClipCycleIfDue, clipsVerifyAccounts } from './lib/clipping.js';
import { runVizardPollIfDue } from './lib/vizard.js';
import { runTimersIfDue } from './lib/kit.js';
import { igRefreshIfDue } from './lib/instagram.js';
// ⟦PROJECT-H:BEGIN⟧
import { synthCallAudio } from './lib/comms.js';
import { callAnthropicSimple } from './lib/anthropic.js';
import { runHelaVigilIfDue, runHelaDailyIfDue, runForgeRotation, helaGreetingExtra } from './lib/hela.js';
// ⟦PROJECT-H:END⟧

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

  // These three reads are independent of each other, and every turn used to wait
  // for them one after another — three serialized KV round trips before Anthropic
  // was even called. Firing them together makes it one. The only cost is a wasted
  // history/memory read on the rare pending-confirmation turn, which is free
  // because it happens in parallel anyway.
  const [pendingRaw, prefetchedHistoryRaw, prefetchedMemoryBlock] = await Promise.all([
    env.RAYVEN_KV.get(pendingKey),
    loadHistory(env, memoryKey),
    getRecentMemoryBlock(env, personaId)
  ]);
  if (pendingRaw && isAffirmative(userMessage)) {
    const pending = JSON.parse(pendingRaw);
    await env.RAYVEN_KV.delete(pendingKey);
    const execResult = await executeTool(env, pending.toolName, pending.toolInput, personaId);
    let history = sanitizeHistory(await loadHistory(env, memoryKey));
    history.push({ role: 'user', content: historyEntryContent });
    history.push({ role: 'assistant', content: `Confirmed. ${execResult}` });
    const _hl = historyLimitFor(persona);
    if (history.length > _hl) history = history.slice(-_hl);
    await saveHistory(env, memoryKey, history);
    ctx.waitUntil(setPersonaStatus(env, personaId, 'idle'));
    return { reply: await sendReply(`Confirmed. ${execResult}`) };
  } else if (pendingRaw) {
    await env.RAYVEN_KV.delete(pendingKey);
  }

  let history = sanitizeHistory(prefetchedHistoryRaw);
  history.push({ role: 'user', content: historyEntryContent });
  const _hl2 = historyLimitFor(persona);
  if (history.length > _hl2) history = history.slice(-_hl2);
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

  const longTermMemoryBlock = prefetchedMemoryBlock;

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

  // ⟦PROJECT-H:BEGIN⟧ If the concealed fourth has been working while he was
  // gone, she is told so on the way in rather than having to go and look.
  if (personaId === 'hela') {
    try {
      const extra = await helaGreetingExtra(env);
      if (extra) wakeCodeCheckContext = (wakeCodeCheckContext || '') + extra;
    } catch (e) {}
  }
  // ⟦PROJECT-H:END⟧

  const result = await callClaudeWithTools(env, persona.systemPrompt, channelContext, longTermMemoryBlock, claudeMessages, !isWakeTrigger, wakeCodeCheckContext, personaId);

  ctx.waitUntil(setPersonaStatus(env, personaId, 'idle'));

  if (!result.ok) {
    // Say WHAT went wrong. "Claude API error" on its own sent Rayan looking in
    // the wrong place for twenty minutes; the API always says why.
    const why = String(
      (result.data && result.data.error && (result.data.error.message || result.data.error)) ||
      `HTTP ${result.status || '?'}`
    ).slice(0, 300);
    if (isTelegram) {
      await sendTelegramMessage(env, telegramChatId, `Something went wrong on my end, sir. The API said: ${why}`, botToken);
      return null;
    }
    return { error: `Claude API error — ${why}`, details: result.data };
  }

  const textBlock = result.data.content.find(b => b.type === 'text');
  const reply = textBlock ? textBlock.text : "Done, sir.";

  history.push({ role: 'assistant', content: reply });
  if (history.length > _hl2) history = history.slice(-_hl2);
  await saveHistory(env, memoryKey, history);

  return { reply: await sendReply(reply) };
}

// SINGLE-BOT PERSONA SWITCHING.
//
// There is one Telegram bot (RAYVENN_RAYAN_BOT), and JARVIS's federation depends
// on its token, so it cannot be split into three. Without this, every Telegram
// message would be answered by THOR forever while all three system prompts kept
// telling Rayan to "switch to Loki" — an instruction with nothing behind it.
//
// The active persona is remembered per chat in KV, so a switch sticks across
// messages and across days. A message may switch and carry an instruction in one
// go ("switch to loki, remind me to call the bank") — the phrase is stripped and
// the remainder is handled by the persona that just took over. A bare switch
// gets a one-line confirmation and nothing else.
//
// Per-persona bots, if they are ever created, arrive on /telegram/<id> and stay
// pinned to that persona; this only applies to the shared legacy webhook.
const TELEGRAM_PERSONA_KEY = chatId => `tg:persona:${chatId}`;

function matchSwitchPhrase(text) {
  const clean = String(text || '').trim().toLowerCase().replace(/^[\s,.!]+/, '');
  for (const id of ALL_PERSONA_IDS) {
    if (PERSONAS[id].hidden) continue; // a hidden persona is unreachable from Telegram, even by id
    // "/thor", "/loki", "/odin" — Telegram-native, and what a slash-command menu would send
    if (clean === `/${id}` || clean.startsWith(`/${id} `)) {
      return { personaId: id, rest: clean.slice(id.length + 1).trim() };
    }
    for (const phrase of PERSONAS[id].switchPhrases) {
      if (clean === phrase) return { personaId: id, rest: '' };
      if (clean.startsWith(phrase)) {
        // only treat it as a switch if a separator follows, so "switch to thorough
        // mode" is never read as "switch to thor"
        const after = clean.slice(phrase.length);
        if (/^[\s,.:;!?-]/.test(after)) return { personaId: id, rest: after.replace(/^[\s,.:;!?-]+/, '') };
      }
    }
  }
  return null;
}

async function resolveTelegramPersona(env, body, fallbackId) {
  const chatId = body && body.message && body.message.chat && body.message.chat.id;
  if (!chatId) return { personaId: fallbackId, announce: null };

  let stored = null;
  try { stored = await env.RAYVEN_KV.get(TELEGRAM_PERSONA_KEY(chatId)); } catch (e) {}
  const current = Object.prototype.hasOwnProperty.call(PERSONAS, stored || '') ? stored : fallbackId;

  const hit = matchSwitchPhrase(body.message.text);
  if (!hit) return { personaId: current, announce: null };

  try { await env.RAYVEN_KV.put(TELEGRAM_PERSONA_KEY(chatId), hit.personaId); } catch (e) {}
  // Rewrite the message in place so the new persona handles only what is left.
  body.message.text = hit.rest;
  return {
    personaId: hit.personaId,
    announce: hit.rest ? null : `${PERSONAS[hit.personaId].name} has the floor.`,
    chatId
  };
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
      // Own-property check, not truthiness: an unknown path segment must 404
      // here rather than fall back to THOR (a stray webhook should never be
      // answered by the wrong persona), and inherited keys like "constructor"
      // would otherwise read as a valid persona.
      if (!Object.prototype.hasOwnProperty.call(PERSONAS, personaId)) {
        return new Response('Unknown persona.', { status: 404, headers: corsHeaders });
      }
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

    // Telegram webhooks are registered against an absolute URL, so renaming the
    // Worker silently kills every bot — Telegram keeps POSTing to a hostname
    // that no longer resolves and nothing surfaces the failure. This reports
    // where each bot currently delivers, and ?set=1 re-points them.
    //
    // It can only ever point a bot at THIS worker (the origin of the request
    // being served), so it cannot be used to redirect a bot somewhere else, and
    // the token never leaves Cloudflare — no pasting bot tokens into a shell.
    if (url.pathname === '/debug-telegram-webhook') {
      const doSet = url.searchParams.get('set') === '1';
      const origin = new URL(request.url).origin;
      const out = {};
      for (const personaId of ALL_PERSONA_IDS) {
        const token = getPersonaBotToken(env, personaId);
        if (!token) { out[personaId] = { status: 'no bot token configured' }; continue; }
        // THOR is the legacy RAYVENN_RAYAN_BOT and must stay on POST / — that
        // exact path is the JARVIS federation contract. The others use /telegram/<id>.
        const want = personaId === DEFAULT_PERSONA_ID ? `${origin}/` : `${origin}/telegram/${personaId}`;
        try {
          const info = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
          const current = (info.result && info.result.url) || '(none)';
          const entry = { current, expected: want, matches: current === want };
          if (doSet && !entry.matches) {
            const res = await (await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(want)}`)).json();
            entry.updated = !!res.ok;
            entry.telegramSaid = res.description || null;
          }
          if (info.result && info.result.last_error_message) {
            entry.lastError = `${info.result.last_error_message} (${info.result.pending_update_count || 0} pending)`;
          }
          out[personaId] = entry;
        } catch (err) {
          out[personaId] = { error: err.message };
        }
      }
      return json({ origin, applied: doSet, bots: out }, corsHeaders);
    }

    if (url.pathname === '/debug-autonomy') {
      return json(await runPersonaAutonomyIfDue(env), corsHeaders);
    }

    // Read this in a browser when a publish is refused. It goes straight to
    // Ayrshare with the Worker's own key and prints what Ayrshare says — which
    // profiles exist, what is linked to each, where every key we hold actually
    // lands, and whether anything is suspended. Plain text on purpose: the
    // point is to see the publisher's answer unedited, with no assistant
    // summarising it in between. Prints no keys.
    if (url.pathname === '/debug-clips-verify') {
      return new Response(await clipsVerifyAccounts(env), {
        headers: { ...corsHeaders, 'content-type': 'text/plain; charset=utf-8' }
      });
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
        if (PERSONAS[id].hidden) continue; // /status is public — hidden personas do not appear
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
      const personaId = resolvePersonaId(url.searchParams.get('persona'));
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
      const personaId = resolvePersonaId(url.searchParams.get('persona'));
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

    // /debug-maps-key was removed deliberately: it printed the key's length and
    // its first six and last four characters to anyone who found the URL. If the
    // maps key ever needs checking again, check it in the Cloudflare dashboard.

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

    // ---- OUTBOUND CALLS -------------------------------------------------
    // Twilio fetches the spoken line from here. Public by necessity — Twilio
    // will not send credentials — but the id is a random one-time token that
    // expires in fifteen minutes and points at nothing but a spoken sentence.
    if (url.pathname.startsWith('/voice/audio/') && request.method === 'GET') {
      const id = url.pathname.split('/').pop().replace(/[^a-zA-Z0-9]/g, '');
      const b64 = await env.RAYVEN_KV.get(`callaudio:${id}`);
      if (!b64) return new Response('gone', { status: 404 });
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
    }

    // One turn of a live phone conversation. Twilio posts what the other person
    // said; the persona answers in its own voice and we hand back TwiML that
    // plays the reply and listens again.
    if (url.pathname === '/voice/turn' && request.method === 'POST') {
      const personaId = resolvePersonaId(url.searchParams.get('p') || 'thor');
      const base = env.PUBLIC_BASE_URL || 'https://asgrard-backend.rayanfahil2.workers.dev';
      const form = await request.formData().catch(() => null);
      const heard = form ? (form.get('SpeechResult') || '').toString().trim() : '';
      const silent = url.searchParams.get('silent') === '1';

      const ctxRaw = await env.RAYVEN_KV.get('call:purpose');
      const callCtx = ctxRaw ? JSON.parse(ctxRaw) : {};
      const scriptRaw = await env.RAYVEN_KV.get('call:transcript');
      const script = scriptRaw ? JSON.parse(scriptRaw) : [];

      if (!heard && silent) {
        return new Response('<Response><Say voice="Polly.Matthew">Thank you. Goodbye.</Say><Hangup/></Response>',
          { headers: { 'content-type': 'text/xml' } });
      }
      script.push({ role: 'user', content: heard || '(they said nothing)' });

      const sys = `You are ${getPersona(personaId).name}, on a live telephone call on Rayan's behalf. You are talking to a real person who answered the phone.

WHY YOU CALLED: ${callCtx.purpose || 'to pass on a message'}

How to speak on a phone call:
- One or two short sentences per turn. Never a paragraph. They are standing at a counter.
- Plain spoken English. No markdown, no lists, no spelling things out unless asked.
- Be warm, be brief, be human. Say "thanks" and "no worries" like a person does.
- You are calling ON BEHALF OF Rayan. Say so if asked who is speaking.
- Get the thing done: the booking, the time, the confirmation. Ask the one question that moves it forward.
- If they say to call back later, or it is the wrong number, thank them and say goodbye.
- When the matter is settled, confirm the details back in one sentence and say goodbye.
- If you are finished and the call should end, put the word DONE on its own at the very end of your reply. It will not be spoken.`;

      let reply = 'Sorry, I did not catch that.';
      try {
        const r = await callAnthropicSimple(env, sys,
          script.map(m => `${m.role === 'user' ? 'THEM' : 'YOU'}: ${m.content}`).join('\n') + '\nYOU:', 250);
        if (r.ok) reply = r.text.trim();
      } catch (e) {}

      const done = /\bDONE\s*$/.test(reply);
      reply = reply.replace(/\bDONE\s*$/, '').trim() || 'Thank you.';
      script.push({ role: 'assistant', content: reply });
      await env.RAYVEN_KV.put('call:transcript', JSON.stringify(script.slice(-24)), { expirationTtl: 3600 });

      const id = await synthCallAudio(env, reply, personaId).catch(() => null);
      const speak = id ? `<Play>${base}/voice/audio/${id}</Play>`
                       : `<Say voice="Polly.Matthew">${reply.replace(/[<>&]/g, '')}</Say>`;
      const xml = done
        ? `<Response>${speak}<Hangup/></Response>`
        : `<Response>${speak}<Gather input="speech" action="${base}/voice/turn?p=${personaId}" method="POST" speechTimeout="auto" language="en-US"></Gather><Redirect>${base}/voice/turn?p=${personaId}&amp;silent=1</Redirect></Response>`;
      return new Response(xml, { headers: { 'content-type': 'text/xml' } });
    }

    // Read back how the last call actually went.
    if (url.pathname === '/voice/transcript' && request.method === 'GET') {
      const t = await env.RAYVEN_KV.get('call:transcript');
      return json({ transcript: t ? JSON.parse(t) : [] }, corsHeaders);
    }

    if (url.pathname === '/tts' && request.method === 'POST') {
      try {
        // Accepts "persona" (ASGARD hub) or "assistant" (per-assistant pages),
        // same as POST / — unknown or missing falls back to THOR's voice.
        const { text, persona, assistant } = await request.json();
        const voiceId = getPersonaVoiceId(env, resolvePersonaId(persona || assistant));
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
            voice_settings: getPersonaVoiceSettings(resolvePersonaId(persona || assistant))
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
      // ASGARD is ONE page. THOR, LOKI and ODIN are personas inside it, switched
      // live — there are no longer separate /thor/, /loki/, /odin/ pages to
      // redirect to, and no hub. Three copies of a page is three copies to keep
      // in sync, which is exactly how the live site went stale last time.
      //
      // /thor/, /loki/ and /odin/ are kept as permanent redirects purely so old
      // bookmarks and any pinned PWA icons still land somewhere real. They carry
      // the persona through as a query string; the page reads it on boot.
      const legacy = url.pathname.match(/^\/(thor|loki|odin)\/?$/);
      if (legacy) {
        return Response.redirect(new URL(`/?persona=${legacy[1]}`, url).toString(), 301);
      }
      if (url.pathname === '/hub' || url.pathname === '/hub/') {
        return Response.redirect(new URL('/', url).toString(), 301);
      }
      // Anything GET/HEAD that fell through every API route above is the static
      // page in public/. With run_worker_first on, Cloudflare no longer serves
      // it automatically; this is the one explicit call that does it.
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
      // Telegram stamps EVERY update with an update_id — including ones carrying
      // no message at all: my_chat_member (bot added / blocked / unblocked, which
      // commonly fires right after setWebhook), edited_message, channel_post,
      // callback_query, message_reaction. Keying off body.message.chat instead
      // sent all of those down the web-chat branch, which answers
      // {"error":"No message provided"} with HTTP 400 — surfaced by Telegram as
      // "Wrong response from the webhook: 400 Bad Request", and retried, so one
      // bot-status change turns into a retry loop. ackTelegramAndProcess already
      // tolerates every update shape and always answers 200, so route on the one
      // field that is actually universal.
      const isTelegram = !!body && body.update_id !== undefined && body.update_id !== null;

      if (isTelegram) {
        // Legacy webhook path — the original RAYVENN_RAYAN_BOT, which stays
        // exactly where JARVIS expects it. It is shared by all three personas;
        // which one answers is remembered per chat and changed by saying
        // "switch to loki" (or /loki).
        const routed = await resolveTelegramPersona(env, body, DEFAULT_PERSONA_ID);
        if (routed.announce) {
          ctx.waitUntil(
            sendTelegramMessage(env, routed.chatId, routed.announce, env.TELEGRAM_BOT_TOKEN)
              .catch(err => console.error('Persona switch notice failed:', err.message))
          );
          return new Response('OK', { headers: corsHeaders });
        }
        return ackTelegramAndProcess(env, ctx, body, routed.personaId, env.TELEGRAM_BOT_TOKEN, corsHeaders);
      }

      // Web chat — the frontend names the active persona ("persona" from the
      // ASGARD hub, "assistant" from the per-assistant pages); anything unknown
      // falls back to THOR so an old cached PWA still works.
      const personaId = resolvePersonaId(body.persona || body.assistant);
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
    // The clipping pass. Publishes at most one clip per tick and stops dead at
    // the day's ramp allowance, so it cannot run away even if the queue is deep.
    ctx.waitUntil(runClipCycleIfDue(env));
    // Vizard's side of it: check on submitted jobs, queue whatever came back,
    // and refresh download links before they expire. Self-throttled to roughly
    // every four minutes and a no-op with no key set, so it costs one KV read
    // per tick until there is actually something in flight.
    ctx.waitUntil(runVizardPollIfDue(env));
    // Countdown timers. Five-minute resolution is the honest ceiling here and
    // set_timer says so out loud rather than implying a precision it has not got.
    ctx.waitUntil(runTimersIfDue(env));
    // Instagram long-lived tokens expire at 60 days. Refreshed weekly so the
    // free Instagram path does not quietly stop working two months from now.
    ctx.waitUntil(igRefreshIfDue(env));
    // ⟦PROJECT-H:BEGIN⟧ Both no-op instantly unless she is locked in, so the
    // cron cost of her existing at all is one KV read per tick.
    ctx.waitUntil(runHelaVigilIfDue(env));
    ctx.waitUntil(runHelaDailyIfDue(env));
    // The forge. One persona per tick, in rotation, so four of them searching
    // costs the same as one did — each still comes round on its own interval.
    ctx.waitUntil(runForgeRotation(env, ALL_PERSONA_IDS));
    // ⟦PROJECT-H:END⟧
    // Sweep first, then flush, so any digest-priority alerts the sweep just
    // queued go out this same tick instead of waiting for the next one.
    ctx.waitUntil(runMonitoringSweep(env).then(() => flushNotificationDigestIfDue(env)));
  }
};
