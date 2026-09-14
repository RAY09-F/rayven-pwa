// Run after wrangler deploy --dry-run --outdir output/everything-dry-run.
// Executes the built Worker router and real SQLite ledger with a minimal DO host shim.
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
try{
 let source=readFileSync(new URL('../output/everything-dry-run/index.js',import.meta.url),'utf8');
 source=source.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}');
 source=source.replace('import { DurableObject as DurableObject2 } from "cloudflare:workers";','const DurableObject2=DurableObject;');
 const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let writes=0;const data=new Map(),pending=[];
 const token='fixture-pairing-'.repeat(4);
 const env={BROWSER_CONTROL_TOKEN:token,ADMIN_TOKEN:'operator-fixture',RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>{writes++;data.set(k,v)}}};
 const ctx={waitUntil:p=>pending.push(p)};
 for(const [path,method] of [['/browser/poll','GET'],['/browser/result','POST'],['/admin/scheduler','GET']]){
  const response=await module.default.fetch(new Request('https://asgard.test'+path,{method}),env,ctx);assert.equal(response.status,401,path);
 }
 assert.equal(writes,0,'unauthenticated requests must not touch storage');
 const response=await module.default.fetch(new Request('https://asgard.test/browser/poll',{headers:{'X-Asgard-Browser':token}}),env,ctx);
 assert.equal(response.status,200);assert.equal((await response.json()).command,null);await Promise.all(pending);
 const db=new DatabaseSync(':memory:');
 const sql={exec:(query,...args)=>{const rows=db.prepare(query).all(...args);return {toArray:()=>rows}},databaseSize:0};
 const ledger=new module.AsgardLedger({storage:{sql}},{});ledger.init();
 const results=await Promise.all(Array.from({length:40},()=>ledger.op({op:'reserveScheduledModels',count:1})));
 assert.equal(results.filter(r=>r.allowed).length,30);
 assert.equal(JSON.parse(db.prepare('SELECT value FROM kv WHERE key=?').get('budget:scheduled-models').value).used,30);
 const claims=await Promise.all(Array.from({length:40},()=>ledger.op({op:'claimTelegramUpdate',persona:'thor',updateId:123})));
 assert.equal(claims.filter(r=>r.claimed).length,1,'concurrent Telegram copies claim once');
 assert.equal((await ledger.op({op:'claimTelegramUpdate',persona:'loki',updateId:123})).claimed,true);
 db.prepare('UPDATE telegram_updates SET expires_at=0').run();
 assert.equal((await ledger.op({op:'claimTelegramUpdate',persona:'thor',updateId:123})).claimed,true);
 await assert.rejects(ledger.op({op:'claimTelegramUpdate',persona:'thor',updateId:-1}));
 db.close();console.log('PASS built Worker transport/admin auth, SQLite model budget, and concurrent Telegram deduplication');
}catch(error){console.error('FAIL runtime check:',error.message);process.exitCode=1}
