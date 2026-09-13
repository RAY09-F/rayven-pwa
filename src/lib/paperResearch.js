// Deterministic PAPER diagnostics. Thresholds are research policies, not an edge.
import {fillModelFor,maxDrawdown} from './broker.js';
export const RESEARCH_VERSION='2026-09-13-cost-aware-v1';
export function portfolioValuation(portfolio,trades,marks={},now=Date.now()){
  let cost=0,value=0,entryFees=0;const positions=[];
  for(const [id,p] of Object.entries(portfolio.positions||{})){
    const mark=marks[id],valid=mark&&Number.isFinite(mark.close)&&mark.close>0;
    const entry=p.qty*p.entryPrice,v=p.qty*(valid?mark.close:p.entryPrice),fee=p.fees?.entryCommission||0;
    cost+=entry;value+=v;entryFees+=fee;
    positions.push({id,cost:entry,value:v,unrealizedPnl:v-entry-fee,mark:valid?mark.close:null,markedAt:valid?mark.time:null,ageMinutes:valid?(now-mark.time)/60000:null,estimated:!valid});
  }
  const realized=trades.reduce((s,t)=>s+(Number(t.pnl)||0),0);
  return {cash:portfolio.cash,positionCost:cost,positionValue:value,equity:portfolio.cash+value,
    unrealizedPnl:value-cost-entryFees,realizedPnl:realized,totalPnl:portfolio.cash+value-portfolio.startingBalance,
    reconciliationDifference:portfolio.cash+cost+entryFees-portfolio.startingBalance-realized,
    positions,estimated:positions.some(p=>p.estimated),valuationNote:'Cached marks; missing marks use entry cost. Equity is not available cash. Exit costs not deducted.'};
}
export function marketRegime(candles){
  const w=candles.slice(-30);if(w.length<30)return 'insufficient';
  const change=Math.abs(w.at(-1).close/w[0].close-1);
  const path=w.slice(1).reduce((s,c,i)=>s+Math.abs(c.close/w[i].close-1),0);
  const range=w.reduce((s,c)=>s+(c.high-c.low)/c.close,0)/w.length;
  return range>.02?'volatile':path&&change/path>.35?'trending':'sideways';
}
export function correlationGroup(instrumentId){return ['spy','qqq'].includes(instrumentId)?'us-equity':['btc','btcFast','eth','doge','shib'].includes(instrumentId)?'crypto':instrumentId;}
export function entryGate({candles,strategy,provider,portfolio,agents,instruments,agentId,trades=[],now=Date.now()}){
  const a=agents[agentId],instrument=instruments[a.instrumentId],fm=fillModelFor(provider),last=candles.at(-1);
  const roundTripCostPct=((1+fm.slippageBps/10000)*(1+fm.commissionPct/100)/((1-fm.slippageBps/10000)*(1-fm.commissionPct/100))-1)*100;
  const mean=candles.slice(-21,-1).reduce((s,c)=>s+c.close,0)/20;
  const range=candles.slice(-20).reduce((s,c)=>s+(c.high-c.low)/c.close,0)/20;
  const opportunityPct=100*(strategy==='meanReversion'?Math.max(0,mean/last.close-1):range*3);
  const evidence={version:RESEARCH_VERSION,regime:marketRegime(candles),roundTripCostPct,opportunityPct};
  const fail=reason=>({ok:false,reason,...evidence});
  if(candles.length<50)return fail('At least 50 closed candles required');
  if(!(opportunityPct>roundTripCostPct*1.5))return fail('Observed move budget does not cover costs plus research margin');
  const mine=trades.filter(t=>t.agent===agentId&&!t.manual).slice(-10);
  if(mine.length>=5&&mine.slice(-5).every(t=>t.pnl<0)&&now-new Date(mine.at(-1).exitTime).getTime()<86400000)return fail('Five consecutive net losses: 24-hour entry cooldown; exits remain active');
  const group=correlationGroup(a.instrumentId);
  const groupValue=Object.entries(portfolio.positions).filter(([id])=>correlationGroup(agents[id]?.instrumentId)===group).reduce((s,[,p])=>s+p.qty*p.entryPrice,0);
  if(Object.keys(portfolio.positions).some(id=>agents[id]?.instrumentId===a.instrumentId))return fail('Same instrument already held by another agent');
  const capacity=Math.max(0,portfolio.startingBalance*(group==='crypto'?.25:.30)-groupValue);
  if(capacity<10)return fail('Correlated exposure ceiling reached');
  if(instrument.category==='memes'&&!(last.volume>0))return fail('Meme volume missing');
  return {ok:true,capacity,...evidence};
}
export function depthFill(book,side,qty){
  const rows=book?.[side==='buy'?'asks':'bids'];
  if(!Array.isArray(rows)||!rows.length||!Number.isFinite(qty)||qty<=0)return {ok:false,reason:'Order-book data unavailable'};
  const sorted=rows.map(r=>[+r[0],+r[1]]).sort((a,b)=>side==='buy'?a[0]-b[0]:b[0]-a[0]);
  if(sorted.some(([p,q])=>!(p>0)||!(q>=0)))return {ok:false,reason:'Malformed order book'};
  let remain=qty,notional=0;for(const [price,size]of sorted){const take=Math.min(remain,size);notional+=take*price;remain-=take;if(remain<=1e-9)break;}
  return remain>qty*1e-8?{ok:false,reason:'Insufficient displayed depth'}:{ok:true,price:notional/qty,notional};
}
// Immutable parameters; no fitting on the test window. Next-bar opens remove
// the old same-close fill assumption. All three strategies get their own $10k.
export function replayResearch(candles,signals,provider){
  if(candles.length<120)return {available:false,reason:'Need 120 closed bars; no fabricated history',bars:candles.length};
  const split=Math.floor(candles.length*.6),fm=fillModelFor(provider),results=[];
  for(const [strategy,signal]of Object.entries(signals)){
    let cash=10000,pos=null;const trades=[],curve=[10000],regimes={};
    const close=(price,time,regime)=>{const fill=price*(1-fm.slippageBps/10000),proceeds=fill*pos.qty,fee=proceeds*fm.commissionPct/100;const pnl=proceeds-fee-pos.cost;cash+=proceeds-fee;trades.push({pnl,regime,time});pos=null;};
    for(let i=split;i<candles.length;i++){
      const w=candles.slice(0,i),bar=candles[i],regime=marketRegime(w),s=signal(w,!!pos);
      if(pos&&bar.open<=pos.stop)close(bar.open,bar.time,regime);
      else if(pos&&s.action==='exit')close(bar.open,bar.time,regime);
      else if(!pos&&s.action==='enter'){
        const px=bar.open*(1+fm.slippageBps/10000),spend=cash*.1,qty=spend/(px*(1+fm.commissionPct/100));
        pos={qty,cost:spend,stop:bar.open*.98};cash-=spend;
      }
      if(pos&&bar.low<=pos.stop)close(pos.stop,bar.time,regime);
      curve.push(cash+(pos?pos.qty*bar.close:0));
    }
    if(pos)close(candles.at(-1).close,candles.at(-1).time,marketRegime(candles));
    curve.push(cash);for(const t of trades){const r=regimes[t.regime]||={trades:0,pnl:0};r.trades++;r.pnl+=t.pnl;}
    const start=candles[split].open,end=candles.at(-1).close;
    const buyHold=10000*(end*(1-fm.slippageBps/10000)*(1-fm.commissionPct/100)/(start*(1+fm.slippageBps/10000)*(1+fm.commissionPct/100))-1);
    results.push({strategy,accountStartingBalance:10000,equity:cash,pnl:cash-10000,trades:trades.length,winRatePct:trades.length?100*trades.filter(t=>t.pnl>0).length/trades.length:null,maxDrawdownPct:maxDrawdown(curve)*100,regimes,baselines:{cashPnl:0,buyHoldPnl:buyHold}});
  }
  return {available:true,version:RESEARCH_VERSION,splitIndex:split,trainBars:split,testBars:candles.length-split,testStart:candles[split].time,testEnd:candles.at(-1).time,results,limitations:'Chronological held-out replay, not proof these bars were never seen during earlier development. Fixed 10% sizing and 2% stops; distinct from live paper policy. No historical depth or holder data. Each strategy is an independent simulated account.'};
}
