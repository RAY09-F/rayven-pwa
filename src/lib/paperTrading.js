// ODIN's paper-trading simulation. SIMULATED ONLY — no real money, no real
// brokerage/exchange keys with trading permissions, nothing here executes a
// real trade. This is deliberately separate from ODIN's real trading rules
// (personas.js): he still never recommends a real trade, generates a real
// signal, or executes anything with real money. Every value this module
// produces must be labeled PAPER/SIMULATED wherever it's shown.
//
// Two-layer model, added 2026-09-03 for more concurrent trade volume without
// more Twelve Data API calls:
//   - INSTRUMENTS: the underlying tradable feeds (7 of them). Each is fetched
//     NATIVE at one interval only — never derived from another via resampling
//     (resampleSequential groups from the end of the series, which is fine
//     for the NYSE-session bars below that aren't clock-aligned to begin
//     with, but does NOT land on real hour boundaries — an early version of
//     this tried to derive 60m BTC bars from a 15m fetch and produced OHLC
//     values that didn't match Kraken's own native 60m feed).
//   - AGENTS: an (instrument, strategy, resample factor) triple. Agents CAN
//     share one instrument's already-fetched candles when they use the exact
//     same resample factor as an existing agent on it — that's how
//     BALDR/HEIMDALL/VIDAR ride on SPY/QQQ/GLD's existing fetches for zero
//     extra API cost. TYR needed a genuinely different BTC granularity, so it
//     gets its own instrument (btcFast) and its own real fetch instead.
// The original five agents keep their original ids (btc/spy/qqq/gld/uso) on
// purpose, so the KV portfolio/trade-history keys they already wrote under
// stay valid — no migration needed for whatever position is open when this
// shipped.
import {
  fetchKrakenCandles, fetchTwelveDataCandles, resampleSequential,
  isNyseSessionOpen
} from './marketData.js';
import { appendCappedLog, readCappedLog } from './util.js';
import { getPersonaBotToken } from './personas.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { getBroker, getHalt, setHalt, tradingReadiness, fillModelFor } from './broker.js';
import { submitAndRemember } from './batch.js';
import { tickLog } from './tick.js';
import { costLine } from './cost.js';
import { MODELS } from './models.js';
import { minutesToNyseClose, nyseCalendarLastYear, nyseCloseMinutes, NYSE_HOLIDAYS } from './marketData.js';

// Phase 4.2 -- risk caps that apply to PAPER too, so the record is honest.
const DAILY_LOSS_CAP = 0.03;          // realised loss today >= 3% of the starting balance -> no new positions until tomorrow
const POSITION_CAP_FRACTION = 0.20;   // one councillor's position never exceeds 20% of the starting balance
const NEAR_CLOSE_MINUTES = 10;        // no new NYSE positions in the last 10 minutes of the session
// "max 2 open positions per councillor": the book has exactly one position slot
// per agent id and every councillor wraps exactly one agent, so this cap is
// structural -- it cannot be exceeded and needs no check.

const TZ_NY = 'America/New_York';
const TZ_LA = 'America/Los_Angeles';

const DEFAULT_STARTING_BALANCE = 10000;
const PORTFOLIO_KEY = 'paper:portfolio';
const TRADES_KEY = 'paper:trades';
const TRADES_CAP = 1000;
// Fallback only, when there isn't enough history yet for a real ATR reading.
// The actual stop is ATR-based -- see stopDistanceFraction below.
const STOP_LOSS_PCT = 0.01;
const ATR_PERIOD = 14;
const ATR_STOP_MULTIPLIER = 1.75; // middle of the commonly-cited 1.5x-2x ATR range
const MIN_STOP_FRACTION = 0.003; // floor: never so tight a stop it sits on top of the entry
const MAX_STOP_FRACTION = 0.05; // cap: never so wide a stop-out barely means anything
const LOOKBACK = 20;
const CANDLE_WINDOW = 60; // recent bars kept per agent for the HUD chart
const EQUITY_LOG_KEY = 'paper:equity';
const EQUITY_LOG_CAP = 300;

// Volatility-scaled position sizing: size is a fraction of available cash,
// scaled INVERSELY to a market's recent average true-range fraction so a
// choppier market gets a smaller simulated position for the same dollar
// risk appetite. REFERENCE_VOL is just a normalizing constant, not a target.
const BASE_RISK_FRACTION = 0.10;
const REFERENCE_VOL = 0.01;
const MIN_SIZE_FRACTION = 0.02;
const MAX_SIZE_FRACTION = 0.25;

// Each instrument is fetched NATIVE at the interval given — never derive one
// candle size from another via resampleSequential. That resampler groups
// sequentially from the end of the series (by design, for the NYSE-session
// bars below, which aren't clock-aligned to begin with); it does NOT
// guarantee alignment to real clock-hour boundaries, so aggregating 15m
// Kraken bars into synthetic 60m bars silently produced wrong OHLC values
// that didn't match Kraken's own native 60m feed (caught by direct
// cross-check before this shipped). btc and btcFast are the same pair at two
// real, independently-fetched, natively clock-aligned granularities instead.
export const INSTRUMENTS = {
  btc: {
    id: 'btc', label: 'Bitcoin', provider: 'kraken', krakenPair: 'XBTUSD', krakenInterval: 60,
    hoursNote: 'Real 24/7 market.'
  },
  btcFast: {
    id: 'btcFast', label: 'Bitcoin (15-min)', provider: 'kraken', krakenPair: 'XBTUSD', krakenInterval: 15,
    hoursNote: 'Real 24/7 market.'
  },
  eth: {
    id: 'eth', label: 'Ethereum', provider: 'kraken', krakenPair: 'ETHUSD', krakenInterval: 60,
    hoursNote: 'Real 24/7 market.'
  },
  spy: {
    id: 'spy', label: 'S&P 500 (SPY proxy)', provider: 'twelvedata', tdSymbol: 'SPY', baseInterval: '5min',
    hoursNote: 'Real NYSE hours (9:30am-4:00pm ET) — SPY genuinely trades those hours, no approximation.'
  },
  qqq: {
    id: 'qqq', label: 'Nasdaq (QQQ proxy)', provider: 'twelvedata', tdSymbol: 'QQQ', baseInterval: '5min',
    hoursNote: 'Real NYSE hours (9:30am-4:00pm ET) — QQQ genuinely trades those hours, no approximation.'
  },
  gld: {
    id: 'gld', label: 'Gold (GLD proxy)', provider: 'twelvedata', tdSymbol: 'GLD', baseInterval: '15min',
    hoursNote: 'APPROXIMATION: runs on ordinary NYSE stock-market hours (9:30am-4:00pm ET), not real COMEX gold-futures hours (~23hrs/day, Sun 6pm-Fri 5pm ET). Free-tier trade-off Rayan approved 2026-09-01.'
  },
  uso: {
    id: 'uso', label: 'Oil (USO proxy)', provider: 'twelvedata', tdSymbol: 'USO', baseInterval: '15min',
    hoursNote: 'APPROXIMATION: runs on ordinary NYSE stock-market hours (9:30am-4:00pm ET), not real NYMEX oil-futures hours (~23hrs/day, Sun 6pm-Fri 5pm ET). Free-tier trade-off Rayan approved 2026-09-01.'
  }
};

