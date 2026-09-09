async page => {
 await page.unrouteAll({behavior:'wait'});
 await page.route('**/hud/summary',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.route('**/history?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({persona:'loki',turns:[{role:'assistant',text:'Long recorded response. '.repeat(600)}]})}));
 await page.goto('http://127.0.0.1:4191/?motion=false&check=history-layout#loki',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('.msgs')?.textContent.includes('Long recorded response'),null,{timeout:90000});
 const result=await page.evaluate(()=>{const m=document.querySelector('.msgs'),c=document.querySelector('.col-right'),a=document.querySelector('.composer');return {scrollable:m.scrollHeight>m.clientHeight,columnFits:c.scrollHeight<=c.clientHeight+1,linkVisible:a.getBoundingClientRect().bottom<=c.getBoundingClientRect().bottom};});
 if(!result.scrollable||!result.columnFits||!result.linkVisible)throw Error(JSON.stringify(result));
 return result;
}
