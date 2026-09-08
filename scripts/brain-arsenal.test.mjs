import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG} from '../src/tools/catalog.js';
import {publicHostCheck,httpFetch} from '../src/lib/http.js';
const families=['web','docs','money','world','dev','knowledge','media','browser'];
const added=(await Promise.all(families.map(f=>import(`../src/tools/catalog-brain-${f}.js`)))).flatMap(m=>m.TOOLS);
const env={DOC_CONVERSION_ENABLED:'true',BROWSER_CLOUD_ENABLED:'true',BROWSER_RUN_TOKEN:'fixture',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),SEC_USER_AGENT:'Asgard team@example.com',FRED_API_KEY:'fixture',TMDB_READ_TOKEN:'fixture',ASSEMBLYAI_API_KEY:'fixture',ASSEMBLYAI_ENABLED:'true',FIRECRAWL_API_KEY:'fixture',FIRECRAWL_ENABLED:'true',EXA_API_KEY:'fixture',EXA_ENABLED:'true',OCR_SPACE_API_KEY:'fixture',OCR_SPACE_ENABLED:'true',RAYVEN_KV:{get:async()=>null}};
for(const tool of added){
 test(`${tool.name} has deferred example and reports a provider failure`,async()=>{
  assert.equal(tool.defer_loading,true);assert.ok(tool.input_examples.length);
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"fixture failure"}',{status:503});
  try{const result=await tool.run(env,tool.input_examples[0]);if(tool.name==='dev_self_check'){assert.equal(result.ok,false);assert.equal(result.releaseMatches,null);}else assert.match(result,/failed|unexpected/);}finally{globalThis.fetch=original;}
 });
}
test('gated providers and push refuse all network requests by default',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Must not call network');};
 try{for(const tool of added.filter(t=>/firecrawl|exa_|ocr|transcribe|to_markdown/.test(t.name)))assert.match(await tool.run({},tool.input_examples[0]),/not configured|disabled/);
 for(const name of ['ntfy_push','comms_push']){assert.match(await CATALOG[name].run({NTFY_TOPIC:'x'.repeat(40)},{message:'fixture'}),/disabled/);assert.match(await CATALOG[name].run({COMMS_PUSH_ENABLED:'true',NTFY_TOPIC:'short'},{message:'fixture'}),/32/);}}
 finally{globalThis.fetch=original;}
});
test('URL guards and redirects protect credentials',async()=>{
 for(const url of ['http://example.com','https://user:pass@example.com','https://[::ffff:127.0.0.1]','https://127.1','https://asgrard-backend.rayanfahil2.workers.dev'])assert.equal(publicHostCheck(url).ok,false,url);
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,opts)=>{calls++;if(calls===1)return new Response(null,{status:302,headers:{location:'https://different.example/result'}});assert.equal(opts.headers.Authorization,undefined);return new Response('{"ok":true}');};
 try{assert.equal((await httpFetch({},'https://example.com',{headers:{Authorization:'fixture-only'}})).ok,true);}finally{globalThis.fetch=original;}
});
test('successful market result keeps dates and does not leak key or contact',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:[{record_date:'2026-09-01',tot_pub_debt_out_amt:'123'}]});
 try{const result=await CATALOG.money_treasury.run({},{});assert.match(result,/2026-09-01/);assert.match(result,/123/);}finally{globalThis.fetch=original;}
});