// resampleFactor is relative to the INSTRUMENT's base fetch above, not to
// minutes directly — e.g. spy fetches at 5m, so resampleFactor 10 = 50m bars.
export const AGENTS = {
  btc: {
    id: 'btc', name: null, label: 'Bitcoin', instrumentId: 'btc', resampleFactor: null, strategy: 'momentum'
  },
  spy: {
    id: 'spy', name: null, label: 'S&P 500 (SPY proxy)', instrumentId: 'spy', resampleFactor: 10, strategy: 'meanReversion'
  },
  qqq: {
    id: 'qqq', name: null, label: 'Nasdaq (QQQ proxy)', instrumentId: 'qqq', resampleFactor: 10, strategy: 'meanReversion'
  },
  gld: {
    id: 'gld', name: null, label: 'Gold (GLD proxy)', instrumentId: 'gld', resampleFactor: 16, strategy: 'trendFollowing'
  },
  uso: {
    id: 'uso', name: null, label: 'Oil (USO proxy)', instrumentId: 'uso', resampleFactor: 16, strategy: 'trendFollowing'
  },
  // Object keys and id fields below (freya/tyr/baldr/heimdall/vidar) are kept
  // stable on purpose -- they're the KV storage keys for this agent's candle
  // history, positions, and trades. Rayan renamed the DISPLAY names after
  // launch (2026-09-03, again 2026-09-04 to match the council page), so ids
  // and display names deliberately differ: the id "heimdall" is DISPLAYED as
  // HOGUN, and the id "vidar" is DISPLAYED as HEIMDALL. That's intentional,
  // not a bug -- do not "fix" it or swap ids around.
  freya: {
    id: 'freya', name: 'FRIGGA', label: 'Ethereum — FRIGGA', instrumentId: 'eth', resampleFactor: null, strategy: 'momentum',
    theme: 'The queen saw further than the king. Reads where Ethereum is heading and rides the one breakout that holds.'
  },
  tyr: {
    id: 'tyr', name: 'FANDRAL', label: 'Bitcoin — FANDRAL', instrumentId: 'btcFast', resampleFactor: null, strategy: 'meanReversion',
    theme: 'Quick blade, one clean strike. Waits for Bitcoin to overreach, then takes the snap-back.'
  },
  baldr: {
    id: 'baldr', name: 'VOLSTAGG', label: 'S&P 500 (SPY proxy) — VOLSTAGG', instrumentId: 'spy', resampleFactor: 10, strategy: 'trendFollowing',
    theme: 'Unmovable. Holds the S&P trend and keeps holding until it actually turns.'
  },
  heimdall: {
    id: 'heimdall', name: 'HOGUN', label: 'Nasdaq (QQQ proxy) — HOGUN', instrumentId: 'qqq', resampleFactor: 10, strategy: 'trendFollowing',
    theme: 'Says nothing, commits everything. Once the Nasdaq trend is confirmed — no half-measures.'
  },
  vidar: {
    id: 'vidar', name: 'HEIMDALL', label: 'Gold (GLD proxy) — HEIMDALL', instrumentId: 'gld', resampleFactor: 16, strategy: 'momentum',
    theme: 'Sees all nine realms from the Bifrost. Watches gold in silence and moves before the breakout is news.'
  }
};

// SPY and QQQ move together closely enough that a second simulated long on
// top of the first isn't real diversification — it's the same bet twice.
// Deliberately scoped to just the two ORIGINAL agents: BALDR/HEIMDALL and the
// rest trade independently, since the whole point of adding more agents is
// independent decisions, not one unified risk-managed book.
const CORRELATED_PAIR = { spy: 'qqq', qqq: 'spy' };

function nyDateString(ts) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_NY, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}

function pacificParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_LA, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10), minute: parseInt(p.minute, 10) };
}

// ---- portfolio state ----

async function getPortfolio(env) {
  const raw = await env.RAYVEN_KV.get(PORTFOLIO_KEY);
  if (raw) return JSON.parse(raw);
  return {
    startingBalance: DEFAULT_STARTING_BALANCE,
    cash: DEFAULT_STARTING_BALANCE,
    positions: {},
    createdAt: new Date().toISOString()
  };
}

async function savePortfolio(env, portfolio) {
  await env.RAYVEN_KV.put(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

// ---- shared indicators -----------------------------------------------
// Added 2026-09-03 after a pass through current (2026) retail-trading
// research on each strategy family. None of this makes a signal reliably
// profitable -- published studies put retail-strategy live failure rates at
// 70-90%, and simple RSI/crossover signals show no significant edge once
// multiple-testing is corrected for. What IS well-evidenced is that these
// specific filters measurably cut the standard failure modes: false
// breakouts with no volume behind them, mean-reversion "catching a falling
// knife" against a real trend, and trend-following whipsaws in a sideways
// market. That's the honest scope of this pass -- fewer bad trades, not a
// guaranteed edge.

function computeRSI(candles, period) {
  if (candles.length < period + 1) return 50; // neutral when there's not enough history to mean anything
  const recent = candles.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].close - recent[i - 1].close;
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// True Range aware of gaps between bars (unlike a plain high-low range), used
// for the ATR-based stop below. Standard Wilder ATR: a simple average of TR
// over `period` bars is close enough for our purposes at this scale.
function computeATR(candles, period) {
  if (candles.length < period + 1) return null;
  const recent = candles.slice(-period - 1);
  let sum = 0;
  for (let i = 1; i < recent.length; i++) {
    const cur = recent[i], prev = recent[i - 1];
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
  }
  return sum / period;
}

// Wilder's ADX: measures trend STRENGTH (not direction). Below ~20 the market
// is chopping sideways and moving-average crossovers are mostly noise; above
// ~20-25 a real trend is more likely underway. Needs roughly 2x period bars
// to stabilize -- returns null rather than a misleading number when there
// isn't enough history yet, and callers treat null as "don't block the trade
// on a filter we can't actually compute" rather than getting stuck forever.
function computeADX(candles, period) {
  if (candles.length < period * 2) return null;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i], prev = candles[i - 1];
    const upMove = cur.high - prev.high, downMove = prev.low - cur.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close)));
  }
  const wilderSmooth = arr => {
    const out = [arr.slice(0, period).reduce((a, b) => a + b, 0)];
    for (let i = period; i < arr.length; i++) out.push(out[out.length - 1] - out[out.length - 1] / period + arr[i]);
    return out;
  };
  const trS = wilderSmooth(tr), plusS = wilderSmooth(plusDM), minusS = wilderSmooth(minusDM);
  const dx = trS.map((t, i) => {
    const plusDI = 100 * plusS[i] / (t || 1), minusDI = 100 * minusS[i] / (t || 1);
    return 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1);
  });
  if (dx.length < period) return null;
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;
  return adx;
}

// ---- strategies: each returns { action: 'enter'|'exit'|'hold', reason } ----

const RSI_PERIOD = 14;
const TREND_FILTER_PERIOD = 50; // bars, for the mean-reversion counter-trend guard
const ADX_PERIOD = 14;
const ADX_TREND_THRESHOLD = 20; // below this, treat the market as sideways chop
const VOLUME_CONFIRM_MULTIPLIER = 1.5; // breakout volume must beat the recent average by this much
const MA_SEPARATION_MIN = 0.001; // fast/slow MA must clear this fractional gap, not just nominally cross

function meanReversionSignal(candles, hasPosition) {
  if (candles.length < LOOKBACK + 1) return { action: 'hold', reason: 'not enough candle history yet' };
  const window = candles.slice(-LOOKBACK - 1, -1);
  const closes = window.map(c => c.close);
  const mean = closes.reduce((s, x) => s + x, 0) / closes.length;
  const variance = closes.reduce((s, x) => s + (x - mean) ** 2, 0) / closes.length;
  const stdev = Math.sqrt(variance) || 0.0001;
  const last = candles[candles.length - 1].close;
  const z = (last - mean) / stdev;
  const rsi = computeRSI(candles, RSI_PERIOD);
  // Trend filter: mean reversion is dangerous against a real trend ("catching
  // a falling knife"). Only take the oversold long if price isn't deep below
  // its own longer-run average -- a mild dip within a flat/up market, not a
  // genuine downtrend.
  const haveTrendWindow = candles.length >= TREND_FILTER_PERIOD;
  const trendSma = haveTrendWindow
    ? candles.slice(-TREND_FILTER_PERIOD).reduce((s, c) => s + c.close, 0) / TREND_FILTER_PERIOD
    : mean;
  const notInDowntrend = last >= trendSma * 0.98;
  if (!hasPosition && z <= -1.5 && rsi <= 35 && notInDowntrend) {
    return { action: 'enter', reason: `oversold vs ${LOOKBACK}-bar mean (z-score ${z.toFixed(2)}, RSI ${rsi.toFixed(0)}), not fighting the longer trend` };
  }
  if (!hasPosition && z <= -1.5 && !notInDowntrend) {
    return { action: 'hold', reason: `oversold (z-score ${z.toFixed(2)}) but ${TREND_FILTER_PERIOD}-bar trend is down -- skipping, not catching a falling knife` };
  }
  if (hasPosition && (z >= 0 || rsi >= 55)) return { action: 'exit', reason: `reverted to mean (z-score ${z.toFixed(2)}, RSI ${rsi.toFixed(0)})` };
  return { action: 'hold', reason: `z-score ${z.toFixed(2)}, RSI ${rsi.toFixed(0)}` };
}

