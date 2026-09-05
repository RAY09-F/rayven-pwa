// ---------------------------------------------------------------------------
// SCHEDULES (asgard-upgrade Phase 2/3, Hard Rule 14)
// ---------------------------------------------------------------------------
// Cloudflare cron fires in UTC; every time Rayan speaks is Pacific. There is
// NO cron-syntax parser here. A schedule is either
//   { at: 'HH:MM', days: [0..6], tz: 'America/Los_Angeles' }   (0 = Sunday)
// or
//   { every: N }                                                 (minutes)
// "Due" = format now in tz with Intl.DateTimeFormat and compare against the
// last-run stamp in the caller's state. The cron ticks every 5 minutes, so an
// `at` schedule fires on the first tick at or after HH:MM on a listed day, and
// only once per local day.
export const DEFAULT_TZ = 'America/Los_Angeles';

export function localParts(ts = Date.now(), tz = DEFAULT_TZ) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  const hour = parseInt(p.hour, 10) % 24;   // some engines print "24" at midnight
  return { date: `${p.year}-${p.month}-${p.day}`, hour, minute: parseInt(p.minute, 10), minutes: hour * 60 + parseInt(p.minute, 10), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

export function validateSchedule(s) {
  if (!s || typeof s !== 'object') return 'a schedule is an object';
  if (s.every != null) { const n = Number(s.every); if (!(n >= 5 && n <= 10080)) return 'every must be 5..10080 minutes'; return null; }
  if (typeof s.at !== 'string' || !/^\d{2}:\d{2}$/.test(s.at)) return "at must be 'HH:MM'";
  const [h, m] = s.at.split(':').map(Number); if (h > 23 || m > 59) return 'at is not a real time';
  if (s.days != null && (!Array.isArray(s.days) || !s.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6))) return 'days must be a list of 0..6';
  if (s.tz != null) { try { new Intl.DateTimeFormat('en-US', { timeZone: s.tz }); } catch (e) { return `unknown time zone ${s.tz}`; } }
  return null;
}

// state: { lastRunAt (ms), lastRunDate ('YYYY-MM-DD' local) }
export function isDue(schedule, state = {}, now = Date.now()) {
  if (!schedule) return false;
  if (schedule.every != null) {
    const last = Number(state.lastRunAt) || 0;
    return now - last >= Number(schedule.every) * 60000 - 15000;   // 15 s slack for cron jitter
  }
  const tz = schedule.tz || DEFAULT_TZ;
  const p = localParts(now, tz);
  const days = Array.isArray(schedule.days) && schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(p.weekday)) return false;
  const [h, m] = schedule.at.split(':').map(Number);
  if (p.minutes < h * 60 + m) return false;
  if (state.lastRunDate === p.date) return false;               // once per local day
  // don't fire a stale schedule hours late on a redeploy: 90-minute window
  if (p.minutes - (h * 60 + m) > 90) return false;
  return true;
}

export function stampRun(schedule, state = {}, now = Date.now()) {
  const tz = (schedule && schedule.tz) || DEFAULT_TZ;
  return { ...state, lastRunAt: now, lastRunDate: localParts(now, tz).date };
}

export function describeSchedule(s) {
  if (!s) return 'never (on demand)';
  if (s.every != null) return `every ${s.every} minutes`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = Array.isArray(s.days) && s.days.length < 7 ? s.days.map(d => names[d]).join('/') : 'daily';
  return `${days} at ${s.at} ${(s.tz || DEFAULT_TZ).split('/').pop().replace('_', ' ')}`;
}
