async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/hud/summary',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({generated:new Date().toISOString(),sources:{events:true},realms:{loki:{stats:[{v:'2'},{v:'0'},null,null],rows:[]}},ticker:[]})}));
 await page.route('**/history?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({persona:r.request().url().split('persona=')[1],turns:[{role:'user',text:'Recorded test message'}]})}));
 await page.goto('http://127.0.0.1:4191/?motion=false#loki',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.AsgardHUD?.status().render?.frames>0, null,{timeout:120000});
 await page.evaluate(()=>AsgardHUD.refresh());
 const read=()=>page.evaluate(()=>({text:document.body.innerText,stats:[...document.querySelectorAll('.stat .v')].map(x=>x.textContent),canvas:document.querySelectorAll('canvas').length,link:document.querySelector('.composer').getAttribute('href'),overflow:[...document.querySelectorAll('.stat')].some(x=>x.scrollWidth>x.clientWidth+1)}));
 const healthy=await read();
 if(healthy.stats[0]!=='2'||!healthy.text.includes('Recorded test message')||healthy.text.includes('VOICE ON')||healthy.text.includes('18 MS')||healthy.text.includes('LISTENING')||healthy.canvas!==1||healthy.overflow)throw Error(JSON.stringify(healthy));
 await page.screenshot({path:'output/playwright/hud-real-loki.png',timeout:90000});
 await page.route('**/hud/summary',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/history?*',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.evaluate(()=>AsgardHUD.refresh());
 const failed=await read();
 if(!failed.stats.every(x=>x==='Unavailable')||failed.text.includes('Recorded test message')||!failed.text.includes('CONNECTION UNAVAILABLE'))throw Error('Failed sources retained stale data');
 for(const realm of ['thor','odin']){
  await page.evaluate(r=>AsgardHUD.select(r),realm);
  await page.waitForFunction(r=>AsgardHUD.status().scene===r&&AsgardHUD.status().render?.frames>0,realm,{timeout:120000});
  await page.evaluate(()=>AsgardHUD.refresh());
  const state=await read();if(state.canvas!==1||state.overflow||!state.stats.every(x=>x==='Unavailable'))throw Error(realm+' invalid');
 }
 return {healthy:{stats:healthy.stats,canvas:healthy.canvas,conversationLink:healthy.link},failed:{stats:failed.stats},errors};
}
