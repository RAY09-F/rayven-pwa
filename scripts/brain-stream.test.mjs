import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMessage } from '../src/lib/anthropic-stream.js';
import { callAnthropic } from '../src/lib/anthropic.js';
import { readChatReply } from '../public/ui/event-stream.js';
const wire = events => events.map(data => `event: ${data.type}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`).join('');
function stream(text) { const bytes = new TextEncoder().encode(text); return new ReadableStream({start(c){ for(const byte of bytes)c.enqueue(Uint8Array.of(byte));c.close();}}); }
const start = {type:'message_start',message:{id:'fixture',content:[],usage:{input_tokens:123,cache_read_input_tokens:100}}};
const stop = [{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:4}},{type:'message_stop'}];
test('byte-split UTF8, tool JSON, thinking signature, cumulative usage and ping',async()=>{
 const seen=[];
 const result=await collectMessage(stream(wire([start,{type:'ping'},
 {type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}},
 {type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'private'}},
 {type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'signed'}},
 {type:'content_block_stop',index:0},
 {type:'content_block_start',index:1,content_block:{type:'tool_use',id:'t',name:'fixture',input:{}}},
 {type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"city":'}},
 {type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'"Montréal"}'}},
 {type:'content_block_stop',index:1},
 {type:'content_block_start',index:2,content_block:{type:'text',text:''}},
 {type:'content_block_delta',index:2,delta:{type:'text_delta',text:'Hello ⚡'}},
 {type:'content_block_stop',index:2},...stop])), t=>seen.push(t));
 assert.deepEqual(seen,['Hello ⚡']);assert.equal(result.content[0].signature,'signed');
 assert.deepEqual(result.content[1].input,{city:'Montréal'});assert.equal(result.usage.cache_read_input_tokens,100);assert.equal(result.usage.output_tokens,4);
});
test('truncated provider stream is never a completed reply',async()=>assert.rejects(collectMessage(stream(wire([start]))),/before completion/));
test('malformed tool JSON fails before dispatch',async()=>assert.rejects(collectMessage(stream(wire([start,{type:'content_block_start',index:0,content_block:{type:'tool_use',input:{}}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{' }},{type:'content_block_stop',index:0},...stop])))));
test('429 honors retry-after and 529 backs off',async()=>{
 const original=globalThis.fetch;let calls=0;const sleeps=[];
 globalThis.fetch=async()=>++calls===1?new Response(JSON.stringify({error:{type:'rate_limit_error'}}),{status:429,headers:{'retry-after':'2'}}):calls===2?new Response(JSON.stringify({error:{type:'overloaded_error'}}),{status:529}):Response.json({content:[],usage:{}});
 try {assert.equal((await callAnthropic({},[],[],[],100,undefined,{sleep:async ms=>sleeps.push(ms)})).ok,true);assert.deepEqual(sleeps,[2000,2000]);}finally{globalThis.fetch=original;}
});
test('monthly spend cap does not retry',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({error:{details:{error_code:'enforced_spend_limit_reached'}}},{status:429});};
 try {const r=await callAnthropic({},[],[],[]);assert.equal(calls,1);assert.match(r.data.error.message,/spending limit/);}finally{globalThis.fetch=original;}
});
test('in-stream overload surfaces readable error with no replay',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(stream(wire([start,{type:'error',error:{type:'overloaded_error'}}])));};
 try{const r=await callAnthropic({},[],[],[],100,undefined,{onText:()=>{}});assert.equal(calls,1);assert.match(r.data.error.message,/overloaded/);}finally{globalThis.fetch=original;}
});
test('Haiku omits unsupported effort; Sonnet requests low effort',async()=>{
 const original=globalThis.fetch, bodies=[];globalThis.fetch=async(_,init)=>{bodies.push(JSON.parse(init.body));return Response.json({content:[]});};
 try{await callAnthropic({},[],[],[],100,'claude-haiku-4-5');await callAnthropic({},[],[],[],100,'claude-sonnet-5');assert.equal(bodies[0].output_config,undefined);assert.equal(bodies[1].output_config.effort,'low');}finally{globalThis.fetch=original;}
});
test('browser shows progressive text, resets between tool turns, requires final receipt',async()=>{
 const chunks=[];const response=new Response(stream('event: text\ndata: {"text":"First"}\n\nevent: reset\ndata: {}\n\nevent: text\ndata: {"text":"Final"}\n\nevent: done\ndata: {"reply":"Final"}\n\n'));
 assert.equal((await readChatReply(response,(...args)=>chunks.push(args))).reply,'Final');assert.deepEqual(chunks,[['First'],['',true],['Final']]);
 await assert.rejects(readChatReply(new Response(stream('event: text\ndata: {"text":"partial"}\n\n')),()=>{}),/before completion/);
});

test('mixed cache TTLs are costed separately',async()=>{
 const {usd}=await import('../src/lib/cost.js');
 assert.equal(usd('claude-sonnet-5',{cache_creation_input_tokens:2000,cache_creation:{ephemeral_1h_input_tokens:1000,ephemeral_5m_input_tokens:1000}}),0.0065);
});

test('actual Worker smoke route streams without consuming pending approvals or writing KV',async()=>{
 const {registerHooks}=await import('node:module');
 const hook=registerHooks({resolve(specifier,context,next){if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {}',shortCircuit:true};return next(specifier,context);}});
 const worker=(await import('../src/index.js')).default;hook.deregister();
 const original=globalThis.fetch;const writes=[],waits=[],bodies=[];
 const env={RAYVEN_KV:{get:async key=>key.startsWith('pending:')?JSON.stringify({toolName:'send_text',toolInput:{}}):null,put:async(...args)=>writes.push(args),delete:async(...args)=>writes.push(args)}};
 globalThis.fetch=async(_,init)=>{bodies.push(JSON.parse(init.body));return new Response(stream(wire([start,{type:'content_block_start',index:0,content_block:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Fixture response'}},{type:'content_block_stop',index:0},...stop])));};
 try{
  for(const message of ['yes','APPROVE 1234','[WAKE_TRIGGER]']){
   const response=await worker.fetch(new Request('https://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream','X-Asgard-Smoke':'1'},body:JSON.stringify({message,persona:'thor'})}),env,{waitUntil:p=>waits.push(p)});
   assert.equal((await readChatReply(response,()=>{})).reply,'Fixture response');
  }
  await Promise.all(waits);assert.equal(writes.length,0);assert.equal(bodies.length,3);assert.ok(bodies.every(b=>b.tools.length===0));
 }finally{globalThis.fetch=original;}
});
