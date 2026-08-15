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
  if (/\brayven\b/i.test(text)) return true;
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
export async function sendTelegramMessage(env, chatId, text, botToken) {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data.ok) console.error('Telegram send failed:', data);
  return data;
}

export async function getRayanPrivateChatId(env) {
  return await env.RAYVEN_KV.get('rayan:private_chat_id');
}

export { JAY_TELEGRAM_USERNAME, KEVIN_TELEGRAM_USERNAME, RAYAN_TELEGRAM_USERNAME };
