import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePaperTrades,paperSegments,closedPaperCandles} from '../src/lib/paperAnalytics.js';
import {AGENTS,INSTRUMENTS,processAgent} from '../src/lib/paperTrading.js';
import {PaperBroker,fillModelFor} from '../src/lib/broker.js';
test('high win rates can still lose money; empty data is not a zero-percent strategy',()=>{
  const s=summarizePaperTrades([...Array.from({length:8},()=>({pnl:1})),{pnl:-10},{pnl:-10}]);
  assert.equal(s.winRatePct,80);assert.equal(s.pnl,-12);assert.equal(s.profitFactor,.4);
  assert.equal(s.averageNetPerTrade,-1.2);assert.ok(s.winRateInterval95[0]<80);
  assert.equal(summarizePaperTrades([]).winRatePct,null);
  assert.equal(summarizePaperTrades([{pnl:0}]).breakeven,1);
});
test('categories separate memes, stocks and crypto; demo trades are excluded',()=>{
  const trades=[{agent:'btc',pnl:3},{agent:'spy',pnl:-1},{agent:'dogeMomentum',pnl:8},{agent:'shibMomentum',pnl:20,manual:true},{agent:'btc',pnl:100,entryReason:'MANUAL TEST ENTRY'}];
  const s=paperSegments(trades,AGENTS,INSTRUMENTS);
  assert.equal(s.groups.regular.pnl,2);assert.equal(s.groups.memes.pnl,8);
  assert.equal(s.groups.crypto.trades,1);assert.equal(s.groups.stocks.trades,1);
  assert.equal(s.manualTradesExcluded,2);
});
test('forming candles are excluded and malformed OHLC blocks a decision',()=>{
  const bar=time=>({time,open:10,high:12,low:9,close:11,volume:100});
  assert.deepEqual(closedPaperCandles([bar(0),bar(300000)],5,400000),[bar(0)]);
  assert.deepEqual(closedPaperCandles([bar(0),{...bar(300000),high:1}],5,900000),[]);
  assert.deepEqual(closedPaperCandles([{...bar(0),close:NaN}],5,900000),[]);
});
test('an already processed strategy candle does not suppress a later stop; gaps fill worse',async()=>{
  const now=Date.now(),start=Math.floor(now/300000)*300000;
  const bar=(time,open,low)=>({time,open,low,high:110,close:100,volume:500});
  const cache=new Map([['doge',{ok:true,candles:[bar(start-600000,100,99),bar(start-300000,100,99),bar(start,85,80)]}]]);
  const state=new Map([['paper:lastCandle:dogeMomentum',String(start-300000)]]);
  const env={RAYVEN_KV:{get:async k=>state.get(k),put:async(k,v)=>state.set(k,v)}};
  const portfolio={positions:{dogeMomentum:{entryTime:start-200000,stopPrice:90}}};
  const closes=[];const broker={closePosition:async(id,args)=>{closes.push(args);return {ok:true,fill:{price:args.price}}}};
  const result=await processAgent(env,'dogeMomentum',portfolio,cache,broker,{halt:{halted:true}});
  assert.equal(result.action,'stopped_out');assert.equal(closes[0].price,85);
});
test('stale or malformed feeds cannot create a fill',async()=>{
  const env={RAYVEN_KV:{get:async()=>null,put:async()=>{}}};let calls=0;
  const broker={placeOrder:async()=>{calls++},closePosition:async()=>{calls++}};
  for(const candles of [[{time:1,open:10,high:12,low:9,close:11,volume:1}],[{time:Date.now(),open:10,high:1,low:9,close:11,volume:1}]]){
    const result=await processAgent(env,'dogeMomentum',{positions:{}},new Map([['doge',{ok:true,candles}]]),broker,{});
    assert.ok(result.error);
  }assert.equal(calls,0);
});
test('modeled fees make a flat-price round trip lose money, including meme stress costs',async()=>{
  for(const provider of ['kraken','kraken_meme']){
    const portfolio={cash:10000,startingBalance:10000,positions:{}};
    const broker=new PaperBroker({},portfolio,{providerOf:()=>provider});
    const costs=fillModelFor(provider),qty=1000/(100*(1+costs.slippageBps/10000)*(1+costs.commissionPct/100));
    await broker.placeOrder({agentId:'test',qty,price:100,time:1,stop:90,provider});
    assert.ok(Math.abs(portfolio.cash-9000)<0.000001);
    await broker.closePosition('test',{price:100,time:2});assert.ok(portfolio.cash<10000);
  }
});
