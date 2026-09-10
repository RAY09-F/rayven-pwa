import test from 'node:test';
import assert from 'node:assert/strict';
import {executionState} from '../src/lib/bridge-runs.js';
import {answerBridgeQuestion} from '../src/lib/bridge-question.js';
import {callClaudeWithTools} from '../src/lib/tools.js';
import {getBridgeSnapshot} from '../src/lib/bridge.js';

function fixture() {
  const saved=new Map(),kv=new Map();let queue=Promise.resolve();
  const store={get:async key=>structuredClone(saved.get(key)??null),put:async(key,value)=>saved.set(key,structuredClone(value))};
  const env={RAYVEN_KV:{get:async key=>kv.get(key)??null,put:async(key,value)=>kv.set(key,value)},
    LEDGER:{idFromName:()=> 'test',get:()=>({fetch:async(url,opts)=>{
      const body=JSON.parse(opts.body);assert.equal(body.op,'execution');
      const result=queue.then(()=>executionState(store,body.action,body));queue=result.catch(()=>{});
      return Response.json({ok:true,result:await result});
    }})}};
  return {env,kv,store};
}
const calc={stop_reason:'tool_use',content:[{type:'tool_use',id:'calc',name:'calculate',input:{expression:'2+3'}}]};
const ask={stop_reason:'tool_use',content:[{type:'tool_use',id:'ask',name:'util_ask_user',input:{question:'Which destination?'}}]};
const final={stop_reason:'end_turn',content:[{type:'text',text:'Recorded answer received.'}]};
const start=env=>callClaudeWithTools(env,'Private rules','Private channel','Saved memory',[{role:'user',content:'Plan the trip'}],true,null,'thor',false,{meta:{},channel:'web'});
async function mocked(responses,fn){
  const original=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');assert.ok(responses.length,'Unexpected external call');requests.push(JSON.parse(opts.body));return Response.json(responses.shift());};
  try{return await fn(requests);}finally{globalThis.fetch=original;}
}

test('pause exposes only question metadata; answer resumes exact tool context without replay',async()=>{
  const {env,kv}=fixture();
  await mocked([calc,ask,final],async requests=>{
    const first=await start(env);assert.equal(first.paused,true);assert.deepEqual(first.actions,['calculate']);
    const snapshot=await getBridgeSnapshot(env);
    assert.equal(snapshot.running.length,0);
    const q=snapshot.needs.find(n=>n.type==='QUESTION');assert.equal(q.title,'Which destination?');
    assert.doesNotMatch(JSON.stringify(snapshot),/Private rules|Saved memory|tool_use_id|checkpoint/);
    kv.set('web:main',JSON.stringify({turns:[{role:'user',content:'Newer conversation stays'}],meta:{newer:true}}));
    const answer=await answerBridgeQuestion(env,{id:q.sourceId,persona:q.persona,revision:q.revision,answer:'Bakersfield'},callClaudeWithTools);
    assert.equal(answer.ok,true);assert.equal(answer.reply,'Recorded answer received.');
    assert.equal(requests.length,3);
    const messages=requests[2].messages;
    assert.equal(messages.at(-1).content[0].tool_use_id,'ask');
    assert.equal(messages.at(-1).content[0].content,'Bakersfield');
    assert.ok(messages.some(m=>Array.isArray(m.content)&&m.content.some(b=>b.tool_use_id==='calc')));
    const history=JSON.parse(kv.get('web:main'));assert.equal(history.turns[0].content,'Newer conversation stays');assert.equal(history.meta.newer,true);
    assert.match(history.turns.at(-2).content,/Which destination.*Bakersfield/);
    assert.equal((await getBridgeSnapshot(env)).needs.filter(n=>n.type==='QUESTION').length,0);
  });
});

test('double answer and stale revision cannot run the same continuation twice',async()=>{
  const {env}=fixture();
  await mocked([ask,final],async requests=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    const body={id:q.sourceId,persona:q.persona,revision:q.revision,answer:'The coast'};
    assert.equal((await answerBridgeQuestion(env,{...body,revision:'stale'},callClaudeWithTools)).ok,false);
    assert.equal((await answerBridgeQuestion(env,{...body,persona:'loki'},callClaudeWithTools)).ok,false);
    const results=await Promise.all([answerBridgeQuestion(env,body,callClaudeWithTools),answerBridgeQuestion(env,body,callClaudeWithTools)]);
    assert.equal(results.filter(r=>r.ok).length,1);assert.equal(requests.length,2);
  });
});

