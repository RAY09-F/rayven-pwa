async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>localStorage.setItem('asgardfx:still','1'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AsgardUI?.status().render?.frames>0,{},{timeout:90000});
 const before=await page.evaluate(()=>AsgardUI.status().render);
 if(before.scene!=='prism-foundry'||before.threeRevision!=='184'||before.advisors.length!==5)throw Error('Scene contract failed');
 const box=await page.locator('#presence-scene').boundingBox(),gem=before.objects.find(x=>x.id==='sapphire');
 await page.mouse.move(box.x+gem.x,box.y+gem.y);
 await page.waitForFunction(()=>AsgardUI.status().render.hover==='sapphire',{},{timeout:60000});
 await page.mouse.click(box.x+gem.x,box.y+gem.y);
 await page.waitForFunction(()=>AsgardUI.status().render.selected==='sapphire',{},{timeout:60000});
 const selected=await page.evaluate(()=>({render:AsgardUI.status().render.selected,dialog:[...document.querySelectorAll('dialog[open]')].map(d=>d.textContent.slice(0,150))}));
 await page.keyboard.press('Escape');
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+65,box.y+box.height*.45+20,{steps:3});await page.mouse.up();
 const dragged=await page.evaluate(()=>AsgardUI.status().render);
 if(!dragged.hasDragged||dragged.autoRotate)throw Error('Drag failed to stop autorotate');
 await page.screenshot({path:'output/prism-desktop.png',timeout:90000});
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>AsgardUI.status().render.width<400,{},{timeout:90000});
 const mobile=await page.evaluate(()=>{const host=document.querySelector('#presence-scene').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,contained:[...document.querySelectorAll('.prism-label')].every(el=>{const r=el.getBoundingClientRect();return r.left>=host.left&&r.right<=host.right&&r.top>=host.top&&r.bottom<=host.bottom;})};});
 if(mobile.overflow||!mobile.contained)throw Error('Mobile label bounds failed');
 await page.screenshot({path:'output/prism-mobile.png',timeout:90000});
 await page.evaluate(()=>{document.querySelector('[data-go=thor]').click();document.querySelector('[data-go=odin]').click();document.querySelector('[data-go=loki]').click();});
 await page.waitForFunction(()=>AsgardUI.status().render?.scene==='prism-foundry'&&AsgardUI.status().render?.frames>0,{},{timeout:90000});
 const lifecycle=await page.evaluate(()=>({canvases:document.querySelectorAll('#presence-scene > canvas').length,labels:document.querySelectorAll('.prism-label').length,persona:AsgardUI.status().render.persona}));
 if(lifecycle.canvases!==1||lifecycle.labels!==6||lifecycle.persona!=='loki')throw Error('Rapid hall switch lost the last selection');
 return {lifecycle,mobile,selected,dragged:{hasDragged:dragged.hasDragged,autoRotate:dragged.autoRotate},errors};
}
