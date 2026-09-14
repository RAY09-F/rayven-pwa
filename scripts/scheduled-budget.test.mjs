import test from 'node:test';import assert from 'node:assert/strict';
import {reserveBudget,scheduledEnvironment,scheduledModelFetch} from '../src/lib/scheduled-budget.js';
test('thirty reservations maximum, batch counts included, daily reset, invalid reservations rejected',()=>{
 const now=Date.parse('2026-09-14T12:00Z');let state;
 for(let i=0;i<10;i++){const r=reserveBudget(state,3,now);assert.equal(r.result.allowed,true);state=r.state}
 assert.equal(reserveBudget(state,1,now).result.allowed,false);assert.equal(reserveBudget(state,1,now+86400000).result.used,1);
 for(const n of [0,-1,1.1,31,NaN])assert.equal(reserveBudget(state,n,now).result.allowed,false);
});
test('concurrent scheduled provider requests share one atomic budget and chat stays independent',async()=>{
 let state,network=0;const now=Date.parse('2026-09-14T12:00Z');const original=globalThis.fetch;
 const env={LEDGER:{idFromName:()=>1,get:()=>({fetch:async(url,init)=>{const b=JSON.parse(init.body);const n=reserveBudget(state,b.count,now);state=n.state;return Response.json({ok:true,result:n.result})}})}};
 globalThis.fetch=async()=>{network++;return Response.json({ok:true})};
 try{const wrapped=scheduledEnvironment(env);const r=await Promise.allSettled(Array.from({length:40},()=>scheduledModelFetch(wrapped,'https://model.test',{})));assert.equal(r.filter(x=>x.status==='fulfilled').length,30);assert.equal(network,30);await scheduledModelFetch(env,'https://model.test',{});assert.equal(network,31)}finally{globalThis.fetch=original}
});
test('missing budget storage blocks scheduled models before network access',async()=>{
 await assert.rejects(scheduledModelFetch(scheduledEnvironment({}),'https://model.test',{}),/LEDGER/);
});
