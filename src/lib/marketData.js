// Real OHLC candle data for the paper-trading simulation (paperTrading.js).
// Two free providers, chosen 2026-09-01 after Rayan weighed the trade-offs:
//   - Bitcoin: Kraken's public OHLC endpoint. No key, no geoblocking — Binance
//     was ruled out because it 403s every request from Cloudflare's (US-based)
//     edge IPs, not just from actual US users.
//   - SPY/QQQ/GLD/USO: Twelve Data, free tier (800 calls/day, 8/min). Our real
//     usage is ~50-60 calls/day total across all five markets, nowhere near
//     that ceiling.
//
// Gold and oil are GLD/USO ETF proxies, not real commodities data — Twelve
// Data's free tier excludes commodities outright (that needs their $29/mo
// "Grow" plan). Rayan chose the free proxy path knowingly: GLD/USO trade on
// ordinary NYSE hours (9:30-4 ET), NOT the near-24-hour COMEX/NYMEX Globex
// schedule real gold/oil futures run on. Every caller that surfaces a
// gold/oil number MUST label it as a stock-market-hours approximation.

const TZ_NY = 'America/New_York';

function nyParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_NY, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  const weekdayNum = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10),
    minute: parseInt(p.minute, 10),
    weekday: weekdayNum
  };
}

// Regular session only (9:30-4:00 ET, Mon-Fri) — no pre/post-market, since
// that's what "50-minute candle mean reversion" should trade against.
//
// KNOWN GAP: this checks weekday + time-of-day only, no US market holiday
// calendar (Thanksgiving, Christmas, early-close days, etc.) and no true
// minute-precision handling of the 9:30 open edge beyond hour+minute compare.
// On a holiday this will wrongly think NYSE is open and attempt a fetch —
// Twelve Data will just return stale/no new data, so it fails safe (no
// candle change means no new signal), but it is not a real holiday calendar.
// NYSE full-day closures and 1:00 p.m. ET early closes, copied from
// nyse.com/markets/hours-calendars on 2026-09-05 (Phase 4.3). Static on
// purpose -- no automatic refresh. Odin's Sunday report warns when the list's
// last year is the current year (see nyseCalendarLastYear).
export const NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25'
]);
export const NYSE_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24']);   // 1:00 p.m. ET
export function nyseCalendarLastYear() { return 2028; }
export function nyseCloseMinutes(dateStr) { return NYSE_EARLY_CLOSE.has(dateStr) ? 13 * 60 : 16 * 60; }
export function isNyseHoliday(date = new Date()) { return NYSE_HOLIDAYS.has(nyParts(date).date); }

export function isNyseSessionOpen(date = new Date()) {
  const { date: d, hour, minute, weekday } = nyParts(date);
  if (weekday < 1 || weekday > 5) return false;
  if (NYSE_HOLIDAYS.has(d)) return false;
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < nyseCloseMinutes(d);
}

// Minutes left in today's regular session (0 when closed). Phase 4.2 uses it
// to refuse NEW paper positions in the last 10 minutes before the close.
export function minutesToNyseClose(date = new Date()) {
  if (!isNyseSessionOpen(date)) return 0;
  const { date: d, hour, minute } = nyParts(date);
  return nyseCloseMinutes(d) - (hour * 60 + minute);
}

export function isBitcoinSessionOpen() {
  return true; // the one market that actually is 24/7
}

function normalizeCandle(time, open, high, low, close, volume) {
  return {
    time: Math.round(Number(time)),
    open: Number(open), high: Number(high), low: Number(low), close: Number(close),
    volume: Number(volume) || 0
  };
}

// Kraken OHLC — free, no API key, no geoblocking. interval is in minutes
// (Kraken's own supported set: 1,5,15,30,60,240,1440,10080,21600).
export async function fetchKrakenCandles(pair, intervalMinutes) {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${intervalMinutes}`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Kraken HTTP ${res.status}` };
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: 'Kraken returned non-JSON.' };
  if (data.error && data.error.length) return { ok: false, error: `Kraken error: ${data.error.join('; ')}` };
  const resultKey = Object.keys(data.result || {}).find(k => k !== 'last');
  const rows = (resultKey && data.result[resultKey]) || [];
  // Kraken row shape: [time, open, high, low, close, vwap, volume, count]
  const candles = rows.map(r => normalizeCandle(r[0] * 1000, r[1], r[2], r[3], r[4], r[6]));
  return { ok: true, candles };
}

// Twelve Data time_series — free tier, needs env.TWELVE_DATA_API_KEY.
// interval like '5min', '15min'. outputsize = number of most-recent bars.
export async function fetchTwelveDataCandles(env, symbol, interval, outputsize) {
  if (!env.TWELVE_DATA_API_KEY) return { ok: false, error: 'TWELVE_DATA_API_KEY not set.' };
  // timezone=UTC or `datetime` comes back as exchange-local (America/New_York)
  // wall-clock time with no offset marker, and appending "Z" below would then
  // silently mislabel it as UTC -- shifting every candle by the ET/UTC offset.
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&timezone=UTC&apikey=${env.TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, error: `Twelve Data HTTP ${res.status}` };
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: 'Twelve Data returned non-JSON.' };
  if (data.status === 'error' || !Array.isArray(data.values)) {
    return { ok: false, error: `Twelve Data error: ${data.message || JSON.stringify(data).slice(0, 200)}` };
  }
  // Twelve Data returns newest-first; sort ascending so every downstream
  // consumer (resampler, strategies) can assume chronological order.
  const candles = data.values
    .map(v => normalizeCandle(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime(), v.open, v.high, v.low, v.close, v.volume))
    .sort((a, b) => a.time - b.time);
  return { ok: true, candles };
}

// No provider offers a native 50-minute or (NYSE-hours-constrained) 4-hour
// bar, so real bars get grouped into buckets ourselves. Buckets are aligned
// to the END of the series (trim any remainder off the OLDEST candles) so
// the most recent bucket is always a real, complete group rather than a
// partial one — and they are SEQUENTIAL groupings of whatever real bars came
// back, not clock-aligned (e.g. not forced to start exactly on the hour).
// During NYSE-hours-only symbols this means a "4-hour" bucket is 16
// consecutive 15-minute session bars, which given a 6.5-hour trading day is
// not literally a 4-hour wall-clock span — a documented simplification, not
// a silent one.
export function resampleSequential(candles, factor) {
  if (factor <= 1) return candles;
  const usable = candles.length - (candles.length % factor);
  if (usable <= 0) return [];
  const trimmed = candles.slice(candles.length - usable);
  const buckets = [];
  for (let i = 0; i < trimmed.length; i += factor) {
    const chunk = trimmed.slice(i, i + factor);
    buckets.push({
      time: chunk[chunk.length - 1].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0)
    });
  }
  return buckets;
}
