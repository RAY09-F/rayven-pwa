import {sleepLights,desktopMode,maintainDesktop,telemetry} from './desktop-local.mjs';
import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE='https://asgrard-backend.rayanfahil2.workers.dev';
export const COLORS={thor:'#47B3FF',loki:'#006400',odin:'#FF9000',locked:'#B00000'};
export function createCompanion({token,port=18771,apply=applySignal,desktop=maintainDesktop}){
  let last=null,chain=Promise.resolve(),revision=0,desktopChain=Promise.resolve(),desktopRevision=0;
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');
    const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if(req.headers.host!==`127.0.0.1:${server.address().port}`)return reply(403,{error:'Host denied'});
    if(origin&&origin!==SITE)return reply(403,{error:'Origin denied'});
    if(origin===SITE){res.setHeader('Access-Control-Allow-Origin',SITE);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      if(origin!==SITE)return reply(403,{error:'Origin required'});
      res.setHeader('Access-Control-Allow-Methods','POST, GET');
      res.setHeader('Access-Control-Allow-Headers','content-type, x-asgard-key');
      res.setHeader('Access-Control-Allow-Private-Network','true');return reply(200,{});
    }
    if(req.method==='GET'&&req.url==='/pair'){
      // The secret stays in the fragment; it is never sent to the website server.
      res.writeHead(302,{Location:SITE+'/#rgb-pair='+token,'Referrer-Policy':'no-referrer'});return res.end();
    }
    const supplied=Buffer.from(String(req.headers['x-asgard-key']||'')),expected=Buffer.from(token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return reply(401,{error:'Pair this browser first'});
    if(req.method==='GET'&&req.url==='/telemetry')return reply(200,await telemetry());
    if(req.method==='POST'&&['/sleep','/desktop'].includes(req.url)){try{let raw='';for await(const c of req){raw+=c;if(raw.length>100)return reply(413,{error:'Too large'});}const v=JSON.parse(raw);if(typeof v.enabled!=='boolean')return reply(400,{error:'Boolean required'});return reply(200,await(req.url==='/sleep'?sleepLights(v.enabled):desktopMode(v.enabled)));}catch{return reply(502,{error:'Local setting unavailable'});}}
    if(req.method==='GET'&&req.url==='/status')return reply(200,{ok:true,last});
    if(req.method!=='POST'||req.url!=='/state')return reply(404,{error:'Not found'});
    if(!String(req.headers['content-type']).startsWith('application/json'))return reply(415,{error:'JSON required'});
    let body='';
    try{
      for await(const chunk of req){body+=chunk;if(body.length>256)return reply(413,{error:'Too large'});}
      const data=JSON.parse(body);
      if(!['thor','loki','odin'].includes(data.persona)||typeof data.locked!=='boolean')return reply(400,{error:'Invalid lighting state'});
      const mode=data.locked?'locked':data.persona,myRevision=++revision;
      chain=chain.catch(()=>{}).then(async()=>{
        if(myRevision!==revision)return;
        await apply(mode);
        last={persona:data.persona,locked:data.locked,color:COLORS[mode],at:new Date().toISOString(),transitionMs:mode==='locked'?4000:2000};
        const d=++desktopRevision;
        desktopChain=desktopChain.catch(()=>{}).then(async()=>{if(d===desktopRevision)await desktop(mode);}).catch(()=>{});
      });
      await chain;reply(200,{ok:true,last});
    }catch(error){reply(502,{error:'SignalRGB is unavailable or Pro is not active'});}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;
  return server;
}
export async function applySignal(mode){
  const base='http://127.0.0.1:16038/api/v1/lighting',effect='ASGARD Flow.html';
  const current=await fetch(base,{signal:AbortSignal.timeout(1500)});
  if(!current.ok)throw Error('SignalRGB unavailable');
  const state=await current.json();
  if(state.data?.id!==effect){
    const result=await fetch(base+'/effects/'+encodeURIComponent(effect)+'/apply',{method:'POST',signal:AbortSignal.timeout(2000)});
    if(!result.ok||(await result.json()).status!=='ok')throw Error('Flow effect unavailable');
    let loaded=false;
    for(let attempt=0;attempt<12;attempt++){
      await new Promise(r=>setTimeout(r,80));
      const check=await fetch(base,{signal:AbortSignal.timeout(1000)});
      if(check.ok&&(await check.json()).data?.id===effect){loaded=true;break;}
    }
    if(!loaded)throw Error('Flow effect did not load');
  }
  if(!state.data?.attributes?.enabled){
    const r=await fetch(base+'/enabled',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true}),signal:AbortSignal.timeout(1500)});
    if(!r.ok)throw Error('Canvas unavailable');
  }
  const event=await fetch('http://127.0.0.1:16034/canvas/event?sender=asgard-rgb&event='+encodeURIComponent(mode),{method:'POST',signal:AbortSignal.timeout(1500)});
  if(!event.ok)throw Error('Palette event unavailable');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const dir=join(process.env.LOCALAPPDATA,'ASGARD-RGB');mkdirSync(dir,{recursive:true});
  const config=join(dir,'pairing.json');let token;
  try{token=JSON.parse(readFileSync(config,'utf8')).token;}catch{token=randomBytes(32).toString('hex');writeFileSync(config,JSON.stringify({token}));}
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid pairing configuration');
  createCompanion({token}).listen(18771,'127.0.0.1',()=>console.log('ASGARD lighting helper ready on this PC'));
}
