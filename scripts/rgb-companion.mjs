import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE='https://asgrard-backend.rayanfahil2.workers.dev';
export const COLORS={thor:'#47B3FF',loki:'#1FB352',odin:'#DBA340',locked:'#FF0B12'};
export function createCompanion({token,port=18771,apply=applySignal}){
  let last=null,chain=Promise.resolve(),revision=0;
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
        last={persona:data.persona,locked:data.locked,color:COLORS[mode],at:new Date().toISOString()};
      });
      await chain;reply(200,{ok:true,last});
    }catch(error){reply(502,{error:'SignalRGB is unavailable or Pro is not active'});}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;
  return server;
}
async function applySignal(mode){
  const base='http://127.0.0.1:16038/api/v1/lighting';
  const effect='ASGARD '+mode+'.html';
  const current=await fetch(base,{signal:AbortSignal.timeout(4000)});
  if(!current.ok)throw Error('SignalRGB unavailable');
  const state=await current.json();
  if(state.data?.id===effect&&state.data?.attributes?.enabled)return;
  const result=await fetch(base+'/effects/'+encodeURIComponent(effect)+'/apply',{method:'POST',signal:AbortSignal.timeout(4000)});
  if(!result.ok||(await result.json()).status!=='ok')throw Error('Effect unavailable');
  const enabled=await fetch(base+'/enabled',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true}),signal:AbortSignal.timeout(4000)});
  if(!enabled.ok)throw Error('Canvas unavailable');
  // An accepted request does not guarantee SignalRGB loaded the effect.
  for(let attempt=0;attempt<8;attempt++){
    await new Promise(resolve=>setTimeout(resolve,250));
    const check=await fetch(base,{signal:AbortSignal.timeout(1500)});
    if(!check.ok)continue;
    const actual=await check.json();
    if(actual.data?.id===effect&&actual.data?.attributes?.enabled)return;
  }
  throw Error('SignalRGB did not load the requested effect');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const dir=join(process.env.LOCALAPPDATA,'ASGARD-RGB');mkdirSync(dir,{recursive:true});
  const config=join(dir,'pairing.json');let token;
  try{token=JSON.parse(readFileSync(config,'utf8')).token;}catch{token=randomBytes(32).toString('hex');writeFileSync(config,JSON.stringify({token}));}
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid pairing configuration');
  createCompanion({token}).listen(18771,'127.0.0.1',()=>console.log('ASGARD lighting helper ready on this PC'));
}
