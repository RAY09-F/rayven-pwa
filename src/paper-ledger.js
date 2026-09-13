import {DurableObject} from 'cloudflare:workers';
import {runPaperTradingCycleIfDue,forceDemoTrade} from './lib/paperTrading.js';
// One serialized owner. A cycle stages all paper writes; SQL commits them
// together, so fills, cash, positions and last-candle markers cannot diverge.
export class PaperLedger extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.tail=Promise.resolve();}
  fetch(req){const run=this.tail.catch(()=>{}).then(()=>this.run(req));this.tail=run;return run;}
  async init(){
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS paper_state (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS paper_events (id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL)');
    const exists=[...this.ctx.storage.sql.exec("SELECT value FROM paper_state WHERE key='paper:migration'")];if(exists.length)return;
    const entries=[];let cursor;
    do{const page=await this.env.RAYVEN_KV.list({prefix:'paper:',cursor,limit:1000});
      for(let i=0;i<page.keys.length;i+=10){entries.push(...await Promise.all(page.keys.slice(i,i+10).map(async k=>[k.name,await this.env.RAYVEN_KV.get(k.name)])));}
      cursor=page.list_complete?null:page.cursor;
    }while(cursor);
    this.ctx.storage.transactionSync(()=>{for(const [k,v]of entries)if(v!==null)this.ctx.storage.sql.exec('INSERT OR IGNORE INTO paper_state VALUES (?,?)',k,v);this.ctx.storage.sql.exec('INSERT INTO paper_state VALUES (?,?)','paper:migration',JSON.stringify({at:Date.now(),source:'KV copy; original retained',keys:entries.length}));});
  }
  async run(req){try{
    await this.init();const b=await req.json();
    const state=new Map([...this.ctx.storage.sql.exec('SELECT key,value FROM paper_state')].map(r=>[r.key,r.value]));
    if(b.op==='get')return Response.json({value:state.get(b.key)||null});
    const pending=new Map();
    const kv={get:async(k,...args)=>k.startsWith('paper:')?(pending.has(k)?pending.get(k):state.get(k))??null:this.env.RAYVEN_KV.get(k,...args),
      put:async(k,v,...args)=>k.startsWith('paper:')?pending.set(k,v):this.env.RAYVEN_KV.put(k,v,...args),
      delete:async k=>pending.set(k,null)};
    let result;
    if(b.op==='put'){pending.set(b.key,b.value);result={ok:true};}
    else if(b.op==='delete'){pending.set(b.key,null);result={ok:true};}
    else if(b.op==='cycle'||b.op==='demo'){
      const env={...this.env,RAYVEN_KV:kv,_paperTransaction:true,_paperWrapped:true};
      result=b.op==='cycle'?await runPaperTradingCycleIfDue(env):await forceDemoTrade(env,b.agentId,b.action);
      if(result.saveError)throw Error(result.saveError);
    }else throw Error('Unknown operation');
    this.ctx.storage.transactionSync(()=>{for(const [k,v]of pending){if(v===null)this.ctx.storage.sql.exec('DELETE FROM paper_state WHERE key=?',k);else this.ctx.storage.sql.exec('INSERT OR REPLACE INTO paper_state VALUES (?,?)',k,String(v));
      if(k==='paper:trades'||k==='paper:decisions')for(const row of JSON.parse(v||'[]'))this.ctx.storage.sql.exec('INSERT OR IGNORE INTO paper_events VALUES (?,?,?)',row.id||[row.at,row.agentId,row.action||row.skipped||row.error].join(':'),k,JSON.stringify(row));
    }});
    return Response.json(result);
  }catch(e){return Response.json({error:e.message},{status:500});}}
}
