// Read-only research tools. No trades, account access, configuration writes,
// background polling, new secrets, or paid services.
import {readCappedLog} from '../lib/util.js';
import {httpJson} from '../lib/http.js';
import {paperSegments,summarizePaperTrades} from '../lib/paperAnalytics.js';
import {isNyseSessionOpen,minutesToNyseClose} from '../lib/marketData.js';
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const number=description=>({type:'number',description});
const str=description=>({type:'string',description});
const output=value=>JSON.stringify(value);
const finite=(value,name,min=0,max=1e12)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${name} must be a finite number between ${min} and ${max}`);return value;};
async function context(env){const [{AGENTS,INSTRUMENTS},raw,trades]=await Promise.all([import('../lib/paperTrading.js'),env.RAYVEN_KV.get('paper:portfolio'),readCappedLog(env,'paper:trades')]);return {agents:AGENTS,instruments:INSTRUMENTS,portfolio:raw?JSON.parse(raw):null,trades};}
const automatic=trades=>trades.filter(t=>!t.manual&&!/MANUAL TEST/i.test(t.entryReason||''));

export function riskSnapshot(portfolio,agents,instruments){
  if(!portfolio)return {available:false,reason:'No saved paper portfolio'};
  const rows=Object.entries(portfolio.positions||{}).map(([agent,p])=>({agent,category:instruments[agents[agent]?.instrumentId]?.category||(instruments[agents[agent]?.instrumentId]?.provider==='kraken'?'crypto':'stocks'),
    entryNotional:p.qty*p.entryPrice,modeledLossToStop:p.qty*Math.max(0,p.entryPrice-p.stopPrice),entryTime:new Date(p.entryTime).toISOString()}));
  return {label:'PAPER exposure at entry prices',cash:portfolio.cash,startingBalance:portfolio.startingBalance,
    positions:rows,openEntryNotional:rows.reduce((s,p)=>s+p.entryNotional,0),modeledLossToStops:rows.reduce((s,p)=>s+p.modeledLossToStop,0),
    limitation:'Not current equity or maximum loss. Gaps, slippage and exit fees can increase losses. All agents share simulated cash.'};
}
export function costSensitivity(trades,extraBps){
  finite(extraBps,'extra_bps',0,1000);
  const rows=automatic(trades).filter(t=>Number.isFinite(t.pnl)&&Number.isFinite(t.qty)&&Number.isFinite(t.entryPrice)&&Number.isFinite(t.exitPrice));
  const stressed=rows.map(t=>({...t,pnl:t.pnl-(t.qty*t.entryPrice+t.qty*t.exitPrice)*extraBps/10000}));
  return {label:'PAPER retrospective cost stress',extraBpsPerSide:extraBps,eligibleTrades:rows.length,excludedRecords:trades.length-rows.length,
    baseline:summarizePaperTrades(rows),stressed:summarizePaperTrades(stressed),limitation:'Adds costs to recorded fills. Does not model different entries, exits, liquidity or capital constraints.'};
}
export function unitEconomics(input){
  const price=finite(input.price,'price'),variable=finite(input.variable_cost,'variable_cost'),fixed=finite(input.fixed_cost,'fixed_cost'),customers=finite(input.customers,'customers',0,1e7);
  if(!Number.isInteger(customers))throw Error('customers must be a whole number');
  const contribution=price-variable;
  return {label:'Business scenario from supplied assumptions',revenue:price*customers,contributionPerCustomer:contribution,
    estimatedOperatingProfit:contribution*customers-fixed,breakEvenCustomers:contribution>0?Math.ceil(fixed/contribution):null,
    limitation:'Use the same currency and time period for all inputs. Excludes taxes and any costs you did not supply. This is not a sales forecast.'};
}
export function benchmarkCompare(input){
  const before=finite(input.before_fps,'before_fps',1,10000),after=finite(input.after_fps,'after_fps',1,10000);
  return {source:'User-supplied measurements',beforeFps:before,afterFps:after,fpsChangePct:(after/before-1)*100,
    beforeFrameMs:1000/before,afterFrameMs:1000/after,frameTimeReductionMs:1000/before-1000/after,
    limitation:'Comparable only with the same map, rendering mode, resolution and test method. Does not measure this PC or diagnose a bottleneck.'};
}
export function expectancy(input){
  const win=finite(input.win_rate_pct,'win_rate_pct',0,100)/100,avgWin=finite(input.average_win,'average_win'),avgLoss=finite(input.average_loss,'average_loss'),cost=finite(input.cost_per_trade,'cost_per_trade');
  return {label:'Hypothetical arithmetic, not a predicted win rate',expectedNetPerTrade:win*avgWin-(1-win)*avgLoss-cost,
    breakEvenWinRatePct:avgWin+avgLoss>0?(avgLoss+cost)/(avgWin+avgLoss)*100:null,
    limitation:'Average win and loss must be positive gross amounts in the same currency. Do not subtract costs twice.'};
}
export function summarizeBook(book){
  const parse=rows=>(rows||[]).map(r=>({price:Number(r[0]),qty:Number(r[1])}));
  const bids=parse(book.bids),asks=parse(book.asks);
  if(!bids.length||!asks.length||[...bids,...asks].some(r=>!Number.isFinite(r.price)||!Number.isFinite(r.qty)||r.price<=0||r.qty<0))throw Error('Invalid or empty order book');
  const bid=Math.max(...bids.map(r=>r.price)),ask=Math.min(...asks.map(r=>r.price));if(ask<bid)throw Error('Crossed order book');
  return {bestBid:bid,bestAsk:ask,spreadBps:(ask-bid)/((ask+bid)/2)*10000,
    displayedBidNotional:bids.reduce((s,r)=>s+r.price*r.qty,0),displayedAskNotional:asks.reduce((s,r)=>s+r.price*r.qty,0),
    levels:{bids:bids.length,asks:asks.length},limitation:'Displayed depth only, not total liquidity. Orders can vanish. This is not a safety score or execution guarantee.'};
}
const tool=(name,description,input_schema,run,group='markets',taint=false)=>({name,description,input_schema,run,group,taint});
export const TOOLS=[
  tool('paper_category_report','Read PAPER win rates, net P/L and sample counts separately for regular markets, stocks, crypto and meme coins. Excludes manual demos.',schema(),async env=>{const c=await context(env);return output(paperSegments(c.trades,c.agents,c.instruments));}),
  tool('paper_risk_snapshot','Read open PAPER exposure at entry prices and modeled loss to stops. Does not claim current equity or maximum loss.',schema(),async env=>{const c=await context(env);return output(riskSnapshot(c.portfolio,c.agents,c.instruments));}),
  tool('paper_agent_review','Read each PAPER agent’s historical net results and sample size, excluding demo trades. No strategy tuning or real trade advice.',schema(),async env=>{const c=await context(env),trades=automatic(c.trades);return output({label:'PAPER retained history',agents:Object.values(c.agents).map(a=>({id:a.id,name:a.name||a.label,strategy:a.strategy,...summarizePaperTrades(trades.filter(t=>t.agent===a.id))})),limitation:'Small and correlated samples do not establish future performance.'});}),
  tool('paper_cost_sensitivity','Stress recorded PAPER outcomes by adding extra cost in basis points on both entry and exit. Never changes the portfolio.',schema({extra_bps:number('Extra basis points per side, 0–1000')},['extra_bps']),async(env,input)=>output(costSensitivity(await readCappedLog(env,'paper:trades'),input.extra_bps))),
  tool('paper_feed_health','Inspect cached candle timestamps for every PAPER agent. Distinguishes exchange closure, stale cache and missing history. Does not fetch quotes or claim scheduler health.',schema(),async env=>{const c=await context(env),now=Date.now();const rows=await Promise.all(Object.values(c.agents).map(async a=>{const i=c.instruments[a.instrumentId];let bars=[];try{bars=JSON.parse(await env.RAYVEN_KV.get(`paper:candles:${a.id}`)||'[]')}catch{}if(!Array.isArray(bars))bars=[];bars=bars.filter(b=>b&&Number.isFinite(b.time));const last=bars.at(-1),age=last?Math.max(0,(now-last.time)/60000):null;const interval=i.krakenInterval||parseInt(i.baseInterval,10);return {agent:a.id,bars:bars.length,lastCandleAt:last?new Date(last.time).toISOString():null,ageMinutes:age,status:!last?'missing':i.provider!=='kraken'&&!isNyseSessionOpen()?'exchange closed':age>interval*3?'stale cache':'recent cache'};}));return output({checkedAt:new Date(now).toISOString(),label:'Cached data health, not a scheduler heartbeat',agents:rows});}),
  tool('crypto_orderbook_snapshot','Read Kraken top-20 bid/ask levels, spread and displayed depth for BTC, ETH, DOGE or SHIB. No orders, no wallet, no safety guarantee.',schema({symbol:{type:'string',enum:['BTC','ETH','DOGE','SHIB']}},['symbol']),async(env,{symbol})=>{const pairs={BTC:'XBTUSD',ETH:'ETHUSD',DOGE:'XDGUSD',SHIB:'SHIBUSD'};if(!Object.hasOwn(pairs,symbol))throw Error('Unsupported symbol');const r=await httpJson(env,`https://api.kraken.com/0/public/Depth?pair=${pairs[symbol]}&count=20`,{cacheSeconds:15,timeoutMs:8000});if(!r.ok)return output({ok:false,error:r.error});if(r.json.error?.length)return output({ok:false,error:r.json.error.join('; ')});return output({symbol,source:'Kraken public Depth',fetchedAt:new Date().toISOString(),cacheSeconds:15,...summarizeBook(Object.values(r.json.result||{})[0]||{})});},'markets',true),
  tool('market_session_clock','Read current regular US exchange-session status and minutes to close using the installed holiday calendar. Crypto is 24/7 subject to exchange outages.',schema(),async()=>output({at:new Date().toISOString(),nyseRegularSessionOpen:isNyseSessionOpen(),minutesToClose:minutesToNyseClose(),calendarThrough:2028,crypto:'24/7 subject to exchange availability',scope:'Regular session only; no premarket or after-hours trading'})),
  tool('business_unit_economics','Calculate contribution margin, break-even customers and scenario operating profit from supplied costs. No invented revenue forecasts.',schema({price:number('Price per customer per period'),variable_cost:number('Cost per customer per period'),fixed_cost:number('Fixed cost per period'),customers:number('Whole number of customers')},['price','variable_cost','fixed_cost','customers']),async(env,input)=>output(unitEconomics(input)),'math'),
  tool('benchmark_compare','Compare two user-supplied FPS measurements and frame times. Does not scan or alter the PC.',schema({before_fps:number('Measured FPS before change'),after_fps:number('Measured FPS after change')},['before_fps','after_fps']),async(env,input)=>output(benchmarkCompare(input)),'math'),
  tool('trade_expectancy_calculator','Calculate hypothetical net expectancy and break-even win rate from supplied average wins, losses and costs. No predicted results or trades.',schema({win_rate_pct:number('Hypothetical win rate 0–100'),average_win:number('Positive gross average win'),average_loss:number('Positive gross average loss'),cost_per_trade:number('Costs per round trip')},['win_rate_pct','average_win','average_loss','cost_per_trade']),async(env,input)=>output(expectancy(input)))
];

