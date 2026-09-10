import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const audio=Buffer.alloc(44+44100*2*3);audio.write('RIFF');audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(44100,24);audio.writeUInt32LE(88200,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);for(let i=0;i<44100*3;i++)audio.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/44100)*9000),44+i*2);
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
const page=await browser.newPage({extraHTTPHeaders:process.env.ASGARD_QA_VERSION?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${process.env.ASGARD_QA_VERSION}"`}:{}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/history?*',r=>r.fulfill({json:{turns:[{role:'assistant',text:'A voice playback test.'}]}}));
await page.route('**/tts',r=>r.fulfill({contentType:'audio/wav',body:audio}));
await page.goto(process.env.ASGARD_QA_URL||'http://127.0.0.1:4193');await page.getByRole('button',{name:'Read aloud'}).click();
await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.startsWith('Speaking.'));
await page.waitForTimeout(500);
const energy=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl');return gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM),gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM),'uVoice'));});
assert.ok(energy>.1,'Playback samples must drive particle energy');await page.locator('#stop').click();await page.waitForFunction(()=>document.querySelector('#stop').hidden);await page.waitForTimeout(4000);assert.ok(!(await page.locator('#connection-status').innerText()).includes('Speaking'));
await page.getByRole('button',{name:'Read aloud'}).click();await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.startsWith('Speaking.'));await page.locator('[data-p=loki]').click();await page.waitForFunction(()=>document.querySelector('#stop').hidden);assert.deepEqual(errors,[]);
console.log(JSON.stringify({audioEnergy:energy,stopped:true,personaSwitchStopsPlayback:true,errors}));
}finally{await browser.close();}
