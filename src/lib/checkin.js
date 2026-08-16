// Two existing scheduled jobs, ported unchanged: the daily proactive Telegram
// check-in, and the daily self-code-check against RAYVEN's own GitHub source.
// Both were already written as scheduled()-invoked functions in worker.js — they
// just never actually ran because wrangler.toml had no cron trigger. Phase 0 adds
// that trigger; these functions themselves are untouched logic.
import { loadHistory, saveHistory, sanitizeHistory, getTodos } from './kv-store.js';
import { getRecentMemoryBlock, addLongTermMemory } from './memory.js';
import { askAgentForCheckIn } from './sibling-agents.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { runWebSearch, tavilySearch } from './search.js';

// How often the unprompted "hey sir, checking in" Telegram message is allowed to
// fire. This never actually ran before Phase 0 (no cron trigger existed), so
// there's no prior real-world cadence to preserve — 4 hours keeps it feeling
// proactive without becoming spam. Adjustable later if it's too much/little.
const CHECKIN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export async function runProactiveCheckInIfDue(env) {
  const lastRunRaw = await env.RAYVEN_KV.get('checkin:last_run');
  const lastRun = lastRunRaw ? parseInt(lastRunRaw, 10) : 0;
  if (Date.now() - lastRun < CHECKIN_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: 'Already checked in within the last 4 hours.' };
  }
  await env.RAYVEN_KV.put('checkin:last_run', String(Date.now()));
  return await runProactiveCheckIn(env);
}

export async function runProactiveCheckIn(env) {
  const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
  if (!chatId) {
    return { ok: false, step: 'lookup_chat_id', reason: "No private chat ID stored yet — RAYVEN hasn't seen a private DM from Rayan (@rayanfahil) since this feature was added." };
  }

  const memoryKey = `telegram:${chatId}`;
  let history = sanitizeHistory(await loadHistory(env, memoryKey));

  let todos = (await getTodos(env)).filter(t => !t.done);

  const longTermMemoryBlock = await getRecentMemoryBlock(env);
  const todoBlock = todos.length
    ? `Rayan's open to-dos:\n` + todos.map(t => `- ${t.text} (added ${t.created.slice(0, 10)})`).join('\n')
    : `No open to-dos.`;

  const persona = `You are THOR (formerly RAYVEN), Rayan's personal AI assistant and the default face of his ASGARD triad, built by Rayan himself. J.A.R.V.I.S.-style personality: calm, witty, precise, loyal. Call him "sir."

This is a SCHEDULED, self-initiated check-in — Rayan did not message you first, you are reaching out on your own. Your job right now: if it seems useful, briefly check in with JARVIS and/or KEVOS (ask_jarvis / ask_kevos) about how things are going on their end. Then send Rayan ONE short, natural message — like a real assistant proactively checking in, not a robotic status report.

Rotate across check-ins between angles like: "How's the clipping business plan coming along?", suggesting one concrete upgrade idea for yourself, "How's Jay's build going — anything JARVIS has that you should have too?" (use ask_jarvis if worth actually checking), asking what he needs handled today, or gently nagging about the OLDEST open to-do if one's been sitting a while (see below). Don't repeat the same angle twice in a row if you can tell from recent history. Keep it to 2-4 sentences, in character, natural — not templated.

You do NOT have calendar or meeting access — never claim to check his schedule or mention a meeting unless he told you about one directly (check your long-term memory below for anything he's actually shared).`;

  const tools = [
    { name: 'ask_jarvis', description: "Ask Jay's JARVIS a question, agent-to-agent.", input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
    { name: 'ask_kevos', description: "Ask Kevin's KEVOS a question, agent-to-agent.", input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
    { name: 'remember_this', description: "Save something worth remembering permanently.", input_schema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] } }
  ];

  const systemBlocks = [
    { type: 'text', text: persona },
    { type: 'text', text: longTermMemoryBlock },
    { type: 'text', text: todoBlock }
  ];

  let convo = [...history, { role: 'user', content: '[Scheduled proactive check-in — do your routine now.]' }];
  let finalReply = null;
  let claudeError = null;

  for (let iter = 0; iter < 4; iter++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system: systemBlocks, tools, messages: convo })
      });
    } catch (err) {
      claudeError = `Network error calling Anthropic: ${err.message}`;
      break;
    }
    if (!res.ok) {
      claudeError = `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}`;
      break;
    }
    const data = await res.json();

    if (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;
      let toolResult;
      if (toolUse.name === 'ask_jarvis') {
        toolResult = await askAgentForCheckIn('JARVIS', env.JARVIS_AGENT_URL, env.AGENT_KEY_JARVIS_RAYVEN, toolUse.input.question);
      } else if (toolUse.name === 'ask_kevos') {
        toolResult = await askAgentForCheckIn('KEVOS', env.KEVOS_AGENT_URL, env.AGENT_KEY_RAYVEN_KEVOS, toolUse.input.question);
      } else if (toolUse.name === 'remember_this') {
        toolResult = await addLongTermMemory(env, toolUse.input.fact);
      } else {
        toolResult = 'Unknown tool.';
      }
      convo.push({ role: 'assistant', content: data.content });
      convo.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] });
      continue;
    }

    const textBlock = data.content.find(b => b.type === 'text');
    finalReply = textBlock ? textBlock.text : null;
    break;
  }

  if (!finalReply) {
    return { ok: false, step: 'claude_generation', reason: claudeError || 'Claude produced no final text reply — check tool loop or ANTHROPIC_API_KEY.', chatId };
  }

  let tgResult;
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: finalReply })
    });
    tgResult = await tgRes.json();
  } catch (err) {
    return { ok: false, step: 'telegram_send', reason: `Network error sending to Telegram: ${err.message}`, chatId, reply: finalReply };
  }

  if (!tgResult.ok) {
    return { ok: false, step: 'telegram_send', reason: `Telegram rejected the send: ${JSON.stringify(tgResult)}`, chatId, reply: finalReply };
  }

  let newHistory = history;
  newHistory.push({ role: 'assistant', content: finalReply });
  if (newHistory.length > 30) newHistory = newHistory.slice(-30);
  await saveHistory(env, memoryKey, newHistory);

  return { ok: true, chatId, reply: finalReply };
}

