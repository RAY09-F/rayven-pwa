import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildServiceSample,outputPath} from './build-service-sample.mjs';
assert.equal(await readFile(outputPath,'utf8'),await buildServiceSample());
const require=createRequire(process.env.ASGARD_PLAYWRIGHT_MODULE||join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright'),browser=await chromium.launch({channel:'msedge',headless:true});
const evidence={routes:[],screens:[],errors:[],extraRequests:[]};
await mkdir('output/goal',{recursive:true});
try {
 const page=await browser.newPage({acceptDownloads:true});
 const base=process.env.ASGARD_QA_URL||'http://127.0.0.1:4191';
 await page.goto(base+'/workshop/services.html');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download the interactive offline sample'}).click()]);
 assert.equal(download.suggestedFilename(),'alder-and-line-offline-demo.html');
 const downloaded=resolve('output/goal/alder-and-line-offline-demo.html');await download.saveAs(downloaded);
 assert.equal(await readFile(downloaded,'utf8'),await buildServiceSample());
 evidence.downloadFilename=download.suggestedFilename();
 const fileUrl=pathToFileURL(downloaded).href;
 page.on('pageerror',e=>evidence.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')evidence.errors.push(m.text());});
 page.on('request',r=>{if(r.url()!==fileUrl)evidence.extraRequests.push(r.url());});
 await page.goto(fileUrl);
 await page.getByRole('link',{name:'About this offline sample'}).click();
 assert.equal(new URL(page.url()).hash,'#about-sample');
 await page.locator('button[type=submit]').click();assert.equal(await page.locator('#sample-error').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'project');
 const good={project:'shelves',timing:'planned',budget:'medium',area:'local'};
 for(const [values,route] of [[good,'Design brief'],[{...good,budget:'small'},'Discovery'],[{...good,timing:'soon'},'Availability'],[{...good,area:'outside'},'Scope']]) {
   for(const [field,value] of Object.entries(values))await page.locator('#'+field).selectOption(value);
   await page.locator('button[type=submit]').click();
   assert.equal(await page.locator('#sample-result').isVisible(),true);
   assert.ok((await page.locator('#result-route').textContent()).startsWith(route));evidence.routes.push(route);
 }
 await page.evaluate(()=>{const option=document.createElement('option');option.value='<script>';option.textContent='Malformed test';document.querySelector('#project').append(option);document.querySelector('#project').value='<script>';});
 await page.locator('button[type=submit]').click();
 assert.equal(await page.locator('#sample-error').isVisible(),true);assert.equal(await page.locator('#sample-result').isVisible(),false);
 await page.locator('button[type=reset]').click();
 for(const field of Object.keys(good))assert.equal(await page.locator('#'+field).inputValue(),'');
 assert.equal(await page.locator('#sample-empty').isVisible(),true);assert.equal(await page.locator('#sample-error').isVisible(),false);
 for(const width of [1440,390,320]) {
   await page.setViewportSize({width,height:width===1440?1000:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const path=`output/goal/service-sample-offline-${width}.png`;await page.screenshot({path,fullPage:true});evidence.screens.push(path);
 }
 assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.extraRequests,[]);
 evidence.passed=true;console.log(JSON.stringify(evidence));await writeFile('output/goal/service-sample-export-qa.json',JSON.stringify(evidence,null,2));
}finally{await browser.close();}
