import test from 'node:test';
import assert from 'node:assert/strict';
import {getBridgeSnapshot,bridgePlan} from '../src/lib/bridge.js';
const now=Date.parse('2026-09-09T01:00:00Z');
const fixture=(records={})=>({LEDGER:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({ok:true,result:[]})})},RAYVEN_KV:{
  get:async key=>key in records?JSON.stringify(records[key]):null,
  put:async()=>{throw Error('Bridge reads must not write');},delete:async()=>{throw Error('Bridge reads must not delete');}
}});

test('empty sources produce no invented work, replies, weather or spending',async()=>{
  const s=await getBridgeSnapshot(fixture(),{now});
  assert.deepEqual(s.needs,[]);assert.deepEqual(s.running,[]);assert.deepEqual(s.activity,[]);
  assert.equal(s.needsTotal,0);assert.equal(s.glance.openTodos,0);
  assert.equal(s.glance.modelSpend,null);assert.equal(s.glance.weather,null);
  assert.equal(s.glance.extension.connected,false);
  assert.ok(s.halls.every(h=>h.lastSaid===null&&h.state===null&&h.pendingCount===0));
});

test('failed reads are unavailable, never a successful empty inbox or zero spend',async()=>{
  const s=await getBridgeSnapshot({RAYVEN_KV:{get:async()=>{throw Error('offline');}}},{now});
  assert.ok(Object.values(s.sources).every(v=>v===false));
  assert.equal(s.needsTotal,null);assert.equal(s.glance.openTodos,null);
  assert.equal(s.glance.extension,null);assert.equal(s.glance.modelSpend,null);
  assert.ok(s.halls.every(h=>h.pendingCount===null&&!h.historyAvailable));
});

test('reviews are real, unexpired, visible, limited to five, with full count retained',async()=>{
  const reviews=Array.from({length:7},(_,i)=>({id:String(1000+i),persona:'thor',status:'pending',
    createdAt:new Date(now-i*1000).toISOString(),expiresAt:new Date(now+10000).toISOString(),description:'Recorded action '+i,tool:'add_todo'}));
  const s=await getBridgeSnapshot(fixture({approvals:[...reviews,{...reviews[0],persona:'hela'},
    {...reviews[0],id:'expired',expiresAt:new Date(now-1).toISOString()},null]}),{now});
  assert.equal(s.needs.length,5);assert.equal(s.needsTotal,7);
  assert.equal(s.halls.find(h=>h.id==='thor').pendingCount,7);
  assert.ok(s.needs.every(r=>r.persona==='thor'&&r.type==='REVIEW'));
});

test('since-you-left uses recorded time, deduplicates spooled events and excludes private identities',async()=>{
  const row={time:new Date(now-1000).toISOString(),persona:'thor',councillor:'jane_foster',summary:'Read the source'};
  const s=await getBridgeSnapshot(fixture({'agent:autonomy:log':[row,{...row,time:new Date(now-100000).toISOString()},
    {...row,persona:'hela',councillor:'fenris'},{...row,persona:'loki'}],
    'tick:last':{recent:['tick:fixture']},'tick:fixture':{autonomy:[row],drained:[{...row,kind:'autonomy'}]}}),{now,since:now-5000});
  assert.equal(s.activity.length,1);assert.equal(s.activity[0].summary,row.summary);
  assert.equal(s.activity[0].at,row.time);
});

test('old fixed progress and expired leases never become a live plan',()=>{
  assert.equal(bridgePlan({task:'replying',progress:.5},'thor',now),null);
  const status={at:new Date(now).toISOString(),task:'Recorded work',plan:{id:'p',title:'Source check',
    leaseUntil:new Date(now+60000).toISOString(),steps:[{title:'Fetch',status:'done'},{title:'Inspect',status:'in_progress'},{title:'Report',status:'pending'}]}};
  assert.equal(bridgePlan(status,'thor',now).percent,33);
  assert.equal(bridgePlan(status,'thor',now+60001),null);
  status.plan.steps[2].status='in_progress';assert.equal(bridgePlan(status,'thor',now),null);
});

test('calendar uses local dates, stored history supplies last words, cached weather retains its age',async()=>{
  const weather={at:new Date(now-3600000).toISOString(),text:'Recorded weather result'};
  const s=await getBridgeSnapshot(fixture({
    'calendar:events':[{title:'Past',date:'2026-09-08',time:'17:00'},{title:'Review',date:'2026-09-08',time:'19:00'}],
    todos:[{text:'done',done:true},{text:'open',done:false}],
    'web:main':{turns:[{role:'user',content:'Hello'},{role:'assistant',content:'Actual stored words'}],meta:{council:{valkyrie:{weather}}}}
  }),{now});
  assert.equal(s.glance.nextEvent.title,'Review');assert.equal(s.glance.openTodos,1);
  assert.deepEqual(s.glance.weather,weather);
  assert.equal(s.halls.find(h=>h.id==='thor').lastSaid,'Actual stored words');
});

test('ledger failure does not resurrect stale KV spending as current data',async()=>{
  const env=fixture({'tick:last':{day:'2026-09-09',costToday:{usd:123}}});
  env.LEDGER_BACKEND='do';env.LEDGER={idFromName:()=>1,get:()=>({fetch:async()=>{throw Error('ledger down');}})};
  const s=await getBridgeSnapshot(env,{now});
  assert.equal(s.sources.ticks,false);assert.equal(s.needsTotal,null);assert.equal(s.glance.modelSpend,null);
});

test('recorded usage cost is explicitly an estimate with excluded costs',async()=>{
  const s=await getBridgeSnapshot(fixture({'tick:last':{day:'2026-09-09',costToday:{usd:.125}}}),{now});
  assert.equal(s.glance.modelSpend.usd,.125);assert.equal(s.glance.modelSpend.estimated,true);
  assert.match(s.glance.modelSpend.basis,/excludes speech, search and hosting/);
});

test('real notifications have stable dismissal IDs and private sources remain hidden',async()=>{
 const rows=[{time:new Date(now-1000).toISOString(),source:'thor',title:'A real reminder',body:'Recorded text',status:'sent'},
   {time:new Date(now-2000).toISOString(),source:'hela',title:'Private',body:'Must stay private',status:'sent'}];
 const env=fixture({'notif:log':rows});const first=await getBridgeSnapshot(env,{now});
 assert.equal(first.needs.length,1);assert.equal(first.needs[0].type,'NOTIFY');assert.match(first.needs[0].id,/^notice:[a-f0-9]{24}$/);
 const next=await getBridgeSnapshot(env,{now:now+1000,dismissed:[first.needs[0].id]});assert.equal(next.needs.length,0);assert.equal(next.needsTotal,0);
});
