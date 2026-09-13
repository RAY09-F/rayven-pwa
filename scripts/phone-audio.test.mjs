import test from 'node:test';import assert from 'node:assert/strict';
import {storePhoneAudio,readPhoneAudio,cleanupPhoneAudio} from '../src/lib/phone-audio.js';
import {phoneQuickReply} from '../src/lib/phone-agent.js';
import {synthCallAudio} from '../src/lib/comms.js';
test('phone audio uses an immediately readable binary object and expires at its URL deadline',async()=>{
 const objects=new Map(),env={CLIPS:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{body:objects.get(k)}:null}};
 const bytes=new Uint8Array([73,68,51,0]),id=await storePhoneAudio(env,bytes);
 assert.match(id,/^r2\d{13}[a-f0-9]{20}$/);const r=await readPhoneAudio(env,id);assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal((await readPhoneAudio(env,'r20000000000000'+'a'.repeat(20))).status,404);assert.equal((await readPhoneAudio(env,'../other-media')).status,404);
});
test('cleanup removes only expired temporary phone audio, never other bucket assets',async()=>{
 const now=Date.parse('2026-09-13T02:00:00Z'),old='phone-audio/r2'+(now-1000)+'a'.repeat(20),fresh='phone-audio/r2'+(now+1000)+'b'.repeat(20);let removed=[];
 const env={CLIPS:{list:async()=>({objects:[{key:old},{key:fresh},{key:'clips/important.mp4'},{key:'phone-audio/notes'}]}),delete:async keys=>{removed=keys;}}};
 await cleanupPhoneAudio(env,now);assert.deepEqual(removed,[old]);
});
test('fast speech preserves persona voice, uses Flash, and bypasses base64 KV storage when R2 works',async()=>{
 const previous=globalThis.fetch;let request,stored,timing;
 try{globalThis.fetch=async(url,opts)=>{request={url,body:JSON.parse(opts.body),signal:opts.signal};return new Response(new Uint8Array([73,68,51]));};
 const env={ELEVENLABS_API_KEY:'test',ELEVENLABS_VOICE_ID:'voice-test',CLIPS:{put:async(k,v)=>{stored=v;}},RAYVEN_KV:{put:async()=>{throw Error('KV should not be needed');}}};
 const id=await synthCallAudio(env,'Test reply','thor',{fast:true,onTiming:t=>{timing=t;}});assert.ok(id.startsWith('r2'));assert.equal(request.body.model_id,'eleven_flash_v2_5');assert.ok(request.signal);assert.equal(stored.length,3);assert.equal(timing.audioStorage,'r2');
 }finally{globalThis.fetch=previous;}
});
test('quick conversation avoids a model only for exact social phrases, never substantive instructions',()=>{
 assert.equal(phoneQuickReply('Can you hear me?'),"I'm here, Rayan.");assert.match(phoneQuickReply('Goodbye'),/DONE$/);assert.equal(phoneQuickReply('Thanks, now buy stocks'),null);assert.equal(phoneQuickReply('Hello, what is my balance?'),null);
});

test('fast speech falls back to expiring KV audio if R2 rejects the write',async()=>{
 const previous=globalThis.fetch;let stored,timing;
 try{globalThis.fetch=async()=>new Response(new Uint8Array([73,68,51]));
 const env={ELEVENLABS_API_KEY:'test',ELEVENLABS_VOICE_ID:'voice-test',CLIPS:{put:async()=>{throw Error('unavailable');}},RAYVEN_KV:{put:async(k,v,opts)=>{stored={k,v,opts};}}};
 const id=await synthCallAudio(env,'Fallback test','thor',{fast:true,onTiming:t=>{timing=t;}});
 assert.equal(stored.k,'callaudio:'+id);assert.equal(stored.v,'SUQz');assert.equal(stored.opts.expirationTtl,900);assert.equal(timing.audioStorage,'kv');
 }finally{globalThis.fetch=previous;}
});
