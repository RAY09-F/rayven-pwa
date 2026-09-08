// Assembles the three-realm HUD's live panels from the subsystems that already
// hold the data: the paper-trading desk (Odin), todos and routines (Loki's day
// board and Thor's campaign), and the activity log (the ticker).
//
// Every field is optional. A realm only reports values it can genuinely source;
// anything missing is omitted so the frontend keeps the design's own copy
// rather than showing a blank or an invented number.

import { getPaperStatus } from './paperTrading.js';
import { getActivityLog } from './activity.js';


const money = n => (n < 0 ? '-' : '+') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const tone = n => (n > 0 ? 'up' : n < 0 ? 'down' : undefined);
const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { return fallback; } };
// Deliberately not kv-store's getTodos: that one swallows read errors and hands
// back an empty array, which the HUD cannot tell apart from "you have no todos".
// A read failure has to reach `safe` so the realm reports nothing and the design
// values stay on screen instead of a fabricated zero.
// Both of these read KV directly rather than through kv-store's getTodos or
// routines' readRoutinesIndex. Those two swallow read errors and hand back an
// empty array, which the HUD cannot tell apart from "you genuinely have none".
// A failure has to reach `safe` so the realm reports nothing for that stat and
// the design's own value stays on screen instead of a fabricated zero.
const readTodos = async env => { const raw = await env.RAYVEN_KV.get('todos'); return raw ? JSON.parse(raw) : []; };
const readRoutines = async env => {
  const raw = await env.RAYVEN_KV.get('routines:index');
  const index = raw ? JSON.parse(raw) : [];
  return Array.isArray(index) ? index.filter(r => !r.deleted) : [];
};

// ---- Odin: paper desk ----------------------------------------------------
function odinDesk(paper) {
  if (!paper) return null;
  const open = Object.values(paper.openPositions || {});
  const today = paper.today || {}, all = paper.allTime || {};
  const winRate = today.winRatePct ?? all.winRatePct;
  const stats = [
    { v: String(open.length) },
    { v: String(today.trades ?? 0) },
    today.wins != null && today.losses != null
      ? { v: `${today.wins} / ${today.losses}`, t: tone(today.wins - today.losses) } : null,
    all.pnl != null ? { v: money(all.pnl), t: tone(all.pnl) } : null
  ];
  // Rows come from closed trades, not open positions. An open position carries
  // no P/L field -- there is no mark price in the payload -- so reading one
  // would print a confident $0 against every line.
  const rows = (paper.recentTrades || []).slice(0, 3).map(t => {
    const pnl = Number(t.pnl ?? 0);
    const [instrument] = String(t.market || t.label || '').split(' \u2014 ');
    const who = String(t.agentName || '').toUpperCase();
    const side = String(t.side || '').toUpperCase();
    return { k: `${instrument.toUpperCase()}${side ? ' ' + side : ''}${who ? ' \u00b7 ' + who : ''}`.trim(), v: money(pnl), t: tone(pnl) };
  });
  return { stats, rows, signal: winRate != null ? `WIN RATE ${Math.round(winRate)}%` : undefined };
}

// ---- Loki: day board -----------------------------------------------------
function lokiDesk(todos, routines) {
  if (!todos && !routines) return null;
  const openTodos = todos ? todos.filter(t => !t.done) : null;
  const stats = [
    routines ? { v: String(routines.filter(r => r.enabled).length) } : null,
    todos ? { v: String(todos.length) } : null,
    openTodos ? { v: String(openTodos.length), t: openTodos.length ? 'down' : 'up' } : null,
    null   // no free-block source yet; the design's value stands
  ];
  const rows = (openTodos || []).slice(0, 3).map(t => ({
    k: `REMIND · ${String(t.text || '').toUpperCase()}`,
    v: t.created ? String(t.created).slice(11, 16) : '—'
  }));
  return { stats, rows, signal: openTodos ? `${openTodos.length} DUE TODAY` : undefined };
}

// ---- Thor: campaign ------------------------------------------------------
function thorDesk(todos, routines) {
  if (!todos && !routines) return null;
  const done = todos ? todos.filter(t => t.done).length : null;
  const plans = routines ? routines.filter(r => r.enabled) : null;
  const pct = todos && todos.length ? Math.round((done / todos.length) * 100) : null;
  const stats = [
    plans ? { v: String(plans.length) } : null,
    todos && todos.length ? { v: `${done}/${todos.length}` } : null,
    pct != null ? { v: `${pct}%`, t: pct >= 50 ? 'up' : 'down' } : null,
    null   // no gate/milestone source yet; the design's value stands
  ];
  const rows = (plans || []).slice(0, 3).map(r => ({
    k: String(r.name || r.id || '').toUpperCase(),
    v: r.enabled ? 'ON TRACK' : 'PAUSED',
    t: r.enabled ? 'up' : 'down'
  }));
  return { stats, rows, signal: pct != null ? `ON TRACK ${pct}%` : undefined };
}

// ---- ticker --------------------------------------------------------------
function ticker(activity) {
  if (!Array.isArray(activity) || !activity.length) return [];
  return activity.slice(-8).reverse()
    .map(e => [e.subsystem, e.action || e.decided || e.observed].filter(Boolean).join(' '))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean).slice(0, 8);
}

export async function getHudSummary(env) {
  const [paper, todos, routines, activity] = await Promise.all([
    safe(() => getPaperStatus(env), null),
    safe(() => readTodos(env), null),
    safe(() => readRoutines(env), null),
    safe(() => getActivityLog(env), null)
  ]);
  const realms = {};
  const odin = odinDesk(paper); if (odin) realms.odin = odin;
  const loki = lokiDesk(todos, routines); if (loki) realms.loki = loki;
  const thor = thorDesk(todos, routines); if (thor) realms.thor = thor;
  return {
    generated: new Date().toISOString(),
    label: 'PAPER / SIMULATED — no real money',
    realms,
    ticker: ticker(activity)
  };
}
