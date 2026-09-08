async page => {
 page.setDefaultTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});const base='https://asgrard-backend.rayanfahil2.workers.dev';const checks=[];
 const check=(v,l)=>{if(!v)throw Error(l);checks.push(l);};
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?persona=thor');await page.waitForFunction(()=>window.AsgardUI?.status().render?.ready);
 check(await page.locator('.aperture').count()===1,'Live index serves floating realms in existing HUD');
 const release=await page.evaluate(async()=>await (await fetch('/ui/release.json',{cache:'no-store'})).json());check(release.name==='The Floating Realms','Live metadata identifies delivered build');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#still-setting').check();await page.locator('#output-setting').uncheck();await page.keyboard.press('Escape');await page.waitForFunction(()=>!AsgardUI.status().render.rafActive);
 for(const p of ['Thor','Loki','Odin']){await page.getByRole('button',{name:p,exact:true}).click();await page.waitForFunction(p=>AsgardUI.status().render.persona===p&&!AsgardUI.status().render.rafActive,p.toLowerCase());await page.screenshot({path:`output/playwright/floating-live-${p.toLowerCase()}.png`});check(await page.locator('#presence-scene canvas').count()===1,`Live ${p} uses one renderer canvas`);check((await page.evaluate(()=>AsgardUI.status().render.objects.length))===6,`Live ${p} has six draggable objects`);await page.getByRole('button',{name:'Reset 3D view',exact:true}).click();}
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Loki',exact:true}).click();await page.screenshot({path:'output/playwright/floating-live-loki-phone.png',fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Live phone has no horizontal overflow');
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Thor',exact:true}).click();
 // Existing server smoke contract executes a real turn without saving chat history.
 await page.route(base+'/',async route=>{if(route.request().method()==='POST')await route.continue({headers:{...route.request().headers(),'X-Asgard-Smoke':'1'}});else await route.continue();});
 const responsePromise=page.waitForResponse(r=>r.url()===base+'/'&&r.request().method()==='POST',{timeout:65000});const started=Date.now();
 await page.locator('#in-thor').fill('Deployment smoke check. Reply only: Bifrost is ready. Do not use tools, recall memory, send messages, or change any data.');await page.locator('#in-thor').press('Enter');
 const response=await responsePromise;const payload=await response.json();if(response.ok()){await page.locator('#tx-thor .copy-response').waitFor({timeout:10000});check(typeof payload.reply==='string'&&payload.reply.length>0,'Live POST chat returns actual provider reply');check(payload.persona==='thor','Live chat retains persona namespace');}else{await page.locator('#tx-thor .errline').waitFor();}
 await page.screenshot({path:'output/playwright/floating-live-chat.png'});await page.unroute(base+'/');
 return {verifiedAt:new Date().toISOString(),url:base,release:release.id,fingerprint:release.fingerprint,checks,chat:{verified:response.ok(),status:response.status(),persona:payload.persona,reply:payload.reply,error:payload.error,elapsedMs:Date.now()-started,smokeHeader:true},renderer:await page.evaluate(()=>AsgardUI.status().render)};
}