// Daily 8am briefing, fired from the private Telegram chat. Bakersfield is the
// relevant timezone (Rayan's clipping business + local context), so we read
// wall-clock time in America/Los_Angeles directly rather than a fixed UTC
// offset — this keeps firing at 8am through PST/PDT changes automatically.
const BRIEFING_HOUR = 8;
const BRIEFING_TZ = 'America/Los_Angeles';

function getPacificDateParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BRIEFING_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10), minute: parseInt(p.minute, 10) };
}

export async function runMorningBriefingIfDue(env) {
  const { date, hour, minute } = getPacificDateParts();
  // Cron ticks every 5 minutes — only the first tick inside the 8:00-8:04
  // window should fire, and only once per Pacific calendar day.
  if (hour !== BRIEFING_HOUR || minute >= 5) {
    return { ok: true, skipped: true, reason: `Not due — it's ${hour}:${String(minute).padStart(2, '0')} in ${BRIEFING_TZ}, briefing fires at ${BRIEFING_HOUR}:00.` };
  }
  const lastDate = await env.RAYVEN_KV.get('briefing:last_date');
  if (lastDate === date) {
    return { ok: true, skipped: true, reason: 'Already sent today.' };
  }
  await env.RAYVEN_KV.put('briefing:last_date', date);
  return await runMorningBriefing(env);
}

