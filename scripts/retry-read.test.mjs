import test from 'node:test';
import assert from 'node:assert/strict';
import {retryRead} from '../src/lib/retry-read.js';
import {httpFetch} from '../src/lib/http.js';
test('transient reads retry three times with bounded backoff',async()=>{
 let calls=0;const delays=[];
 const result=await retryRead(async()=>({status:++calls<3?503:200}),{sleep:async ms=>delays.push(ms)});
 assert.equal(result.status,200);assert.equal(calls,3);assert.deepEqual(delays,[1000,4000]);
});
test('writes, permanent errors and long Retry-After are never replayed',async()=>{
 for(const [method,status,retryAfterMs] of [['POST',503,0],['GET',401,0],['GET',429,60000]]){
 let calls=0;await retryRead(async()=>{calls++;return {status,retryAfterMs}},{method,sleep:()=>assert.fail('unexpected wait')});assert.equal(calls,1);
 }
});
test('shared HTTP helper preserves size limits and private redirect guard',async()=>{
 const original=globalThis.fetch;
 try {
 globalThis.fetch=async()=>new Response('oversize',{headers:{'content-length':'8'}});
 assert.equal((await httpFetch({},'https://example.com',{maxBytes:2})).ok,false);
 globalThis.fetch=async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/'}});
 assert.match((await httpFetch({},'https://example.com')).error,/redirect refused/);
 }finally{globalThis.fetch=original}
});
test('timeout covers stalled response body, not only headers',async()=>{
 const original=globalThis.fetch;
 try {
 globalThis.fetch=async(url,init)=>new Response(new ReadableStream({start(controller){
 init.signal.addEventListener('abort',()=>controller.error(new DOMException('aborted','AbortError')),{once:true});
 }}));
 const result=await httpFetch({},'https://example.com',{method:'POST',timeoutMs:15});
 assert.equal(result.ok,false);assert.match(result.error,/timed out/);
 }finally{globalThis.fetch=original}
});