function momentumBreakoutSignal(candles, hasPosition) {
  if (candles.length < LOOKBACK + 11) return { action: 'hold', reason: 'not enough candle history yet' };
  const window = candles.slice(-LOOKBACK - 1, -1);
  const donchianHigh = Math.max(...window.map(c => c.high));
  const sma10 = candles.slice(-11, -1).reduce((s, c) => s + c.close, 0) / 10;
  const lastCandle = candles[candles.length - 1];
  const last = lastCandle.close;
  // Volume confirmation: a breakout on thin volume is a classic false signal.
  // Falls back to "confirmed" when a feed reports no volume at all, rather
  // than permanently blocking trades on a data gap.
  const avgVol = window.reduce((s, c) => s + (c.volume || 0), 0) / window.length;
  const volumeConfirmed = avgVol > 0 ? (lastCandle.volume || 0) >= avgVol * VOLUME_CONFIRM_MULTIPLIER : true;
  if (!hasPosition && last > donchianHigh && volumeConfirmed) {
    return { action: 'enter', reason: `breakout above ${LOOKBACK}-bar high ${donchianHigh.toFixed(2)}, volume ${(avgVol ? lastCandle.volume / avgVol : 1).toFixed(1)}x average` };
  }
  if (!hasPosition && last > donchianHigh && !volumeConfirmed) {
    return { action: 'hold', reason: `broke above ${LOOKBACK}-bar high but volume didn't confirm -- likely false breakout` };
  }
  if (hasPosition && last < sma10) return { action: 'exit', reason: `fell below 10-bar average ${sma10.toFixed(2)}, momentum fading` };
  return { action: 'hold', reason: 'inside recent range' };
}

function trendFollowingSignal(candles, hasPosition) {
  if (candles.length < 21) return { action: 'hold', reason: 'not enough candle history yet' };
  const fast = candles.slice(-8).reduce((s, c) => s + c.close, 0) / 8;
  const slow = candles.slice(-21).reduce((s, c) => s + c.close, 0) / 21;
  const separation = (fast - slow) / slow;
  const adx = computeADX(candles, ADX_PERIOD);
  // Below the ADX threshold the market is sideways chop, where crossovers are
  // mostly whipsaws -- this is the single biggest documented cause of
  // trend-following losses. Null ADX (not enough history) doesn't block the
  // trade; an unmeasurable filter shouldn't strand the strategy forever.
  const trending = adx === null || adx >= ADX_TREND_THRESHOLD;
  if (!hasPosition && separation > MA_SEPARATION_MIN && trending) {
    return { action: 'enter', reason: `uptrend: 8-bar avg ${fast.toFixed(2)} > 21-bar avg ${slow.toFixed(2)}${adx !== null ? `, ADX ${adx.toFixed(0)} confirms trending regime` : ''}` };
  }
  if (!hasPosition && separation > MA_SEPARATION_MIN && !trending) {
    return { action: 'hold', reason: `MAs crossed but ADX ${adx.toFixed(0)} says sideways chop -- sitting out to avoid a whipsaw` };
  }
  if (hasPosition && fast < slow) return { action: 'exit', reason: `trend reversed: 8-bar avg ${fast.toFixed(2)} < 21-bar avg ${slow.toFixed(2)}` };
  return { action: 'hold', reason: 'trend intact' };
}

const SIGNAL_FNS = { meanReversion: meanReversionSignal, momentum: momentumBreakoutSignal, trendFollowing: trendFollowingSignal };

function computeVolatility(candles) {
  const recent = candles.slice(-LOOKBACK);
  if (recent.length < 2) return REFERENCE_VOL;
  const ranges = recent.map(c => (c.high - c.low) / c.close);
  return ranges.reduce((s, x) => s + x, 0) / ranges.length;
}

function sizeFractionForVolatility(vol) {
  const raw = BASE_RISK_FRACTION * (REFERENCE_VOL / Math.max(vol, 0.0005));
  return Math.min(MAX_SIZE_FRACTION, Math.max(MIN_SIZE_FRACTION, raw));
}

// ATR-based stop distance: adapts to each market's own volatility instead of
// one flat percentage for a $60k crypto asset and a low-volatility ETF alike.
// Research on this specific change (ATR-sized stops vs fixed-percent) cites
// roughly 43% lower drawdowns across a large sample. Clamped to a sane band
// so a near-zero ATR reading (very quiet market) never produces a stop
// sitting right on top of the entry price, and a spike doesn't blow the
// stop out past what the position sizing already assumes.
function stopDistanceFraction(candles, lastClose) {
  const atr = computeATR(candles, ATR_PERIOD);
  if (atr === null || !lastClose) return STOP_LOSS_PCT;
  const raw = (atr * ATR_STOP_MULTIPLIER) / lastClose;
  return Math.min(MAX_STOP_FRACTION, Math.max(MIN_STOP_FRACTION, raw));
}

async function logTrade(env, agentDef, position, exitPrice, exitTime, exitReason, fees) {
  const commissions = ((fees && fees.entryCommission) || 0) + ((fees && fees.exitCommission) || 0);
  const pnl = (exitPrice - position.entryPrice) * position.qty - commissions;   // net of commissions; slippage is already in the fill prices
  const pnlPct = (exitPrice - position.entryPrice) / position.entryPrice;
  const entry = {
    id: crypto.randomUUID(),
    label: 'PAPER',
    agent: agentDef.id,
    agentName: agentDef.name,
    market: agentDef.label,
    strategy: agentDef.strategy,
    side: 'long',
    entryTime: new Date(position.entryTime).toISOString(),
    entryPrice: position.entryPrice,
    exitTime: new Date(exitTime).toISOString(),
    exitPrice,
    qty: position.qty,
    pnl,
    pnlPct,
    entryReason: position.entryReason,
    exitReason,
    fees: fees ? { commissions, slippageBps: fees.slippageBps || 0 } : null
  };
  await appendCappedLog(env, TRADES_KEY, entry, TRADES_CAP);
  return entry;
}

// Phase 4.1: every fill goes through the broker (PaperBroker today; LiveBroker
// is a stub that refuses). The broker holds the same in-memory portfolio the
// cycle loads and saves; the trade log hook below is the one it calls on exit.
function brokerFor(env, portfolio, instrumentCache) {
  const quotes = new Map();
  for (const [instrumentId, raw] of instrumentCache.entries()) if (raw && raw.ok && raw.candles && raw.candles.length) quotes.set(instrumentId, raw.candles[raw.candles.length - 1]);
  return getBroker(env, portfolio, {
    quotes,
    providerOf: agentOrInstrument => { const a = AGENTS[agentOrInstrument]; const instr = INSTRUMENTS[a ? a.instrumentId : agentOrInstrument]; return instr ? instr.provider : 'twelvedata'; },
    hooks: { onClose: (agentId, position, exitPrice, exitTime, reason, fees) => logTrade(env, AGENTS[agentId], position, exitPrice, exitTime, reason, fees) }
  });
}

