async page => {
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(async()=>{
  for(const image of document.querySelectorAll('[data-hall-art]')){const canvas=document.createElement('canvas');canvas.className=image.className;canvas.dataset.hallArt=image.dataset.hallArt;canvas.width=300;canvas.height=160;canvas.setAttribute('aria-hidden','true');image.replaceWith(canvas);}
  await (await import('/ui/bridge/hall-previews.js')).renderHallPreviews();
 });
 for(const id of ['thor','loki','odin']){
  const target=page.locator(`[data-hall-art="${id}"]`);
  if(await target.getAttribute('data-render')!=='webgl-preview')throw Error('Unrendered '+id);
  await target.screenshot({path:`public/ui/bridge/hall-${id}.png`,omitBackground:true,style:'.bridge-command{visibility:hidden!important}body,.bridge-hall{background:transparent!important}'});
 }
 return {captured:['thor','loki','odin'],controlsExcluded:true};
}
