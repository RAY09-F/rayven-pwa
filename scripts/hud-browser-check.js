async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>window.AsgardHUD,{},{timeout:120000});
 await page.waitForTimeout(2500);
 const art=await page.evaluate(()=>{const a=document.querySelector('.hud-art').getBoundingClientRect();return {w:Math.round(a.width),h:Math.round(a.height)};});
 if(art.w!==1600||art.h!==900)throw Error('Artboard is '+art.w+'x'+art.h);
 // The handoff requires the left column to fit the 746px body row exactly.
 const fit=await page.evaluate(()=>({left:document.querySelector('.col-left').scrollHeight,body:Math.round(document.querySelector('.body').getBoundingClientRect().height)}));
 if(fit.left>fit.body)throw Error('Left column overflows: '+JSON.stringify(fit));
 // Micro-labels must never wrap mid-phrase.
 const wrap=await page.evaluate(()=>[...document.querySelectorAll('.micro,.left-tag div,.foot-lines div,.bottom-tag div,.realm-index,.desk-title,.desk-meta,.stat .k,.stat .v,.desk-row .k,.desk-row .v,.tel .t,.stage-label,.rule-txt,.plate .sub,.callout .tag,.send-row div,.stage-side')].filter(e=>getComputedStyle(e).whiteSpace!=='nowrap').length);
 if(wrap)throw Error(wrap+' micro-labels are not nowrap');
 const seen={};
 for(const realm of ['thor','loki','odin']){
  await page.evaluate(r=>document.querySelector(`.pill[data-realm="${r}"]`).click(),realm);
  await page.waitForFunction(r=>AsgardHUD.realm===r,realm,{timeout:120000});
  await page.waitForTimeout(1800);
  const s=await page.evaluate(()=>{
   const cs=getComputedStyle(document.documentElement);
   return {realm:AsgardHUD.realm,scene:AsgardHUD.status().scene,live:AsgardHUD.status().live,
    acc:cs.getPropertyValue('--acc').trim(),display:cs.getPropertyValue('--display').trim(),
    hash:location.hash,stored:localStorage.getItem('asgard:hud-realm'),
    canvases:document.querySelectorAll('canvas').length,
    members:document.querySelectorAll('.member').length,stats:document.querySelectorAll('.stat').length,
    pressed:[...document.querySelectorAll('.pill')].filter(p=>p.getAttribute('aria-pressed')==='true').map(p=>p.dataset.realm)};
  });
  const want={thor:'#7bb0ff',loki:'#3ddc84',odin:'#e8c06a'}[realm];
  if(s.acc!==want)throw Error(realm+' --acc is '+s.acc);
  if(s.hash!=='#'+realm||s.stored!==realm)throw Error(realm+' deep-link/persist failed: '+JSON.stringify(s));
  if(s.canvases!==1)throw Error(realm+' has '+s.canvases+' canvases');
  if(s.scene!==realm||!s.live)throw Error(realm+' council scene not mounted');
  if(s.members!==5||s.stats!==4)throw Error(realm+' roster/desk wrong');
  if(s.pressed.length!==1||s.pressed[0]!==realm)throw Error(realm+' switcher state wrong');
  await page.screenshot({path:`output/hud/${realm}.png`,timeout:120000});
  seen[realm]={acc:s.acc,display:s.display,scene:s.scene};
 }
 // One toggle freezes every animation in the HUD.
 const count=n=>page.evaluate(()=>{const a=[...document.querySelectorAll('.hud-art,.hud-art *')].filter(x=>getComputedStyle(x).animationName!=='none');
  return {total:a.length,paused:a.filter(x=>getComputedStyle(x).animationPlayState==='paused').length};});
 const before=await count();
 await page.evaluate(()=>AsgardHUD.setMotion(false));await page.waitForTimeout(300);
 const after=await count();
 if(before.paused!==0||after.paused!==after.total||!after.total)throw Error('Freeze failed: '+JSON.stringify({before,after}));
 await page.evaluate(()=>AsgardHUD.setMotion(true));
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);
 const reduced=await count();
 if(reduced.paused!==reduced.total)throw Error('Reduced motion did not pause');
 await page.emulateMedia({reducedMotion:'no-preference'});
 return {art,fit,animated:after.total,realms:seen,errors};
}
