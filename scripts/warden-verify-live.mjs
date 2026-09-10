import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.argv[2]||'https://asgrard-backend.rayanfahil2.workers.dev';
const version=process.env.ASGARD_QA_VERSION;
const headers=version?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${version}"`}:{};
const expected=JSON.parse(await readFile('public/ui/release.json','utf8'));
async function get(path){const u=new URL(path,base);u.searchParams.set('verify',Date.now());const response=await fetch(u,{headers,signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,path);return {bytes:Buffer.from(await response.arrayBuffer()),type:response.headers.get('content-type')||''};}
const manifest=await get('/ui/release.json');assert.ok(manifest.type.includes('json'));assert.equal(JSON.parse(manifest.bytes).fingerprint,expected.fingerprint);
const jobs=Object.entries(expected.assets),checks=[];
await Promise.all(Array.from({length:6},async()=>{while(jobs.length){const [path,hash]=jobs.shift();const url=path.endsWith('/index.html')?path.slice(0,-10):path;const data=await get(url);assert.equal(createHash('sha256').update(data.bytes).digest('hex'),hash,url);const mime=path.endsWith('.js')?'javascript':path.endsWith('.css')?'css':path.endsWith('.json')?'json':path.endsWith('.html')?'html':null;if(mime)assert.ok(data.type.includes(mime),url);checks.push({path:url,bytes:data.bytes.length,type:data.type});}}));
const result={at:new Date().toISOString(),base,version:version||'unrestricted production traffic',release:expected.id,assetCount:checks.length,checks};
await mkdir('output/warden',{recursive:true});await writeFile(`output/warden/assets-${new URL(base).hostname}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,checks:undefined}));
