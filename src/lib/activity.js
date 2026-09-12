// Central activity/audit log — every autonomous decision RAYVEN's background
// subsystems make (monitoring, email, calendar, notifications) gets recorded here
// so Rayan can see what RAYVEN observed, decided, and did without digging through
// raw KV. Exposed read-only via GET /activity in index.js.

import { appendCappedLog, readCappedLog } from './util.js';
import {queuePhoneUpdate} from './phone-updates.js';
import {safeError} from './chat-diagnostics.js';

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
  if(record.subsystem!=='phone'&&(record.success===false||(record.action&&!/^(none|no.action|skipped|unchanged)$/i.test(record.action)))){
    await queuePhoneUpdate(env,{source:record.subsystem,priority:record.success?'normal':'high',title:record.success?'Activity update':'System problem',body:safeError([record.observed,record.decided,record.action,record.error].filter(Boolean).join('. ')),dedupeKey:'activity:'+record.subsystem+':'+record.action}).catch(()=>{});
  }
  return record;
}

export async function getActivityLog(env) {
  return await readCappedLog(env, ACTIVITY_LOG_KEY);
}
