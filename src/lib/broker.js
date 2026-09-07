// THE BROKER INTERFACE (asgard-upgrade Phase 4.1).
//
// One interface, two implementations. PaperBroker is the existing paper-trading
// portfolio logic moved BEHIND the interface: same KV keys, same agent ids,
// same position shape, same trade log -- a refactor, not a change. LiveBroker
// is a stub whose every method throws LIVE_TRADING_DISABLED with the list of
// gates not met. There is NO go-live tool, NO broker client, NO key, and no
// code anywhere writes config:trading:mode or config:trading:live_ack. No
// real-money code path can execute. trading_readiness answers honestly:
// "mode: paper. No live path exists." and lists the gates and their status.
//
// The signatures are shaped like a broker API that offers a free paper
// endpoint and a live endpoint with the same request shape (Alpaca's orders
// API is the usual example: symbol, qty, side, type, time_in_force, stop
// price). That is a shape borrowed for the day a switch is ever considered --
// nothing here calls it, and nothing here signs up for it.

export const LIVE_TRADING_DISABLED = 'LIVE_TRADING_DISABLED';
export const TRADING_MODE_KEY = 'config:trading:mode';          // READ ONLY here; 'paper' when missing
export const TRADING_LIVE_ACK_KEY = 'config:trading:live_ack';  // never written by any code in this repo
export const TRADING_RISK_KEY = 'config:trading:risk';          // max drawdown gate, percent; default 8
export const TRADING_HALT_KEY = 'config:trading:halt';          // the kill switch: { halted, reason, at, by }

// Phase 4.3 fill model. Every PAPER fill pays these, so the record is honest:
// slippage is applied against the trader (buy higher, sell lower), and the
// commission is charged per fill. Stated in every report that quotes a fill.
export const FILL_MODEL = {
  kraken: { slippageBps: 10, commissionPct: 0.26, note: 'crypto: 0.10% slippage + Kraken taker fee 0.26% per fill' },
  twelvedata: { slippageBps: 5, commissionPct: 0, note: 'ETFs: 0.05% slippage, $0 commission (commission-free brokerage assumption)' }
};
export function fillModelFor(provider) { return FILL_MODEL[provider] || { slippageBps: 5, commissionPct: 0, note: 'default: 0.05% slippage, no commission' }; }

export class Broker {
  constructor(env) { this.env = env; this.kind = 'abstract'; }
  async getQuote(symbol) { throw new Error('Broker.getQuote not implemented'); }
  async getPositions() { throw new Error('Broker.getPositions not implemented'); }
  async getBalance() { throw new Error('Broker.getBalance not implemented'); }
  async placeOrder(order) { throw new Error('Broker.placeOrder not implemented'); }
  async cancelOrder(id) { throw new Error('Broker.cancelOrder not implemented'); }
  async closePosition(id, opts) { throw new Error('Broker.closePosition not implemented'); }
}

