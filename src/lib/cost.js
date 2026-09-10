import {ledger,ledgerBackend} from './ledger.js';
// THE COST TRACKER (asgard-upgrade Phase 6.6).
//
// Every Anthropic call reports its token usage. On the reply path the numbers
// ride in the conversation's _spool (kind 'cost'); in cron they go to the tick
// buffer. The tick rolls them into a running total for the UTC day inside
// tick:last (no extra write) and, on the first tick of the next day, writes ONE
// summary key cost:YYYY-MM-DD. Dollar figures are estimates from list prices.
import { MODELS } from './models.js';

// $ per million tokens, input / output. Cache reads are billed at 10% of input,
// cache writes at 125% (5m) or 200% (1h); Message Batches at 50% of everything.
export const PRICES = {
  [MODELS.sonnet]: { in: 2, out: 10 },
  [MODELS.haiku]: { in: 1, out: 5 }
};
export function tierOf(model) { return model === MODELS.haiku ? 'haiku' : model === MODELS.sonnet ? 'sonnet' : (model || 'unknown'); }

export function usd(model, usage, { batch = false } = {}) {
  const p = PRICES[model] || PRICES[MODELS.sonnet];
  const u = usage || {};
  const inTok = Number(u.input_tokens) || 0, outTok = Number(u.output_tokens) || 0, cr = Number(u.cache_read_input_tokens) || 0, cw = Number(u.cache_creation_input_tokens) || 0;
  const hourWrites = Math.min(cw, Number(u.cache_creation?.ephemeral_1h_input_tokens) || 0);
  let dollars = (inTok * p.in + outTok * p.out + cr * p.in * 0.1 + (cw - hourWrites) * p.in * 1.25 + hourWrites * p.in * 2) / 1e6;
  if (batch) dollars *= 0.5;
  return dollars;
}

// One cost line, as pushed to a spool or the tick buffer.
export function costLine({ persona, councillor, model, usage, source, batch }) {
  const u = usage || {};
  return {
    persona: persona || null, councillor: councillor || null, model: model || MODELS.sonnet, tier: batch ? 'batch' : tierOf(model), source: source || 'chat',
    in: Number(u.input_tokens) || 0, out: Number(u.output_tokens) || 0, cacheRead: Number(u.cache_read_input_tokens) || 0, cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    usd: usd(model, usage, { batch: !!batch })
  };
}

export function emptyCost(day) { return { day, calls: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0, usd: 0, byPersona: {}, byCouncillor: {}, byTier: {} }; }
export function addCost(total, line) {
  const t = total; t.calls += 1; t.in += line.in || 0; t.out += line.out || 0; t.cacheRead += line.cacheRead || 0; t.cacheWrite += line.cacheWrite || 0; t.usd += line.usd || 0;
  const bump = (bag, key) => { if (!key) return; const b = bag[key] || (bag[key] = { calls: 0, usd: 0 }); b.calls += 1; b.usd += line.usd || 0; };
  bump(t.byPersona, line.persona); bump(t.byCouncillor, line.councillor); bump(t.byTier, line.tier);
  return t;
}

const money = v => `$${(Number(v) || 0).toFixed(2)}`;
export async function costReportText(env, days = 7) {
  let last = {}; const durable=ledgerBackend(env)==='do';
  try { if(durable)last=await ledger.get(env,'tick:last')||{};else {const raw=await env.RAYVEN_KV.get('tick:last');last=raw?JSON.parse(raw):{};} } catch {return 'Cost tracking is temporarily unavailable; no zero-spend estimate was substituted.';}
  const today = new Date().toISOString().slice(0, 10);
  const running = last.day === today && last.costToday ? last.costToday : emptyCost(today);
  const keys = []; for (let i = 1; i <= days; i++) keys.push(`cost:${new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)}`);
  const raws = durable ? [] : await Promise.all(keys.map(k => env.RAYVEN_KV.get(k).catch(() => null)));
  let past = raws.map(r => { try { return r ? JSON.parse(r) : null; } catch (e) { return null; } }).filter(Boolean);
  if(durable){try{past=(await ledger.costDays(env,days)).filter(row=>row.day!==today);}catch{return 'Historical cost tracking is temporarily unavailable.';}}
  const week = past.reduce((s, d) => s + (d.usd || 0), running.usd || 0);
  const personas = {}; const tiers = {};
  for (const d of [running, ...past]) { for (const [k, v] of Object.entries(d.byPersona || {})) personas[k] = (personas[k] || 0) + v.usd; for (const [k, v] of Object.entries(d.byTier || {})) tiers[k] = (tiers[k] || 0) + v.usd; }
  const lines = [
    `Model spend, estimated from list prices (cache reads at 10%, batches at 50%). Tracking started 2026-09-05; missing days are unmeasured.`,
    `Today so far (UTC ${today}): ${money(running.usd)} over ${running.calls} call(s), ${running.in + running.cacheRead} tokens in / ${running.out} out.`,
    `Last ${days} day(s) plus today: ${money(week)} (${past.length} day summar${past.length === 1 ? 'y' : 'ies'} on record).`,
    Object.keys(personas).length ? `By persona: ${Object.entries(personas).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${money(v)}`).join(' · ')}.` : null,
    Object.keys(tiers).length ? `By tier: ${Object.entries(tiers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${money(v)}`).join(' · ')}.` : null,
    `Cache tokens today: ${running.cacheRead || 0} read / ${running.cacheWrite || 0} written.`,
    `Not counted: Workers AI free-tier calls (the councils' free tier, the critic), ElevenLabs speech, search APIs.`
  ].filter(Boolean);
  return lines.join('\n');
}
