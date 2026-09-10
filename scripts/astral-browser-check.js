async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'Reset 3D view',exact:true}).click();
 const before=await page.evaluate(()=>AsgardUI.status().render);
 if(before.scene!=='astral-cartographer'||before.advisors.length!==5||before.renderScale>1.25||before.shadowMapSize!==1024)throw Error('Scene contract');
 const box=await page.locator('#presence-scene').boundingBox(),bolt=before.objects.find(o=>o.id==='sapphire');
 await page.mouse.move(box.x+bolt.x,box.y+bolt.y);
 await page.waitForFunction(()=>AsgardUI.status().render.hover==='sapphire',{},{timeout:90000});
 await page.mouse.click(box.x+bolt.x,box.y+bolt.y);
 await page.waitForFunction(()=>AsgardUI.status().render.selected==='sapphire',{},{timeout:90000});
 const dialog=await page.locator('dialog[open]').textContent();if(!dialog.includes('Valkyrie'))throw Error('Wrong advisor');await page.keyboard.press('Escape');const selectedBeforeDrag=await page.evaluate(()=>AsgardUI.status().render.selected);
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+80,box.y+box.height*.4+25,{steps:4});await page.mouse.up();
 let state=await page.evaluate(()=>AsgardUI.status().render);if(!state.hasDragged||state.autoRotate||state.selected!==selectedBeforeDrag)throw Error('Drag activated selection or failed');
 await page.getByRole('button',{name:'Resume motion',exact:true}).click();
 await page.waitForFunction(t=>AsgardUI.status().render.animationTime>t+.2,state.animationTime,{timeout:90000});
 await page.evaluate(()=>document.querySelector('[data-motion-toggle]').click());
 state=await page.evaluate(()=>AsgardUI.status().render);
 await page.screenshot({path:'output/astral/animated-desktop.png',timeout:90000});
 return {selected:'Valkyrie',hasDragged:state.hasDragged,autoRotate:state.autoRotate,animationTime:state.animationTime,errors};
}
