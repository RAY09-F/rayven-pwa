import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');const {PNG}=require('pngjs');
const base=process.env.ASGARD_QA_URL||'http://127.0.0.1:4193';const out=process.env.ASGARD_QA_OUT||'output/warden-motion';
const headers=process.env.ASGARD_QA_VERSION?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${process.env.ASGARD_QA_VERSION}"`}:{};
await mkdir(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});const errors=[];const results=[];
function metrics(bytes){const p=PNG.sync.read(bytes);let luminance=0,white=0;for(let y=Math.round(p.height*.15);y<p.height*.75;y++)for(let x=Math.round(p.width*.15);x<p.width*.85;x++){const i=(y*p.width+x)*4;const r=p.data[i],g=p.data[i+1],bl=p.data[i+2];luminance+=(r+g+bl)/3;if(Math.min(r,g,bl)>190)white++;}return {luminance,white};}
try{const p=await b.newPage({extraHTTPHeaders:headers});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')errors.push(m.text());});
await p.addInitScript(()=>{window.motionQA={frames:[],passes:new Set(),energy:[]};const draw=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...a){const prog=this.getParameter(this.CURRENT_PROGRAM);motionQA.passes.add(this.getUniform(prog,this.getUniformLocation(prog,'uPass')));return draw.apply(this,a);};function tick(t){motionQA.frames.push(t);if(motionQA.frames.length>1000)motionQA.frames.shift();requestAnimationFrame(tick);}requestAnimationFrame(tick);});
for(const [width,height] of [[1600,900],[390,844]]){await p.setViewportSize({width,height});await p.goto(base+'/?verify='+Date.now());await p.waitForFunction(()=>window.ASGARD);await p.waitForTimeout(2400);
for(const id of ['thor','loki','odin']){await p.evaluate(id=>ASGARD.persona(id),id);const row={id,width};
for(const state of ['idle','listening','speaking']){await p.evaluate(state=>ASGARD.state(state).level(state==='speaking'?.75:0),state);await p.waitForTimeout(2200);const bytes=await p.screenshot({path:`${out}/${id}-${state}-${width}.png`});row[state]=metrics(bytes);}
assert.ok(row.listening.white>row.idle.white*1.15,JSON.stringify(row));assert.ok(row.speaking.white>row.idle.white*1.3,JSON.stringify(row));results.push(row);}
await p.evaluate(()=>ASGARD.state('idle').level(0));await p.waitForTimeout(2500);const a=PNG.sync.read(await p.screenshot());await p.waitForTimeout(650);const z=PNG.sync.read(await p.screenshot());let changed=0;for(let i=0;i<a.data.length;i+=4)if(Math.abs(a.data[i]-z.data[i])+Math.abs(a.data[i+1]-z.data[i+1])+Math.abs(a.data[i+2]-z.data[i+2])>45)changed++;
assert.ok(changed>width*height*.03,'Particle motion too subtle');results.push({width,changedPixels:changed,performance:await p.evaluate(()=>{const f=motionQA.frames.slice(-120),d=f.slice(1).map((v,i)=>v-f[i]).sort((a,b)=>a-b);return {medianMs:d[Math.floor(d.length/2)],p95Ms:d[Math.floor(d.length*.95)],passes:[...motionQA.passes]};})});}
await p.mouse.click(190,260);await p.waitForTimeout(850);const burst=await p.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl'),pr=g.getParameter(g.CURRENT_PROGRAM);return g.getUniform(pr,g.getUniformLocation(pr,'uBurst'));});assert.ok(burst>.7);results.push({chargePulse:burst});
await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.waitForFunction(()=>window.ASGARD);await p.waitForTimeout(2300);await p.mouse.click(190,260);const reduced=await p.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl'),pr=g.getParameter(g.CURRENT_PROGRAM);return {motion:g.getUniform(pr,g.getUniformLocation(pr,'uMotion')),burst:g.getUniform(pr,g.getUniformLocation(pr,'uBurst'))};});assert.deepEqual(reduced,{motion:0,burst:0});results.push({reduced});
assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({base,results,errors},null,2));console.log(JSON.stringify({base,results,errors}));
}finally{await b.close();}
