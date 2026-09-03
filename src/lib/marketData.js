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
export function isNyseSessionOpen(date = new Date()) {
  const { hour, minute, weekday } = nyParts(date);
  if (weekday < 1 || weekday > 5) return false;
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
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
