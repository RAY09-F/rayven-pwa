import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),base=process.env.ASGARD_QA_URL||'http://127.0.0.1:4193';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],sent=[],results=[];await mkdir('output/warden-workspace',{recursive:true});
try{
const p=await browser.newPage({viewport:{width:1500,height:940},extraHTTPHeaders:process.env.ASGARD_QA_VERSION?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${process.env.ASGARD_QA_VERSION}"`}:{}});p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{localStorage.setItem('asgard:voice-output','0');});
await p.route('**/history?*',r=>r.fulfill({json:{turns:[{role:'assistant',text:'Earlier '+new URL(r.request().url()).searchParams.get('persona')+' context.'}]}}));
await p.route('**/',async r=>{
  if(r.request().method()!=='POST')return r.continue();const body=r.request().postDataJSON();sent.push(body);
  if(body.message==='fail')return r.fulfill({status:500,json:{error:'Claude API error — API key is invalid.'}});
  if(body.message==='slow')await new Promise(resolve=>setTimeout(resolve,1200));
  if(body.message==='stream')return r.fulfill({contentType:'text/event-stream',body:'event: text\ndata: {"text":"Hello "}\n\nevent: text\ndata: {"text":"stream"}\n\nevent: done\ndata: {"reply":"Hello stream"}\n\n'});
  return r.fulfill({json:{reply:'Verified '+body.persona+' response: **'+body.message+'**. <img src=x onerror=alert(1)>'}});
});
await p.goto(base);await p.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('Earlier thor'));
assert.equal(await p.locator('#enterLink').count(),0);assert.equal(await p.locator('a[href*="/hall"]').count(),0);
for(const id of ['thor','loki','odin']){
 await p.locator('[data-p='+id+']').click();await p.waitForFunction(id=>document.querySelector('#transcript').textContent.includes('Earlier '+id),id);
 await p.locator('#message').fill('hello '+id);await p.locator('#message').press('Enter');await p.waitForFunction(id=>document.querySelector('#transcript').textContent.includes('Verified '+id),id);
 assert.equal(sent.at(-1).persona,id);assert.equal(await p.locator('#transcript img').count(),0);results.push(id+' history and reply');
}
await p.locator('#message').fill('fail');await p.locator('#send').click();await p.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('ANTHROPIC_API_KEY'));
assert.equal(await p.locator('#message').inputValue(),'fail');results.push('Invalid key explanation and restored draft');
await p.locator('#message').fill('slow');await p.locator('#send').click();await p.locator('[data-p=loki]').click();await p.waitForTimeout(1500);
assert.ok(!(await p.locator('#transcript').innerText()).includes('slow'));await p.locator('[data-p=odin]').click();assert.ok((await p.locator('#transcript').innerText()).includes('slow'));results.push('In-flight persona isolation');
await p.locator('#message').fill('slow');await p.locator('#send').click();await p.locator('#stop').click();await p.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('Server work may continue'));
await p.waitForTimeout(1400);assert.ok((await p.locator('#transcript .message').last().innerText()).includes('Stopped waiting'));results.push('Cancellation rejects late reply');
await p.locator('#message').fill('stream');await p.locator('#send').click();await p.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('Hello stream'));results.push('SSE reply');
await p.locator('[data-open-arsenal]').click();await p.waitForFunction(()=>document.querySelectorAll('.tool-card').length>0);assert.ok(await p.locator('.tool-card').count()>10);await p.locator('.tool-card').first().click();assert.ok(await p.locator('.tool-form').count());await p.locator('.arsenal-close').click();results.push('Real catalog and tool forms');
await p.locator('[data-open-missions]').click();await p.locator('.mission-card').first().click();assert.ok((await p.locator('#message').inputValue()).length>60);await p.locator('#message').fill('');results.push('Mission prepares a draft');
await p.locator('.council-strip summary').click();assert.equal(await p.locator('.council-member').count(),5);await p.locator('.council-member').first().click();assert.ok((await p.locator('#arsenal-dialog').innerText()).includes('Prepare delegation'));await p.locator('.arsenal-close').click();await p.locator('.council-strip summary').click();
await p.locator('#settings').click();await p.locator('#still-motion').check();await p.getByRole('button',{name:'Done',exact:true}).click();results.push('Council and settings');
for(const size of [{width:1500,height:940},{width:390,height:844},{width:320,height:640}]){
 await p.setViewportSize(size);await p.waitForTimeout(600);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const send=await p.locator('#send').boundingBox();assert.ok(send.y+send.height<=size.height&&send.x+send.width<=size.width);await p.screenshot({path:'output/warden-workspace/'+size.width+'.png'});
}
results.push('Desktop and two phone sizes fit');
// Speech recognition fixture: test the real controller callbacks, not a live mic.
await p.evaluate(()=>{
 window.fakeTracksStopped=0;const track={stop(){fakeTracksStopped++;},addEventListener(){}};
 navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[track]});
 window.AudioContext=class{createMediaStreamSource(){return {connect(){}};}createAnalyser(){return {fftSize:512,connect(){},getByteTimeDomainData(a){a.fill(145);}};}resume(){return Promise.resolve();}close(){return Promise.resolve();}};
 window.SpeechRecognition=class{start(){window.recFixture=this;this.onstart?.();}abort(){}};
});
await p.locator('#mic').click();await p.waitForFunction(()=>document.querySelector('#mic').getAttribute('aria-pressed')==='true');
await p.evaluate(()=>{const result=[{transcript:'voice request'}];result.isFinal=true;recFixture.onresult({results:[result]});recFixture.onend();});
await p.waitForFunction(()=>document.querySelector('#transcript').textContent.includes('voice request'));await p.waitForFunction(()=>!document.querySelector('#send').disabled);
assert.equal(sent.at(-1).message,'voice request');assert.ok(await p.evaluate(()=>fakeTracksStopped>0));results.push('Speech-to-send and mic cleanup');
for(const id of ['thor','loki','odin']){
 await p.locator('[data-p='+id+']').click();
 assert.equal(await p.locator('#micLabel').innerText(),'Mic off');
 assert.ok((await p.locator('#mic').getAttribute('aria-label')).toLowerCase().includes(id));
 const before=sent.length;await p.locator('#mic').click();
 await p.waitForFunction(()=>document.querySelector('#micLabel').textContent==='Mic on');
 await p.locator('#mic').click();assert.equal(await p.locator('#micLabel').innerText(),'Mic off');
 assert.equal(await p.locator('#mic').getAttribute('aria-pressed'),'false');assert.equal(sent.length,before);
}
results.push('Visible mic toggle turns on and off for all three personas');
assert.deepEqual(errors,[]);await writeFile('output/warden-workspace/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
