import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const exec=promisify(execFile),[version,out]=process.argv.slice(2),base='https://asgrard-backend.rayanfahil2.workers.dev';
const manifest=JSON.parse(await readFile('public/ui/release.json','utf8')),started=Date.now(),samples=[];
async function get(path,pin=true){const args=['--fail','--silent','--show-error','--max-time','25'];if(pin)args.push('-H',`Cloudflare-Workers-Version-Overrides: asgrard-backend="${version}"`);args.push(base+path+(path.includes('?')?'&':'?')+'verify='+Date.now());return (await exec('curl',args,{encoding:'buffer',maxBuffer:4e6})).stdout;}
for(let i=0;i<=10;i++){
 const sample={at:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000)};
 try{
  for(const path of ['/index.html','/ui/hud-real-v1/hud/hud.js','/ui/hud-real-v1/hud/hud-data.js']){
   const bytes=await get(path==='/index.html'?'/':path);
   if(createHash('sha256').update(bytes).digest('hex')!==manifest.assets[path])throw Error('Incorrect candidate asset '+path);
  }
  const summary=JSON.parse(await get('/hud/summary'));
  if(!summary.sources||!summary.realms||!summary.generated)throw Error('Invalid data summary');
  sample.sources=summary.sources;
  const index=await get('/',false);if(!index.toString().includes('ASGARD'))throw Error('Public index unavailable');
  sample.ok=true;
 }catch(e){sample.ok=false;sample.error=e.message;}
 samples.push(sample);await writeFile(out,JSON.stringify({version,release:manifest.id,started:new Date(started).toISOString(),samples},null,2));console.log(JSON.stringify(sample));
 if(!sample.ok)process.exit(1);
 if(i<10)await new Promise(r=>setTimeout(r,30000));
}
if(Date.now()-started<300000)throw Error('Observation too short');
