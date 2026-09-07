// Local static preview only. It never proxies requests to the live Worker.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const args=process.argv.slice(2), option=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const root=resolve('public');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
const fixtureScript=`<script>const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).startsWith('https://asgrard-backend.rayanfahil2.workers.dev')?originalFetch('/__fixture'+(String(url).endsWith('/tts')?'/tts':'/chat'),options):originalFetch(url,options);document.addEventListener('DOMContentLoaded',()=>{const n=document.createElement('p');n.textContent='LOCAL TEST · replies are fixtures';n.style.cssText='position:fixed;bottom:0;left:0;font:10px system-ui;color:#ffd391;background:#24201b;padding:3px;margin:0;z-index:50';document.body.append(n);});</script>`;
createServer(async(req,res)=>{
  const requestURL=new URL(req.url,'http://localhost');
  if(requestURL.pathname.startsWith('/__fixture/')&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>20000){res.writeHead(413);res.end();return;}}
    let data;try{data=JSON.parse(body);}catch{res.writeHead(400);res.end();return;}
    res.setHeader('Content-Type','application/json');
    if(requestURL.pathname.endsWith('/tts')){res.writeHead(503);res.end('{"error":"Fixture audio unavailable"}');return;}
    const fail=data.message?.includes('simulate error');
    setTimeout(()=>{res.writeHead(fail?503:200);res.end(JSON.stringify(fail?{error:'Preview failure — no live backend was called'}:{reply:'Let’s make it manageable.\n\n- Choose one useful outcome.\n- Make the first step small.\n\nYour message reached the **'+data.assistant+'** fixture.\n\n```js\nconst nextStep = "Begin";\n```\n[Reference](https://example.com)'}));},700);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__review'){
      const w=Math.min(1600,Math.max(320,Number(url.searchParams.get('w'))||1440));
      const h=Math.min(1100,Math.max(300,Number(url.searchParams.get('h'))||900));
      const persona=['thor','loki','odin'].includes(url.searchParams.get('persona'))?url.searchParams.get('persona'):'thor';
      res.writeHead(200,{'Content-Type':'text/html'});res.end(`<html><body style="margin:0;width:${w}px;height:${h}px"><iframe title="ASGARD review" src="/?hall=${persona}${url.searchParams.get('renderer')==='svg'?'&renderer=svg':''}${url.searchParams.get('fixture')==='1'?'&fixture=1':''}" style="width:${w}px;height:${h}px;border:0;display:block"></iframe></body></html>`);return;
    }
    let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    let bytes=await readFile(path);
    if(path===resolve(root,'index.html')&&url.searchParams.get('fixture')==='1')bytes=Buffer.from(bytes.toString().replace('</head>',fixtureScript+'</head>'));
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(option('--port','4173')),option('--host','127.0.0.1'),()=>console.log('ASGARD static preview ready; backend not proxied.'));
