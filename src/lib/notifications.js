// Centralized notification engine — the single place every background subsystem
// (web monitoring, email, calendar) calls to proactively message Rayan. Handles
// priority, dedup, per-event cooldowns, grouping low/normal-priority items into
// periodic digests instead of spamming individual messages, an hourly rate limit
// on immediate sends, and a persistent, readable history (notif:log, GET
// /notifications).
//
// Usage: await notify(env, { source, priority, title, body, dedupeKey, groupKey, cooldownMinutes })
//   source        — which subsystem this came from, e.g. 'monitoring', 'email'
//   priority      — 'critical' | 'high' | 'normal' | 'low'
//   title, body   — the message content
//   dedupeKey     — identifies "the same event" across repeated checks (e.g. a
//                   watch id + condition). Defaults to `${source}:${title}`.
//   groupKey      — how digest items are grouped/labeled when batched. Defaults
//                   to `source`.
//   cooldownMinutes — override the default per-priority cooldown for this call.
import { appendCappedLog, readCappedLog, sha256Hex } from './util.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';

const NOTIF_LOG_KEY = 'notif:log';
const NOTIF_LOG_CAP = 500;
const DIGEST_QUEUE_KEY = 'notif:digest_queue';
const DIGEST_LAST_FLUSH_KEY = 'notif:digest_last_flush';

const DIGEST_FLUSH_INTERVAL_MS = 30 * 60 * 1000; // flush at most every 30 min...
const DIGEST_FLUSH_MAX_QUEUE = 8;                // ...or sooner if a lot has piled up

const DEFAULT_COOLDOWN_MINUTES = { critical: 1, high: 15, normal: 60, low: 180 };
const HOURLY_SEND_CAP = 20; // immediate (critical/high) sends only — digests are naturally rate-limited by the flush interval

