import test from 'node:test';
import assert from 'node:assert/strict';
import {executionState,trackExecution} from '../src/lib/bridge-runs.js';
import {getBridgeSnapshot} from '../src/lib/bridge.js';
import {callClaudeWithTools} from '../src/lib/tools.js';

function fixture() {
  const records=new Map(),writes=[];
  const store={get:async key=>structuredClone(records.get(key)??null),put:async(key,value)=>{records.set(key,structuredClone(value));writes.push(key);}};
  const env={RAYVEN_KV:{get:async()=>null,put:async()=>{}},LEDGER:{idFromName:()=> 'test',get:()=>({fetch:async(url,opts)=>{
    const body=JSON.parse(opts.body);
    if(body.op!=='execution')throw Error('Unexpected ledger operation');
    return Response.json({ok:true,result:await executionState(store,body.action,body)});
  }})}};
  return {store,env,writes,read:now=>executionState(store,'read',{},now)};
}

test('concurrent runs retain independent real steps and terminal outcomes',async()=>{
  const {store,read}=fixture();
  await executionState(store,'begin',{id:'a',persona:'thor'},100);
  await executionState(store,'begin',{id:'b',persona:'thor'},101);
  await executionState(store,'step',{id:'a',title:'Process reply'},102);
  await executionState(store,'step',{id:'b',title:'Process reply'},103);
  await executionState(store,'step',{id:'a',title:'Handle request: calculate'},104);
  await executionState(store,'finish',{id:'a',state:'failed'},105);
  const rows=await read(106);assert.equal(rows.length,2);
  const a=rows.find(r=>r.id==='a'),b=rows.find(r=>r.id==='b');
  assert.equal(a.state,'failed');assert.equal(b.state,'running');
  assert.deepEqual(a.steps.map(s=>s.status),['done','in_progress','pending']);
  assert.equal(await executionState(store,'heartbeat',{id:'a'},106),false);
});

test('expired process cannot revive its lease or declare completion',async()=>{
  const {store,read}=fixture();
  await executionState(store,'begin',{id:'a',persona:'loki'},100);
  await executionState(store,'step',{id:'a',title:'Process reply'},101);
  assert.equal(await executionState(store,'heartbeat',{id:'a'},90101),false);
  assert.equal(await executionState(store,'finish',{id:'a',state:'done'},90102),false);
  assert.equal((await read())[0].steps[0].status,'in_progress');
});

test('Bridge reads ledger steps, hides terminal and private work, never writes',async()=>{
  const {env,store,writes}=fixture(),now=Date.now();
  for(const [id,persona,councillor] of [['a','thor',null],['b','loki','fenris'],['c','odin',null]]) {
    await executionState(store,'begin',{id,persona,councillor},now);
    await executionState(store,'step',{id,title:'Process reply'},now);
  }
  await executionState(store,'finish',{id:'c',state:'done'},now);
  const before=writes.length;
  const s=await getBridgeSnapshot(env,{now});
  assert.deepEqual(s.running.map(r=>r.id),['a']);assert.equal(s.running[0].percent,0);
  assert.deepEqual(s.running[0].steps.map(s=>s.status),['in_progress','pending']);
  assert.equal(writes.length,before);
  assert.deepEqual((await getBridgeSnapshot(env,{now:now+90001})).running,[]);
});

test('real tool loop updates processing boundaries and records outcome without external calls',async()=>{
  const {env,read}=fixture(),original=globalThis.fetch,observed=[];
  const replies=[{stop_reason:'tool_use',content:[{type:'tool_use',id:'calc',name:'calculate',input:{expression:'2+3'}}]},
    {stop_reason:'end_turn',content:[{type:'text',text:'5'}]}];
  globalThis.fetch=async url=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');
    observed.push(structuredClone(await read()));
    return Response.json(replies.shift());
  };
  try {
    const result=await callClaudeWithTools(env,'Rules','Channel','Memory',[{role:'user',content:'Calculate 2+3'}],true,null,'thor',false,{meta:{},channel:'web'});
    assert.equal(result.ok,true);assert.deepEqual(result.actions,['calculate']);
    assert.equal(observed[0][0].steps[0].title,'Process reply · round 1');
    assert.deepEqual(observed[1][0].steps.map(s=>s.status),['done','done','in_progress','pending']);
    const run=(await read())[0];assert.equal(run.state,'done');assert.ok(run.steps.every(s=>s.status==='done'));
  } finally {globalThis.fetch=original;}
});

test('loop exhaustion records failure instead of a completed reply',async()=>{
  const {env,read}=fixture(),original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({stop_reason:'pause_turn',content:[]});
  try {
    const result=await callClaudeWithTools(env,'Rules','Channel','Memory',[{role:'user',content:'Hi'}],true,null,'thor',false,{meta:{},channel:'web'},{maxIter:1});
    assert.equal(result.ok,false);assert.equal((await read())[0].state,'failed');
  } finally {globalThis.fetch=original;}
});

test('tracking disabled or unavailable cannot break replies or start background timers',async()=>{
  const {env,read}=fixture();
  const off=await trackExecution(env,{persona:'thor',enabled:false});await off.step('Ignored');await off.finish('done');
  assert.deepEqual(await read(),[]);
  const missing=await trackExecution({}, {persona:'thor'});await missing.step('Ignored');await missing.finish('done');
});

test('lost execution heartbeat becomes unknown, not a fabricated completion',async()=>{
  const {store,env}=fixture();
  await executionState(store,'begin',{id:'lost',persona:'thor',token:'private-fence'},100);
  await executionState(store,'step',{id:'lost',token:'private-fence',title:'Process reply'},101);
  const rows=await executionState(store,'read',{},90102);
  assert.equal(rows[0].state,'unknown');assert.equal(rows[0].token,undefined);
  assert.equal(rows[0].steps[0].status,'in_progress');
  const snapshot=await getBridgeSnapshot(env);
  assert.deepEqual(snapshot.running,[]);assert.match(snapshot.activity[0].summary,/unknown/);
  assert.doesNotMatch(JSON.stringify(snapshot),/private-fence/);
});