// Risk state computed once per cycle: today's realised P&L and the halt.
async function riskStateFor(env, portfolio) {
  const [trades, halt] = await Promise.all([readCappedLog(env, TRADES_KEY), getHalt(env)]);
  const today = nyDateString(Date.now());
  const todayPnl = trades.filter(t => nyDateString(t.exitTime) === today).reduce((s, t) => s + t.pnl, 0);
  return { halt, todayPnl, dailyLossCapHit: todayPnl <= -DAILY_LOSS_CAP * portfolio.startingBalance, trades };
}

async function fetchInstrumentCandles(env, instrumentId) {
  const instr = INSTRUMENTS[instrumentId];
  return instr.provider === 'kraken'
    ? await fetchKrakenCandles(instr.krakenPair, instr.krakenInterval)
    // 600, not 200 -- GLD/USO resample x16, so 200 raw bars was only ~12
    // resampled bars, not enough for a 14-period ADX (needs ~28) or the
    // 50-bar mean-reversion trend filter. Same API call either way, just a
    // bigger response.
    : await fetchTwelveDataCandles(env, instr.tdSymbol, instr.baseInterval, 600);
}

// instrumentCache is populated once per tick per instrument (not per agent),
// so two agents sharing an instrument (btc: original+TYR, spy: original+BALDR,
// etc.) only ever cost one real fetch each.
async function processAgent(env, agentId, portfolio, instrumentCache, broker, risk) {
  const a = AGENTS[agentId];
  const instr = INSTRUMENTS[a.instrumentId];
  const sessionOpen = instr.provider === 'kraken' ? true : isNyseSessionOpen();
  if (!sessionOpen) return { agentId, skipped: 'market closed' };

  if (!instrumentCache.has(a.instrumentId)) {
    instrumentCache.set(a.instrumentId, await fetchInstrumentCandles(env, a.instrumentId));
  }
  const raw = instrumentCache.get(a.instrumentId);
  if (!raw.ok) return { agentId, error: raw.error };

  const candles = a.resampleFactor ? resampleSequential(raw.candles, a.resampleFactor) : raw.candles;
  if (!candles.length) return { agentId, error: 'no candles returned' };

  const lastCandle = candles[candles.length - 1];
  const lastProcessedKey = `paper:lastCandle:${agentId}`;
  const lastProcessedRaw = await env.RAYVEN_KV.get(lastProcessedKey);
  if (lastProcessedRaw && parseInt(lastProcessedRaw, 10) === lastCandle.time) {
    return { agentId, skipped: 'already processed this candle' };
  }

  // Snapshot the window the strategy just looked at, for the HUD chart. Only
  // written on a genuine new candle (same gate as above) -- a plain put(),
  // not appendCappedLog, since this replaces the whole window rather than
  // growing an ever-longer log.
  try {
    await env.RAYVEN_KV.put(`paper:candles:${agentId}`, JSON.stringify(candles.slice(-CANDLE_WINDOW)));
  } catch (err) {
    console.error(`Paper trading: candle snapshot write failed for ${agentId}:`, err.message);
  }

  const position = portfolio.positions[agentId] || null;
  let outcome;

  // HARD STOP LOSS — checked before any strategy logic, no exceptions. Exits
  // are never blocked by the halt or the caps: a halt stops NEW orders only.
  if (position && lastCandle.low <= position.stopPrice) {
    const c = await broker.closePosition(agentId, { price: position.stopPrice, time: lastCandle.time, reason: `ATR-based stop hit (${((position.stopFraction || STOP_LOSS_PCT) * 100).toFixed(2)}% below entry) — no exceptions` });
    outcome = c.ok ? { agentId, action: 'stopped_out', price: c.fill.price, quoted: position.stopPrice } : { agentId, error: c.error };
  } else {
    const signal = SIGNAL_FNS[a.strategy](candles, !!position);
    if (position && signal.action === 'exit') {
      const c = await broker.closePosition(agentId, { price: lastCandle.close, time: lastCandle.time, reason: signal.reason });
      outcome = c.ok ? { agentId, action: 'closed', reason: signal.reason, price: c.fill.price, quoted: lastCandle.close } : { agentId, error: c.error };
    } else if (!position && signal.action === 'enter') {
      const pairId = CORRELATED_PAIR[agentId];
      if (risk && risk.halt && risk.halt.halted) {
        outcome = { agentId, action: 'skipped_halted', reason: `trading halt is on (${risk.halt.reason || 'no reason given'}) — no new PAPER positions until resumed` };
      } else if (risk && risk.dailyLossCapHit) {
        outcome = { agentId, action: 'skipped_daily_loss_cap', reason: `today's realised PAPER loss (${risk.todayPnl.toFixed(2)}) has reached the ${DAILY_LOSS_CAP * 100}% daily cap — no new positions until tomorrow` };
      } else if (instr.provider !== 'kraken' && minutesToNyseClose() <= NEAR_CLOSE_MINUTES) {
        outcome = { agentId, action: 'skipped_near_close', reason: `inside the last ${NEAR_CLOSE_MINUTES} minutes before the NYSE close — no new positions` };
      } else if (pairId && portfolio.positions[pairId]) {
        outcome = { agentId, action: 'skipped_correlation', reason: `${pairId.toUpperCase()} is already simulated-long — correlation filter blocked stacking ${agentId.toUpperCase()}` };
      } else {
        const vol = computeVolatility(candles);
        const sizeFraction = sizeFractionForVolatility(vol);
        const spend = Math.min(portfolio.cash * sizeFraction, POSITION_CAP_FRACTION * portfolio.startingBalance);   // per-councillor position cap
        const qty = spend / lastCandle.close;
        const stopFraction = stopDistanceFraction(candles, lastCandle.close);
        const o = await broker.placeOrder({ agentId, symbol: a.instrumentId, side: 'buy', qty, price: lastCandle.close, time: lastCandle.time, stop: lastCandle.close * (1 - stopFraction), reason: signal.reason, provider: instr.provider, meta: { strategy: a.strategy, sizeFraction, volatilityAtEntry: vol, stopFraction } });
        outcome = o.ok
          ? { agentId, action: 'entered', reason: signal.reason, qty, price: o.fill.price, quoted: lastCandle.close, sizeFraction, stopFraction, fees: o.fill.commission }
          : { agentId, action: 'skipped_no_cash', reason: o.error };
      }
    } else {
      outcome = { agentId, action: 'hold', reason: signal.reason };
    }
  }

  await env.RAYVEN_KV.put(lastProcessedKey, String(lastCandle.time));
  return outcome;
}

