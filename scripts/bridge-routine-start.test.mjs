import test from 'node:test';
import assert from 'node:assert/strict';
import {executionState} from '../src/lib/bridge-runs.js';
import {routineRunNow,runRoutinesIfDue,resumeBatchedRoutine} from '../src/lib/routines.js';
import {routineHasPendingWork} from '../src/lib/routine-continuation.js';

function fixture(steps,{afterExecution}={}) {
  const saved=new Map(),kv=new Map();let queue=Promise.resolve();
  const store={get:async key=>structuredClone(saved.get(key)??null),put:async(key,value)=>saved.set(key,structuredClone(value))};
  const env={RAYVEN_KV:{get:async key=>kv.get(key)??null,put:async(key,value)=>kv.set(key,value)},
    LEDGER:{idFromName:()=> 'test',get:()=>({fetch:async(url,opts)=>{
      const body=JSON.parse(opts.body);assert.equal(body.op,'execution');
      const result=queue.then(()=>executionState(store,body.action,body));queue=result.catch(()=>{});
      const completed=await result;
      if(afterExecution)await afterExecution(body);
      return Response.json({ok:true,result:completed});
    }})}};
  const routine={id:'start-test',name:'Ordinary routine',owner:'thor',enabled:true,trigger:{kind:'schedule',every:1},deliver:'silent',runs:[],state:{},steps};
  kv.set('routines:index',JSON.stringify([{id:routine.id,name:routine.name,owner:routine.owner,enabled:true}]));
  kv.set('routines:'+routine.id,JSON.stringify(routine));
  return {env,kv,rows:()=>executionState(store,'read')};
}
const tool={tool:'calculate',args:{expression:'2+3'}};

test('ordinary start publishes real boundaries, blocks another start, and saves a terminal receipt',async()=>{
  const {env,kv,rows}=fixture([{say:'prefix'},tool,{say:'done'}]);let calls=0;
  const result=await routineRunNow(env,'thor','start-test',async()=>{
    calls++;
    const [run]=await rows();assert.equal(run.title,'Ordinary routine');assert.equal(run.routine.id,'start-test');
    assert.deepEqual(run.steps.map(s=>s.status),['done','in_progress','pending']);
    assert.deepEqual(run.steps.map(s=>s.title),['Prepare message','Request calculate','Prepare message']);
    assert.match(await routineRunNow(env,'thor','start-test',async()=>assert.fail('duplicate')),/already has waiting/);
    return '5';
  });
  assert.match(result,/Ran/);assert.equal(calls,1);
  const [run]=await rows();assert.equal(run.state,'done');assert.ok(run.steps.every(s=>s.status==='done'));
  const receipt=JSON.parse(kv.get('routines:start-test')).runs[0];assert.equal(receipt.executionId,run.id);assert.equal(receipt.execution,undefined);
  assert.equal(await routineHasPendingWork(env,'start-test'),false);
});

test('scheduled failure preserves failed step and unstarted tail without model calls',async()=>{
  const {env,rows}=fixture([tool,{say:'must not start'}]);let calls=0;
  const result=await runRoutinesIfDue(env,[],async()=>{calls++;throw Error('fixture failure');});
  assert.equal(result.ran,1);assert.equal(result.results[0].ok,false);assert.equal(calls,1);
  const [run]=await rows();assert.equal(run.state,'failed');assert.equal(run.routine.status,'failed');
  assert.deepEqual(run.steps.map(s=>s.status),['in_progress','pending']);
});

test('ordinary councillor borrows the parent execution without finishing its remaining steps',async()=>{
  const {env,rows}=fixture([{delegate:{councillor:'jane_foster',task:'Fixture reply'}},tool]);
  const original=globalThis.fetch;let modelCalls=0;
  globalThis.fetch=async url=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');modelCalls++;
    const runs=await rows();assert.equal(runs.length,1);assert.equal(runs[0].title,'Ordinary routine');
    assert.deepEqual(runs[0].steps.map(s=>s.status),['in_progress','pending']);
    return Response.json({stop_reason:'end_turn',content:[{type:'text',text:'Fixture result'}]});
  };
  try {
    await routineRunNow(env,'thor','start-test',async()=>{
      const [run]=await rows();assert.equal(run.state,'running');assert.deepEqual(run.steps.map(s=>s.status),['done','in_progress']);return '5';
    });
    assert.equal(modelCalls,1);assert.equal((await rows()).length,1);assert.equal((await rows())[0].state,'done');
  } finally {globalThis.fetch=original;}
});

