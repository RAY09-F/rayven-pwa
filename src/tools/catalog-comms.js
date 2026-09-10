// CATALOGUE — COMMS & SHARING (asgard-upgrade Phase 7.11). Korg.
// ntfy: the topic is the only credential ntfy has, so it is a SECRET (NTFY_TOPIC).
// discord_webhook: permission 'confirm', only with a webhook URL secret, never from a routine.
// share_file: a temporary HMAC link served by the Worker; refuses every key under asgard/
// and asgard-vault/ except asgard/notes/ (Rule 16).
import { r2KeyAllowedForTools } from '../lib/containment.js';
const S = (props, required = []) => ({ type: 'object', properties: props, required });
const str = d => ({ type: 'string', description: d }), int = d => ({ type: 'integer', description: d });
const G = 'sharing';
const BASE = 'https://asgrard-backend.rayanfahil2.workers.dev';
export async function hmacHex(secret, text) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)); return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export function shareKeyAllowed(key) { const k = String(key || ''); if (!k || k.includes('..')) return false; if (k.startsWith('asgard/notes/')) return true; if (k.startsWith('asgard/') || k.startsWith('asgard-vault/')) return false; return r2KeyAllowedForTools(k); }

export const TOOLS = [
  { name: 'ntfy_push', group: G, taint: false, description: 'Push a notification to Rayan\'s phone through ntfy.sh (he has the app and is subscribed to the private topic). Title, message, priority 1-5, optional click URL. Never secrets or memory. Needs the NTFY_TOPIC secret.', input_schema: S({ title: str('short title'), message: str('the message'), priority: int('1 (min) to 5 (urgent), default 3'), click: str('optional https URL to open') }, ['message']),
    async run(env, { title, message, priority, click }) {
      if (env.COMMS_PUSH_ENABLED !== 'true') return 'Phone notifications are disabled. No message was sent.';
      if (!/^[A-Za-z0-9_-]{32,}$/.test(env.NTFY_TOPIC || '')) return 'A secret topic of at least 32 random characters must be configured. No message was sent.';
      const body = String(message || '');
      if (!body || new TextEncoder().encode(body).length > 4096) return 'Provide a message of 1–4096 bytes. No message was sent.';
      const h = { 'content-type': 'text/plain; charset=utf-8', title: String(title || 'Asgard').replace(/[\r\n]/g, ' ').slice(0,120), priority: String(Math.max(1,Math.min(5,Number(priority)||3))) };
      if (click && /^https:\/\//.test(click)) h.click = String(click).replace(/[\r\n]/g,'').slice(0,500);
      try { const r = await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {method:'POST',headers:h,body,redirect:'error',signal:AbortSignal.timeout(10000)}); await r.body?.cancel(); return r.ok ? 'Phone notification sent.' : `Phone notification failed (HTTP ${r.status}).`; }
      catch { return 'Phone notification connection failed.'; }
    } },
  { name: 'discord_webhook', group: G, taint: false, description: 'Post a message to Rayan\'s Discord channel through its webhook (secret DISCORD_WEBHOOK_URL). Always confirmed live; never runs from a routine.', input_schema: S({ message: str('the message (up to 1,900 chars)') }, ['message']),
    async run(env, { message }) { if (!env.DISCORD_WEBHOOK_URL) return 'discord_webhook: DISCORD_WEBHOOK_URL is not set (Rayan adds it as a secret if he wants this).'; if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(env.DISCORD_WEBHOOK_URL)) return 'discord_webhook: the configured URL is not a Discord webhook.'; try { const r = await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(message).slice(0, 1900) }) }); return r.ok || r.status === 204 ? 'Posted to Discord.' : `discord_webhook: Discord answered HTTP ${r.status}`; } catch (e) { return `discord_webhook: ${e.message}`; } } },
  { name: 'share_file', group: G, taint: false, description: 'A temporary link (up to 7 days) to a file already in the R2 bucket, served by the Worker with a signed URL. Refuses anything under asgard/ or asgard-vault/ except published notes. Waits for approval when the session has read outside content.', input_schema: S({ key: str('the R2 object key'), days: int('link lifetime in days, default 1, max 7') }, ['key']),
    async run(env, { key, days }) { if (!env.CLIPS) return 'share_file: no R2 bucket is bound.'; if (!env.ADMIN_TOKEN) return 'share_file: ADMIN_TOKEN is not set, so links cannot be signed.'; const k = String(key || '').trim(); if (!shareKeyAllowed(k)) return `share_file: refused — ${k} is under a protected prefix or is not a valid key.`; const head = await env.CLIPS.head(k).catch(() => null); if (!head) return `share_file: no object at ${k}.`; const expiry = Date.now() + Math.max(1, Math.min(7, Number(days) || 1)) * 86400000; const sig = await hmacHex(env.ADMIN_TOKEN, `${k}|${expiry}`); return `${BASE}/share/${k.split('/').map(encodeURIComponent).join('/')}/${expiry}/${sig} (expires ${new Date(expiry).toISOString().slice(0, 16)}Z, ${head.size} bytes)`; } }
];

// Reuse the existing send implementation; both names obey the same explicit off switch.
TOOLS.push({...TOOLS.find(t=>t.name==='ntfy_push'),name:'comms_push',defer_loading:true,input_examples:[{message:'Your requested reminder.'}],description:'Send a phone notification only after Rayan enables COMMS_PUSH_ENABLED and configures a secret topic. Disabled by default.'});
