import test from 'node:test';import assert from 'node:assert/strict';
import {phoneTransition,publicPhoneState,localClock,phoneWindow} from '../src/lib/phone-state.js';
import {validateTwilio,phonePersona,handlePhoneRequest,runPhoneUpdates} from '../src/lib/phone-updates.js';
import {toolDefinitionsForPersona} from '../src/lib/tools.js';
import {coreFor} from '../src/tools/meta.js';
const now=Date.parse('2026-09-12T01:00:00Z');
test('all three main personas have the owner notification tool in their active core',()=>{
  for(const p of ['thor','loki','odin'])assert.ok(coreFor(p,toolDefinitionsForPersona(p)).some(t=>t.name==='notify_owner'));
});
function machine(){let s;return {go(a,t=now){const n=phoneTransition(s,a,t);s=n.state;return n.result;},get state(){return s;}};}
test('calls fail closed; presence expires; daily reservation and cap are atomic',()=>{
  const m=machine();assert.equal(m.go({kind:'reserve',id:'0'}).reason,'disabled');
  assert.throws(()=>m.go({kind:'configure',config:{enabled:true}}));
  m.go({kind:'configure',config:{enabled:true,to:'+15555550123',dailyTime:'18:00'}});
  m.go({kind:'enqueue',item:{id:'urgent',persona:'loki',priority:'high'}});
  m.go({kind:'presence',state:'home'});
  const daily=m.go({kind:'reserve',id:'daily'});assert.equal(daily.item.daily,true);
  assert.equal(m.go({kind:'reserve',id:'double'}).reason,'cooldown');
  assert.equal(m.go({kind:'reserve',id:'home'},now+610000).reason,'not_due');
  m.go({kind:'presence',state:'away',source:'location'},now+610000);
  assert.equal(m.go({kind:'reserve',id:'urgent1'},now+610001).item.id,'urgent');
  m.go({kind:'enqueue',item:{id:'urgent2',persona:'odin',priority:'high'}},now+2500000);
  assert.equal(m.go({kind:'reserve',id:'stale'},now+2500001).reason,'not_due');
  m.go({kind:'presence',state:'away'},now+2500002);
  assert.equal(m.go({kind:'reserve',id:'third'},now+2500003).item.id,'urgent2');
  assert.equal(m.go({kind:'reserve',id:'fourth'},now+3200000).reason,'daily_limit');
  assert.equal(publicPhoneState(m.state).config.to,'••••0123');
});
test('pairing expires and is single-use; presence and configuration validate',()=>{
  const m=machine();m.go({kind:'pair',hash:'code'});
  assert.throws(()=>m.go({kind:'redeem',hash:'bad',ownerHash:'new'}));
  m.go({kind:'redeem',hash:'code',ownerHash:'new'});
  assert.throws(()=>m.go({kind:'redeem',hash:'code',ownerHash:'other'}));
  assert.throws(()=>m.go({kind:'configure',config:{to:'911',enabled:true}}));
  assert.throws(()=>m.go({kind:'configure',config:{dailyTime:'29:01'}}));
  assert.throws(()=>m.go({kind:'configure',config:{timeZone:'invalid'}}));
  assert.throws(()=>m.go({kind:'configure',config:{maxDaily:999}}));
  m.go({kind:'pair',hash:'late'});assert.throws(()=>m.go({kind:'redeem',hash:'late'},now+600001));
  assert.equal(localClock(Date.parse('2026-11-01T09:30:00Z'),'America/Los_Angeles').minute,90);
});
test('dedupe, unknown delivery and out-of-order callbacks do not redial or undo completion',()=>{
  const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123',dailyEnabled:false}});m.go({kind:'presence',state:'away'});
  const item={id:'one',persona:'thor',priority:'critical'};m.go({kind:'enqueue',item});assert.equal(m.go({kind:'enqueue',item}).reason,'duplicate');
  m.go({kind:'reserve',id:'a'});m.go({kind:'result',id:'a',result:{status:'unknown'}});
  assert.equal(m.go({kind:'reserve',id:'b'},now+700000).reason,'not_due');
  m.go({kind:'result',id:'a',result:{status:'completed'}});m.go({kind:'result',id:'a',result:{status:'ringing'}});
  assert.equal(m.state.calls[0].status,'completed');m.go({kind:'pause'});assert.equal(m.go({kind:'reserve',id:'c'}).reason,'disabled');
});
test('Twilio callbacks require a valid signature including the exact URL',async()=>{
  const url='https://example.com/phone-api/callback?id=abc',form=new URLSearchParams({CallSid:'CA123',CallStatus:'completed'}),env={TWILIO_AUTH_TOKEN:'test-secret'};
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TWILIO_AUTH_TOKEN),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(url+'CallSidCA123CallStatuscompleted'));
  const signature=Buffer.from(bytes).toString('base64');
  assert.equal(await validateTwilio(new Request(url,{headers:{'x-twilio-signature':signature}}),env,form),true);
  assert.equal(await validateTwilio(new Request(url+'x',{headers:{'x-twilio-signature':signature}}),env,form),false);
  assert.equal(await validateTwilio(new Request(url),env,form),false);
});
test('routing is persona-aware and phone admin endpoints reject anonymous requests',async()=>{
  assert.equal(phonePersona({source:'calendar'}),'loki');assert.equal(phonePersona({source:'paper-trading'}),'odin');assert.equal(phonePersona({source:'thor'}),'thor');
  const m=machine(),env={LEDGER:{idFromName:()=>0,get:()=>({fetch:async(u,init)=>Response.json({ok:true,result:m.go(JSON.parse(init.body).action)})})}};
  assert.equal((await handlePhoneRequest(new Request('https://site/phone-api/status'),env)).status,401);
  assert.equal((await handlePhoneRequest(new Request('https://site/phone-api/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env)).status,401);
  assert.equal((await runPhoneUpdates(env)).reason,'not_configured');
});
test('outbound updates use the fixed owner number, bounded calls and truthful fallback delivery',async()=>{
  const original=globalThis.fetch,calls=[];
  try{
    globalThis.fetch=async(url,init)=>{if(url.includes('IncomingPhoneNumbers'))return Response.json({incoming_phone_numbers:[{phone_number:'+15555550456',capabilities:{voice:true}}]});calls.push({url,params:new URLSearchParams(init.body)});return Response.json({sid:'CA_test',status:'queued'});};
    for(const persona of ['thor','loki','odin']){
      const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123'}});
      const env={TWILIO_ACCOUNT_SID:'AC_test',TWILIO_AUTH_TOKEN:'secret',TWILIO_PHONE_NUMBER:'+15555550456',LEDGER:{idFromName:()=>0,get:()=>({fetch:async(u,init)=>Response.json({ok:true,result:m.go(JSON.parse(init.body).action)})})}};
      const r=await runPhoneUpdates(env,{test:true,persona,now:()=>now});assert.equal(r.status,'queued');assert.equal(r.voice,'fallback');
      const p=calls.at(-1).params;assert.equal(p.get('To'),'+15555550123');assert.equal(p.get('From'),'+15555550456');assert.equal(p.get('TimeLimit'),'180');assert.match(p.get('Twiml'),new RegExp(persona));assert.match(p.get('Twiml'),/<Hangup\/>/);assert.equal(p.get('Record'),null);
    }
  }finally{globalThis.fetch=original;}
});
test('11 AM–3 AM overnight window blocks quiet hours, including test calls; all updates ignore presence',()=>{
  const c={timeZone:'America/Los_Angeles',callStart:'11:00',callEnd:'03:00'};
  for(const [utc,expected] of [['2026-09-12T17:59:59Z',false],['2026-09-12T18:00:00Z',true],['2026-09-13T09:59:00Z',true],['2026-09-13T10:00:00Z',false],['2026-09-13T17:00:00Z',false]])assert.equal(phoneWindow(c,Date.parse(utc)).allowed,expected,utc);
  const m=machine();m.go({kind:'configure',config:{...c,to:'+15555550123',enabled:true,allUpdates:true,awayOnly:false,dailyEnabled:false,maxDaily:null}});
  m.go({kind:'enqueue',item:{id:'normal',persona:'odin',priority:'normal',body:'a'}});
  m.go({kind:'enqueue',item:{id:'low',persona:'odin',priority:'low',body:'b'}});
  assert.equal(m.go({kind:'reserve',id:'blocked',test:true},Date.parse('2026-09-12T15:00:00Z')).reason,'quiet_hours');
  const r=m.go({kind:'reserve',id:'allowed'},Date.parse('2026-09-12T18:00:00Z'));assert.equal(r.batch.length,2);assert.equal(r.item.persona,'odin');
  assert.equal(m.go({kind:'reserve',id:'no-repeat'},Date.parse('2026-09-12T18:20:00Z')).reason,'not_due');
});
test('phone turns are claimed once, ordered and cached for duplicate webhooks',()=>{
  const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123'}});m.go({kind:'reserve',id:'call',test:true});
  assert.equal(m.go({kind:'claimTurn',id:'call',turn:1}).denied,true);
  assert.ok(m.go({kind:'claimTurn',id:'call',turn:0}).call);
  assert.equal(m.go({kind:'claimTurn',id:'call',turn:0}).busy,true);
  m.go({kind:'finishTurn',id:'call',turn:0,heard:'question',reply:'answer',xml:'<Response/>'});
  assert.equal(m.go({kind:'claimTurn',id:'call',turn:0}).cached,'<Response/>');
  assert.equal(m.state.calls[0].transcript.length,2);
});