export async function runMorningBriefing(env) {
  const chatId = await getRayanPrivateChatId(env);
  if (!chatId) {
    return { ok: false, step: 'lookup_chat_id', reason: "No private chat ID stored yet — RAYVEN hasn't seen a private DM from Rayan (@rayanfahil) since this feature was added." };
  }

  const memoryKey = `telegram:${chatId}`;
  const history = sanitizeHistory(await loadHistory(env, memoryKey));
  const longTermMemoryBlock = await getRecentMemoryBlock(env);

  const persona = `You are THOR (formerly RAYVEN), Rayan's personal AI assistant and the default face of his ASGARD triad, built by Rayan himself. J.A.R.V.I.S.-style personality: calm, witty, precise, quietly confident. Call him "sir."

This is your SCHEDULED daily morning briefing, sent every day around 8am while Rayan is asleep or just waking up in Bakersfield, CA — he did not ask for this, you are proactively pulling it together on your own initiative. Research using web_search / tavily_research, then send him ONE well-organized Telegram message covering, in this order, only the sections that actually have something real to say:

1. Bakersfield brief — anything locally relevant today (news, weather, notable local happenings) worth a mention. Skip it if there's nothing real.
2. Clipping business trends — what's currently blowing up on Instagram/TikTok/YouTube Shorts right now in sports, gaming, streaming, or IRL clips he could act on today. This is the section he cares most about — put real effort into it.
3. Markets — a sharp, quick read on what happened overnight/premarket that a builder-investor type would actually care about, not a generic recap.
4. Meme coins / crypto — anything genuinely buzzing right now, skip it if it's routine noise.
5. Anything else — your own judgment call on what else is worth flagging. Skip if nothing real.

Run however many web_search / tavily_research calls you actually need to get real, current material for each section — don't guess or make things up, and don't pad a section just to fill it. If you learn something durable worth remembering long-term (a specific opportunity, a trend worth tracking), use remember_this.

Formatting: short section headers, each section tight (1-3 lines), no walls of text, no filler transitions like "I hope this finds you well." Write it like a sharp aide handing over a briefing, not a dumped research report. Open and close naturally, in character — no formal salutation or sign-off.

You do NOT have calendar or meeting access — never claim to check his schedule or mention a meeting unless he told you about one directly (check your long-term memory below for anything he's actually shared).`;

  const tools = [
    { name: 'web_search', description: "Quick Google search via SerpAPI for current, real-time, or factual info.", input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'tavily_research', description: "Deeper research search — use for anything needing more than a quick fact.", input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'remember_this', description: "Save something worth remembering permanently.", input_schema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] } }
  ];

  const systemBlocks = [
    { type: 'text', text: persona },
    { type: 'text', text: longTermMemoryBlock }
  ];

  let convo = [...history, { role: 'user', content: '[Scheduled 8am morning briefing — research and send it now.]' }];
  let finalReply = null;
  let claudeError = null;

  // Higher iteration cap than the regular check-in (4) since a real briefing
  // typically needs several research calls (local, trends, markets, crypto)
  // before it has enough to compose the final message.
  for (let iter = 0; iter < 10; iter++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, system: systemBlocks, tools, messages: convo })
      });
    } catch (err) {
      claudeError = `Network error calling Anthropic: ${err.message}`;
      break;
    }
    if (!res.ok) {
      claudeError = `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}`;
      break;
    }
    const data = await res.json();

    if (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;
      let toolResult;
      if (toolUse.name === 'web_search') {
        toolResult = await runWebSearch(env, toolUse.input.query);
      } else if (toolUse.name === 'tavily_research') {
        toolResult = await tavilySearch(env, toolUse.input.query);
      } else if (toolUse.name === 'remember_this') {
        toolResult = await addLongTermMemory(env, toolUse.input.fact);
      } else {
        toolResult = 'Unknown tool.';
      }
      convo.push({ role: 'assistant', content: data.content });
      convo.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] });
      continue;
    }

    const textBlock = data.content.find(b => b.type === 'text');
    finalReply = textBlock ? textBlock.text : null;
    break;
  }

  if (!finalReply) {
    return { ok: false, step: 'claude_generation', reason: claudeError || 'Claude produced no final text reply — check tool loop or ANTHROPIC_API_KEY.', chatId };
  }

  const tgResult = await sendTelegramMessage(env, chatId, finalReply);
  if (!tgResult || !tgResult.ok) {
    return { ok: false, step: 'telegram_send', reason: `Telegram rejected the send: ${JSON.stringify(tgResult)}`, chatId, reply: finalReply };
  }

  let newHistory = history;
  newHistory.push({ role: 'user', content: '[Scheduled 8am morning briefing — research and send it now.]' });
  newHistory.push({ role: 'assistant', content: finalReply });
  if (newHistory.length > 30) newHistory = newHistory.slice(-30);
  await saveHistory(env, memoryKey, newHistory);

  return { ok: true, chatId, reply: finalReply };
}

