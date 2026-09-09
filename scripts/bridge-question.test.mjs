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
