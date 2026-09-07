// Central activity/audit log — every autonomous decision RAYVEN's background
// subsystems make (monitoring, email, calendar, notifications) gets recorded here
// so Rayan can see what RAYVEN observed, decided, and did without digging through
// raw KV. Exposed read-only via GET /activity in index.js.

import { appendCappedLog, readCappedLog } from './util.js';

const ACTIVITY_LOG_KEY = 'activity:log';
const ACTIVITY_LOG_CAP = 500;

// entry: { subsystem, observed, decided, action, success, error, meta }
export async function logActivity(env, entry) {
  const record = {
    time: new Date().toISOString(),
    subsystem: entry.subsystem || 'unknown',
    observed: entry.observed || '',
    decided: entry.decided || '',
    action: entry.action || '',
    success: entry.success !== false,
    error: entry.error || null,
    meta: entry.meta || undefined
  };
  await appendCappedLog(env, ACTIVITY_LOG_KEY, record, ACTIVITY_LOG_CAP);
  return record;
}

export async function getActivityLog(env) {
  return await readCappedLog(env, ACTIVITY_LOG_KEY);
}
