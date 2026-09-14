import test from 'node:test';
import assert from 'node:assert/strict';
import {routinePause,routineResume,routineDelete,runRoutine,routineRunNow} from '../src/lib/routines.js';
const fixture=()=>{
 const index=['thor','loki','odin','hela'].map(owner=>({id:owner+'-daily',name:'Daily',owner,enabled:true}));
 const data=new Map([['routines:index',JSON.stringify(index)],...index.map(r=>['routines:'+r.id,JSON.stringify({...r,steps:[{say:'NOTHING'}],deliver:'telegram',runs:[]})])]);
 return {data,env:{RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)}}};
};
for(const action of [routinePause,routineResume,routineDelete])test(`${action.name||'routine toggle'} preserves every other persona in the index`,async()=>{
 const {data,env}=fixture();const before=JSON.parse(data.get('routines:index'));
 await action(env,'loki','loki-daily');const after=JSON.parse(data.get('routines:index'));
 assert.equal(after.length,4);assert.deepEqual(after.filter(r=>r.owner!=='loki'),before.filter(r=>r.owner!=='loki'));
 assert.deepEqual(JSON.parse(data.get('routines:odin-daily')),{...before[2],steps:[{say:'NOTHING'}],deliver:'telegram',runs:[]});
});
test('routine lookup cannot modify another persona by exact ID',async()=>{
 const {data,env}=fixture();const original=data.get('routines:index');await routinePause(env,'thor','loki-daily');assert.equal(data.get('routines:index'),original);
});
test('NOTHING suppresses delivery without dropping the successful run result',async()=>{
 const {env}=fixture();const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No network allowed')};
 try{const result=await runRoutine(env,{owner:'loki',name:'empty',steps:[{say:'NOTHING'}],deliver:'telegram'},null,async()=>{});assert.equal(result.ok,true);assert.equal(result.delivered,'nothing to deliver');assert.equal(result.steps.length,1)}finally{globalThis.fetch=old}
});
test('stored routine run history stays capped after repeated executions',async()=>{
 const {env,data}=fixture();for(let i=0;i<35;i++)await routineRunNow(env,'loki','loki-daily',async()=>{});
 const runs=JSON.parse(data.get('routines:loki-daily')).runs;assert.equal(runs.length,20);assert.ok(runs.every(run=>run.ok&&run.delivered==='nothing to deliver'));
});