// Manual demo trade -- Rayan asked to see the full entry->exit->chart->report
// flow without waiting on real signal conditions. Uses the REAL current
// price for the agent's instrument (never fabricated), but the decision to
// enter/exit is manual, not from the agent's actual strategy -- clearly
// labeled as such everywhere it surfaces so it's never mistaken for a real
// signal. One-off operator tool, not part of the normal trading cycle.
export async function forceDemoTrade(env, agentId, action) {
  const a = AGENTS[agentId];
  if (!a) return { ok: false, error: `unknown agent ${agentId}` };
  const raw = await fetchInstrumentCandles(env, a.instrumentId);
  if (!raw.ok) return { ok: false, error: raw.error };
  const candles = a.resampleFactor ? resampleSequential(raw.candles, a.resampleFactor) : raw.candles;
  if (!candles.length) return { ok: false, error: 'no candles returned' };
  const lastCandle = candles[candles.length - 1];
  const portfolio = await getPortfolio(env);
  const position = portfolio.positions[agentId] || null;

  if (action === 'enter') {
    if (position) return { ok: false, error: `${agentId} already has an open position` };
    const vol = computeVolatility(candles);
    const sizeFraction = sizeFractionForVolatility(vol);
    const spend = portfolio.cash * sizeFraction;
    const qty = spend / lastCandle.close;
    const stopFraction = stopDistanceFraction(candles, lastCandle.close);
    const cache = new Map([[a.instrumentId, raw]]);
    const broker = await brokerFor(env, portfolio, cache);
    const o = await broker.placeOrder({ agentId, symbol: a.instrumentId, side: 'buy', qty, price: lastCandle.close, time: lastCandle.time, stop: lastCandle.close * (1 - stopFraction), reason: 'MANUAL TEST ENTRY — demo requested by Rayan, not a real strategy signal', provider: INSTRUMENTS[a.instrumentId].provider, meta: { strategy: a.strategy, sizeFraction, volatilityAtEntry: vol, stopFraction, manual: true } });
    if (!o.ok) return { ok: false, error: o.error };
    await savePortfolio(env, portfolio);
    await appendCappedLog(env, EQUITY_LOG_KEY, { time: Date.now(), cash: portfolio.cash }, EQUITY_LOG_CAP);
    return { ok: true, action: 'entered', agentId, price: lastCandle.close, qty, stopPrice: portfolio.positions[agentId].stopPrice };
  }

  if (action === 'exit') {
    if (!position) return { ok: false, error: `${agentId} has no open position to exit` };
    const cache = new Map([[a.instrumentId, raw]]);
    const broker = await brokerFor(env, portfolio, cache);
    const c = await broker.closePosition(agentId, { price: lastCandle.close, time: lastCandle.time, reason: 'MANUAL TEST EXIT — demo requested by Rayan, not a real strategy signal' });
    if (!c.ok) return { ok: false, error: c.error };
    await savePortfolio(env, portfolio);
    await appendCappedLog(env, EQUITY_LOG_KEY, { time: Date.now(), cash: portfolio.cash }, EQUITY_LOG_CAP);
    return { ok: true, action: 'closed', agentId, price: c.fill.price, pnl: c.trade ? c.trade.pnl : null };
  }

  return { ok: false, error: `unknown action ${action}, expected 'enter' or 'exit'` };
}

const PORTFOLIO_MUTATING_ACTIONS = new Set(['entered', 'closed', 'stopped_out']);

export async function runPaperTradingCycleIfDue(env) {
  const portfolio = await getPortfolio(env);
  const results = [];
  let mutated = false;
  const instrumentCache = new Map();
  const risk = await riskStateFor(env, portfolio);
  const broker = await brokerFor(env, portfolio, instrumentCache);   // PaperBroker; a LiveBroker (mode 'live') refuses every call and no trade happens
  for (const agentId of Object.keys(AGENTS)) {
    try {
      const outcome = await processAgent(env, agentId, portfolio, instrumentCache, broker, risk);
      results.push(outcome);
      if (outcome && PORTFOLIO_MUTATING_ACTIONS.has(outcome.action)) mutated = true;
    } catch (err) {
      console.error(`Paper trading: ${agentId} cycle failed:`, err.message);
      results.push({ agentId, error: err.message });
    }
  }
  // Only entered/closed/stopped_out actually change cash or positions -- every
  // other tick (hold/skip/error) leaves the portfolio identical to what's
  // already in KV. Writing it back unconditionally every 5 minutes was 288
  // no-op writes/day against the free-tier write quota for nothing.
  let saveError = null;
  if (mutated) {
    // Never let a KV write failure here take down the whole cycle response —
    // it did once (an unguarded put() 500'd the entire route) before this was
    // wrapped. Whatever agents DID process still get reported back honestly;
    // only the persistence of this tick's portfolio state is what's in doubt.
    try {
      await savePortfolio(env, portfolio);
    } catch (err) {
      saveError = err.message;
      console.error('Paper trading: portfolio save failed:', err.message);
    }
    // Equity curve point, same "only on real change" gate as the portfolio
    // save above -- feeds the HUD's balance-over-time chart with real history
    // instead of another random walk.
    try {
      await appendCappedLog(env, EQUITY_LOG_KEY, { time: Date.now(), cash: portfolio.cash }, EQUITY_LOG_CAP);
    } catch (err) {
      console.error('Paper trading: equity log write failed:', err.message);
    }
  }
  // Phase 4.3: per-councillor stats, written only when one of its trades closed (Rule 5d).
  const closedAgents = results.filter(o => o && (o.action === 'closed' || o.action === 'stopped_out')).map(o => o.agentId);
  if (closedAgents.length) {
    try { const trades = await readCappedLog(env, TRADES_KEY); for (const id of closedAgents) await updateAgentStats(env, id, trades, portfolio, { sample: false }); }
    catch (err) { console.error('Paper trading: stats update failed:', err.message); }
  }
  return { ok: !saveError, results, saveError, portfolioSaved: mutated };
}

// ---- status (feeds the HUD panel, Odin's tool, and the debug route) ----

export async function getPaperStatus(env) {
  const [portfolio, trades, statsRaw] = await Promise.all([getPortfolio(env), readCappedLog(env, TRADES_KEY), Promise.all(Object.keys(AGENTS).map(id => env.RAYVEN_KV.get(STATS_KEY(id)).catch(() => null)))]);
  const stats = {}; Object.keys(AGENTS).forEach((id, i) => { if (statsRaw[i]) { try { const s = JSON.parse(statsRaw[i]); delete s.equity; stats[id] = { ...s, name: AGENTS[id].name, label: 'PAPER / SIMULATED' }; } catch (e) {} } });
  const today = nyDateString(Date.now());
  const todayTrades = trades.filter(t => nyDateString(t.exitTime) === today);
  const wins = todayTrades.filter(t => t.pnl > 0).length;
  const losses = todayTrades.filter(t => t.pnl <= 0).length;
  const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalWins = trades.filter(t => t.pnl > 0).length;
  const openPositions = Object.fromEntries(
    Object.entries(portfolio.positions).map(([agentId, pos]) => {
      const a = AGENTS[agentId];
      return [agentId, { ...pos, label: a ? a.label : agentId, name: a ? a.name : null }];
    })
  );
  return {
    label: 'PAPER / SIMULATED — no real money',
    startingBalance: portfolio.startingBalance,
    currentCash: portfolio.cash,
    openPositions,
    today: {
      date: today, pnl: todayPnl, trades: todayTrades.length, wins, losses,
      winRatePct: todayTrades.length ? (wins / todayTrades.length) * 100 : null,
      lostMoneyToday: todayPnl < 0
    },
    allTime: {
      pnl: totalPnl, trades: trades.length, wins: totalWins,
      winRatePct: trades.length ? (totalWins / trades.length) * 100 : null
    },
    recentTrades: trades.slice(-10).reverse(),
    stats,   // Phase 4.3: per-councillor stats (win rate, avg win/loss, max drawdown, Sharpe-style), PAPER
    agents: Object.fromEntries(Object.values(AGENTS).map(a => [
      a.id, { label: a.label, name: a.name, theme: a.theme || null, hoursNote: INSTRUMENTS[a.instrumentId].hoursNote }
    ]))
  };
}

