import {writeFile} from 'node:fs/promises';
const base='https://asgrard-backend.rayanfahil2.workers.dev';
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
const [status,research]=await Promise.all([read('/paper-trading/status'),read('/paper-trading/research')]);
const money=n=>Number(n).toFixed(2),pct=n=>n==null?'not available':Number(n).toFixed(2)+'%';
const lines=['# Paper trading diagnostic snapshot',`Generated ${new Date().toISOString()}. Simulated money only.`,
`Closed trades: ${status.allTime.trades}; wins: ${status.allTime.wins}; win rate: ${pct(status.allTime.winRatePct)}; realized P&L: $${money(status.allTime.pnl)}.`,
`Cached-mark equity: $${money(status.valuation.equity)}. Reconciliation difference: ${status.valuation.reconciliationDifference}.`,
'','## Separate categories','| Category | Closed trades | Win rate | Net P&L |','|---|---:|---:|---:|'];
for(const [id,s]of Object.entries(status.segments.groups))lines.push(`| ${id} | ${s.trades} | ${pct(s.winRatePct)} | $${money(s.pnl)} |`);
lines.push('','## Existing chronological replay','Each row uses an independent simulated account. Cached windows may overlap across agents. Do not pool rows as independent evidence.','| Agent | Strategy | Trades | Win rate | Net P&L |','|---|---|---:|---:|---:|');
for(const [id,a]of Object.entries(research.agents||{}))for(const r of a.results||[])lines.push(`| ${id} | ${r.strategy} | ${r.trades} | ${pct(r.winRatePct)} | $${money(r.pnl)} |`);
lines.push('','## Interpretation and limits',
'- Negative net results are evidence against promoting these current settings to real money; this report does not alter positions or settings.',
'- High percentages from one or a few trades are not validated win rates. No 75–80% target has been demonstrated.',
'- The replay uses cached history, fixed 10% sizing and 2% stops, not the exact live-paper entry policy. It does not prove bars were unseen during prior development.',
'- Replay buy-and-hold uses full capital while strategies deploy 10% per entry; raw P&L comparisons are not exposure-matched.',
'- Further work: independent forward paper evaluation, exposure-matched baselines, larger disjoint windows and historical execution-cost data.',
'- Market-history validation now rejects insufficient, nonfinite, impossible-range or duplicate/out-of-order candles before entry/replay calculations. This prevents bad inputs; it does not manufacture profitable signals.');
await writeFile('docs/PAPER-DIAGNOSTIC-SNAPSHOT.md',lines.join('\n')+'\n');console.log('Saved paper diagnostic snapshot; no trading mutations performed.');
