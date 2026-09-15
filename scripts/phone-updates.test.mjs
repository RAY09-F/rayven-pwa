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
      const p=calls.at(-1).params;assert.equal(p.get('To'),'+15555550123');assert.equal(p.get('From'),'+15555550456');assert.equal(p.get('TimeLimit'),'600');assert.match(p.get('Twiml'),new RegExp(persona));assert.match(p.get('Twiml'),/<Hangup\/>/);assert.equal(p.get('Record'),null);
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

test('phone listening has no announcer and allows a natural pause',async()=>{
  const {listen}=await import('../src/lib/phone-updates.js');
  const xml=listen('call',1);assert.doesNotMatch(xml,/<Say|<Play/);assert.match(xml,/speechTimeout="1"/);assert.match(xml,/timeout="15"/);
});
test('phone tool execution runs a requested local task and rejects tools outside phone scope',async()=>{
  const {answerPhone,phoneTools}=await import('../src/lib/phone-agent.js');
  assert.ok(phoneTools('loki').some(t=>t.name==='add_todo'));
  assert.ok(!phoneTools('thor').some(t=>t.name==='set_tool_permission'));
  const old=globalThis.fetch,kv=new Map();let round=0;
  const env={ANTHROPIC_API_KEY:'test',RAYVEN_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)}};
  try{
    globalThis.fetch=async(url,init)=>{
      if(!String(url).includes('api.anthropic.com'))throw Error('Unexpected external tool request');
      const req=JSON.parse(init.body);
      if(round++===0)return Response.json({stop_reason:'tool_use',content:[{type:'tool_use',id:'t1',name:'add_todo',input:{text:'Call the dentist'}},{type:'tool_use',id:'t2',name:'set_tool_permission',input:{toolName:'browser_click',level:'auto'}}]});
      assert.match(JSON.stringify(req.messages),/blocked|outside your lane/i);
      return Response.json({stop_reason:'end_turn',content:[{type:'text',text:'I added your task.'}]});
    };
    assert.equal(await answerPhone(env,{persona:'loki',opening:'Update',transcript:[]},'Add a task to call the dentist'),'I added your task.');
    assert.ok([...kv.values()].some(v=>v.includes('Call the dentist')));
    assert.equal(kv.has('permissions'),false);
  }finally{globalThis.fetch=old;}
});

test('signed speech callbacks enqueue once and polling retrieves the same completed answer',async()=>{
  const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123'}});m.go({kind:'reserve',id:'call',test:true});m.go({kind:'result',id:'call',result:{sid:'CA_test',opening:'Hello',persona:'loki'}});
  const oldFetch=globalThis.fetch,oldNow=Date.now;Date.now=()=>now;
  let rounds=0;const kv=new Map(),jobs=[];
  const env={ANTHROPIC_API_KEY:'test',TWILIO_ACCOUNT_SID:'AC_test',TWILIO_AUTH_TOKEN:'secret',RAYVEN_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)},LEDGER:{idFromName:()=>0,get:()=>({fetch:async(u,init)=>Response.json({ok:true,result:m.go(JSON.parse(init.body).action)})})}};
  const send=async(poll=false)=>{
    const url='https://site/phone-api/turn?id=call&turn=0'+(poll?'&poll=1':''),form=new URLSearchParams({AccountSid:'AC_test',CallSid:'CA_test',...(poll?{}:{SpeechResult:'Add a task to call the dentist'})});
    let raw=url;for(const key of [...form.keys()].sort())raw+=key+form.get(key);
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('secret'),{name:'HMAC',hash:'SHA-1'},false,['sign']);
    const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))).toString('base64');
    return (await handlePhoneRequest(new Request(url,{method:'POST',headers:{'x-twilio-signature':sig},body:form}),env,{waitUntil:p=>jobs.push(p)})).text();
  };
  try{
    globalThis.fetch=async()=>Response.json(rounds++===0?{stop_reason:'tool_use',content:[{type:'tool_use',id:'task',name:'add_todo',input:{text:'Call the dentist'}}]}:{stop_reason:'end_turn',content:[{type:'text',text:'I added that task.'}]});
    assert.match(await send(),/I added that task|<Redirect/);await send();assert.equal(jobs.length,1);
    await Promise.all(jobs);const result=await send(true);assert.match(result,/I added that task/);assert.doesNotMatch(result,/You can reply/);
    assert.equal(await send(),result);assert.equal(rounds,2);assert.equal(JSON.parse(kv.get('todos')).length,1);
  }finally{globalThis.fetch=oldFetch;Date.now=oldNow;}
});

