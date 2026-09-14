import test from 'node:test';
import assert from 'node:assert/strict';
import {JOB_IDS,dispatchJobs,setSchedulerEnabled,schedulerConfig} from '../src/lib/scheduler.js';
const fixture=()=>{const data=new Map();return {RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)}}};
test('disabled jobs never execute, rejected jobs cannot block remaining jobs',async()=>{
 const env=fixture();await setSchedulerEnabled(env,JOB_IDS[0],false);const calls=[],errors=[];
 const jobs=JOB_IDS.map((id,i)=>({id,run:async()=>{calls.push(id);if(i===1)throw Error('failure');return {checked:true}}}));
 const result=await dispatchJobs(env,jobs,{onError:async id=>errors.push(id)});
 assert.equal(calls.length,JOB_IDS.length-1);assert.equal(result[0].status,'disabled');assert.equal(result[1].status,'failed');assert.equal(result[2].status,'checked');assert.deepEqual(errors,[JOB_IDS[1]]);
});
test('config validates names and boolean values and supports reenable',async()=>{
 const env=fixture();await assert.rejects(setSchedulerEnabled(env,'invented',true));await assert.rejects(setSchedulerEnabled(env,JOB_IDS[0],'yes'));
 await setSchedulerEnabled(env,JOB_IDS[0],false);await setSchedulerEnabled(env,JOB_IDS[0],true);assert.deepEqual((await schedulerConfig(env)).disabled,[]);
});
test('invalid registry fails before executing any job',async()=>{
 let calls=0;await assert.rejects(dispatchJobs(fixture(),[{id:JOB_IDS[0],run:async()=>calls++}]));assert.equal(calls,0);
});