test('failed resume is not automatically replayable',async()=>{
  const {env}=fixture();
  await mocked([ask],async()=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    const body={id:q.sourceId,persona:q.persona,revision:q.revision,answer:'Home'};
    let calls=0;const fail=async()=>{calls++;throw Error('Lost acknowledgement');};
    assert.equal((await answerBridgeQuestion(env,body,fail)).ok,false);
    assert.equal((await answerBridgeQuestion(env,body,fail)).ok,false);assert.equal(calls,1);
  });
});

test('resuming can pause again with a new revision, without accepting the old answer twice',async()=>{
  const {env}=fixture();
  await mocked([ask,ask],async()=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    const body={id:q.sourceId,persona:q.persona,revision:q.revision,answer:'Home'};
    const result=await answerBridgeQuestion(env,body,callClaudeWithTools);assert.equal(result.paused,true);
    const next=(await getBridgeSnapshot(env)).needs[0];assert.notEqual(next.revision,q.revision);
    assert.equal(next.sourceId,q.sourceId);assert.equal((await answerBridgeQuestion(env,body,callClaudeWithTools)).ok,false);
  });
});

test('old execution token cannot finish or overwrite a resumed job',async()=>{
  const {store}=fixture();
  await executionState(store,'begin',{id:'a',persona:'thor',token:'old'},100);
  await executionState(store,'pause',{id:'a',token:'old',question:'Where?',checkpoint:{messages:[]}},101);
  const [run]=await executionState(store,'read');assert.equal(run.checkpoint,undefined);
  const claim=await executionState(store,'claim',{id:'a',persona:'thor',revision:run.question.revision,answer:'Here',token:'new'},102);
  assert.ok(claim);
  assert.equal(await executionState(store,'finish',{id:'a',token:'old',state:'done'},103),false);
  assert.equal(await executionState(store,'step',{id:'a',token:'new',title:'Resumed work'},104),true);
});

test('resumption rechecks current tool permissions instead of treating the answer as approval',async()=>{
  const {env,kv}=fixture();
  const send={stop_reason:'tool_use',content:[{type:'tool_use',id:'send',name:'send_text',input:{to:'fixture-only',message:'Do not send'}}]};
  await mocked([ask,send,final],async requests=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    kv.set('permissions',JSON.stringify({send_text:'off'}));
    const result=await answerBridgeQuestion(env,{id:q.sourceId,persona:q.persona,revision:q.revision,answer:'yes'},callClaudeWithTools);
    assert.equal(result.ok,true);
    assert.match(requests.at(-1).messages.at(-1).content[0].content,/turned off/);
    assert.equal(kv.has('pending:thor'),false);
  });
});

test('a failed conversation save is reported instead of claiming the reply was saved',async()=>{
  const {env}=fixture();
  await mocked([ask,final],async()=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    env.RAYVEN_KV.put=async()=>{throw Error('Storage unavailable');};
    const result=await answerBridgeQuestion(env,{id:q.sourceId,persona:q.persona,revision:q.revision,answer:'Home'},callClaudeWithTools);
    assert.equal(result.ok,true);assert.match(result.message,/saving it to the hall failed/);assert.ok(result.reply);
  });
});

test('unreadable existing history is never overwritten by a resumed reply',async()=>{
  const {env,kv}=fixture();
  await mocked([ask,final],async()=>{
    await start(env);const q=(await getBridgeSnapshot(env)).needs[0];
    kv.set('web:main','unreadable original');
    const result=await answerBridgeQuestion(env,{id:q.sourceId,persona:q.persona,revision:q.revision,answer:'Home'},callClaudeWithTools);
    assert.equal(result.ok,true);assert.match(result.message,/not overwritten/);assert.ok(result.reply);assert.equal(kv.get('web:main'),'unreadable original');
  });
});

import {runCouncillor,runQueuedDelegations,COUNCIL} from '../src/lib/council.js';