// ---- chart data for the HUD panel: recent candles + entry/exit markers per
// agent, plus the equity curve. Candles come from the snapshot processAgent
// writes on every genuine new candle (see CANDLE_WINDOW above) -- this never
// calls Kraken/Twelve Data itself, so the frontend never needs API keys.
export async function getPaperChartData(env) {
  const [portfolio, trades, equity] = await Promise.all([
    getPortfolio(env), readCappedLog(env, TRADES_KEY), readCappedLog(env, EQUITY_LOG_KEY)
  ]);
  const agentIds = Object.keys(AGENTS);
  const candleReads = await Promise.all(agentIds.map(id => env.RAYVEN_KV.get(`paper:candles:${id}`)));
  const agents = {};
  agentIds.forEach((id, i) => {
    const a = AGENTS[id];
    const pos = portfolio.positions[id] || null;
    const agentTrades = trades.filter(t => t.agent === id).slice(-20);
    let candles = [];
    try { candles = candleReads[i] ? JSON.parse(candleReads[i]) : []; } catch (e) {}
    agents[id] = {
      label: a.label, name: a.name, theme: a.theme || null, strategy: a.strategy,
      candles,
      openPosition: pos ? { entryTime: pos.entryTime, entryPrice: pos.entryPrice, stopPrice: pos.stopPrice } : null,
      trades: agentTrades.map(t => ({
        entryTime: new Date(t.entryTime).getTime(), entryPrice: t.entryPrice,
        exitTime: new Date(t.exitTime).getTime(), exitPrice: t.exitPrice, pnl: t.pnl
      }))
    };
  });
  return {
    label: 'PAPER / SIMULATED — no real money',
    agents,
    equityCurve: equity,
    startingBalance: portfolio.startingBalance,
    currentCash: portfolio.cash
  };
}

// ---- ODIN's paper_trading_status tool: a grounded text summary, never
// invented numbers. period is 'today' (default), 'week', or 'all'. ----
export async function getPaperSummaryText(env, period) {
  const [portfolio, trades] = await Promise.all([getPortfolio(env), readCappedLog(env, TRADES_KEY)]);
  const nowMs = Date.now();
  let windowTrades, windowLabel;
  if (period === 'week') {
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    windowTrades = trades.filter(t => new Date(t.exitTime).getTime() >= weekAgoMs);
    windowLabel = 'past 7 days';
  } else if (period === 'all') {
    windowTrades = trades;
    windowLabel = 'all time';
  } else {
    const today = nyDateString(nowMs);
    windowTrades = trades.filter(t => nyDateString(t.exitTime) === today);
    windowLabel = 'today';
  }
  const wins = windowTrades.filter(t => t.pnl > 0).length;
  const losses = windowTrades.filter(t => t.pnl <= 0).length;
  const windowPnl = windowTrades.reduce((s, t) => s + t.pnl, 0);
  const allTimePnl = trades.reduce((s, t) => s + t.pnl, 0);

  const openList = Object.entries(portfolio.positions).map(([agentId, pos]) => {
    const a = AGENTS[agentId];
    const label = a ? (a.name || a.label) : agentId;
    return `${label} (entered $${pos.entryPrice.toFixed(2)}, stop $${pos.stopPrice.toFixed(2)})`;
  });

  const lines = [
    'PAPER / SIMULATED trading — no real money, no real trades.',
    openList.length ? `Currently open (${openList.length}): ${openList.join('; ')}.` : 'No open positions right now.',
    `${windowLabel[0].toUpperCase()}${windowLabel.slice(1)}: ${windowPnl >= 0 ? '+' : '-'}$${Math.abs(windowPnl).toFixed(2)} paper · ${windowTrades.length} trade${windowTrades.length === 1 ? '' : 's'} · ${wins}W/${losses}L${windowTrades.length ? ` · ${((wins / windowTrades.length) * 100).toFixed(0)}% win rate` : ''}`,
    `Running total since start: ${allTimePnl >= 0 ? '+' : '-'}$${Math.abs(allTimePnl).toFixed(2)} paper over ${trades.length} trade${trades.length === 1 ? '' : 's'}. Current simulated cash: $${portfolio.cash.toFixed(2)} (started at $${portfolio.startingBalance.toFixed(2)}).`
  ];

  // Phase 4.3: one line from each trader's own journal (their after-close self-review), when there is one.
  try {
    const notes = await Promise.all(COUNCIL_TRADERS.map(id => readCappedLog(env, JOURNAL_KEY(id))));
    const lines2 = [];
    COUNCIL_TRADERS.forEach((id, i) => { const j = notes[i]; if (j && j.length) { const last = j[j.length - 1]; lines2.push(`${AGENTS[id].name} (${last.date}): ${String(last.text).replace(/\s+/g, ' ').slice(0, 220)}`); } });
    if (lines2.length) lines.push(`Trader notes (PAPER, their own after-close reviews): ${lines2.join(' | ')}`);
  } catch (e) {}
  if (period === 'week' && nyseCalendarLastYear() <= new Date().getFullYear()) lines.push(`NOTE: the built-in NYSE holiday calendar ends with ${nyseCalendarLastYear()} — it needs next year's dates added before January.`);
  if (windowTrades.length) {
    const recentList = windowTrades.slice(-8).reverse().map(t => {
      const a = AGENTS[t.agent];
      const label = (a && (a.name || a.label)) || t.market || t.agent;
      const sign = t.pnl >= 0 ? '+' : '-';
      return `${label}: ${sign}$${Math.abs(t.pnl).toFixed(2)} (${t.exitReason})`;
    });
    lines.push(`Trades: ${recentList.join(' | ')}`);
  }

  return lines.join('\n');
}

// ---- daily Telegram report ----

const REPORT_HOUR_KEY = 'config:paper:report:hour';
const DEFAULT_REPORT_HOUR_PACIFIC = 17; // 5pm Pacific / 8pm ET -- after NYSE close, a real end-of-day
const REPORT_LAST_DATE_KEY = 'paper:report:last_date';
const REPORT_FAILURES_KEY = 'paper:report:failures';

function formatDailyReportText(status) {
  const t = status.today;
  const sign = t.pnl >= 0 ? '+' : '-';
  const lines = [
    'PAPER TRADING REPORT — SIMULATED, no real money.',
    `Today: ${sign}$${Math.abs(t.pnl).toFixed(2)} paper · ${t.trades} trade${t.trades === 1 ? '' : 's'} · ${t.wins}W/${t.losses}L${t.winRatePct !== null ? ` · ${t.winRatePct.toFixed(0)}% win rate` : ''}`,
    `Running total since start: ${status.allTime.pnl >= 0 ? '+' : '-'}$${Math.abs(status.allTime.pnl).toFixed(2)} paper over ${status.allTime.trades} trades.`
  ];
  const openNames = Object.values(status.openPositions).map(p => p.name || p.label);
  if (openNames.length) lines.push(`Currently in a position: ${openNames.join(', ')}.`);
  if (t.lostMoneyToday) lines.push('Today was a losing day, shown plainly above — not folded into the running total.');
  return lines.join('\n');
}

// Retry once, immediately, inside the same call — so a genuinely broken send
// and a quiet no-op are never indistinguishable: a failure here is ALWAYS
// logged loudly (console.error + a small capped failure log), and the day's
// last_date marker is only set on real success, so it never silently reads
// as "sent" when it wasn't.
async function sendWithRetry(env, text) {
  const chatId = await getRayanPrivateChatId(env);
  if (!chatId) return { ok: false, error: 'No private Telegram chat ID stored yet — message any bot privately once first.' };
  const botToken = getPersonaBotToken(env, 'odin') || env.TELEGRAM_BOT_TOKEN;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await sendTelegramMessage(env, chatId, text, botToken);
    if (res && res.ok) return { ok: true, attempt };
    lastError = (res && (res.description || JSON.stringify(res))) || 'unknown Telegram error';
    console.error(`Paper trading daily report: send attempt ${attempt} failed:`, lastError);
    if (attempt === 1) await new Promise(r => setTimeout(r, 2000));
  }
  return { ok: false, error: `Telegram send failed twice in a row: ${lastError}` };
}

export async function runPaperTradingDailyReportIfDue(env) {
  const hourRaw = await env.RAYVEN_KV.get(REPORT_HOUR_KEY);
  const targetHour = (hourRaw !== null && hourRaw !== '') ? parseInt(hourRaw, 10) : DEFAULT_REPORT_HOUR_PACIFIC;
  const { date, hour, minute } = pacificParts();
  if (hour !== targetHour || minute >= 5) return { ok: true, skipped: 'not due' };
  const last = await env.RAYVEN_KV.get(REPORT_LAST_DATE_KEY);
  if (last === date) return { ok: true, skipped: 'already sent today' };
  return await sendPaperTradingReportNow(env, date);
}

