import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {createCompanion,SITE,applySignal} from './rgb-companion.mjs';
test('rainbow lasts two seconds, keeps exact selected palette and ignores duplicate events',()=>{
 let now=10000;const fills=[],ctx={clearRect(){},drawImage(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills.push(this.fillStyle);}};
 const s={Date:{now:()=>now},document:{getElementById:()=>({getContext:()=>ctx}),createElement:()=>({getContext:()=>ctx})},requestAnimationFrame(){}};
 vm.createContext(s);vm.runInContext(readFileSync(new URL('./effects/ASGARD Flow.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],s);
 s.onCanvasApiEvent({sender:'asgard-rgb',event:'loki'});assert.equal(s.spinProgress(now),0);
 now+=1000;s.paint();assert.equal(new Set(fills.filter(x=>x.startsWith('hsl('))).size,12);
 const started=s.started;s.onCanvasApiEvent({sender:'asgard-rgb',event:'loki'});assert.equal(s.started,started);
 s.onCanvasApiEvent({sender:'other',event:'odin'});assert.equal(s.mode,'loki');
 s.onCanvasApiEvent({sender:'asgard-rgb',event:'thor'});assert.equal(s.started,now);
 now+=1999;assert.ok(s.spinProgress(now)<1);now++;assert.equal(s.spinProgress(now),1);
 fills.length=0;s.paint();assert.ok(!fills.some(x=>x.startsWith('hsl(')));
 assert.deepEqual(Array.from(s.target),Array.from(s.palettes.thor));assert.equal(ctx.globalAlpha,1);
 assert.equal(s.lockFrame(0).brightness,1);assert.equal(s.lockFrame(900).brightness,0.25);assert.equal(s.lockFrame(1800).stage,'black');
 for(let i=0;i<3;i++){assert.equal(s.lockFrame(2050+i*650).on,true);assert.equal(s.lockFrame(2050+i*650+180).on,false);}
 assert.equal(s.lockFrame(4000).stage,'hold');assert.equal(s.lockFrame(4000).glitch,false);assert.equal(s.lockFrame(7200).glitch,true);assert.equal(s.lockFrame(7310).glitch,false);
});test('slow desktop update does not hold up later lighting requests',async()=>{
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