test('queued councillor waits without publishing a finished report and resumes in the owner hall',async()=>{
  const {env,kv}=fixture();
  const denied={stop_reason:'tool_use',content:[{type:'tool_use',id:'send',name:'send_text',input:{to:'fixture',message:'Never send'}}]};
  await mocked([ask,denied,final],async requests=>{
    assert.equal(await runQueuedDelegations(env,[{kind:'delegation',status:'queued',persona:'thor',councillor:'jane_foster',task:'Find a route'}]),1);
    const q=(await getBridgeSnapshot(env)).needs[0];assert.equal(q.councillor,'jane_foster');
    assert.equal(kv.has('web:main'),false,'A waiting question is not a delivered report');
    assert.equal(kv.has('council:thor:jane_foster'),false,'Waiting does not increment completed runs');
    const result=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Bakersfield'},callClaudeWithTools);
    assert.equal(result.ok,true);assert.equal(result.councillor,'jane_foster');
    assert.match(requests.at(-1).messages.at(-1).content[0].content,/outside.*permissions/);
    assert.ok(requests[0].tools.some(t=>t.name==='util_ask_user'));
    assert.equal(JSON.parse(kv.get('web:main')).turns.at(-1).councillor,'jane_foster');
    assert.equal(kv.has('web:loki'),false);assert.equal(kv.has('pending:thor'),false);
  });
});

test('a councillor permission removed while waiting remains removed on resume',async()=>{
  const {env}=fixture(),c=COUNCIL.jane_foster,original=[...c.tools];
  const denied={stop_reason:'tool_use',content:[{type:'tool_use',id:'removed',name:original[0],input:{}}]};
  try {
    await mocked([ask,denied,final],async requests=>{
      assert.equal((await runCouncillor(env,'jane_foster','Fixture task')).paused,true);
      const q=(await getBridgeSnapshot(env)).needs[0];c.tools=c.tools.filter(n=>n!==original[0]);
      const result=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Here'},callClaudeWithTools);
      assert.equal(result.ok,true);assert.match(requests.at(-1).messages.at(-1).content[0].content,/outside.*permissions/);
      assert.ok(!requests[1].tools.some(t=>t.name===original[0]));
    });
  } finally {c.tools=original;}
});

test('failed queued councillor does not create a successful council-run stamp',async()=>{
  const {env,kv}=fixture(),original=globalThis.fetch;
  globalThis.fetch=async url=>{assert.equal(url,'https://api.anthropic.com/v1/messages');return Response.json({error:{message:'Fixture provider unavailable'}},{status:400});};
  try {
    assert.equal(await runQueuedDelegations(env,[{kind:'delegation',status:'queued',persona:'thor',councillor:'jane_foster',task:'Fixture task'}]),1);
    assert.equal(kv.has('council:thor:jane_foster'),false);
    assert.match(JSON.parse(kv.get('web:main')).meta.pendingSpeech[0].text,/JANE FOSTER failed:.*could not complete/);
  } finally {globalThis.fetch=original;}
});

import {routineRunNow,runRoutinesIfDue} from '../src/lib/routines.js';
import {routineHasPendingWork} from '../src/lib/routine-continuation.js';
function seedRoutine(kv,extra={}){
  const r={id:'fixture-routine',name:'Fixture routine',owner:'thor',enabled:true,trigger:{kind:'schedule',every:1},deliver:'speak',runs:[],state:{},
    steps:[{tool:'calculate',args:{expression:'1+1'}},{delegate:{councillor:'jane_foster',task:'Choose a destination'}},{tool:'calculate',args:{expression:'3+4'}},{say:'Prefix $steps[0].text; answer $steps[1].text; tail $steps[2].text'}],...extra};
  kv.set('routines:index',JSON.stringify([{id:r.id,name:r.name,owner:r.owner,enabled:true}]));kv.set('routines:'+r.id,JSON.stringify(r));return r;
}

