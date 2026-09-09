// Verify actual bytes and MIME on the existing public host; a fallback 200 is a failure.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),base=(process.argv[2]||'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/,'');
const expected=JSON.parse(await readFile('public/ui/release.json','utf8'));
async function get(path){const {stdout}=await exec('curl',['--fail','--silent','--show-error','--max-time','30','--write-out','\n%{content_type}',base+path],{encoding:'buffer',maxBuffer:4*1024*1024});const split=stdout.lastIndexOf(10);return {bytes:stdout.subarray(0,split),type:stdout.subarray(split+1).toString()};}
const manifest=await get('/ui/release.json');
if(!manifest.type.includes('json'))throw Error('Release metadata MIME is not JSON');
const live=JSON.parse(manifest.bytes);
if(live.fingerprint!==expected.fingerprint)throw Error(`Wrong release: ${live.id}`);
const checks=[];
for(const [path,hash] of Object.entries(expected.assets)){
 const url=path.endsWith('/index.html')?path.slice(0,-10):path,{bytes,type}=await get(url);
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(digest!==hash)throw Error(`Wrong asset bytes: ${url}`);
 const mime=path.endsWith('.js')?'javascript':path.endsWith('.css')?'css':path.endsWith('.json')?'json':path.endsWith('.html')?'html':null;
 if(mime&&!type.includes(mime))throw Error(`Wrong MIME ${url}: ${type}`);
 checks.push({path:url,bytes:bytes.length,type,sha256:digest});
}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),base,release:live.id,fingerprint:live.fingerprint,checks},null,2));
