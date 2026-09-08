async page => {
 const checks=[];const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>window.AsgardUI?.status().render?.ready);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#still-setting').check();await page.locator('#output-setting').uncheck();await page.keyboard.press('Escape');
 // Browser executes the production stream decoder against a deliberately slow fixture.
 // No provider, microphone, tool execution or production mutation.
 await page.evaluate(()=>{
   const previous=window.fetch.bind(window);
   window.fetch=async(url,options)=>{
     if(options?.method!=='POST')return previous(url,options);
     const encoder=new TextEncoder();let timer;
     const body=new ReadableStream({start(controller){
       controller.enqueue(encoder.encode('event: text\ndata: {"text":"First words"}\n\n'));
       timer=setTimeout(()=>{controller.enqueue(encoder.encode('event: text\ndata: {"text":" arrive progressively."}\n\nevent: done\ndata: {"reply":"First words arrive progressively.","persona":"thor"}\n\n'));controller.close();},1500);
       options.signal?.addEventListener('abort',()=>{clearTimeout(timer);controller.error(new DOMException('Aborted','AbortError'));},{once:true});
     },cancel(){clearTimeout(timer);}});
     return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
   };
 });
 await page.locator('#in-thor').fill('Local stream check');await page.locator('#in-thor').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#tx-thor .msg:last-child .bubble')?.textContent.includes('First words')).catch(async()=>{await page.getByText('First words',{exact:true}).waitFor();});
 check(await page.getByText('First words',{exact:true}).count()===1,'Partial text visible before final receipt');
 check(await page.locator('#tx-thor .copy-response').count()===0,'Partial text is not labeled completed');
 await page.locator('#tx-thor .copy-response').waitFor();
 check(await page.getByText('First words arrive progressively.',{exact:true}).count()===1,'Final reply replaces partial rendering');
 await page.locator('#in-thor').fill('Cancel local stream');await page.locator('#in-thor').press('Enter');
 await page.getByText('First words',{exact:true}).waitFor();await page.locator('#hall-thor .cancel-reply').click();
 await page.waitForTimeout(1700);
 check(await page.locator('#tx-thor .copy-response').count()===1,'Cancelled stream cannot append a late completed reply');
 check(await page.locator('#presence-scene canvas').count()===1,'Existing rendered realm remains mounted');
 return {kind:'local fixture browser; not provider latency evidence',checks};
}