// The paper broker works on the in-memory portfolio object the trading cycle
// loads once per tick and saves once at the end (only when something changed).
// quotes: Map<instrumentId, lastCandle>. hooks.onClose(agentId, position,
// exitPrice, exitTime, reason, fees) logs the trade (paperTrading.logTrade).
export class PaperBroker extends Broker {
  constructor(env, portfolio, { quotes = new Map(), hooks = {}, providerOf = () => 'twelvedata', fills = true } = {}) {
    super(env); this.kind = 'paper'; this.portfolio = portfolio; this.quotes = quotes; this.hooks = hooks; this.providerOf = providerOf; this.fills = fills;
  }
  async getQuote(symbol) { const c = this.quotes.get(symbol); return c ? { symbol, price: c.close, time: c.time, paper: true } : null; }
  async getPositions() {
    return Object.entries(this.portfolio.positions || {}).map(([id, p]) => ({ id, agentId: id, symbol: p.symbol || null, side: 'long', qty: p.qty, entryPrice: p.entryPrice, entryTime: p.entryTime, stopPrice: p.stopPrice, paper: true }));
  }
  async getBalance() { return { cash: this.portfolio.cash, startingBalance: this.portfolio.startingBalance, paper: true }; }
  // A market order fills at the given price, worse by the slippage model, and
  // pays the commission. Returns the position exactly as the cycle used to
  // build it (plus the fee fields), so nothing downstream changes shape.
  async placeOrder({ agentId, symbol, side = 'buy', qty, price, time, stop, reason, provider, meta = {} }) {
    if (side !== 'buy') return { ok: false, error: 'the paper book is long-only' };
    if (!(qty > 0) || !(price > 0)) return { ok: false, error: 'position sizing produced zero/invalid size' };
    const fm = this.fills ? fillModelFor(provider || this.providerOf(symbol)) : { slippageBps: 0, commissionPct: 0 };
    const fillPrice = price * (1 + fm.slippageBps / 10000);
    const notional = qty * fillPrice;
    const commission = notional * (fm.commissionPct / 100);
    const spend = notional + commission;
    if (spend > this.portfolio.cash) return { ok: false, error: 'not enough simulated cash for that size after fees' };
    this.portfolio.cash -= spend;
    const position = {
      qty, entryPrice: fillPrice, entryTime: time, stopPrice: stop,
      strategy: meta.strategy, entryReason: reason,
      sizeFraction: meta.sizeFraction, volatilityAtEntry: meta.volatilityAtEntry, stopFraction: meta.stopFraction,
      ...(meta.manual ? { manual: true } : {}),
      fees: { entryCommission: commission, slippageBps: fm.slippageBps, quotedPrice: price }
    };
    this.portfolio.positions[agentId] = position;
    return { ok: true, fill: { price: fillPrice, qty, commission, slippageBps: fm.slippageBps }, position };
  }
  async cancelOrder(id) { return { ok: false, error: 'the paper broker fills market orders instantly; there is nothing to cancel' }; }
  async closePosition(agentId, { price, time, reason, provider } = {}) {
    const position = this.portfolio.positions[agentId];
    if (!position) return { ok: false, error: `${agentId} has no open position` };
    const fm = this.fills ? fillModelFor(provider || this.providerOf(agentId)) : { slippageBps: 0, commissionPct: 0 };
    const fillPrice = price * (1 - fm.slippageBps / 10000);
    const proceeds = position.qty * fillPrice;
    const commission = proceeds * (fm.commissionPct / 100);
    const fees = { exitCommission: commission, entryCommission: (position.fees && position.fees.entryCommission) || 0, slippageBps: fm.slippageBps, quotedExit: price };
    let trade = null;
    if (typeof this.hooks.onClose === 'function') trade = await this.hooks.onClose(agentId, position, fillPrice, time, reason, fees);
    this.portfolio.cash += proceeds - commission;
    delete this.portfolio.positions[agentId];
    return { ok: true, fill: { price: fillPrice, commission }, trade };
  }
}

// Every method throws. The message carries the gates that are not met, so a
// caller (or a human reading a log) sees exactly why nothing happened.
export class LiveBroker extends Broker {
  constructor(env, gates) { super(env); this.kind = 'live-stub'; this.gates = gates || []; }
  _refuse() {
    const unmet = this.gates.filter(g => !g.met).map(g => g.name);
    throw new Error(`${LIVE_TRADING_DISABLED}: no live path exists. Gates not met: ${unmet.length ? unmet.join(', ') : '(all listed gates met, but there is still no live implementation)'}`);
  }
  async getQuote() { this._refuse(); } async getPositions() { this._refuse(); } async getBalance() { this._refuse(); }
  async placeOrder() { this._refuse(); } async cancelOrder() { this._refuse(); } async closePosition() { this._refuse(); }
}

// ---- mode, gates, readiness ---------------------------------------------------
export async function getTradingMode(env) {
  const v = await env.RAYVEN_KV.get(TRADING_MODE_KEY).catch(() => null);
  return v === 'live' ? 'live' : 'paper';
}
export async function getHalt(env) {
  try { const raw = await env.RAYVEN_KV.get(TRADING_HALT_KEY); if (!raw) return { halted: false }; const j = JSON.parse(raw); return { halted: !!j.halted, reason: j.reason || null, at: j.at || null, by: j.by || null, day: j.day || null }; }
  catch (e) { return { halted: false }; }
}
export async function setHalt(env, halted, reason, by, day) {
  const rec = { halted: !!halted, reason: reason || null, at: new Date().toISOString(), by: by || 'odin', day: day || null };
  await env.RAYVEN_KV.put(TRADING_HALT_KEY, JSON.stringify(rec));
  return rec;
}

