async page => {
 const errors=[],actions=[];page.on('pageerror',e=>errors.push(e.message));
 const at=new Date().toISOString(),revision='a'.repeat(64);
 const fixture={generatedAt:at,since:at,sources:{approvals:true,notifications:true,activity:true,ticks:true,calendar:true,todos:true},needsTotal:2,
  needs:[{id:'review:thor:1234',sourceId:'1234',persona:'thor',type:'REVIEW',revision,title:'Save a task',description:'Add the task Review the source',at},
    {id:'notice:'+'b'.repeat(24),persona:'loki',type:'NOTIFY',title:'Recorded reminder',description:'This is a browser-test fixture, not live activity.',at}],
  running:[{id:'test',persona:'thor',title:'Fixture work',percent:33,steps:[{title:'Read context',status:'done'},{title:'Process request',status:'in_progress'},{title:'Save reply',status:'pending'}]}],
  activity:[{persona:'loki',councillor:'miss_minutes',name:'MISS MINUTES',at,summary:'Fixture reminder recorded',detail:null}],
  halls:['thor','loki','odin'].map(id=>({id,historyAvailable:true,statusAvailable:true,pendingCount:id==='thor'?1:0,lastSaid:'Recorded fixture conversation for '+id,state:{task:'idle',at}})),
  glance:{nextEvent:{title:'Fixture review',date:'2026-09-09',time:'19:00',timeZone:'America/Los_Angeles'},openTodos:2,weather:null,extension:{connected:false,lastSeen:null},modelSpend:null}};
 let fail=false;
 await page.route('https://**',route=>route.abort());
 await page.addInitScript(()=>{window.SpeechRecognition=class{start(){window.__testMic=this;queueMicrotask(()=>this.onstart?.());}stop(){queueMicrotask(()=>this.onend?.());}abort(){queueMicrotask(()=>this.onend?.());}};});
 await page.route('**/bridge/state?*',route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.fulfill({json:fixture}));
 await page.route('**/bridge/review?*',route=>route.fulfill({json:{ok:true,revision,description:'Original fixture',fields:[{key:'text',label:'Task',type:'string',required:true,value:'Review the source'}]}}));
 await page.route('**/bridge/action',async route=>{const data=route.request().postDataJSON();actions.push(data);if(data.decision==='edit')fixture.needs[0].description='Edited: '+data.values.text;else{fixture.needs=fixture.needs.filter(n=>n.type!=='REVIEW');fixture.needsTotal--;}await route.fulfill({json:{ok:true,message:'Fixture action recorded'}});});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:4191/?bridge-check='+Date.now()+'#thor');
 await page.waitForFunction(()=>document.querySelectorAll('#bridge-inbox article').length===2);
 if(await page.locator('#bridge-main canvas').count())throw Error('Bridge starts WebGL by default');
 if(await page.locator('[data-pulse=true]').count()!==1)throw Error('Wrong pulse count');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Task',{exact:true}).fill('Edited task');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('dialog').open);
 if(actions.length!==1||actions[0].decision!=='edit'||actions[0].values.text!=='Edited task')throw Error('Edit did not preserve typed values');
 await page.getByRole('button',{name:'Approve',exact:true}).click();
 if(actions.length!==1)throw Error('Opening review executed it');
 await page.getByRole('dialog').getByRole('button',{name:'Approve',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#bridge-inbox article').length===1);
 if(actions.length!==2)throw Error('Approval submitted more than once');
 // A second question for the same job must remain visible after the first answer.
 const question={id:'question:job:first',sourceId:'job',persona:'thor',type:'QUESTION',revision:'first',title:'Which destination?',at};
 fixture.needs.unshift(question);fixture.needsTotal++;
 const answers=[];
 await page.route('**/bridge/answer',async route=>{answers.push(route.request().postDataJSON());fixture.needs[0]={...question,id:'question:job:second',revision:'second',title:'Which day?'};await route.fulfill({json:{ok:true,paused:true,message:'Fixture resumed',reply:'Which day?'}});});
 await page.evaluate(()=>AsgardBridge.refresh());
 await page.getByLabel('Your answer',{exact:true}).fill('Bakersfield');
 await page.getByRole('button',{name:'Answer',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 if(answers.length!==1||answers[0].answer!=='Bakersfield'||answers[0].revision!=='first')throw Error('Question did not submit its answer and revision');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('heading',{name:'Which day?',exact:true}).waitFor();
 if(await page.getByLabel('Your answer',{exact:true}).inputValue())throw Error('Previous answer leaked into the next question');
 await page.getByRole('button',{name:'Type',exact:true}).click();
 await page.getByLabel('Your message',{exact:true}).fill('Keep my fixture draft');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Type',exact:true}).click();
 if(await page.getByLabel('Your message',{exact:true}).inputValue()!=='Keep my fixture draft')throw Error('Draft lost');
 await page.keyboard.press('Escape');
 await page.keyboard.press('Control+k');
 if(!await page.getByRole('dialog').isVisible())throw Error('Keyboard command bar unavailable');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Talk',exact:true}).click();
 await page.waitForFunction(()=>AsgardBridge.status().recording);
 await page.getByRole('button',{name:'Stop microphone',exact:true}).click();
 await page.waitForFunction(()=>!AsgardBridge.status().recording);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Talk',exact:true}).click();
 await page.keyboard.press('Control+k');
 if(await page.evaluate(()=>AsgardBridge.status().recording))throw Error('Changing mode left the microphone running');
 await page.keyboard.press('Escape');
 await page.screenshot({path:'output/playwright/bridge-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({path:'output/playwright/bridge-phone.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('Phone overflows horizontally');
 fail=true;await page.evaluate(()=>AsgardBridge.refresh());
 await page.waitForFunction(()=>document.getElementById('bridge-freshness').textContent==='Records unavailable');
 if(await page.locator('#bridge-inbox article').count())throw Error('Failed refresh left actionable stale records');
 fail=false;await page.evaluate(()=>AsgardBridge.refresh());
 if(await page.locator('#bridge-error').isVisible())throw Error('Recovered fetch left old error visible');
 if(errors.length)throw Error(JSON.stringify(errors));
 return {desktop:true,phone:true,edit:true,approve:true,draftPreserved:true,commands:true,questionResume:true,failureRecovery:true,actions:actions.length,applicationErrors:errors};
}