test('spoken handoffs recognize requests without switching on mentions or negations',async()=>{
 const {phoneHandoff}=await import('../src/lib/phone-agent.js');
 for(const [text,p] of [['switch to Odin','odin'],['let me talk to Loki','loki'],['can I speak to Thor','thor'],["use Loki's voice",'loki'],['get Odin on','odin'],['switch me over to Loki','loki']])assert.equal(phoneHandoff(text),p,text);
 for(const text of ["don't switch to Odin",'What did Loki do today?','Odin has a task','switch to Kevin'])assert.equal(phoneHandoff(text),null,text);
 const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123'}});m.go({kind:'reserve',id:'switch',test:true,persona:'thor'});m.go({kind:'claimTurn',id:'switch',turn:0});
 m.go({kind:'finishTurn',id:'switch',turn:0,persona:'loki',heard:'let me talk to Loki',reply:"It's Loki",xml:'<Response/>',timing:{modelMs:0,readyMs:900}});
 assert.equal(m.go({kind:'claimTurn',id:'switch',turn:1}).call.persona,'loki');
 assert.equal(m.state.calls[0].turns[0].timing.readyMs,900);
});

test('incoming owner calls work during quiet hours, reject other callers and do not consume outbound allowance',()=>{
 const m=machine(),quiet=Date.parse('2026-09-12T15:00:00Z');m.go({kind:'configure',config:{to:'+15555550123',enabled:false}});
 assert.equal(m.go({kind:'inbound',sid:'CA_in',from:'+15555550999'},quiet).denied,true);
 const a=m.go({kind:'inbound',sid:'CA_in',from:'+15555550123'},quiet);assert.equal(a.call.persona,'thor');assert.equal(a.call.direction,'inbound');assert.equal(m.state.count,0);
 assert.equal(m.go({kind:'inbound',sid:'CA_in',from:'+15555550123'},quiet).call.id,a.call.id);assert.equal(m.state.calls.length,1);
});
test('inbound webhook validates Twilio signature and caller before opening the conversation',async()=>{
 const m=machine();m.go({kind:'configure',config:{to:'+15555550123',enabled:false}});
 const env={TWILIO_ACCOUNT_SID:'AC_test',TWILIO_AUTH_TOKEN:'secret',LEDGER:{idFromName:()=>0,get:()=>({fetch:async(u,init)=>Response.json({ok:true,result:m.go(JSON.parse(init.body).action)})})}};
 const send=async(from,signed=true)=>{
  const url='https://site/phone-api/inbound',form=new URLSearchParams({AccountSid:'AC_test',CallSid:'CA'+'a'.repeat(32),From:from});let raw=url;for(const k of [...form.keys()].sort())raw+=k+form.get(k);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('secret'),{name:'HMAC',hash:'SHA-1'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))).toString('base64');
  return handlePhoneRequest(new Request(url,{method:'POST',body:form,headers:signed?{'x-twilio-signature':sig}:{}}),env);
 };
 assert.equal((await send('+15555550123',false)).status,403);
 assert.match(await (await send('+15555550999')).text(),/<Reject/);
 const xml=await (await send('+15555550123')).text();assert.match(xml,/Thor/);assert.match(xml,/<Gather/);assert.doesNotMatch(xml,/You can reply/);
 assert.equal(await (await send('+15555550123')).text(),xml);assert.equal(m.state.calls.length,1);
});

test('phone context identifies the browser extension and distinguishes stale alerts from fresh heartbeats',async()=>{
 const {phoneContext,answerPhone}=await import('../src/lib/phone-agent.js');
 const kv=new Map([['browser:lastpoll',String(now-1000)]]);
 const env={ANTHROPIC_API_KEY:'test',RAYVEN_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)}};
 assert.match(await phoneContext(env,now),/Recently connected/);
 kv.set('browser:lastpoll',String(now-700000));assert.match(await phoneContext(env,now),/appears offline/);
 kv.set('browser:lastpoll','bad');assert.match(await phoneContext(env,now),/unknown/);
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,init)=>{
   const req=JSON.parse(init.body),system=JSON.stringify(req.system);
   assert.match(system,/two-way conversation/);assert.match(system,/ASGARD Browser Control/);
   assert.match(JSON.stringify(req.messages),/Which extension/);
   assert.match(JSON.stringify(req.messages),/extension offline/);
   return Response.json({stop_reason:'end_turn',content:[{type:'text',text:'That is ASGARD Browser Control in Chrome. We can still talk while it is offline.'}]});
  };
  for(const persona of ['thor','loki','odin'])assert.match(await answerPhone(env,{persona,opening:'extension offline',transcript:[]},'Which extension is offline?'),/Browser Control/);
 }finally{globalThis.fetch=old;}
});

test('outbound owner calls permit follow-ups after eight turns and retain a bounded limit',()=>{
 const m=machine();m.go({kind:'configure',config:{enabled:true,to:'+15555550123'}});m.go({kind:'reserve',id:'long-call',test:true});
 for(let turn=0;turn<20;turn++){
  assert.ok(m.go({kind:'claimTurn',id:'long-call',turn}).call);
  m.go({kind:'finishTurn',id:'long-call',turn,heard:'Question',reply:'Answer',xml:'<Response/>'});
 }
 assert.equal(m.go({kind:'claimTurn',id:'long-call',turn:20}).denied,true);
});
