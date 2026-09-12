import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),sent=[];
 await p.addInitScript(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:35,longitude:-119,accuracy:10}});navigator.geolocation.watchPosition=success=>{window.mockPosition=success;return 1;};navigator.geolocation.clearWatch=()=>{};});
 const state={config:{enabled:true,to:'••••0123',dailyEnabled:true,dailyTime:'18:00',timeZone:'America/Los_Angeles',maxDaily:3},presence:{state:'unknown'},calls:[],todayCount:0};
 await p.route('**/phone-api/**',async route=>{const path=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().postDataJSON();sent.push({path,body});let data={};if(path==='pair')data={token:'test-owner-token'};if(path==='status')data=state;if(path==='presence')state.presence=body;if(path==='pause')state.config.enabled=false;if(path==='resume')state.config.enabled=true;await route.fulfill({json:data});});
 await p.goto('http://127.0.0.1:4194/phone/#pair='+'a'.repeat(64));await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('calls enabled'));assert.equal(new URL(p.url()).hash,'');
 await p.getByRole('button',{name:'I’m away',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#presence').textContent.includes('Away'));
 await p.getByRole('button',{name:'Set home from here'}).click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Home saved'));
 await p.getByRole('button',{name:'Use phone location'}).click();await p.evaluate(()=>mockPosition({coords:{latitude:36,longitude:-119,accuracy:10}}));await p.waitForFunction(()=>document.querySelector('#presence').textContent==='Away · location');
 assert.ok(sent.filter(x=>x.path==='presence').every(x=>!('latitude'in x.body)&&!('longitude'in x.body)));
 await p.getByRole('button',{name:'Stop location'}).click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Location stopped'));assert.equal(await p.evaluate(()=>localStorage.getItem('asgard:home-location')),null);
 await p.getByRole('button',{name:'Pause all calls'}).click();await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('calls paused'));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);mkdirSync('output/phone',{recursive:true});await p.screenshot({path:'output/phone/mobile.png',fullPage:true});
 console.log('PASS: mobile pairing, Home/Away, local-only GPS comparison, location deletion, pause and mobile layout.');
}finally{await browser.close();}
