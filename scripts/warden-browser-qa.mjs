import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const base=process.env.ASGARD_QA_URL||'http://127.0.0.1:4192';
const out=process.env.ASGARD_QA_OUT||'output/warden';
const extraHTTPHeaders=process.env.ASGARD_QA_VERSION?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${process.env.ASGARD_QA_VERSION}"`}:{};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream']});
const results={base,browser:browser.version(),scenes:[],checks:[]};
const errors=[];
async function visit(page,address){const url=new URL(address);url.searchParams.set('verify',String(Date.now()));return page.goto(url.href);}
try{
 const page=await browser.newPage({extraHTTPHeaders});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.qa={draws:0,started:performance.now()};
  const draw=WebGLRenderingContext.prototype.drawArrays;
  WebGLRenderingContext.prototype.drawArrays=function(...a){if(!qa.draws)qa.firstFrame=performance.now()-qa.started;qa.draws++;return draw.apply(this,a);};
 });
 for(const [width,height] of [[1600,900],[900,700],[390,844],[320,568]]){
  await page.setViewportSize({width,height});await visit(page,base+'/');await page.waitForFunction(()=>window.ASGARD&&qa.draws>3);
  for(const [i,id] of ['thor','loki','odin'].entries()){
   await page.keyboard.press(String(i+1));await page.waitForTimeout(1100);
   const state=await page.evaluate(()=>({persona:ASGARD.current,href:document.getElementById('enterLink').getAttribute('href'),overflow:document.documentElement.scrollWidth>innerWidth,points:document.getElementById('pts').textContent,firstFrame:qa.firstFrame,draws:qa.draws,canvas:!!document.querySelector('canvas'),enter:document.getElementById('enterLink').getBoundingClientRect().toJSON()}));
   assert.equal(state.persona,id);assert.equal(state.href,'/hall/#'+id);assert.equal(state.overflow,false);assert.ok(state.enter.bottom<=height&&state.enter.top>=0);
   await page.screenshot({path:`${out}/${id}-${width}.png`});results.scenes.push({width,height,...state});
  }
 }
 await visit(page,base+'/?persona=loki');await page.waitForFunction(()=>window.ASGARD);assert.equal(await page.evaluate(()=>ASGARD.current),'loki');
 await visit(page,base+'/?persona=constructor#odin');await page.waitForFunction(()=>window.ASGARD);assert.equal(await page.evaluate(()=>ASGARD.current),'odin');results.checks.push('Legacy query/hash and invalid persona handling');
 await page.keyboard.press('1');await page.waitForTimeout(1100);const before=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--hot'));
 await page.keyboard.press('2');await page.waitForTimeout(350);const middle=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--hot'));
 await page.waitForTimeout(700);const after=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--hot'));
 assert.notEqual(middle,before);assert.notEqual(middle,after);results.checks.push('Palette interpolates during 900ms crossfade');
 await page.evaluate(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}));
 const draws=await page.evaluate(()=>qa.draws);await page.keyboard.press('m');await page.waitForTimeout(200);
 assert.equal(await page.locator('#mic').getAttribute('aria-pressed'),'false');assert.ok(await page.evaluate(()=>qa.draws)>draws);results.checks.push('Denied microphone keeps rendering');
 await page.evaluate(()=>{
  window.qaStopped=0;window.qaCalls=0;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{qaCalls++;return new Promise(resolve=>window.qaGrant=()=>resolve({getTracks:()=>[{stop:()=>qaStopped++}]}));}});
 });
 await page.keyboard.press('m');await page.keyboard.press('m');await page.evaluate(()=>qaGrant());await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>qaStopped),1);assert.equal(await page.evaluate(()=>qaCalls),1);results.checks.push('Cancelled pending mic grant releases stream');
 for(const [i,id] of ['thor','loki','odin'].entries()){
  await visit(page,base+'/');await page.waitForFunction(()=>window.ASGARD);await page.keyboard.press(String(i+1));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(route.request().method()!=='GET'||(!['127.0.0.1','localhost'].includes(u.hostname)&&u.origin!==new URL(base).origin))return route.abort();if(['/status','/wake','/agent/query'].some(p=>u.pathname.startsWith(p)))return route.fulfill({json:{}});return route.continue();});
  await page.keyboard.press('Enter');await page.waitForURL('**/hall/#'+id);assert.equal(await page.locator('html').getAttribute('data-persona'),id);
  await page.unroute('**/*');
 }
 results.checks.push('Enter opens each real hall and selects correct persona');
 const micContext=await browser.newContext({permissions:['microphone'],extraHTTPHeaders});
 const micPage=await micContext.newPage();micPage.on('pageerror',e=>errors.push(e.message));
 await visit(micPage,base+'/');await micPage.waitForFunction(()=>window.ASGARD);
 await micPage.keyboard.press('m');await micPage.waitForFunction(()=>document.getElementById('mic').getAttribute('aria-pressed')==='true');
 await micPage.keyboard.press('m');assert.equal(await micPage.locator('#mic').getAttribute('aria-pressed'),'false');
 await micPage.evaluate(()=>{ASGARD.state('speaking').level(.9);});await micPage.waitForTimeout(400);assert.equal(await micPage.locator('#stv').textContent(),'SPEAKING');
 assert.ok(parseFloat(await micPage.locator('#vox').textContent())>50);
 await micPage.evaluate(()=>ASGARD.auto());results.checks.push('Granted simulated microphone toggles off; external audio API drives glow');
 await micContext.close();
 const fallbackPage=await browser.newPage({extraHTTPHeaders});fallbackPage.on('pageerror',e=>errors.push(e.message));
 await fallbackPage.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await visit(fallbackPage,base+'/');await fallbackPage.waitForFunction(()=>window.ASGARD);await fallbackPage.waitForTimeout(400);
 await fallbackPage.screenshot({path:`${out}/fallback.png`});await fallbackPage.keyboard.press('3');await fallbackPage.waitForTimeout(1100);
 assert.equal(await fallbackPage.locator('#enterLink').getAttribute('href'),'/hall/#odin');results.checks.push('2D fallback remains usable without WebGL');await fallbackPage.close();
 assert.deepEqual(errors,[]);results.errors=errors;console.log(JSON.stringify(results));
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}
