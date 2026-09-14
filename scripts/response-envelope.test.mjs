import test from 'node:test';import assert from 'node:assert/strict';
import {withReleaseHeaders,errorCategory} from '../src/lib/response-envelope.js';
test('release identity covers streams, redirects, errors and immutable response headers',async()=>{
 for(const result of [new Response('stream body'),Response.redirect('https://example.com',301),Response.json({error:'test'},{status:401})]) {
 const original=result.clone();const handler=withReleaseHeaders({fetch:async()=>result});
 const r=await handler.fetch(new Request('https://example.com'),{ASGARD_VERSION:{id:'release-fixture'}},{});
 assert.equal(r.status,original.status);assert.equal(r.headers.get('X-Asgard-Version'),'release-fixture');assert.equal(await r.text(),await original.text());
 }
});
test('unhandled failures return an honest response without leaking secrets',async()=>{
 const saved=console.error;const logs=[];console.error=s=>logs.push(s);
 try {const r=await withReleaseHeaders({fetch:async()=>{throw Error('api_key=private-fixture')}}).fetch(new Request('https://example.com'),{},{});
 assert.equal(r.status,503);assert.equal((await r.json()).category,'logic');assert.ok(!logs.join('').includes('private-fixture'));
 }finally{console.error=saved}
});
test('error categories distinguish auth, quotas, user inputs and network faults',()=>{
 assert.equal(errorCategory(null,401),'auth');assert.equal(errorCategory(null,429),'quota');assert.equal(errorCategory(null,422),'user');assert.equal(errorCategory(new DOMException('timeout','TimeoutError')),'network');
});
