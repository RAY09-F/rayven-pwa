import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const site='https://asgrard-backend.rayanfahil2.workers.dev';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.grantPermissions(['local-network-access'],{origin:site});
  const page=await context.newPage();
  if(!process.env.ASGARD_RGB_LIVE)await page.route(site+'/**',async route=>{
    const u=new URL(route.request().url());
    if(route.request().method()!=='GET')return route.fulfill({json:{reply:'Test fixture'}});
    const response=await fetch('http://127.0.0.1:4194'+u.pathname+u.search);
    await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'text/plain',body:Buffer.from(await response.arrayBuffer())});
  });
  const token=JSON.parse(readFileSync(process.env.LOCALAPPDATA+'/ASGARD-RGB/pairing.json','utf8')).token;
  await page.addInitScript(()=>localStorage.setItem('asgard:voice-output','0'));
  await page.goto(site+'/#rgb-pair='+token);
  await page.waitForFunction(()=>location.hash==='');
  for(const persona of ['thor','loki','odin']){
    await page.locator('[data-p='+persona+']').click();
    await page.waitForFunction(p=>document.body.dataset.identity===p,persona);
    await page.waitForFunction(p=>document.querySelector('#pc-lights-status').textContent==='Connected · '+p+' lighting',persona[0].toUpperCase()+persona.slice(1));
    const actual=await (await fetch('http://127.0.0.1:16038/api/v1/lighting')).json();
    assert.equal(actual.data.id,'ASGARD '+persona+'.html');
  }
  await page.locator('#lock-in').click();
  await page.waitForFunction(()=>document.querySelector('#pc-lights-status').textContent==='Connected · red focus lighting');
  assert.equal((await (await fetch('http://127.0.0.1:16038/api/v1/lighting')).json()).data.id,'ASGARD locked.html');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#pc-lights-status').textContent==='Connected · red focus lighting');
  await page.locator('#lock-in').click();
  await page.locator('[data-p=thor]').click();
  await page.waitForFunction(()=>document.querySelector('#pc-lights-status').textContent==='Connected · Thor lighting');
  await page.evaluate(()=>document.querySelector('#settings-dialog').showModal());
  mkdirSync('output/rgb',{recursive:true});
  await page.screenshot({path:'output/rgb/settings.png'});
  await page.locator('#pc-lights-off').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('asgard:pc-lights-key')),null);
  console.log('PASS: browser pairing, all persona colors, red lock-in, reload persistence, and disconnect with real SignalRGB readback.');
}finally{await browser.close();}
