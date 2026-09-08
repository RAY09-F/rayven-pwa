import test from 'node:test';import assert from 'node:assert/strict';
import {writeStructuredFacts,searchStructuredFacts,getRecentMemoryBlock} from '../src/lib/memory.js';
function fixture(){const values=new Map(),writes=[];return {values,writes,MEMORY_FACTS_ENABLED:'true',RAYVEN_KV:{get:async key=>values.get(key)||null,put:async(key,value)=>{values.set(key,value);writes.push(key);},list:async({prefix})=>({keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}};}
test('changed property replaces prior value; no-op repeat writes nothing; old KV untouched',async()=>{
 const env=fixture();env.values.set('memory:longterm','legacy fixture');
 await writeStructuredFacts(env,'thor',[{subject:'rayan',property:'drink',value:'tea'}],'2026-09-01T00:00:00Z');
 const before=JSON.parse(env.values.get('memory:fact:thor:rayan'));
 await writeStructuredFacts(env,'thor',[{subject:'rayan',property:'drink',value:'coffee'}],'2026-09-02T00:00:00Z');
 const after=JSON.parse(env.values.get('memory:fact:thor:rayan'));
 assert.equal(before.facts.drink.value,'tea');assert.deepEqual(after.facts.drink,{value:'coffee',changed_at:'2026-09-02T00:00:00Z'});assert.equal(Object.keys(after.facts).length,1);
 const n=env.writes.length;await writeStructuredFacts(env,'thor',[{subject:'rayan',property:'drink',value:'coffee'}]);assert.equal(env.writes.length,n);
 assert.equal(env.values.get('memory:longterm'),'legacy fixture');
 assert.equal((await searchStructuredFacts(env,'thor','coffee'))[0].facts.drink.value,'coffee');
});
test('older extraction cannot overwrite a newer stored change; unsafe fields refused',async()=>{
 const env=fixture();await writeStructuredFacts(env,'thor',[{subject:'rayan',property:'drink',value:'coffee'}],'2026-09-02');
 await writeStructuredFacts(env,'thor',[{subject:'rayan',property:'drink',value:'tea'},{subject:'rayan',property:'__proto__',value:'bad'}],'2026-09-01');
 assert.equal((await searchStructuredFacts(env,'thor','coffee')).length,1);assert.ok(!env.values.get('memory:fact:thor:rayan').includes('__proto__'));
});
test('profile has conservative sub-500-token byte bound and stable ordering',async()=>{
 const env=fixture();await writeStructuredFacts(env,'thor',Array.from({length:10},(_,i)=>({subject:'rayan',property:'field'+i,value:'a'.repeat(200)})));
 const profile=await getRecentMemoryBlock(env,'thor');assert.ok(new TextEncoder().encode(profile).length<=450);assert.equal(profile,await getRecentMemoryBlock(env,'thor'));
});