// Shared by the scheduled path and the manual /debug-paper-report-now route.
export async function sendPaperTradingReportNow(env, dateOverride) {
  const date = dateOverride || pacificParts().date;
  const status = await getPaperStatus(env);
  const text = formatDailyReportText(status);
  const sendResult = await sendWithRetry(env, text);
  let markError = null;
  if (sendResult.ok) {
    // If THIS write fails right after a successful send, the "already sent
    // today" marker never lands -- worth its own distinct log line, since the
    // practical risk is a duplicate send later today, not a silent failure.
    try {
      await env.RAYVEN_KV.put(REPORT_LAST_DATE_KEY, date);
    } catch (err) {
      markError = err.message;
      console.error('Paper trading report: sent successfully but failed to record last_date -- may re-send today:', err.message);
    }
  } else {
    await appendCappedLog(env, REPORT_FAILURES_KEY, { date, at: new Date().toISOString(), error: sendResult.error }, 30);
  }
  return { ok: sendResult.ok, sendResult, text, markError };
}

// ---- Phase 4.2: the kill switch and readiness, in plain English ---------------
export async function tradingHaltText(env, on, reason, by) {
  const rec = await setHalt(env, on, reason, by, nyDateString(Date.now()));
  return on
    ? `PAPER trading halted${reason ? ` (${reason})` : ''}. New PAPER positions are blocked until you say resume; open positions stay open and their stops still apply. Nothing is ever force-closed. This is all simulated — no real money.`
    : `PAPER trading resumed at ${rec.at}. New PAPER positions may open again on the next signal. Simulated only — no real money.`;
}
export async function tradingStatusText(env) {
  const [portfolio, halt, trades] = await Promise.all([getPortfolio(env), getHalt(env), readCappedLog(env, TRADES_KEY)]);
  const today = nyDateString(Date.now());
  const todayPnl = trades.filter(t => nyDateString(t.exitTime) === today).reduce((s, t) => s + t.pnl, 0);
  const open = Object.keys(portfolio.positions).length;
  const km = fillModelFor('kraken'), tm = fillModelFor('twelvedata');
  return [
    'PAPER / SIMULATED — no real money, no real trades.',
    `Kill switch: ${halt.halted ? `HALTED since ${halt.at}${halt.reason ? ` (${halt.reason})` : ''}` : 'not halted'}.`,
    `Risk caps (they apply to the PAPER book too): per-trade risk via the ATR stop (about 1% of cash at risk); daily loss cap ${DAILY_LOSS_CAP * 100}% of the starting balance (today's realised: ${todayPnl >= 0 ? '+' : '-'}$${Math.abs(todayPnl).toFixed(2)}${todayPnl <= -DAILY_LOSS_CAP * portfolio.startingBalance ? ' — CAP HIT, no new positions today' : ''}); one position per councillor, never above ${POSITION_CAP_FRACTION * 100}% of the starting balance; no new NYSE positions in the last ${NEAR_CLOSE_MINUTES} minutes before the close.`,
    `Fill model: ${km.note}; ${tm.note}.`,
    `Book: $${portfolio.cash.toFixed(2)} simulated cash, ${open} open position${open === 1 ? '' : 's'}, ${trades.length} closed trades since the start.`,
    `NYSE holiday calendar loaded through ${nyseCalendarLastYear()}.`
  ].join('\n');
}
export async function tradingReadinessText(env) {
  const [portfolio, trades, equity] = await Promise.all([getPortfolio(env), readCappedLog(env, TRADES_KEY), readCappedLog(env, EQUITY_LOG_KEY)]);
  const r = await tradingReadiness(env, { trades, equity, startingBalance: portfolio.startingBalance });
  return r.text;
}

// ---- Phase 4.3: per-councillor stats, journals, backtest, the close tasks ----------
const STATS_KEY = id => `paper:stats:${id}`;
const JOURNAL_KEY = id => `paper:journal:${id}`;
const CLOSE_LAST_KEY = 'paper:close:last_date';
const COUNCIL_TRADERS = ['freya', 'tyr', 'baldr', 'heimdall', 'vidar'];   // Odin's five named councillors (ids, not display names)
const STATS_EQUITY_CAP = 120;
const JOURNAL_CAP = 60;

function std(xs) { if (xs.length < 2) return 0; const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1)); }
function drawdownOf(curve) { let peak = -Infinity, dd = 0; for (const v of curve) { if (v > peak) peak = v; if (peak > 0) dd = Math.max(dd, (peak - v) / peak); } return dd; }

