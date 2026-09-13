import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {createCompanion,SITE,applySignal} from './rgb-companion.mjs';
test('flow starts from current colors, eases to exact targets, and retargets without jumps',()=>{
 let now=10000;const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
 const s={Date:{now:()=>now},document:{getElementById:()=>({getContext:()=>ctx})},requestAnimationFrame(){}};
 vm.createContext(s);vm.runInContext(readFileSync(new URL('./effects/ASGARD Flow.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],s);
 const before=Array.from(s.sample(now));s.onCanvasApiEvent({sender:'asgard-rgb',event:'loki'});assert.deepEqual(Array.from(s.sample(now)),before);
 now+=100;assert.notDeepEqual(Array.from(s.sample(now)),before);
 const mid=Array.from(s.sample(now));s.onCanvasApiEvent({sender:'asgard-rgb',event:'thor'});assert.deepEqual(Array.from(s.sample(now)),mid);
 now+=1200;assert.deepEqual(Array.from(s.sample(now)),Array.from(s.palettes.thor));
 const started=s.started;s.onCanvasApiEvent({sender:'asgard-rgb',event:'thor'});assert.equal(s.started,started);
 s.onCanvasApiEvent({sender:'other',event:'odin'});assert.equal(s.mode,'thor');
});
test('slow desktop update does not hold up later lighting requests',async()=>{
 let release;const pending=new Promise(r=>release=r),calls=[];
 const server=createCompanion({token:'a'.repeat(64),apply:async mode=>calls.push(mode),desktop:()=>pending});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const persona of ['thor','loki']){const r=await fetch('http://127.0.0.1:'+server.address().port+'/state',{method:'POST',headers:{Origin:SITE,'X-ASGARD-Key':'a'.repeat(64),'Content-Type':'application/json'},body:JSON.stringify({persona,locked:false}),signal:AbortSignal.timeout(1500)});assert.equal(r.status,200);}assert.deepEqual(calls,['thor','loki']);}
 finally{release();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('active Flow uses an event without changing brightness or reloading the effect',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,opts)=>{calls.push([url,opts?.method||'GET']);return new Response(JSON.stringify({data:{id:'ASGARD Flow.html',attributes:{enabled:true,global_brightness:0}},status:'ok'}));};await applySignal('loki');assert.equal(calls.length,2);assert.match(calls[1][0],/canvas\/event\?sender=asgard-rgb&event=loki$/);assert.equal(calls[1][1],'POST');}
 finally{globalThis.fetch=previous;}
});
