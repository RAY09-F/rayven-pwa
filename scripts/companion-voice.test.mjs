// Voice transport authentication, validation and persona routing without live side effects.
import test from 'node:test';import assert from 'node:assert/strict';
import {companionVoice} from '../src/lib/companion-voice.js';
const env={ASGARD_COMPANION_TOKEN:'test-only',RAYVEN_KV:{get:async()=>null}};
const call=(path,body={},token='test-only',chat=async()=>({reply:'Here.'}))=>companionVoice(new Request('https://example.com'+path,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}),env,{},chat);
test('Voice routes reject missing credentials before running chat',async()=>{let ran=false;const r=await call('/ask',{assistant:'thor',text:'hello'},'',async()=>{ran=true;});assert.equal(r.status,401);assert.equal(ran,false);});
test('Voice routes validate assistant and command',async()=>{assert.equal((await call('/ask',{assistant:'unknown',text:'hello'})).status,400);assert.equal((await call('/ask',{assistant:'thor',text:''})).status,400);assert.equal((await call('/ask',{assistant:'thor',text:'a'.repeat(6000)})).status,413);});
for(const id of ['thor','loki','odin'])test(`${id} routes through shared voice-mode chat`,async()=>{let opts;const r=await call('/ask',{assistant:id,text:'hello'},'test-only',async(e,c,o)=>{opts=o;return {reply:'Hello.'};});assert.equal(opts.personaId,id);assert.equal(opts.voiceMode,true);assert.equal(opts.body.message,'hello');assert.deepEqual(await r.json(),{heard:'hello',say:'Hello.',actions:[],needsConfirm:false});});
test('Unrelated routes are untouched',async()=>{assert.equal(await companionVoice(new Request('https://example.com/telegram'),env,{},()=>{throw Error('unexpected');}),null);});
test('Health reports missing optional STT honestly',async()=>{const r=await companionVoice(new Request('https://example.com/health'),env,{},()=>{});assert.equal((await r.json()).stt,'none');});
