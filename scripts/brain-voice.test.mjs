import test from 'node:test';import assert from 'node:assert/strict';
import {voiceSession} from '../src/lib/voice-session.js';import {VoicePlayback} from '../public/ui/voice-stream.js';
test('speech socket remains warm, receives continuous deltas and flushes once per turn',async()=>{
 const sent=[],events=[],commits=[];let connects=0;
 const session=voiceSession({send:m=>events.push(m),connectSpeech:async()=>{connects++;return {isOpen:()=>true,send:m=>sent.push(JSON.parse(m)),close(){}};},runTurn:async(text,options)=>{options.voiceTurn.commit=async n=>commits.push(n);options.onText('Hel');options.onText('lo.');return {reply:'Hello.'};}});
 await session.receive({type:'turn',id:'one',text:'hello'});await session.receive({type:'heard',id:'one',heardChars:999});
 await session.receive({type:'turn',id:'two',text:'hello'});await session.receive({type:'interrupt',heardChars:3});
 assert.equal(connects,1);assert.equal(sent.filter(m=>m.flush).length,2);assert.ok(sent.some(m=>m.text==='Hel'));assert.deepEqual(commits,[6,3]);assert.equal(events.filter(m=>m.type==='done').length,2);
});
test('barge-in closes speech context before aborting generation',async()=>{
 const order=[];let ready;const started=new Promise(r=>ready=r);
 const session=voiceSession({send(){},connectSpeech:async()=>({isOpen:()=>true,send:m=>{if(JSON.parse(m).close_context)order.push('close');},close(){}}),runTurn:async(_,{signal})=>{ready();await new Promise((_,reject)=>signal.addEventListener('abort',()=>{order.push('abort');reject(Error('cancel'));},{once:true}));}});
 const turn=session.receive({type:'turn',id:'one',text:'hello'});await started;await session.receive({type:'interrupt',heardChars:0});await turn;assert.deepEqual(order,['close','abort']);
});
test('PCM fragments preserve split samples and stop after gain ramp',()=>{
 const order=[],starts=[];const context={currentTime:1,destination:{},createGain:()=>({connect(){},gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(_,at){order.push(['ramp',at]);}}}),createBuffer:(_,n,rate)=>({duration:n/rate,getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>({connect(){},disconnect(){},start:at=>starts.push(at),stop:at=>order.push(['stop',at])})};
 const player=new VoicePlayback(context);player.append(btoa(String.fromCharCode(0)),{});assert.equal(player.nodes.size,0);player.append(btoa(String.fromCharCode(1,2,3)),{char_start_times_ms:[0],char_durations_ms:[1]});assert.equal(player.nodes.size,1);
 context.currentTime=2;assert.equal(player.heard(),1);player.stop();assert.equal(order[0][0],'ramp');assert.equal(order[1][0],'stop');assert.equal(order[0][1],order[1][1]);assert.equal(starts[0],1.02);
});
test('racing interrupt and next turn commit heard history only once',async()=>{
 const commits=[];let ready;const started=new Promise(r=>ready=r);let turns=0;
 const session=voiceSession({send(){},connectSpeech:async()=>({isOpen:()=>true,send(){},close(){}}),runTurn:async(_,{signal,onText,voiceTurn})=>{voiceTurn.commit=async n=>commits.push(n);onText('Hello.');if(++turns===1){ready();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancel')),{once:true}));}return {reply:'Hello.'};}});
 const first=session.receive({type:'turn',id:'first',text:'hello'});await started;
 await Promise.all([session.receive({type:'interrupt',id:'first',heardChars:3}),session.receive({type:'turn',id:'next',text:'next'})]);await first;
 assert.deepEqual(commits,[3]);
});
test('closed speech socket cannot prevent abort and history cleanup',async()=>{
 const commits=[];let ready;const started=new Promise(r=>ready=r);
 const session=voiceSession({send(){},connectSpeech:async()=>({isOpen:()=>true,send:m=>{if(JSON.parse(m).close_context)throw Error('closed');},close(){}}),runTurn:async(_,{signal,onText,voiceTurn})=>{voiceTurn.commit=async n=>commits.push(n);onText('Hello');ready();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancel')),{once:true}));}});
 const first=session.receive({type:'turn',id:'first',text:'hello'});await started;await session.receive({type:'interrupt',heardChars:2});await first;assert.deepEqual(commits,[2]);
});
test('turn abort cancels a stalled provider handshake',async()=>{
 let ready;const started=new Promise(r=>ready=r);let aborted=false;
 const session=voiceSession({send(){},connectSpeech:async(_,signal)=>{ready();return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancel'));},{once:true}));},runTurn:async()=>assert.fail('Must not start model')});
 const first=session.receive({type:'turn',id:'first',text:'hello'});await started;await session.receive({type:'interrupt'});await first;assert.equal(aborted,true);
});
test('late microphone permission cannot reactivate disabled voice',async()=>{
 const {VoiceClient}=await import('../public/ui/voice-stream.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),cancel=globalThis.cancelAnimationFrame;let grant,stops=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>grant=r)}}});globalThis.cancelAnimationFrame=()=>{};
 try{const client=new VoiceClient('https://fixture.invalid',()=>{});client.unlock=async()=>{};const enabling=client.enableBargeIn();await Promise.resolve();client.disableBargeIn();grant({getTracks:()=>[{stop(){stops++;}}]});await enabling;assert.equal(stops,1);assert.equal(client.mic,null);}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;globalThis.cancelAnimationFrame=cancel;}
});