// Stats from the trade log for one agent. Drawdown is measured on "the book if
// only this agent traded" (starting balance + its cumulative P&L). Sharpe-style
// is per-trade: mean(pnl%) / std(pnl%) × √n -- a shape indicator, not a claim.
export function computeAgentStats(trades, agentId, startingBalance) {
  const mine = trades.filter(t => t.agent === agentId).slice().sort((a, b) => String(a.exitTime).localeCompare(String(b.exitTime)));
  const wins = mine.filter(t => t.pnl > 0), losses = mine.filter(t => t.pnl <= 0);
  let cum = startingBalance; const curve = [startingBalance]; for (const t of mine) { cum += t.pnl; curve.push(cum); }
  const pcts = mine.map(t => Number(t.pnlPct) || 0), sd = std(pcts), mean = pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : 0;
  return {
    agent: agentId, trades: mine.length, wins: wins.length, losses: losses.length,
    winRatePct: mine.length ? (wins.length / mine.length) * 100 : null,
    pnl: mine.reduce((s, t) => s + t.pnl, 0),
    avgWin: wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : null,
    maxDrawdownPct: drawdownOf(curve) * 100,
    sharpeStyle: sd > 0 ? (mean / sd) * Math.sqrt(pcts.length) : null,
    fees: mine.reduce((s, t) => s + ((t.fees && t.fees.commissions) || 0), 0),
    updatedAt: new Date().toISOString()
  };
}
async function updateAgentStats(env, agentId, trades, portfolio, { sample = false } = {}) {
  let prev = null; try { const raw = await env.RAYVEN_KV.get(STATS_KEY(agentId)); prev = raw ? JSON.parse(raw) : null; } catch (e) {}
  const s = computeAgentStats(trades, agentId, portfolio.startingBalance);
  s.equity = (prev && Array.isArray(prev.equity)) ? prev.equity : [];
  if (sample) { const pos = portfolio.positions[agentId]; s.equity.push({ t: Date.now(), realised: portfolio.startingBalance + s.pnl, open: pos ? pos.qty * pos.entryPrice : 0 }); if (s.equity.length > STATS_EQUITY_CAP) s.equity = s.equity.slice(-STATS_EQUITY_CAP); }
  await env.RAYVEN_KV.put(STATS_KEY(agentId), JSON.stringify(s));
  return s;
}
export async function getAgentStats(env, agentId) { try { const raw = await env.RAYVEN_KV.get(STATS_KEY(agentId)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

function agentByNameOrId(q) {
  const s = String(q || '').trim().toLowerCase();
  return Object.values(AGENTS).find(a => a.id === s || (a.name && a.name.toLowerCase() === s) || (a.label && a.label.toLowerCase().startsWith(s))) || null;
}

// The backtest: replay the CACHED candle window (paper:candles:<agent>, written by
// the live cycle) through the agent's own strategy with the same sizing, stop and
// fill model, on a fresh simulated $10,000. Never fetches; never writes.
export async function paperBacktest(env, agentQuery, days) {
  const a = agentByNameOrId(agentQuery);
  if (!a) return { ok: false, text: `No PAPER agent called "${agentQuery}". The named traders are ${COUNCIL_TRADERS.map(id => AGENTS[id].name).join(', ')}.` };
  let candles = []; try { const raw = await env.RAYVEN_KV.get(`paper:candles:${a.id}`); candles = raw ? JSON.parse(raw) : []; } catch (e) {}
  const dayset = new Set(candles.map(c => nyDateString(c.time)));
  if (dayset.size < 5) return { ok: false, text: `Insufficient cached history for ${a.name || a.label}: only ${dayset.size} trading day(s) of candles are cached (${candles.length} bars). The backtest replays cached candles only — it never spends a market-data call.` };
  const wantDays = Math.max(1, Math.min(Number(days) || dayset.size, dayset.size));
  const keepDays = new Set([...dayset].sort().slice(-wantDays)); const cs = candles.filter(c => keepDays.has(nyDateString(c.time)));
  const fm = fillModelFor(INSTRUMENTS[a.instrumentId].provider);
  let cash = DEFAULT_STARTING_BALANCE, pos = null; const trades = [];
  const close = (price, time, reason) => { const fill = price * (1 - fm.slippageBps / 10000), proceeds = pos.qty * fill, comm = proceeds * fm.commissionPct / 100; trades.push({ agent: a.id, pnl: (fill - pos.entryPrice) * pos.qty - comm - pos.entryCommission, pnlPct: (fill - pos.entryPrice) / pos.entryPrice, exitTime: new Date(time).toISOString(), reason }); cash += proceeds - comm; pos = null; };
  for (let i = LOOKBACK + 1; i < cs.length; i++) {
    const w = cs.slice(0, i + 1), last = w[w.length - 1];
    if (pos && last.low <= pos.stopPrice) { close(pos.stopPrice, last.time, 'stop'); continue; }
    const sig = SIGNAL_FNS[a.strategy](w, !!pos);
    if (pos && sig.action === 'exit') close(last.close, last.time, sig.reason);
    else if (!pos && sig.action === 'enter') {
      const vol = computeVolatility(w), frac = sizeFractionForVolatility(vol), spend = Math.min(cash * frac, POSITION_CAP_FRACTION * DEFAULT_STARTING_BALANCE);
      const fill = last.close * (1 + fm.slippageBps / 10000), qty = spend / fill, comm = qty * fill * fm.commissionPct / 100;
      if (qty > 0 && qty * fill + comm <= cash) { cash -= qty * fill + comm; pos = { qty, entryPrice: fill, entryCommission: comm, stopPrice: last.close * (1 - stopDistanceFraction(w, last.close)) }; }
    }
  }
  const s = computeAgentStats(trades, a.id, DEFAULT_STARTING_BALANCE);
  const f = v => (v == null ? '—' : `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`);
  return { ok: true, stats: s, text: [
    `PAPER BACKTEST — ${a.name || a.label} (${a.strategy}), replaying ${cs.length} cached bars over ${keepDays.size} trading day(s). Simulated only; no real money, no live data fetched.`,
    `Trades ${s.trades} · win rate ${s.winRatePct == null ? '—' : s.winRatePct.toFixed(0) + '%'} · P&L ${f(s.pnl)} · avg win ${f(s.avgWin)} · avg loss ${f(s.avgLoss)} · max drawdown ${s.maxDrawdownPct.toFixed(2)}% · Sharpe-style ${s.sharpeStyle == null ? '—' : s.sharpeStyle.toFixed(2)} · fees paid $${s.fees.toFixed(2)}.`,
    `Assumptions: ${fm.note}. A window this short says little — treat it as a shape, not a verdict.`,
    pos ? `A simulated position was still open at the end (entered $${pos.entryPrice.toFixed(2)}); it is not counted.` : ''
  ].filter(Boolean).join('\n') };
}
export async function paperBacktestText(env, agentQuery, days) { return (await paperBacktest(env, agentQuery, days)).text; }

// After the NYSE close on a trading day: one equity sample per agent, one batched
// self-review per named trader (cheap tier, off the live bill), and on later ticks
// the collected reviews land in each trader's journal (one write per trader per day).
function nyPartsNow() { const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ_NY, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }); const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, minutes: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }; }
// (Batch collection moved to the tick hook in index.js -- Phase 6.2 -- where every collector, this one included, runs once per tick.)
export async function runPaperCloseTasksIfDue(env) {
  const { date, minutes, weekday } = nyPartsNow();
  const closeMin = nyseCloseMinutes(date);
  if (weekday < 1 || weekday > 5 || NYSE_HOLIDAYS.has(date)) return { ok: true, skipped: 'not a trading day' };
  if (minutes < closeMin || minutes >= closeMin + 10) return { ok: true, skipped: 'not the close window' };
  const last = await env.RAYVEN_KV.get(CLOSE_LAST_KEY);
  if (last === date) return { ok: true, skipped: 'close tasks already done today' };
  const [portfolio, trades] = await Promise.all([getPortfolio(env), readCappedLog(env, TRADES_KEY)]);
  for (const id of Object.keys(AGENTS)) { try { await updateAgentStats(env, id, trades, portfolio, { sample: true }); } catch (e) { console.error('close sample failed', id, e.message); } }
  const requests = COUNCIL_TRADERS.map(id => {
    const a = AGENTS[id], mine = trades.filter(t => t.agent === id && nyDateString(t.exitTime) === date), pos = portfolio.positions[id], s = computeAgentStats(trades, id, portfolio.startingBalance);
    const facts = [
      `Today (${date}) closed trades: ${mine.length ? mine.map(t => `${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)} (${t.exitReason})`).join('; ') : 'none'}.`,
      `Open position: ${pos ? `long ${pos.qty.toFixed(4)} from $${pos.entryPrice.toFixed(2)}, stop $${pos.stopPrice.toFixed(2)}` : 'none'}.`,
      `All-time: ${s.trades} trades, win rate ${s.winRatePct == null ? '—' : s.winRatePct.toFixed(0) + '%'}, P&L ${s.pnl >= 0 ? '+' : '-'}$${Math.abs(s.pnl).toFixed(2)}, max drawdown ${s.maxDrawdownPct.toFixed(2)}%.`
    ].join('\n');
    return { custom_id: `${date}:${id}`, model: MODELS.haiku, max_tokens: 160,
      system: `You are ${a.name}, one of Odin's five PAPER-trading councillors in ASGARD (${a.label}; strategy ${a.strategy}). Write your own two-sentence after-close self-review of today, in first person, plain text, no markdown. Use ONLY the numbers given — never invent one. Everything is simulated paper trading; do not recommend any real trade.`,
      messages: [{ role: 'user', content: facts }] };
  });
  const sub = await submitAndRemember(env, 'trader-reviews', requests, { date });
  await env.RAYVEN_KV.put(CLOSE_LAST_KEY, date);
  return { ok: true, date, sampled: Object.keys(AGENTS).length, reviewsSubmitted: sub.ok, batch: sub.id || null, error: sub.error || null };
}
export async function collectTraderReviews(env, entry, results) {
  let n = 0;
  for (const r of results) {
    if (!r.custom_id || !r.text) continue;
    const id = r.custom_id.split(':').pop(); if (!AGENTS[id]) continue;
    await appendCappedLog(env, JOURNAL_KEY(id), { date: (entry.meta && entry.meta.date) || r.custom_id.slice(0, 10), text: String(r.text).trim().slice(0, 600), label: 'PAPER' }, JOURNAL_CAP); n++;
    if (r.usage) tickLog('cost', costLine({ persona: 'odin', councillor: id, model: MODELS.haiku, usage: r.usage, source: 'trader-review', batch: true }));   // Phase 6.6
  }
  return { note: `${n} review(s) journaled` };
}
export async function getTraderJournal(env, agentId) { return await readCappedLog(env, JOURNAL_KEY(agentId)); }
