import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TOOLS as a} from '../public/ui/workshop/tools/catalog-business-lab.js';
import {TOOLS as b} from '../public/ui/workshop/tools/catalog-workbench.js';
const require=createRequire(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright'),browser=await chromium.launch({channel:'msedge',headless:true});
const label=v=>v.replace(/^(wb_|biz_|business_|creator_)/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const evidence={widths:[],tools:0,errors:[],requestsDuringRuns:0};
try{
await mkdir('output/goal',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>evidence.errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
await page.goto('http://127.0.0.1:4191/workshop/');await page.waitForFunction(()=>document.querySelectorAll('#tool-list button').length===100);
const recordRequest=()=>evidence.requestsDuringRuns++;page.on('request',recordRequest);
for(const tool of [...a,...b]){await page.locator('#tool-list').getByRole('button',{name:label(tool.name),exact:true}).click();await page.locator('#tool-example').click();await page.locator('#tool-run').click();assert.equal(await page.locator('#tool-error').isVisible(),false,tool.name);assert.equal(await page.locator('#result-section').isVisible(),true,tool.name);evidence.tools++;}
const choose=id=>page.locator('[data-quickstart="'+id+'"]').click();
await choose('wb_web_meta_build');await page.locator('#tool-example').click();await choose('wb_dependency_order');await choose('wb_web_meta_build');
assert.match(await page.locator('#draft-status').textContent(),/Draft restored.*Example inputs/);await page.locator('#tool-run').click();assert.match(await page.locator('#result-status').textContent(),/^Example result/);
await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}}));await page.locator('#result-copy').click();assert.match(await page.locator('#result-status').textContent(),/^Example result/);assert.match(await page.locator('#result-action-status').textContent(),/Result copied/);assert.ok(await page.evaluate(()=>window.copied.length));
await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));await page.locator('#result-copy').click();assert.match(await page.locator('#result-status').textContent(),/^Example result/);assert.match(await page.locator('#result-action-status').textContent(),/Copy unavailable/);
await page.locator('#field-title').fill('My website');await choose('wb_dependency_order');await choose('wb_web_meta_build');assert.equal(await page.locator('#field-title').inputValue(),'My website');assert.match(await page.locator('#draft-status').textContent(),/Your inputs/);
await page.locator('#field-url').fill('invalid');await page.locator('#tool-run').click();assert.equal(await page.locator('#tool-error').isVisible(),true);assert.equal(await page.locator('#result-section').isVisible(),false);
for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`output/goal/cycle2-after-${width}.png`,fullPage:true});await choose('business_project_quote');assert.equal(await page.evaluate(()=>document.activeElement.id),'tool-title');await page.screenshot({path:`output/goal/cycle2-selection-${width}.png`,fullPage:false});await page.locator('#tool-example').click();await page.locator('#tool-run').click();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.screenshot({path:`output/goal/cycle2-selected-${width}.png`,fullPage:false});if(width<600){await page.locator('#tool-browse').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'tool-search');}evidence.widths.push({width,overflow,selectionFocus:true});}
assert.equal(evidence.requestsDuringRuns,0);assert.deepEqual(evidence.errors,[]);page.off('request',recordRequest);await page.reload();await page.waitForSelector('#field-directCosts');assert.equal(await page.locator('#field-directCosts').inputValue(),'');evidence.reloadClearsDraft=true;evidence.exampleRestored=true;evidence.copySuccessAndFailurePreserveProvenance=true;evidence.invalidInputHidesResult=true;
const first=await browser.newPage();await first.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());for(const width of [320,390,1440]){await first.setViewportSize({width,height:844});await first.goto('http://127.0.0.1:4191/workshop/');await first.waitForSelector('#tool-quickstarts button');await first.screenshot({path:`output/goal/cycle2-after-${width}.png`,fullPage:true});}await first.close();await writeFile('output/goal/cycle2-evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}