// Drawdown from an equity/pnl series: the deepest peak-to-trough fall as a
// fraction of the peak.
export function maxDrawdown(values) {
  let peak = -Infinity, dd = 0;
  for (const v of values) { if (v > peak) peak = v; if (peak > 0) { const d = (peak - v) / peak; if (d > dd) dd = d; } }
  return dd;
}

// gates: what a future switch WOULD require. Listed as documentation. This
// function reads; it never writes any of these keys.
export async function tradingGates(env, { trades = [], equity = [], startingBalance = 10000 } = {}) {
  const [ack, riskRaw, halt] = await Promise.all([
    env.RAYVEN_KV.get(TRADING_LIVE_ACK_KEY).catch(() => null),
    env.RAYVEN_KV.get(TRADING_RISK_KEY).catch(() => null),
    getHalt(env)
  ]);
  const riskPct = riskRaw !== null && riskRaw !== '' && isFinite(Number(riskRaw)) ? Number(riskRaw) : 8;
  const days = new Set(trades.map(t => String(t.exitTime || '').slice(0, 10)).filter(Boolean));
  // Drawdown on REALISED equity (starting balance + cumulative closed P&L), not on
  // cash: cash falls every time a position opens, which read as a 60% "drawdown"
  // on a book that had lost nine dollars.
  let cum = startingBalance; const curve = [startingBalance];
  for (const t of trades.slice().sort((a, b) => String(a.exitTime).localeCompare(String(b.exitTime)))) { cum += Number(t.pnl) || 0; curve.push(cum); }
  const dd = maxDrawdown(curve);
  return [
    { name: 'secret LIVE_BROKER_KEY exists', met: !!env.LIVE_BROKER_KEY, detail: env.LIVE_BROKER_KEY ? 'set' : 'not set (and nothing in this repo reads it for trading)' },
    { name: 'config:trading:live_ack holds a phrase Rayan typed through a go-live tool', met: !!ack, detail: ack ? 'present' : 'absent — and no go-live tool exists to write it (it would need a live confirmation AND a Telegram approval: two yeses on two surfaces)' },
    { name: 'paper journal shows at least 30 distinct trading days', met: days.size >= 30, detail: `${days.size} distinct day(s) so far` },
    { name: `paper max drawdown under config:trading:risk (${riskPct}%)`, met: dd * 100 < riskPct, detail: `${(dd * 100).toFixed(2)}% max drawdown on realised equity` },
    { name: 'trading_halt is not set', met: !halt.halted, detail: halt.halted ? `halted: ${halt.reason || 'no reason given'}` : 'not halted' }
  ];
}

export async function getBroker(env, portfolio, opts = {}) {
  const mode = await getTradingMode(env);
  if (mode === 'live') return new LiveBroker(env, await tradingGates(env, opts.gateData || {}));
  return new PaperBroker(env, portfolio, opts);
}

export async function tradingReadiness(env, gateData = {}) {
  const mode = await getTradingMode(env);
  const gates = await tradingGates(env, gateData);
  const halt = await getHalt(env);
  const lines = [
    `mode: ${mode}. No live path exists — there is no broker client, no key, and no go-live tool in this codebase; LiveBroker is a stub that refuses every call.`,
    `kill switch: ${halt.halted ? `HALTED (${halt.reason || 'no reason given'}, since ${halt.at})` : 'not halted'}. A halt blocks NEW paper orders only; it never force-closes.`,
    'Gates a future switch would require (documentation, not a plan):',
    ...gates.map(g => `  ${g.met ? '[met]    ' : '[not met]'} ${g.name} — ${g.detail}`),
    'Everything above concerns PAPER / SIMULATED trading. No real money is or can be involved.'
  ];
  return { mode, livePathExists: false, halt, gates, text: lines.join('\n') };
}
