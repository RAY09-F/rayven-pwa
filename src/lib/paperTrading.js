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

const TZ_NY = 'America/New_York';
const TZ_LA = 'America/Los_Angeles';

const DEFAULT_STARTING_BALANCE = 10000;
const PORTFOLIO_KEY = 'paper:portfolio';
const TRADES_KEY = 'paper:trades';
const TRADES_CAP = 1000;
const STOP_LOSS_PCT = 0.01; // hard 1%, no exceptions
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
  // launch (2026-09-03); the id "tyr" and the display name "TYR" now point at
  // two different agents -- that's intentional, not a bug.
  freya: {
    id: 'freya', name: 'STRANGE', label: 'Ethereum — STRANGE', instrumentId: 'eth', resampleFactor: null, strategy: 'momentum',
    theme: 'Sees a million outcomes before acting — hunts the one breakout timeline that actually happens.'
  },
  tyr: {
    id: 'tyr', name: 'MAGNI', label: 'Bitcoin — MAGNI', instrumentId: 'btcFast', resampleFactor: null, strategy: 'meanReversion',
    theme: 'Sheer strength, no wasted motion — waits for oversold, closes on the snap-back.'
  },
  baldr: {
    id: 'baldr', name: 'GROOT', label: 'S&P 500 (SPY proxy) — GROOT', instrumentId: 'spy', resampleFactor: 10, strategy: 'trendFollowing',
    theme: 'Patient and steady — grows with the trend and holds until it actually turns.'
  },
  heimdall: {
    id: 'heimdall', name: 'TYR', label: 'Nasdaq (QQQ proxy) — TYR', instrumentId: 'qqq', resampleFactor: 10, strategy: 'trendFollowing',
    theme: 'Commits fully once the trend is confirmed — no half-measures.'
  },
  vidar: {
    id: 'vidar', name: 'HEIMDALL', label: 'Gold (GLD proxy) — HEIMDALL', instrumentId: 'gld', resampleFactor: 16, strategy: 'momentum',
    theme: 'Watches gold in silence, sees the breakout coming before anyone else.'
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

// ---- strategies: each returns { action: 'enter'|'exit'|'hold', reason } ----

function meanReversionSignal(candles, hasPosition) {
  if (candles.length < LOOKBACK + 1) return { action: 'hold', reason: 'not enough candle history yet' };
  const window = candles.slice(-LOOKBACK - 1, -1);
  const closes = window.map(c => c.close);
  const mean = closes.reduce((s, x) => s + x, 0) / closes.length;
  const variance = closes.reduce((s, x) => s + (x - mean) ** 2, 0) / closes.length;
  const stdev = Math.sqrt(variance) || 0.0001;
  const last = candles[candles.length - 1].close;
  const z = (last - mean) / stdev;
  if (!hasPosition && z <= -1.5) return { action: 'enter', reason: `oversold vs 20-bar mean (z-score ${z.toFixed(2)})` };
  if (hasPosition && z >= 0) return { action: 'exit', reason: `reverted to 20-bar mean (z-score ${z.toFixed(2)})` };
  return { action: 'hold', reason: `z-score ${z.toFixed(2)}` };
}

function momentumBreakoutSignal(candles, hasPosition) {
  if (candles.length < LOOKBACK + 11) return { action: 'hold', reason: 'not enough candle history yet' };
  const window = candles.slice(-LOOKBACK - 1, -1);
  const donchianHigh = Math.max(...window.map(c => c.high));
  const sma10 = candles.slice(-11, -1).reduce((s, c) => s + c.close, 0) / 10;
  const last = candles[candles.length - 1].close;
  if (!hasPosition && last > donchianHigh) return { action: 'enter', reason: `breakout above ${LOOKBACK}-bar high ${donchianHigh.toFixed(2)}` };
  if (hasPosition && last < sma10) return { action: 'exit', reason: `fell below 10-bar average ${sma10.toFixed(2)}, momentum fading` };
  return { action: 'hold', reason: 'inside recent range' };
}

function trendFollowingSignal(candles, hasPosition) {
  if (candles.length < 21) return { action: 'hold', reason: 'not enough candle history yet' };
  const fast = candles.slice(-8).reduce((s, c) => s + c.close, 0) / 8;
  const slow = candles.slice(-21).reduce((s, c) => s + c.close, 0) / 21;
  if (!hasPosition && fast > slow) return { action: 'enter', reason: `uptrend: 8-bar avg ${fast.toFixed(2)} > 21-bar avg ${slow.toFixed(2)}` };
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

async function logTrade(env, agentDef, position, exitPrice, exitTime, exitReason) {
  const pnl = (exitPrice - position.entryPrice) * position.qty;
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
    exitReason
  };
  await appendCappedLog(env, TRADES_KEY, entry, TRADES_CAP);
  return entry;
}

function closePosition(portfolio, agentId, position, exitPrice) {
  portfolio.cash += position.qty * exitPrice;
  delete portfolio.positions[agentId];
}

async function fetchInstrumentCandles(env, instrumentId) {
  const instr = INSTRUMENTS[instrumentId];
  return instr.provider === 'kraken'
    ? await fetchKrakenCandles(instr.krakenPair, instr.krakenInterval)
    : await fetchTwelveDataCandles(env, instr.tdSymbol, instr.baseInterval, 200);
}

// instrumentCache is populated once per tick per instrument (not per agent),
// so two agents sharing an instrument (btc: original+TYR, spy: original+BALDR,
// etc.) only ever cost one real fetch each.
async function processAgent(env, agentId, portfolio, instrumentCache) {
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

  // HARD STOP LOSS — checked before any strategy logic, no exceptions.
  if (position && lastCandle.low <= position.stopPrice) {
    await logTrade(env, a, position, position.stopPrice, lastCandle.time, 'hard 1% stop loss hit — no exceptions');
    closePosition(portfolio, agentId, position, position.stopPrice);
    outcome = { agentId, action: 'stopped_out', price: position.stopPrice };
  } else {
    const signal = SIGNAL_FNS[a.strategy](candles, !!position);
    if (position && signal.action === 'exit') {
      await logTrade(env, a, position, lastCandle.close, lastCandle.time, signal.reason);
      closePosition(portfolio, agentId, position, lastCandle.close);
      outcome = { agentId, action: 'closed', reason: signal.reason, price: lastCandle.close };
    } else if (!position && signal.action === 'enter') {
      const pairId = CORRELATED_PAIR[agentId];
      if (pairId && portfolio.positions[pairId]) {
        outcome = { agentId, action: 'skipped_correlation', reason: `${pairId.toUpperCase()} is already simulated-long — correlation filter blocked stacking ${agentId.toUpperCase()}` };
      } else {
        const vol = computeVolatility(candles);
        const sizeFraction = sizeFractionForVolatility(vol);
        const spend = portfolio.cash * sizeFraction;
        const qty = spend / lastCandle.close;
        if (qty > 0 && spend <= portfolio.cash) {
          portfolio.cash -= spend;
          portfolio.positions[agentId] = {
            qty, entryPrice: lastCandle.close, entryTime: lastCandle.time,
            stopPrice: lastCandle.close * (1 - STOP_LOSS_PCT),
            strategy: a.strategy, entryReason: signal.reason,
            sizeFraction, volatilityAtEntry: vol
          };
          outcome = { agentId, action: 'entered', reason: signal.reason, qty, price: lastCandle.close, sizeFraction };
        } else {
          outcome = { agentId, action: 'skipped_no_cash', reason: 'position sizing produced zero/invalid size' };
        }
      }
    } else {
      outcome = { agentId, action: 'hold', reason: signal.reason };
    }
  }

  await env.RAYVEN_KV.put(lastProcessedKey, String(lastCandle.time));
  return outcome;
}

const PORTFOLIO_MUTATING_ACTIONS = new Set(['entered', 'closed', 'stopped_out']);

export async function runPaperTradingCycleIfDue(env) {
  const portfolio = await getPortfolio(env);
  const results = [];
  let mutated = false;
  const instrumentCache = new Map();
  for (const agentId of Object.keys(AGENTS)) {
    try {
      const outcome = await processAgent(env, agentId, portfolio, instrumentCache);
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
  return { ok: !saveError, results, saveError, portfolioSaved: mutated };
}

// ---- status (feeds the HUD panel, Odin's tool, and the debug route) ----

export async function getPaperStatus(env) {
  const [portfolio, trades] = await Promise.all([getPortfolio(env), readCappedLog(env, TRADES_KEY)]);
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