test('routine resumes only remaining steps, preserves earlier results, and blocks duplicate scheduled starts',async()=>{
  const {env,kv}=fixture();seedRoutine(kv);let prefixCalls=0;
  await mocked([ask,final],async()=>{
    const started=await routineRunNow(env,'thor','fixture-routine',async()=>{prefixCalls++;return 'SAVED PREFIX';});
    assert.match(started,/Paused/);assert.equal(prefixCalls,1);
    const q=(await getBridgeSnapshot(env)).needs.find(n=>n.type==='QUESTION');assert.ok(q);
    assert.equal(JSON.parse(kv.get('routines:fixture-routine')).runs[0].execution,undefined,'Receipt must not expose execution token');
    assert.equal(await routineHasPendingWork(env,'fixture-routine'),true);
    assert.match(await routineRunNow(env,'thor','fixture-routine',async()=>{throw Error('No duplicate execution allowed');}),/already has waiting/);
    const tick=await runRoutinesIfDue(env,[],async()=>{throw Error('No duplicate scheduled execution allowed');});assert.equal(tick.ran,0);
    assert.match(tick.results[0].skipped,/waiting/);
    const answered=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Home'},async(...args)=>{
      const live=await getBridgeSnapshot(env);assert.equal(live.running[0].id,q.sourceId);assert.equal(live.running[0].title,'Fixture routine');
      assert.equal(live.running[0].percent,25);assert.deepEqual(live.running[0].steps.map(s=>s.status),['done','in_progress','pending','pending']);
      return callClaudeWithTools(...args);
    });
    assert.equal(answered.ok,true);assert.equal(answered.routineOutcome,'done');assert.equal(prefixCalls,1);
    const speech=JSON.parse(kv.get('web:main')).meta.pendingSpeech.at(-1).text;
    assert.match(speech,/SAVED PREFIX/);assert.match(speech,/Recorded answer received/);assert.match(speech,/7/);
    const record=JSON.parse(kv.get('routines:fixture-routine'));assert.equal(record.runs.length,1);assert.equal(record.runs[0].paused,undefined);
    assert.equal(record.runs[0].steps.length,4);assert.equal(await routineHasPendingWork(env,'fixture-routine'),false);
    assert.equal((await getBridgeSnapshot(env)).running.length,0);
  });
});

test('edited or disabled routine refuses continuation before another model or tool call',async()=>{
  for(const change of [{enabled:false},{steps:[{say:'Changed task'}]}]){
    const {env,kv}=fixture();seedRoutine(kv);
    await mocked([ask],async requests=>{
      await routineRunNow(env,'thor','fixture-routine',async()=> 'prefix');
      const q=(await getBridgeSnapshot(env)).needs[0];
      const r=JSON.parse(kv.get('routines:fixture-routine'));Object.assign(r,change);kv.set('routines:fixture-routine',JSON.stringify(r));
      const answered=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Home'},callClaudeWithTools);
      assert.equal(answered.ok,false);assert.match(answered.message,/changed.*disabled/);assert.equal(requests.length,1);
    });
  }
});

test('a later routine councillor can ask another question on the same saved job',async()=>{
  const {env,kv}=fixture();seedRoutine(kv,{steps:[{delegate:{councillor:'jane_foster',task:'First question'}},{delegate:{councillor:'jane_foster',task:'Second question'}},{say:'Both answered'}]});
  await mocked([ask,final,ask,final],async()=>{
    await routineRunNow(env,'thor','fixture-routine',async()=>{throw Error('No tool expected');});
    const first=(await getBridgeSnapshot(env)).needs[0];
    const a=await answerBridgeQuestion(env,{id:first.sourceId,persona:'thor',revision:first.revision,answer:'First'},callClaudeWithTools);
    assert.equal(a.ok,true);assert.equal(a.paused,true);
    const second=(await getBridgeSnapshot(env)).needs[0];assert.equal(second.sourceId,first.sourceId);assert.notEqual(second.revision,first.revision);
    const b=await answerBridgeQuestion(env,{id:second.sourceId,persona:'thor',revision:second.revision,answer:'Second'},callClaudeWithTools);
    assert.equal(b.ok,true);assert.equal(b.routineOutcome,'done');
    assert.equal(await routineHasPendingWork(env,'fixture-routine'),false);
    assert.equal(JSON.parse(kv.get('routines:fixture-routine')).runs.length,1);
  });
});

