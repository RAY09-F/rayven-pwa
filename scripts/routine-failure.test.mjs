import test from 'node:test';import assert from 'node:assert/strict';
import {recordRoutineOutcome} from '../src/lib/routines.js';
test('one failure notice per failure episode, rearmed only by success',async()=>{
 const original=globalThis.fetch;let sent=0;const env={TELEGRAM_BOT_TOKEN:'fixture',RAYVEN_KV:{get:async()=> 'owner-fixture'}};
 globalThis.fetch=async()=>{sent++;return Response.json({ok:true})};
 try{const r={owner:'thor',id:'fixture',name:'Fixture'};for(let i=0;i<4;i++)await recordRoutineOutcome(env,r,{ok:false,error:'test'});assert.equal(sent,1);assert.equal(r.failures,4);await recordRoutineOutcome(env,r,{ok:true});await recordRoutineOutcome(env,r,{ok:false,error:'test'});assert.equal(sent,2)}finally{globalThis.fetch=original}
});
test('missing notification setup is recorded honestly and does not throw',async()=>{
 const r={owner:'loki',name:'test'};await recordRoutineOutcome({RAYVEN_KV:{get:async()=>null}},r,{ok:false,error:'test'});assert.equal(r.failureNoticeAttempted,true);assert.equal(r.failureNoticeDelivered,false);
});
test('daily model budget exhaustion is a skip, not a routine failure or owner alert',async()=>{
 const r={owner:'loki',name:'test',failures:1},run={ok:false,error:'SCHEDULED_MODEL_BUDGET_EXHAUSTED'};
 await recordRoutineOutcome({},r,run);assert.equal(run.skipped,'daily model cap');assert.equal(r.failures,1);assert.equal(r.failureNoticeAttempted,undefined);
});
