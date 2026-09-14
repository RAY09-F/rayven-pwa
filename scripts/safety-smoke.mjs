// Verify a specified deployed version; never print response contents or pairing values.
import {readFileSync} from 'node:fs';
const base='https://asgrard-backend.rayanfahil2.workers.dev';
const expected=process.argv[2];if(!expected)throw Error('Supply the expected Cloudflare version ID');
const pairing=readFileSync(new URL('../browser-pairing.js',import.meta.url),'utf8');
const token=JSON.parse(pairing.replace('globalThis.ASGARD_BROWSER_TOKEN = ','').trim().replace(/;$/,''));
let failures=0;
async function check(path,init,status,validate=async()=>true){
 try{const r=await fetch(base+path,{...init,signal:AbortSignal.timeout(20000)});
 if(r.status!==status||r.headers.get('X-Asgard-Version')!==expected||!(await validate(r)))throw Error(`status ${r.status} or content/version mismatch`);
 console.log(`PASS ${init?.method||'GET'} ${path}`);
 }catch(e){failures++;console.error(`FAIL ${init?.method||'GET'} ${path}: ${e.name}`)}
}
await check('/healthz?public=1',{},200);
await check('/',{},200,async r=>(await r.text()).includes('<html'));
await check('/browser/poll',{},401);
await check('/browser/result',{method:'POST'},401);
await check('/admin/scheduler',{},401);
await check('/browser/poll',{headers:{'X-Asgard-Browser':token}},200,async r=>{const j=await r.json();return Object.hasOwn(j,'command')});
for(const persona of ['thor','loki','odin'])await check('/',{method:'POST',headers:{'content-type':'application/json','X-Asgard-Smoke':'1'},body:JSON.stringify({persona,message:'Reply with the single word OK. Do not use tools.'})},200,async r=>{const j=await r.json();return typeof j.reply==='string'&&j.reply.trim().length>0&&!j.error});
process.exitCode=failures?1:0;