function currentHourBucket() {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export async function notify(env, { source, priority, title, body, dedupeKey, groupKey, cooldownMinutes }) {
  const effectivePriority = ['critical', 'high', 'normal', 'low'].includes(priority) ? priority : 'normal';
  const effectiveDedupeKey = dedupeKey || `${source}:${title}`;
  const effectiveGroupKey = groupKey || source;
  const cooldownMin = cooldownMinutes != null ? cooldownMinutes : DEFAULT_COOLDOWN_MINUTES[effectivePriority];

  const record = {
    time: new Date().toISOString(),
    source, priority: effectivePriority, title, body,
    dedupeKey: effectiveDedupeKey, groupKey: effectiveGroupKey,
    status: 'pending'
  };

  // Dedup / cooldown — skip if we already notified about this exact thing recently.
  const cooldownKvKey = `notif:cooldown:${await sha256Hex(effectiveDedupeKey)}`;
  if (cooldownMin > 0) {
    const cooldownHit = await env.RAYVEN_KV.get(cooldownKvKey);
    if (cooldownHit) {
      record.status = 'suppressed_cooldown';
      await appendCappedLog(env, NOTIF_LOG_KEY, record, NOTIF_LOG_CAP);
      return { sent: false, reason: 'cooldown' };
    }
  }

  const chatId = await getRayanPrivateChatId(env);
  if (!chatId) {
    record.status = 'suppressed_no_chat';
    await appendCappedLog(env, NOTIF_LOG_KEY, record, NOTIF_LOG_CAP);
    return { sent: false, reason: 'no_private_chat_id' };
  }

  const wantsImmediate = effectivePriority === 'critical' || effectivePriority === 'high';

  if (wantsImmediate) {
    let underRateLimit = true;
    if (effectivePriority !== 'critical') {
      const rateKey = `notif:rate:${currentHourBucket()}`;
      const countRaw = await env.RAYVEN_KV.get(rateKey);
      const count = countRaw ? parseInt(countRaw, 10) : 0;
      underRateLimit = count < HOURLY_SEND_CAP;
      if (underRateLimit) await env.RAYVEN_KV.put(rateKey, String(count + 1), { expirationTtl: 3600 });
    }

    if (underRateLimit) {
      await sendTelegramMessage(env, chatId, formatSingle(record));
      record.status = 'sent';
      if (cooldownMin > 0) await env.RAYVEN_KV.put(cooldownKvKey, '1', { expirationTtl: cooldownMin * 60 });
      await appendCappedLog(env, NOTIF_LOG_KEY, record, NOTIF_LOG_CAP);
      return { sent: true };
    }
    // Rate-limited even though it wanted to go immediately — don't drop it, fold
    // it into the next digest instead so Rayan still sees it, just batched.
    record.status = 'queued_rate_limited';
  } else {
    record.status = 'queued';
  }

  await enqueueForDigest(env, record);
  if (cooldownMin > 0) await env.RAYVEN_KV.put(cooldownKvKey, '1', { expirationTtl: cooldownMin * 60 });
  await appendCappedLog(env, NOTIF_LOG_KEY, record, NOTIF_LOG_CAP);
  return { sent: false, reason: 'queued_for_digest' };
}

function formatSingle(record) {
  const prefix = record.priority === 'critical' ? '🔴' : '🟠';
  return `${prefix} ${record.title}\n${record.body}`;
}

async function enqueueForDigest(env, record) {
  const queue = await readCappedLog(env, DIGEST_QUEUE_KEY);
  queue.push(record);
  await env.RAYVEN_KV.put(DIGEST_QUEUE_KEY, JSON.stringify(queue));
}

// Called from scheduled() on every cron tick — decides for itself whether a
// digest is actually due, same "check my own KV state" pattern as the other
// background jobs (runCodeCheckIfDue, runProactiveCheckInIfDue).
export async function flushNotificationDigestIfDue(env) {
  const queue = await readCappedLog(env, DIGEST_QUEUE_KEY);
  if (!queue.length) return { ok: true, skipped: true, reason: 'Nothing queued.' };

  const lastFlushRaw = await env.RAYVEN_KV.get(DIGEST_LAST_FLUSH_KEY);
  const lastFlush = lastFlushRaw ? parseInt(lastFlushRaw, 10) : 0;
  const dueByTime = Date.now() - lastFlush >= DIGEST_FLUSH_INTERVAL_MS;
  const dueBySize = queue.length >= DIGEST_FLUSH_MAX_QUEUE;
  if (!dueByTime && !dueBySize) {
    return { ok: true, skipped: true, reason: `Waiting — ${queue.length} queued, next flush window not reached yet.` };
  }

  const chatId = await getRayanPrivateChatId(env);
  if (!chatId) return { ok: false, reason: 'no_private_chat_id' };

  const groups = {};
  for (const item of queue) {
    const key = item.groupKey || item.source || 'general';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  let message = `🔔 Update (${queue.length} item${queue.length === 1 ? '' : 's'}):\n`;
  for (const [group, items] of Object.entries(groups)) {
    message += `\n[${group}]`;
    for (const item of items) {
      message += `\n• ${item.title} — ${item.body}`;
    }
  }

  await sendTelegramMessage(env, chatId, message.trim());
  await env.RAYVEN_KV.put(DIGEST_QUEUE_KEY, JSON.stringify([]));
  await env.RAYVEN_KV.put(DIGEST_LAST_FLUSH_KEY, String(Date.now()));
  await appendCappedLog(env, NOTIF_LOG_KEY, {
    time: new Date().toISOString(),
    source: 'notifications', priority: 'normal',
    title: 'Digest sent', body: `${queue.length} item(s) grouped and delivered.`,
    status: 'digest_sent'
  }, NOTIF_LOG_CAP);

  return { ok: true, sent: true, count: queue.length };
}

export async function getNotificationLog(env) {
  return await readCappedLog(env, NOTIF_LOG_KEY);
}
