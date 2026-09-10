import test from 'node:test';import assert from 'node:assert/strict';
import {anthropicFetch} from '../src/lib/anthropic-gateway.js';
import {mirrorConversation} from '../src/lib/conversation-mirror.js';
const gateway={AI_GATEWAY_ENABLED:'true',AI_GATEWAY_SPEND_LIMIT_VERIFIED:'true',ANTHROPIC_GATEWAY_BASE:'https://gateway.ai.cloudflare.com/v1/'+ 'a'.repeat(32)+'/fixture/anthropic',ANTHROPIC_DIRECT_FALLBACK:'true'};
test('wrong gateway route falls back but spend caps and ambiguous failures never bypass the limit',async()=>{
 const original=globalThis.fetch;const seen=[];
 try{globalThis.fetch=async(url,opts)=>{seen.push(url);if(seen.length===1){assert.equal(opts.headers.get('cf-aig-collect-log-payload'),'false');return new Response(null,{status:404});}return new Response('ok');};
 assert.equal((await anthropicFetch(gateway,'/v1/messages',{method:'POST',body:'{}'})).status,200);assert.equal(seen[1],'https://api.anthropic.com/v1/messages');
 for(const status of [400,401,429,500,503,529]){let n=0;globalThis.fetch=async()=>{n++;return new Response(null,{status});};assert.equal((await anthropicFetch(gateway,'/v1/messages')).status,status);assert.equal(n,1);}
 let n=0;globalThis.fetch=async()=>{n++;throw Error('lost connection');};await assert.rejects(anthropicFetch(gateway,'/v1/messages'));assert.equal(n,1);
 }finally{globalThis.fetch=original;}
});
test('gateway refuses traffic before verified limit and refuses credential exfiltration hosts',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected fetch');};
 try{await assert.rejects(anthropicFetch({...gateway,AI_GATEWAY_SPEND_LIMIT_VERIFIED:'false'},'/v1/messages'),/spend limit/);await assert.rejects(anthropicFetch({...gateway,ANTHROPIC_GATEWAY_BASE:'https://evil.example'},'/v1/messages'),/Gateway URL/);await assert.rejects(anthropicFetch({...gateway,ANTHROPIC_DIRECT_BASE:'https://evil.example'},'/v1/messages'),/provider host/);}finally{globalThis.fetch=original;}
});
function storage(){const records=new Map(),kvValues=new Map([['history','legacy']]);let writes=0;return{records,kvValues,get:async k=>records.get(k),put:async(k,v)=>records.set(k,v),kv:{get:async k=>kvValues.get(k)??null,put:async(k,v)=>{writes++;kvValues.set(k,v);}},now:()=>1234,writes:()=>writes};}
test('copy forward preserves KV and dual-write retains trial start',async()=>{
 const db=storage();assert.equal(await mirrorConversation(db,'history'),'legacy');assert.equal(db.writes(),0);assert.equal(db.records.get('conversation:copy:history').raw,'legacy');
 await mirrorConversation({...db,now:()=>9000},'history','new');assert.equal(db.kvValues.get('history'),'new');assert.equal(db.records.get('conversation:copy:history').startedAt,1234);assert.equal(db.records.get('conversation:copy:history').raw,'new');
});
test('a disagreement stops every subsequent migration operation without reconciliation',async()=>{
 const db=storage();await mirrorConversation(db,'history');db.kvValues.set('history','external write');await assert.rejects(mirrorConversation(db,'history','overwrite'),/disagree/);assert.equal(db.writes(),0);assert.equal(db.kvValues.get('history'),'external write');await assert.rejects(mirrorConversation(db,'other'),'migration is stopped');
});
test('actual TTS route uses existing MeloTTS on provider HTTP and network failures',async()=>{
 const {registerHooks}=await import('node:module');const hook=registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return{url:'data:text/javascript,export class DurableObject {}',shortCircuit:true};return next(s,c);}});
 const worker=(await import('../src/index.js')).default;hook.deregister();const original=globalThis.fetch;
 let calls=0;const env={ELEVENLABS_API_KEY:'fixture',ELEVENLABS_VOICE_ID:'fixture',AI:{run:async(model)=>{assert.match(model,/melotts/);calls++;return{audio:btoa('fixture audio')};}},RAYVEN_KV:{get:async()=>null}};
 try{for(const failure of [()=>new Response(null,{status:429}),()=>{throw Error('network fixture');}]){globalThis.fetch=async()=>failure();const r=await worker.fetch(new Request('https://fixture.invalid/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'fixture',persona:'thor'})}),env,{waitUntil:()=>{}});assert.equal(r.status,200);assert.equal(r.headers.get('x-asgard-voice'),'fallback');assert.equal(await r.text(),'fixture audio');}assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
