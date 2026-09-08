// Live feeds for the HUD. Anything the backend can answer replaces the matching
// design value; anything it cannot is left alone, so the handoff's numbers stay
// visible rather than being blanked out.
import {TICKER_DEFAULT} from './hud-config.js';

const TIMEOUT = 8000;

export async function fetchSummary(base = '') {
 try {
  const r = await fetch(`${base}/hud/summary`, {cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT)});
  if (!r.ok) throw Error('HTTP ' + r.status);
  return await r.json();
 } catch (error) { return {error: String(error.message || error)}; }
}

// Overlay live stats/rows onto a realm's desk without disturbing labels or order.
export function applySummary(theme, summary) {
 const realm = summary?.realms?.[theme.id];
 if (!realm) return theme;
 const desk = {...theme.desk};
 if (Array.isArray(realm.stats)) {
  desk.stats = theme.desk.stats.map((s, i) => {
   const live = realm.stats[i];
   return live && live.v != null ? {...s, v: String(live.v), t: live.t ?? s.t} : s;
  });
 }
 if (Array.isArray(realm.rows) && realm.rows.length) {
  desk.rows = theme.desk.rows.map((r, i) => {
   const live = realm.rows[i];
   return live && live.k != null && live.v != null ? {k: String(live.k), v: String(live.v), t: live.t ?? r.t} : r;
  });
 }
 return {...theme, desk, signal: realm.signal || theme.signal};
}

// The ticker takes real system events when there are any, and keeps the
// handoff's line as the resting state when the log is quiet.
export function tickerText(summary) {
 const events = summary?.ticker;
 if (!Array.isArray(events) || !events.length) return TICKER_DEFAULT;
 return events.map(e => String(e).toUpperCase().replace(/\s+/g, ' ').trim()).join(' · ') + ' ·';
}
