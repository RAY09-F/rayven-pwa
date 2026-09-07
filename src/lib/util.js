// Small shared helpers used across modules — HMAC signing (agent-to-agent auth),
// XML escaping (Twilio TwiML), and the capped-array KV log pattern reused by
// agent:log, activity:log, notif:log, etc.

export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function sha256Hex(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Append an entry to a capped JSON-array KV log (same pattern worker.js already
// used for agent:log). Used by activity/notification/monitoring logs.
export async function appendCappedLog(env, key, entry, cap) {
  let log = [];
  try {
    const raw = await env.RAYVEN_KV.get(key);
    log = raw ? JSON.parse(raw) : [];
  } catch (e) { log = []; }
  log.push(entry);
  if (log.length > cap) log = log.slice(-cap);
  try { await env.RAYVEN_KV.put(key, JSON.stringify(log)); } catch (e) { console.error(`${key} save failed:`, e); }
  return log;
}

export async function readCappedLog(env, key) {
  try {
    const raw = await env.RAYVEN_KV.get(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
