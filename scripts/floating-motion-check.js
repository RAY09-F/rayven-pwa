async page=>{
 page.setDefaultTimeout(60000);const checks=[],samples=[],check=(v,l)=>{if(!v)throw Error(l);checks.push(l);};
 await page.setViewportSize({width:1000,height:800});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:4173/?fixture=1');await page.reload();await page.waitForFunction(()=>AsgardUI.status().render?.ready);
 for(const name of ['Thor','Loki','Odin']){
  await page.getByRole('button',{name,exact:true}).click();const resume=page.getByRole('button',{name:'Resume motion',exact:true});if(await resume.count())await resume.click();await page.waitForFunction(()=>AsgardUI.status().render.animated);
  const a=await page.locator('#presence-scene>canvas').screenshot();const start=await page.evaluate(()=>({s:AsgardUI.status().render,t:performance.now()}));await page.waitForTimeout(3500);const b=await page.locator('#presence-scene>canvas').screenshot();const end=await page.evaluate(()=>({s:AsgardUI.status().render,t:performance.now()}));
  check(!a.equals(b),name+' visible idle geometry/particles change without hover');check(end.s.animationTime>start.s.animationTime+.3,name+' animation clock advances');samples.push({persona:name,frames:end.s.frames-start.s.frames,duration:end.t-start.t,fps:(end.s.frames-start.s.frames)*1000/(end.t-start.t),driver:end.s.driver});
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();await page.waitForFunction(()=>!AsgardUI.status().render.rafActive);const f=await page.evaluate(()=>AsgardUI.status().render.frames),still=await page.locator('#presence-scene>canvas').screenshot();await page.locator('#presence-scene>canvas').hover();await page.waitForTimeout(300);const still2=await page.locator('#presence-scene>canvas').screenshot();check(f===(await page.evaluate(()=>AsgardUI.status().render.frames))&&still.equals(still2),name+' pause freezes rendered canvas, including hover');
 }
 await page.getByRole('button',{name:'Resume motion',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!AsgardUI.status().render.rafActive);check(!(await page.evaluate(()=>AsgardUI.status().render.animated)),'OS reduced motion stops animation');
 return {checks,samples};
}