const CODE_CHECK_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchGitHubSource(path) {
  const res = await fetch(`https://raw.githubusercontent.com/RAY09-F/rayven-pwa/main/${path}`);
  if (!res.ok) throw new Error(`GitHub fetch failed for ${path}: HTTP ${res.status}`);
  return await res.text();
}

export async function runCodeCheckIfDue(env) {
  const lastRunRaw = await env.RAYVEN_KV.get('codecheck:last_run');
  const lastRun = lastRunRaw ? parseInt(lastRunRaw, 10) : 0;
  if (Date.now() - lastRun < CODE_CHECK_DAY_MS) {
    return { ok: true, skipped: true, reason: 'Already checked within the last 24 hours.' };
  }
  return await runCodeCheck(env);
}

// Source served to any model/persona-readable path must have concealed regions
// stripped: remove everything between the paired ⟦PROJECT-H⟧ comment markers,
// then a token-sweep backstop drops any stray line referencing that region.
function redactConcealedRegions(source) {
  let out = source.replace(/\/\*⟦PROJECT-H:BEGIN⟧[\s\S]*?⟦PROJECT-H:END⟧\*\//g, '/* [region redacted] */');
  // Comment-style markers (backend files use // markers, not block comments).
  out = out.replace(/\/\/ ⟦PROJECT-H:BEGIN⟧[\s\S]*?⟦PROJECT-H:END⟧/g, '// [region redacted]');
  out = out.split('\n').filter(line => !/_h9|h9[A-Z]|helheim|ninth\s+realm|hIntercept|hIsActive|hela|project\s*h\b/i.test(line)).join('\n');
  return out;
}

export async function runCodeCheck(env) {
  await env.RAYVEN_KV.put('codecheck:last_run', String(Date.now()));

  let indexSource, workerSource;
  try {
    [indexSource, workerSource] = await Promise.all([
      fetchGitHubSource('index.html'),
      fetchGitHubSource('worker.js')
    ]);
  } catch (err) {
    return { ok: false, step: 'fetch_source', reason: err.message };
  }
  indexSource = redactConcealedRegions(indexSource);
  workerSource = redactConcealedRegions(workerSource);

  const reviewPrompt = `Review the following two source files — the live, authoritative version of RAYVEN's own codebase, just pulled fresh from GitHub. Look specifically for: syntax errors, duplicated code blocks, leftover dead/backup code, obvious logic bugs, and broken references between functions (e.g. calling something that doesn't exist, mismatched parameters).

Respond with ONLY a valid JSON object in this exact shape, nothing else, no markdown fences: {"issuesFound": true or false, "summary": "a short plain-English description, only if issuesFound is true"}

=== index.html ===
${indexSource}

=== worker.js ===
${workerSource}`;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        messages: [{ role: 'user', content: reviewPrompt }]
      })
    });
  } catch (err) {
    return { ok: false, step: 'claude_call', reason: `Network error calling Anthropic: ${err.message}` };
  }
  if (!res.ok) {
    return { ok: false, step: 'claude_call', reason: `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}` };
  }

  const data = await res.json();
  const textBlock = data.content && data.content.find(b => b.type === 'text');
  if (!textBlock) {
    return { ok: false, step: 'claude_parse', reason: 'No text content in Claude response.' };
  }

  let parsed;
  try {
    const cleaned = textBlock.text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, step: 'json_parse', reason: `Could not parse JSON from Claude's response: ${textBlock.text}` };
  }

  const result = {
    issuesFound: !!parsed.issuesFound,
    summary: parsed.issuesFound ? String(parsed.summary || '').trim() : '',
    checkedAt: new Date().toISOString(),
    delivered: false
  };

  try {
    await env.RAYVEN_KV.put('codecheck:result', JSON.stringify(result));
  } catch (e) {
    return { ok: false, step: 'kv_store', reason: `Check ran but failed to store result: ${e.message}`, result };
  }

  return { ok: true, result };
}
