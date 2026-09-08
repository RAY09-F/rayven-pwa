async page=>{
 page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 const checks=[],errors=[],pictures=[],renders=[],check=(v,l)=>{if(!v)throw Error(l);checks.push(l);};
 page.on('request',r=>{if(/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(r.url()))pictures.push(r.url());});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:4173/?fixture=1');await page.reload();
 const settled=()=>page.waitForFunction(()=>window.AsgardUI?.status().render?.ready&&!AsgardUI.status().render.rafActive);
 const status=()=>page.evaluate(()=>AsgardUI.status().render);
 const project=async (id)=>page.evaluate(async id=>{const T=await import('/ui/vendor/three.module.min.js'),s=AsgardUI.status().render,r=document.querySelector('#presence-scene>canvas').getBoundingClientRect(),c=new T.PerspectiveCamera(36,r.width/r.height,.1,90);c.position.fromArray(s.cameraPosition);c.lookAt(0,3.15,0);c.updateMatrixWorld();const o=s.objects.find(o=>o.id===id),p=new T.Vector3(...o.position);p.y+=id==='center'?1.5:1.7;p.project(c);return{x:r.x+(p.x*.5+.5)*r.width,y:r.y+(-p.y*.5+.5)*r.height};},id);
 const labels=async()=>page.locator('#council-dock button').evaluateAll(async es=>{const T=await import('/ui/vendor/three.module.min.js'),s=AsgardUI.status().render,c=new T.PerspectiveCamera(36,s.width/s.height,.1,90);c.position.fromArray(s.cameraPosition);c.lookAt(0,3.15,0);c.updateMatrixWorld();const b=es[0].parentElement.getBoundingClientRect(),rs=es.map(e=>e.getBoundingClientRect());const tips=es.map(e=>{const o=s.objects.find(o=>o.id===e.dataset.advisor),p=new T.Vector3(...o.position);p.y+=.8+1.55*1.16;p.project(c);return b.y+(-p.y*.5+.5)*b.height;});return{clear:rs.every((r,i)=>r.bottom+5<=tips[i]),inside:rs.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom),overlap:rs.some((a,i)=>rs.some((b,j)=>i<j&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),names:es.map(e=>e.textContent.trim())};});
 await settled();
 for(const width of [page.viewportSize().width]){await page.setViewportSize({width,height:width===1440?900:844});for(const persona of ['Thor','Loki','Odin']){
  await page.getByRole('button',{name:persona,exact:true}).click();await settled();let s=await status();check(s.ready&&s.objects.length===6,persona+' genuine WebGL and six objects at '+width);let l=await labels();check(l.inside&&!l.overlap&&l.clear,persona+' five names fit at '+width);renders.push({viewportWidth:width,...s});
  await page.screenshot({path:`output/playwright/floating-${persona.toLowerCase()}-${width}.png`,fullPage:true});
  for(const id of s.objects.map(o=>o.id)){
   const before=await status(),p=await project(id);await page.mouse.move(p.x,p.y);await page.mouse.down();let down=await status();check(down.dragTarget===id,persona+' raycast selects '+id+' at '+width);
   await page.mouse.move(p.x+80,p.y-65,{steps:3});await page.mouse.up();await settled();const after=await status();check(JSON.stringify(before.view)===JSON.stringify(after.view)&&JSON.stringify(before.cameraPosition)===JSON.stringify(after.cameraPosition),persona+' camera fixed dragging '+id+' at '+width);check(after.objects.filter((o,i)=>JSON.stringify(o.position)!==JSON.stringify(before.objects[i].position)).map(o=>o.id).join()===id,persona+' only '+id+' moves at '+width);check(!after.dragTarget,persona+' pointer released '+id+' at '+width);
   const l=await labels();check(l.inside&&!l.overlap&&l.clear,persona+' names fit after '+id+' max drag at '+width);
  }
  await page.screenshot({path:`output/playwright/floating-${persona.toLowerCase()}-${width}-dragged.png`,fullPage:true});
  for(const id of s.objects.map(o=>o.id)){const p=await project(id);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x-160,p.y+130,{steps:2});await page.mouse.up();await settled();const l=await labels();check(l.inside&&!l.overlap&&l.clear,persona+' names clear at opposite '+id+' drag bound at '+width);}
  await page.screenshot({path:`output/playwright/floating-${persona.toLowerCase()}-${width}-opposite.png`,fullPage:true});
  await page.getByRole('button',{name:'Arrange',exact:true}).click();await page.getByRole('button',{name:'Reset layout',exact:true}).click();await page.getByRole('button',{name:'Arrange',exact:true}).click();await settled();check(JSON.stringify((await status()).objects)===JSON.stringify(s.objects),persona+' reset restores all objects at '+width);
 }}
 check(errors.length===0,'No WebGL shader or JavaScript errors');check(pictures.length===0,'No raster scene images requested');return {checks,errors,pictures,renders};
}