test('remaining routine steps respect a tool turned off while waiting',async()=>{
  const {env,kv}=fixture();seedRoutine(kv,{steps:[{delegate:{councillor:'jane_foster',task:'Where?'}},{tool:'browser_navigate',args:{url:'https://example.invalid'}}]});
  await mocked([ask,final],async requests=>{
    await routineRunNow(env,'thor','fixture-routine',async()=>{throw Error('No pre-question tool');});
    const q=(await getBridgeSnapshot(env)).needs[0];kv.set('permissions',JSON.stringify({browser_navigate:'off'}));
    const a=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Home'},callClaudeWithTools);
    assert.equal(a.routineOutcome,'failed');assert.match(a.message,/turned off/);assert.equal(requests.length,2);
    assert.equal(JSON.parse(kv.get('routines:fixture-routine')).runs[0].ok,false);
  });
});

test('saved untrusted context cannot bypass approval in remaining routine steps',async()=>{
  const {env,kv,store}=fixture();seedRoutine(kv,{steps:[{delegate:{councillor:'jane_foster',task:'Where?'}},{tool:'remember_this',args:{fact:'Fixture outside claim'}}],deliver:'silent'});
  await mocked([ask,final],async requests=>{
    await routineRunNow(env,'thor','fixture-routine',async()=>{throw Error('No pre-question tool');});
    const q=(await getBridgeSnapshot(env)).needs[0],records=await store.get('bridge:executions');
    const key=records.find(r=>r.id===q.sourceId).checkpoint,c=await store.get(key);
    c.startTainted=true;c.convo.meta.tainted={turnsLeft:30,sources:[{source:'fixture outside page',at:Date.now()}]};await store.put(key,c);
    const a=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Home'},callClaudeWithTools);
    assert.equal(a.ok,true);assert.equal(a.routineOutcome,'done');
    const approval=JSON.parse(kv.get('approvals'))[0];assert.equal(approval.tool,'remember_this');assert.match(approval.description,/THIS SESSION HAS READ UNTRUSTED CONTENT/);assert.equal(approval.status,'pending');
    assert.equal(requests.length,2,'No extra memory model or critic call');
  });
});

import {resumeBatchedRoutine} from '../src/lib/routines.js';
test('a batch after a question stays queued and resumes its remaining steps once',async()=>{
  const {env,kv}=fixture();env.ANTHROPIC_API_KEY='fixture-no-network';
  seedRoutine(kv,{steps:[{delegate:{councillor:'jane_foster',task:'Where?'}},{compose:{instruction:'Summarize the answer',batch:true,tier:'cheap'}},{tool:'calculate',args:{expression:'3+4'}}],deliver:'silent'});
  const original=globalThis.fetch,replies=[ask,final];let batchRequests=0,tailCalls=0;
  globalThis.fetch=async url=>{
    if(url==='https://api.anthropic.com/v1/messages/batches'){batchRequests++;return Response.json({id:'fixture-batch',processing_status:'in_progress'});}
    assert.equal(url,'https://api.anthropic.com/v1/messages');assert.ok(replies.length);return Response.json(replies.shift());
  };
  try {
    await routineRunNow(env,'thor','fixture-routine',async()=>{throw Error('No tool before the question');});
    const q=(await getBridgeSnapshot(env)).needs[0];
    const a=await answerBridgeQuestion(env,{id:q.sourceId,persona:'thor',revision:q.revision,answer:'Home'},callClaudeWithTools);
    assert.equal(a.ok,true);assert.equal(a.routineOutcome,'queued');assert.match(a.message,/has not finished/);assert.equal(batchRequests,1);
    assert.equal(await routineHasPendingWork(env,'fixture-routine'),true);
    const queued=await getBridgeSnapshot(env);assert.equal(queued.running.length,0);assert.ok(queued.activity.some(e=>/queued for batch/.test(e.summary)));
    const entry=JSON.parse(kv.get('system:batches')).pending[0];
    const execute=async()=>{tailCalls++;return '7';};
    await resumeBatchedRoutine(env,entry,[{text:'BATCH RESULT'}],execute);
    assert.equal(tailCalls,1);assert.equal(await routineHasPendingWork(env,'fixture-routine'),false);
    await resumeBatchedRoutine(env,entry,[{text:'BATCH RESULT'}],execute);
    assert.equal(tailCalls,1);assert.equal(JSON.parse(kv.get('routines:fixture-routine')).runs.length,1);
  } finally {globalThis.fetch=original;}
});
