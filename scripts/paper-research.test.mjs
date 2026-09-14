import test from 'node:test';import assert from 'node:assert/strict';
import {portfolioValuation,entryGate,depthFill,replayResearch,correlationGroup} from '../src/lib/paperResearch.js';
test('missing or malformed market history cannot enter a trade or produce a replay',()=>{
 const bars=Array.from({length:130},(_,i)=>({time:i,open:100,high:101,low:99,close:100,volume:10}));
 for(const bad of [[],undefined,bars.map((c,i)=>i===10?{...c,close:NaN}:c),bars.map((c,i)=>i===10?{...c,time:9}:c),bars.map((c,i)=>i===10?{...c,high:98}:c)]){
 assert.equal(entryGate({candles:bad}).ok,false);assert.equal(replayResearch(bad,{},'kraken').available,false);
 }
});
test('cash spent on positions is not a trading loss; fees reconcile separately',()=>{
 const v=portfolioValuation({startingBalance:10000,cash:5990,positions:{a:{qty:40,entryPrice:100,fees:{entryCommission:10}}}},[],{a:{close:105,time:1}});
 assert.equal(v.equity,10190);assert.equal(v.unrealizedPnl,190);assert.equal(v.reconciliationDifference,0);
 assert.equal(portfolioValuation({startingBalance:10000,cash:6000,positions:{a:{qty:40,entryPrice:100}}},[]).estimated,true);
});
test('order book fills walk levels and reject missing depth',()=>{
 const book={asks:[[100,2],[101,3]],bids:[[99,3]]};assert.equal(depthFill(book,'buy',4).price,100.5);
 assert.equal(depthFill(book,'buy',6).ok,false);assert.equal(depthFill(null,'buy',4).ok,false);
});
test('tiny mean reversions fail the crypto cost hurdle',()=>{
 const candles=Array.from({length:60},(_,i)=>({time:i,open:100,high:100.1,low:99.9,close:i===59?99.9:100,volume:10}));
 const r=entryGate({candles,strategy:'meanReversion',provider:'kraken',portfolio:{startingBalance:10000,positions:{}},agents:{a:{instrumentId:'btc'}},instruments:{btc:{}},agentId:'a'});
 assert.equal(r.ok,false);assert.match(r.reason,/costs/);assert.equal(correlationGroup('spy'),correlationGroup('qqq'));
});
test('held-out replay signals only see past bars; independent accounts and baselines',()=>{
 const bars=Array.from({length:150},(_,i)=>({time:i,open:100+i,high:101+i,low:99+i,close:100+i,volume:10}));let calls=0;
 const signal=w=>{assert.ok(w.length>=90&&w.length<150);calls++;return {action:w.length===90?'enter':'hold'};};
 const r=replayResearch(bars,{a:signal,b:signal},'twelvedata');assert.equal(r.testBars,60);assert.equal(calls,120);
 assert.deepEqual(r.results[0].pnl,r.results[1].pnl);assert.equal(r.results[0].accountStartingBalance,10000);assert.equal(r.results[0].baselines.cashPnl,0);
 assert.equal(replayResearch(bars.slice(0,20),{},'kraken').available,false);
});
test('paper ledger serializes writes, keeps legacy data, and rolls back a failed cycle',async()=>{
 const {readFile}=await import('node:fs/promises');const {DatabaseSync}=await import('node:sqlite');
 let code=await readFile(new URL('../src/paper-ledger.js',import.meta.url),'utf8');
 code=code.replace("import {DurableObject} from 'cloudflare:workers';",'class DurableObject {}').replace("import {runPaperTradingCycleIfDue,forceDemoTrade} from './lib/paperTrading.js';",`async function runPaperTradingCycleIfDue(env){await env.RAYVEN_KV.put('paper:portfolio','BROKEN');throw Error('injected failure');} const forceDemoTrade=runPaperTradingCycleIfDue;`);
 const {PaperLedger}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const db=new DatabaseSync(':memory:');const storage={sql:{exec:(q,...v)=>{const st=db.prepare(q);return /^SELECT/.test(q)?st.all(...v):(st.run(...v),[]);}},transactionSync:fn=>{db.exec('BEGIN');try{fn();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
 const legacy=new Map([['paper:portfolio','original']]);const l=new PaperLedger({storage},{RAYVEN_KV:{list:async()=>({keys:[...legacy.keys()].map(name=>({name})),list_complete:true}),get:async k=>legacy.get(k)}});
 const call=b=>l.fetch(new Request('https://internal',{method:'POST',body:JSON.stringify(b)}));
 assert.equal((await (await call({op:'get',key:'paper:portfolio'})).json()).value,'original');
 assert.equal((await call({op:'cycle'})).status,500);
 assert.equal((await (await call({op:'get',key:'paper:portfolio'})).json()).value,'original');
 await Promise.all([call({op:'put',key:'paper:a',value:'a'}),call({op:'put',key:'paper:b',value:'b'})]);
 assert.equal((await(await call({op:'get',key:'paper:b'})).json()).value,'b');assert.equal(legacy.get('paper:portfolio'),'original');db.close();
});
