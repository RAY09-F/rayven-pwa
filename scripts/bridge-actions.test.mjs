import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeAction,bridgeReview} from '../src/lib/bridge-actions.js';
import {approvalClaim} from '../src/lib/approval-claims.js';
import {approvalRevision,resolveApproval} from '../src/lib/approvals.js';
const definitions=[{name:'add_todo',input_schema:{type:'object',properties:{text:{type:'string'},token:{type:'string'}},required:['text']}}];
function fixture(tool='add_todo') {
 const record={id:'1234',persona:'thor',tool,input:{text:'First proposal'},description:'First proposal',status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()};
 const values=new Map([['approvals',JSON.stringify([record])]]),receipts=new Map();let queue=Promise.resolve();
 const env={RAYVEN_KV:{get:async key=>values.get(key)??null,put:async(key,value)=>values.set(key,value)}};
 env.LEDGER={idFromName:()=>1,get:()=>({fetch:async(_,init)=>{const body=JSON.parse(init.body);assert.equal(body.op,'approvalClaim');const result=queue.then(()=>approvalClaim({get:async key=>receipts.get(key),put:async(key,value)=>receipts.set(key,value)},body.action,body));queue=result.catch(()=>{});return Response.json({ok:true,result:await result});}})};
 return {env,record,values,receipts};
}
const request=async(record,decision='approve')=>({id:record.id,persona:record.persona,revision:await approvalRevision(record),decision});

test('duplicate approvals across overlapping requests execute exactly once through the claim',async()=>{
 const {env,record}=fixture();let executeCount=0,release,started;const began=new Promise(r=>started=r),blocked=new Promise(r=>release=r);
 const body=await request(record);const execute=async()=>{executeCount++;started();await blocked;return 'Saved';};
 const first=bridgeAction(env,body,definitions,execute);await began;
 const second=await bridgeAction(env,body,definitions,execute);assert.equal(second.ok,false);
 release();assert.equal((await first).ok,true);assert.equal(executeCount,1);
});

test('even an eventually stale pending KV record cannot replay the same action',async()=>{
 const {env,record,values}=fixture();const body=await request(record);let n=0;const execute=async()=>{n++;return 'Saved';};
 assert.equal((await bridgeAction(env,body,definitions,execute)).ok,true);
 values.set('approvals',JSON.stringify([record]));
 assert.equal((await bridgeAction(env,body,definitions,execute)).ok,false);assert.equal(n,1);
});

test('edit saves actual fields but never executes; old approval revision is rejected',async()=>{
 const {env,record,values}=fixture();const old=await request(record);let n=0;
 const result=await bridgeAction(env,{...old,decision:'edit',values:{text:'Changed proposal'}},definitions,async()=>n++);
 assert.equal(result.ok,true);assert.equal(n,0);
 const updated=JSON.parse(values.get('approvals'))[0];assert.equal(updated.input.text,'Changed proposal');assert.equal(updated.status,'pending');
 assert.equal((await bridgeAction(env,old,definitions,async()=>n++)).ok,false);
 assert.equal((await bridgeAction(env,await request(updated),definitions,async()=>{n++;return 'Saved';})).ok,true);assert.equal(n,1);
});

test('an edited receipt refuses a stale pre-edit proposal even if KV returns it',async()=>{
 const {env,record,values}=fixture();const body=await request(record);
 assert.equal((await bridgeAction(env,{...body,decision:'edit',values:{text:'New'}},definitions,()=>assert.fail())).ok,true);
 values.set('approvals',JSON.stringify([record]));
 assert.equal((await bridgeAction(env,body,definitions,()=>assert.fail('Stale proposal must not run'))).ok,false);
});

test('cross-hall, expired, malformed and secret-field edits cannot change a proposal',async()=>{
 const {env,record,values}=fixture(),body=await request(record),before=values.get('approvals');
 for(const bad of [{...body,persona:'loki'},{...body,decision:'anything'},{...body,revision:'bad'},
  {...body,decision:'edit',values:{token:'must not set'}},{...body,decision:'edit',values:{text:123}}])
  assert.equal((await bridgeAction(env,bad,definitions,()=>assert.fail())).ok,false);
 assert.equal(values.get('approvals'),before);
 const review=await bridgeReview(env,{id:'1234',persona:'thor'},definitions);assert.equal(review.ok,true);assert.deepEqual(review.fields.map(f=>f.key),['text']);
});

test('off permissions remain off, even with an old pending approval',async()=>{
 const {env,record,values}=fixture('send_text');values.set('permissions',JSON.stringify({send_text:'off'}));
 const result=await bridgeAction(env,await request(record),definitions,()=>assert.fail('Off tool ran'));
 assert.equal(result.ok,false);assert.match(result.message,/turned off/);
});

test('real text/call approval only stages the existing live confirmation',async()=>{
 const {env,record,values}=fixture('send_text');
 const result=await bridgeAction(env,await request(record),definitions,()=>assert.fail('Must not send'));
 assert.equal(result.ok,true);assert.equal(result.staged,true);assert.ok(values.has('pending:thor'));
});

test('interrupted execution is unknown and cannot automatically retry',async()=>{
 const {env,record,values}=fixture(),body=await request(record);let calls=0;
 const result=await bridgeAction(env,body,definitions,async()=>{calls++;throw Error('Connection lost after request');});
 assert.equal(result.ok,false);assert.match(result.message,/outcome is unknown/);
 values.set('approvals',JSON.stringify([record]));
 assert.equal((await bridgeAction(env,body,definitions,()=>calls++)).ok,false);assert.equal(calls,1);
});

test('legacy approval route shares the same receipt gate',async()=>{
 const {env,record,values}=fixture();let n=0;
 await bridgeAction(env,await request(record),definitions,async()=>{n++;return 'Saved';});values.set('approvals',JSON.stringify([record]));
 assert.equal((await resolveApproval(env,'1234','approve',()=>n++)).ok,false);assert.equal(n,1);
});

test('missing coordinator refuses Bridge actions instead of weakening the gate',async()=>{
 const {env,record}=fixture();delete env.LEDGER;
 const result=await bridgeAction(env,await request(record),definitions,()=>assert.fail());
 assert.equal(result.ok,false);assert.match(result.message,/coordination is unavailable/);
});

test('invalid or expired approval timestamps cannot execute',async()=>{
 for(const expiresAt of ['not a date',new Date(Date.now()-1000).toISOString()]){
  const {env,record,values}=fixture();record.expiresAt=expiresAt;values.set('approvals',JSON.stringify([record]));
  assert.equal((await bridgeAction(env,await request(record),definitions,()=>assert.fail('Expired proposal ran'))).ok,false);
 }
});
