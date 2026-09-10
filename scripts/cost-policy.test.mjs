import test from 'node:test';
import assert from 'node:assert/strict';
import {stableRequest,modelRoundLimit,boundedToolResult} from '../src/lib/cost-policy.js';
import {summarizeOlderHistory} from '../src/lib/history-summary.js';
import {callClaudeWithTools} from '../src/lib/tools.js';
import {MODELS} from '../src/lib/models.js';
import {usd} from '../src/lib/cost.js';
import {activeIdentity,safeError} from '../src/lib/chat-diagnostics.js';

test('time and history changes stay after identical one-hour cache prefixes',()=>{
 const make=time=>stableRequest([{type:'text',text:'Fixed persona rules'},{type:'text',text:time,cache_control:{type:'ephemeral'}}],[{name:'calculate',input_schema:{type:'object'}}],[{role:'user',content:[{type:'text',text:time,cache_control:{type:'ephemeral'}}]}]);
 const a=make('09:00'),b=make('09:01');assert.deepEqual(a.tools,b.tools);assert.deepEqual(a.system[0],b.system[0]);
 assert.equal(JSON.stringify(a).match(/cache_control/g).length,2);assert.equal(a.system[0].cache_control.ttl,'1h');assert.equal(a.system[1].cache_control,undefined);assert.equal(a.messages[0].content[0].cache_control,undefined);
});
test('round cap and long tool results remain bounded without discarding image blocks',()=>{
 assert.equal(modelRoundLimit(14),6);assert.equal(modelRoundLimit(3),3);assert.equal(modelRoundLimit(undefined),6);
 assert.ok(boundedToolResult('x'.repeat(30000)).length<12200);const image={type:'image',source:{type:'base64',data:'fixture'}};assert.deepEqual(boundedToolResult([image]),[image]);
});
test('loop uses at most six requests and asks for a final answer without more tools',async()=>{
 const original=globalThis.fetch,requests=[];let calls=0;
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.anthropic.com/v1/messages');const body=JSON.parse(init.body);requests.push(body);calls++;return Response.json({stop_reason:calls<6?'tool_use':'end_turn',content:calls<6?[{type:'tool_use',id:'calc'+calls,name:'calculate',input:{expression:'2+3'}}]:[{type:'text',text:'5; no further tools needed.'}],usage:{input_tokens:10,output_tokens:5}});};
 try{const env={RAYVEN_KV:{get:async()=>null,put:async()=>{},delete:async()=>{}}};const result=await callClaudeWithTools(env,'Rules','Channel','Memory',[{role:'user',content:'Calculate'}],true,null,'thor',false,{meta:{},channel:'web'});assert.equal(result.ok,true);assert.equal(requests.length,6);assert.equal(requests[5].tool_choice.type,'none');assert.ok(requests.every(r=>r.model===MODELS.sonnet));}finally{globalThis.fetch=original;}
});
test('history summary uses Haiku, preserves twelve exchanges and spools usage without a KV write',async()=>{
 const original=globalThis.fetch;let writes=0;const meta={},turns=Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:'Turn '+i}));
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);assert.equal(body.model,MODELS.haiku);return Response.json({content:[{type:'text',text:'Earlier decisions retained.'}],usage:{input_tokens:15,output_tokens:7}});};
 try{const result=await summarizeOlderHistory({RAYVEN_KV:{put:()=>{writes++;}}},turns,meta,'odin');assert.deepEqual(result,turns.slice(-24));assert.equal(meta.summary,'Earlier decisions retained.');assert.equal(meta._spool[0].kind,'cost');assert.equal(writes,0);}finally{globalThis.fetch=original;}
});
test('failed summary retains history rather than inventing a successful summary',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:{message:'unavailable'}},{status:503});
 const turns=Array.from({length:30},()=>({role:'user',content:'old context'})),meta={summary:'Existing summary'};
 try{assert.equal(await summarizeOlderHistory({},turns,meta,'thor'),turns);assert.equal(meta.summary,'Existing summary');}finally{globalThis.fetch=original;}
});
test('one-hour cache writes and reads are accounted at their actual price multipliers',()=>{
 assert.equal(usd(MODELS.sonnet,{cache_creation_input_tokens:1000,cache_creation:{ephemeral_1h_input_tokens:1000}}),.004);
 assert.equal(usd(MODELS.sonnet,{cache_read_input_tokens:1000}),.0002);
});
test('identity anchor uses the routed persona and diagnostics remove credentials',()=>{
 assert.ok(activeIdentity({name:'ODIN',systemPrompt:'Rules'}).includes('ACTIVE ASSISTANT: ODIN'));
 assert.equal(safeError(Error('Bad sk-ant-fixturevalue at https://example.com/private')), 'Bad [redacted credential] at [URL omitted]');
});
