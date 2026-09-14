import test from 'node:test';import assert from 'node:assert/strict';
import {nextRoutineCheck,routineView,toggleRoutine} from '../src/lib/routine-view.js';
test('next check respects Pacific time, weekends, disabled daily stamps and interval clock',()=>{
 const now=Date.parse('2026-09-14T13:00:00Z');const s={kind:'schedule',at:'07:00',days:[1,2,3,4,5],tz:'America/Los_Angeles'};
 assert.equal(nextRoutineCheck(s,{},now),'2026-09-14T14:00:00.000Z');
 assert.equal(nextRoutineCheck(s,{lastRunDate:'2026-09-14'},now),'2026-09-15T14:00:00.000Z');
 assert.equal(nextRoutineCheck({...s,days:[0]},{},now),'2026-09-20T14:00:00.000Z');
 assert.equal(nextRoutineCheck({kind:'event',event:'test'},{},now),null);
 assert.equal(nextRoutineCheck({every:30},{lastRunAt:now},now),'2026-09-14T13:30:00.000Z');
});
test('Pacific winter offset and nonexistent spring clock time are handled',()=>{
 assert.equal(nextRoutineCheck({at:'07:00',tz:'America/Los_Angeles'},{},Date.parse('2026-12-01T12:00Z')),'2026-12-01T15:00:00.000Z');
 assert.equal(nextRoutineCheck({at:'02:30',tz:'America/Los_Angeles'},{},Date.parse('2026-03-08T08:00Z')),'2026-03-08T10:00:00.000Z');
});
test('registry view uses stored routines and toggles by exact ID',async()=>{
 const r={id:'loki-daily',name:'Daily',owner:'loki',trigger:{kind:'schedule',every:30},enabled:true,runs:[]};const data=new Map([['routines:index',JSON.stringify([r])],['routines:'+r.id,JSON.stringify(r)]]);const env={RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)}};
 assert.equal((await routineView(env))[0].name,'Daily');await toggleRoutine(env,r.id,false);assert.equal((await routineView(env))[0].nextCheck,null);await assert.rejects(toggleRoutine(env,'daily',true));
});
