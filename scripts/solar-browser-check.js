async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Pause motion first: autorotation would move an eye off the cursor between reading its position and hovering it.
 await page.evaluate(()=>localStorage.setItem('asgardfx:still','1'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AsgardUI?.status().render?.frames>0,{},{timeout:120000});
 const before=await page.evaluate(()=>AsgardUI.status().render);
 if(before.scene!=='solar-throne'||before.persona!=='odin'||before.advisors.length!==5)throw Error('Scene contract');
 if(before.renderScale>1.25||before.shadowMapSize!==1024||before.threeRevision!=='184')throw Error('Render budget');
 const labels=await page.evaluate(()=>[...document.querySelectorAll('.prism-label')].map(el=>({key:el.dataset.agentKey,name:el.querySelector('b').textContent,role:el.querySelector('small').textContent,plate:!!el.querySelector('.prism-plate'),opacity:el.style.opacity})));
 if(labels.length!==6||!labels.every(l=>l.plate))throw Error('Label plates');
 if(!labels.some(l=>l.key==='core'&&l.name==='ODIN'&&l.role.startsWith('ALL FATHER')))throw Error('Core label');
 if(!['VOLSTAGG','HEIMDALL','FANDRAL','HOGUN','FRIGGA'].every(n=>labels.some(l=>l.name===n)))throw Error('Agent labels');
 // Read the host box directly: actionability waits time out against a continuously animating canvas.
 const box=await page.evaluate(()=>{const r=document.getElementById('presence-scene').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
 const eye=(await page.evaluate(()=>AsgardUI.status().render.objects)).find(o=>o.id==='sapphire');
 await page.mouse.move(box.x+eye.x,box.y+eye.y);
 await page.waitForFunction(()=>AsgardUI.status().render.hover==='sapphire',{},{timeout:120000});
 await page.mouse.click(box.x+eye.x,box.y+eye.y);
 await page.waitForFunction(()=>AsgardUI.status().render.selected==='sapphire',{},{timeout:120000});
 const dialog=await page.locator('dialog[open]').textContent();if(!/Hogun/i.test(dialog))throw Error('Wrong advisor');
 await page.keyboard.press('Escape');
 const selectedBeforeDrag=await page.evaluate(()=>AsgardUI.status().render.selected);
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+80,box.y+box.height*.4+25,{steps:4});await page.mouse.up();
 let state=await page.evaluate(()=>AsgardUI.status().render);
 if(!state.hasDragged||state.autoRotate||state.selected!==selectedBeforeDrag)throw Error('Drag activated selection or failed');
 await page.screenshot({path:'output/solar/still-desktop.png',timeout:120000});
 // Resume motion and prove the scene advances under its own clock.
 await page.evaluate(()=>document.querySelector('[data-motion-toggle]').click());
 await page.waitForFunction(t=>AsgardUI.status().render.animationTime>t+.2,state.animationTime,{timeout:120000});
 state=await page.evaluate(()=>AsgardUI.status().render);
 await page.screenshot({path:'output/solar/animated-desktop.png',timeout:120000});
 const placed=await page.evaluate(()=>{const host=document.getElementById('presence-scene').getBoundingClientRect();
  return [...document.querySelectorAll('.prism-label')].map(el=>{const r=el.getBoundingClientRect();return {key:el.dataset.agentKey,inside:r.left>=host.left-1&&r.right<=host.right+1&&r.top>=host.top-1&&r.bottom<=host.bottom+1};});});
 if(!placed.every(l=>l.inside))throw Error('Label outside viewport: '+JSON.stringify(placed));
 return {labels:labels.length,selected:'hogun',hasDragged:state.hasDragged,autoRotate:state.autoRotate,animationTime:state.animationTime,frames:state.frames,errors};
}
