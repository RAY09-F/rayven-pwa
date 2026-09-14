import test from 'node:test';
import assert from 'node:assert/strict';
import {runTick,tickLog} from '../src/lib/tick.js';
function fixture(initial={}) {
 const data=new Map(Object.entries(initial)), writes=[];
 return {data,writes,env:{RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>{writes.push(k);data.set(k,v)}}}};
}
test('empty cron bookkeeping makes no writes',async()=>{
 const f=fixture();const result=await runTick(f.env);
 assert.equal(result.skipped,'empty tick');assert.deepEqual(f.writes,[]);
});
test('all buffered lines form one tick body, plus the existing pointer, then clear',async()=>{
 const f=fixture();for(let i=0;i<240;i++)tickLog('notes',{i});
 const result=await runTick(f.env);
 assert.equal(f.writes.filter(k=>k!=='tick:last').length,1);
 const body=JSON.parse(f.data.get(result.key));assert.equal(body.notes.length,200);assert.equal(body.notes[0].i,40);
 assert.equal(JSON.parse(f.data.get('tick:last')).writesToday,2);
 f.writes.length=0;assert.equal((await runTick(f.env)).skipped,'empty tick');assert.equal(f.writes.length,0);
});
test('failed hook does not prevent remaining hook and buffered audit persistence',async()=>{
 const f=fixture();let ran=false;
 const result=await runTick(f.env,{every:async()=>{ran=true;tickLog('notes',{event:'ran'});throw new Error('fixture failure')}});
 assert.equal(ran,true);assert.ok(result.key);assert.ok(f.data.has('tick:last'));
});
test('ledger outage fallback keeps the recent-pointer bound',async()=>{
 const f=fixture({'tick:last':JSON.stringify({day:new Date().toISOString().slice(0,10),recent:Array.from({length:60},(_,i)=>`old:${i}`)})});
 f.env.LEDGER_BACKEND='do';f.env.LEDGER={idFromName:()=>1,get:()=>({fetch:async()=>{throw new Error('fixture outage')}})};
 tickLog('notes',{event:'fallback'});await runTick(f.env);
 assert.equal(JSON.parse(f.data.get('tick:last')).recent.length,60);
});
