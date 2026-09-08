import test from 'node:test';import assert from 'node:assert/strict';
import {COUNCIL,delegate,runQueuedDelegations} from '../src/lib/council.js';
import {callClaudeWithTools} from '../src/lib/tools.js';
const envFixture=()=>{const values=new Map();return {values,RAYVEN_KV:{get:async key=>values.get(key)||null,put:async(key,value)=>values.set(key,value),delete:async key=>values.delete(key)}};};
test('inline delegation selects scope without a model call; foreign council refused',async()=>{
 const env=envFixture(),scope={},meta={};
 const text=await delegate(env,'thor',{councillor:'jane_foster',task:'Read a source',wait:true},{scope,meta});
 assert.equal(scope.councillor,'jane_foster');assert.match(text,/No separate model/);
 assert.match(await delegate(env,'thor',{councillor:'kang',task:'watch'},{scope,meta}),/No councillor/);
});
test('same-turn server gate refuses Kang sending SMS, including canonical alias',async()=>{
 const original=globalThis.fetch,env=envFixture(),meta={},requests=[];
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');requests.push(JSON.parse(init.body));
  return Response.json(requests.length===1?{stop_reason:'tool_use',content:[{type:'tool_use',id:'delegate',name:'delegate',input:{councillor:'kang',task:'Watch changes',wait:true}},{type:'tool_use',id:'send',name:'comms_sms_send',input:{to:'fixture',message:'Must never send'}}]}:{stop_reason:'end_turn',content:[{type:'text',text:'The text was blocked.'}]});
 };
 try{
  const result=await callClaudeWithTools(env,'Fixture','Fixture','Fixture',[{role:'user',content:'Fixture'}],true,null,'loki',false,{meta,channel:'web'});
  assert.equal(result.ok,true);assert.equal(requests.length,2); // normal tool round trip, no nested councillor inference
  const outcomes=requests[1].messages.at(-1).content;
  assert.match(outcomes.find(x=>x.tool_use_id==='send').content,/outside.*permissions/);
  assert.ok(JSON.stringify(meta).includes('councillor allow-list refusal'));
 }finally{globalThis.fetch=original;}
});
test('queue carries the four-part brief and delivers to hall without Telegram',async()=>{
 const env=envFixture(),meta={};await delegate(env,'thor',{councillor:'jane_foster',task:'Summarize fixture source',wait:false},{meta});
 const queued=meta._spool.find(x=>x.kind==='delegation');assert.ok(queued.brief.objective&&queued.brief.output&&queued.brief.tools&&queued.brief.boundaries);
 const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://api.anthropic.com/v1/messages');return Response.json({stop_reason:'end_turn',content:[{type:'text',text:'Fixture source says hello.'}]});};
 try{assert.equal(await runQueuedDelegations(env,[queued]),1);assert.ok([...env.values.values()].some(value=>value.includes('pendingSpeech')&&value.includes('Fixture source says hello.')));}finally{globalThis.fetch=original;}
});
test('historical paper identities remain exact',()=>{assert.equal(COUNCIL.hogun.paperAgentId,'heimdall');assert.equal(COUNCIL.heimdall.paperAgentId,'vidar');assert.equal(COUNCIL.volstagg.paperAgentId,'baldr');assert.equal(COUNCIL.frigga.paperAgentId,'freya');assert.equal(COUNCIL.fandral.paperAgentId,'tyr');});
