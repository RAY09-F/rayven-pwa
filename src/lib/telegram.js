// Telegram-specific helpers: sender identification, group-mention gating, bot-info
// caching, and a shared send helper used by both the chat handler and the new
// centralized notification engine (notifications.js).

const JAY_TELEGRAM_USERNAME = 'jayfarraj';
const KEVIN_TELEGRAM_USERNAME = 'kevoonie';
const RAYAN_TELEGRAM_USERNAME = 'rayanfahil';

export function resolveSenderTag(senderUsername, senderFirstName) {
  if (senderUsername === RAYAN_TELEGRAM_USERNAME) return 'Rayan';
  if (senderUsername === JAY_TELEGRAM_USERNAME) return 'Jay';
  if (senderUsername === KEVIN_TELEGRAM_USERNAME) return 'Kevin';
  return senderFirstName || (senderUsername ? `@${senderUsername}` : 'Unknown');
}

// Per-persona identity. The old version read env.TELEGRAM_BOT_TOKEN no matter
// who was asking, so LOKI, ODIN and HELA all believed they were THOR: none of
// them could tell that a reply was aimed at them, and none of them recognised
// their own @username. In a four-bot group that is the difference between a
// conversation and four bots shouting at once.
export async function getBotInfoFor(env, token, personaId) {
  if (!token) return null;
  const key = `telegram:bot_info:${personaId}`;
  const cached = await env.RAYVEN_KV.get(key);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      const info = { id: data.result.id, username: data.result.username };
      await env.RAYVEN_KV.put(key, JSON.stringify(info), { expirationTtl: 86400 });
      return info;
    }
  } catch (e) { console.error(`getMe failed for ${personaId}:`, e); }
  return null;
}

export async function getBotInfo(env) {
  const cached = await env.RAYVEN_KV.get('telegram:bot_info');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await res.json();
    if (data.ok) {
      const info = { id: data.result.id, username: data.result.username };
      await env.RAYVEN_KV.put('telegram:bot_info', JSON.stringify(info), { expirationTtl: 86400 });
      return info;
    }
  } catch (e) { console.error('getMe failed:', e); }
  return null;
}

export function messageAddressesBot(text, botInfo, replyToMessage) {
  if (replyToMessage && botInfo && replyToMessage.from && replyToMessage.from.id === botInfo.id) return true;
  if (!text) return false;
  // Renamed RAYVEN -> THOR (2026-08-15): match "thor" plus reasonable typed
  // variations/mishearings. "for"/"four" are deliberately excluded — they land
  // in normal conversation constantly (same guard the voice engine uses).
  if (/\b(thor|thors|thorr|tor|tore)\b/i.test(text)) return true;
  if (botInfo && botInfo.username && text.toLowerCase().includes('@' + botInfo.username.toLowerCase())) return true;
  return false;
}

export function textMentionsJarvis(text) {
  return !!text && /\bjarvis\b/i.test(text);
}

export function textMentionsKevin(text) {
  return !!text && /\bkev(in|os)\b/i.test(text);
}

// botToken is optional — defaults to the legacy/THOR bot (RAYVENN_RAYAN_BOT).
// Per-persona bots pass their own token so replies come from the right identity.
export async function sendTelegramMessage(env, chatId, text, botToken, extra) {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(extra && typeof extra === 'object' ? extra : {}) })   // extra: e.g. { reply_markup } (Phase 6.7)
  });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data.ok) console.error('Telegram send failed:', data);
  return data;
}
// Phase 6.7: inline-button plumbing. Both fail quietly -- a button that does not
// visibly acknowledge is a cosmetic loss, never a functional one.
export async function answerCallbackQuery(env, botToken, callbackQueryId, text) {
  try { const res = await fetch(`https://api.telegram.org/bot${botToken || env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callback_query_id: callbackQueryId, text: String(text || '').slice(0, 190) }) }); return await res.json().catch(() => ({ ok: false })); } catch (e) { return { ok: false }; }
}
export async function editMessageText(env, botToken, chatId, messageId, text) {
  try { const res = await fetch(`https://api.telegram.org/bot${botToken || env.TELEGRAM_BOT_TOKEN}/editMessageText`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: String(text || '').slice(0, 4000) }) }); return await res.json().catch(() => ({ ok: false })); } catch (e) { return { ok: false }; }
}

export async function getRayanPrivateChatId(env) {
  return await env.RAYVEN_KV.get('rayan:private_chat_id');
}

export { JAY_TELEGRAM_USERNAME, KEVIN_TELEGRAM_USERNAME, RAYAN_TELEGRAM_USERNAME };