test('ordinary batch keeps its plan queued and claims the tail once',async()=>{
  const {env,kv,rows}=fixture([{say:'prefix'},{compose:{instruction:'Fixture summary',batch:true,tier:'cheap'}},tool]);
  env.ANTHROPIC_API_KEY='fixture-no-network';
  const original=globalThis.fetch;let batchCalls=0,tailCalls=0;
  globalThis.fetch=async url=>{assert.equal(url,'https://api.anthropic.com/v1/messages/batches');batchCalls++;return Response.json({id:'start-batch',processing_status:'in_progress'});};
  try {
    await routineRunNow(env,'thor','start-test',async()=>assert.fail('tail before batch'));
    const [queued]=await rows();assert.equal(queued.state,'queued');assert.deepEqual(queued.steps.map(s=>s.status),['done','in_progress','pending']);
    const entry=JSON.parse(kv.get('system:batches')).pending[0];assert.equal(entry.meta.execution.id,queued.id);
    const execute=async()=>{tailCalls++;return '5';};
    await resumeBatchedRoutine(env,entry,[{text:'Batch result'}],execute);
    await resumeBatchedRoutine(env,entry,[{text:'Duplicate result'}],execute);
    assert.equal(batchCalls,1);assert.equal(tailCalls,1);assert.equal((await rows())[0].state,'done');
    assert.equal(JSON.parse(kv.get('routines:start-test')).runs.length,1);
  } finally {globalThis.fetch=original;}
});

test('current permissions still stop an ordinary routine before invoking its tool',async()=>{
  const {env,kv,rows}=fixture([{tool:'browser_navigate',args:{url:'https://example.invalid'}}]);
  kv.set('permissions',JSON.stringify({browser_navigate:'off'}));
  const result=await routineRunNow(env,'thor','start-test',async()=>assert.fail('disabled tool'));
  assert.match(result,/turned off/);assert.equal((await rows())[0].state,'failed');
});

test('simultaneous ordinary starts cannot both claim the same routine',async()=>{
  const {env}=fixture([tool]);let calls=0;
  const results=await Promise.allSettled([1,2].map(()=>routineRunNow(env,'thor','start-test',async()=>{calls++;return '5';})));
  assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.startsWith('Ran')).length,1);
});

test('ambiguous progress acknowledgement after an action leaves unknown work and stops the tail',async()=>{
  let rejectNext=false,calls=0;
  const {env,rows}=fixture([tool,tool],{afterExecution:async body=>{
    if(rejectNext&&body.action==='routineProgress'&&body.index===1)throw Error('Lost acknowledgement');
  }});
  await assert.rejects(routineRunNow(env,'thor','start-test',async()=>{calls++;rejectNext=true;return '5';}),/could not be confirmed/);
  assert.equal(calls,1);assert.equal((await rows())[0].state,'unknown');
  assert.match(await routineRunNow(env,'thor','start-test',async()=>assert.fail('automatic replay')),/already has waiting/);
});

test('legacy batch metadata without an execution retains its original continuation path',async()=>{
  const {env,rows}=fixture([{compose:{instruction:'old batch',batch:true}},tool]);let calls=0;
  await resumeBatchedRoutine(env,{meta:{routineId:'start-test',stepIndex:0,steps:[],runAt:new Date().toISOString()}},[{text:'Old batch result'}],async()=>{calls++;return '5';});
  assert.equal(calls,1);assert.deepEqual(await rows(),[]);
});

for(const committed of [false,true])test(`outer receipt ${committed?'lost acknowledgement':'write failure'} blocks duplicate work without claiming completion`,async()=>{
  const {env,rows}=fixture([tool]);let calls=0;
  const put=env.RAYVEN_KV.put;
  env.RAYVEN_KV.put=async(key,value)=>{
    if(key!=='routines:start-test')return put(key,value);
    if(committed)await put(key,value);
    throw Error('Receipt unavailable');
  };
  await assert.rejects(routineRunNow(env,'thor','start-test',async()=>{calls++;return '5';}),/Receipt unavailable/);
  assert.equal(calls,1);assert.notEqual((await rows())[0].state,'done');
  assert.equal(await routineHasPendingWork(env,'start-test'),true);
  assert.match(await routineRunNow(env,'thor','start-test',async()=>assert.fail('receipt replay')),/already has waiting/);
});
