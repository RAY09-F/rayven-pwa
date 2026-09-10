import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {routeBrief} from '../public/ui/workshop/sample.js';
const good={project:'shelves',timing:'planned',budget:'medium',area:'local'};
for(const [input,route] of [[good,'Design brief'],[{...good,budget:'small'},'Discovery'],[{...good,budget:'unknown'},'Discovery'],[{...good,timing:'soon'},'Availability'],[{...good,area:'outside',timing:'soon'},'Scope'],[{...good,project:'other'},'Scope']]) assert.ok(routeBrief(input).route.startsWith(route));
for(const bad of [{},{...good,project:'<script>'},{...good,area:null}]) assert.throws(()=>routeBrief(bad));
const require=createRequire(process.env.ASGARD_PLAYWRIGHT_MODULE||join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright'),browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.ASGARD_QA_URL||'http://127.0.0.1:4191';
const evidence={screens:[],routes:[],errors:[],remoteRequests:[],interactionRequests:[]};
await mkdir('output/goal',{recursive:true});
try {
 const page=await browser.newPage(); let interacting=false;
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(base))evidence.remoteRequests.push(r.url());if(interacting)evidence.interactionRequests.push(r.url());});
 await page.goto(base+'/workshop/sample.html');
 for(const width of [1440,390,320]) {
   await page.setViewportSize({width,height:width===1440?1000:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const path=`output/goal/service-sample-${width}.png`;await page.screenshot({path,fullPage:true});evidence.screens.push(path);
 }
 interacting=true;
 await page.locator('button[type=submit]').click();
 assert.equal(await page.locator('#sample-error').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'project');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'timing');
 for(const [values,route] of [[good,'Design brief'],[{...good,budget:'unknown'},'Discovery'],[{...good,timing:'soon'},'Availability'],[{...good,project:'other'},'Scope']]) {
   for(const [field,value] of Object.entries(values))await page.locator('#'+field).selectOption(value);
   await page.locator('button[type=submit]').click();
   assert.equal(await page.locator('#sample-result').isVisible(),true);
   assert.ok((await page.locator('#result-route').textContent()).startsWith(route));
   assert.equal(await page.evaluate(()=>document.activeElement.id),'result-title');
   evidence.routes.push(route);
 }
 await page.screenshot({path:'output/goal/service-sample-result-320.png',fullPage:true});
 await page.locator('#project').selectOption('bench');assert.equal(await page.locator('#sample-result').isVisible(),false);
 await page.locator('button[type=reset]').click();
 for(const field of Object.keys(good))assert.equal(await page.locator('#'+field).inputValue(),'');
 assert.equal(await page.locator('#sample-empty').isVisible(),true);
 assert.equal(await page.locator('#sample-error').isVisible(),false);
 assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.remoteRequests,[]);assert.deepEqual(evidence.interactionRequests,[]);
 evidence.passed=true;console.log(JSON.stringify(evidence));await writeFile('output/goal/service-sample-qa.json',JSON.stringify(evidence,null,2));
}finally{await browser.close();}
