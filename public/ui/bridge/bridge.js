import {THEMES} from '../hud/hud-config.js';

const $=id=>document.getElementById(id);
const renderPreviews=new URLSearchParams(location.search).get('renderHallPreviews')==='1';
const realms=['thor','loki','odin'];
const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=value;return e;};
const button=(label,fn,cls='')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
const link=(label,href)=>{const a=node('a','',label);a.href=href;return a;};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const date=value=>{const d=new Date(value);return value&&Number.isFinite(+d)?d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable';};
let persona=location.hash.slice(1),snapshot=null,request=null,timer=0,disposed=false,recording=null,recordingMode=null;
if(!realms.includes(persona))persona=read('asgard:bridge:persona','odin');
if(!realms.includes(persona))persona='odin';
const visit=Date.now(),since=Math.min(visit,Math.max(0,Number(read('asgard:bridge:left',0))||0));
let dismissed=read('asgard:bridge:dismissed',[]);if(!Array.isArray(dismissed))dismissed=[];
const busy=new Set(),resolved=new Set(),drafts=new Map(),hallNodes=new Map();
let lastFocus=null,dialogMode=null,dialogVersion=0,readFailure=false;
const dialog=node('dialog');dialog.setAttribute('aria-labelledby','bridge-dialog-title');document.body.append(dialog);
function closeDialog(){dialogVersion++;recording?.abort();recording=null;dialog.close();dialogMode=null;setMic('Microphone off');lastFocus?.isConnected&&lastFocus.focus();}
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
function openDialog(title,mode){if(recording){recording.abort();recording=null;setMic('Microphone off');}dialogVersion++;lastFocus=document.activeElement;dialogMode=mode;dialog.replaceChildren();const heading=node('h2','',title);heading.id='bridge-dialog-title';dialog.append(heading);if(!dialog.open)dialog.showModal();return dialog;}
function setRealm(id){if(!realms.includes(id))return;persona=id;document.documentElement.dataset.realm=id;$('bridge-persona').value=id;save('asgard:bridge:persona',id);history.replaceState(null,'','#'+id);}
setRealm(persona);window.addEventListener('hashchange',()=>setRealm(location.hash.slice(1)));
$('bridge-persona').addEventListener('change',event=>setRealm(event.target.value));
$('activity-period').textContent=since?'After '+date(since):'Recent recorded activity';

// Conversation stays in the hall. A Bridge draft is transferred once and never
// submitted automatically, so navigation cannot execute a tool or incur a call.
function enterHall(text='',id=persona){
  if(text.trim()) {
    try{sessionStorage.setItem('asgard:bridge:draft',JSON.stringify({persona:id,text,at:Date.now()}));}
    catch{throw Error('The browser could not keep your draft. Copy it before opening the hall.');}
  }
  location.href='/hall/#'+id;
}
function composer(initial='',id=persona){
  const body=openDialog('Talk with '+id[0].toUpperCase()+id.slice(1),'compose');
  const label=node('label','','Your message');label.htmlFor='bridge-draft';const input=node('textarea');input.id='bridge-draft';input.value=initial||drafts.get(id)||'';
  input.addEventListener('input',()=>drafts.set(id,input.value));
  const error=node('p','bridge-detail');error.setAttribute('role','alert');
  const actions=node('div','bridge-actions');actions.append(button('Continue in '+id,()=>{try{enterHall(input.value,id);}catch(e){error.textContent=e.message;}},'bridge-primary'),button('Cancel',closeDialog));
  body.append(label,input,node('p','bridge-detail','Your conversation and spoken replies stay in the hall. You can review this message before sending.'),error,actions);input.focus();return input;
}
$('bridge-type').addEventListener('click',()=>composer());
function commands(){
  const body=openDialog('Where would you like to go?','commands');
  const list=node('div','bridge-command-list');
  for(const id of realms)list.append(link('Open '+id[0].toUpperCase()+id.slice(1)+'’s hall','/hall/#'+id));
  list.append(link('Tools and council','/hall/?tools=1#'+persona),link('Council HUD','/hud/#'+persona));
  body.append(list,node('p','bridge-detail','Choose a room or open the existing tools panel.'),button('Close',closeDialog));
}
$('bridge-commands').addEventListener('click',commands);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'||e.key==='/'&&!e.target.closest('input,textarea,select,[contenteditable=true]')){e.preventDefault();commands();}});
function setMic(message){$('bridge-command-state').textContent=message;$('bridge-talk').setAttribute('aria-pressed',String(!!recording));const state=dialog.querySelector('[data-mic-state]');if(state)state.textContent=message;}
function talk(){
  if(recording){recording.stop();return;}
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const input=composer('',persona);
  if(!Recognition){setMic('Voice input unavailable here; type instead.');return;}
  const r=new Recognition();recording=r;r.continuous=true;r.interimResults=true;
  const state=node('p','bridge-detail');state.dataset.micState='';state.setAttribute('role','status');
  dialog.append(state,button('Stop microphone',()=>recording?.stop()));
  const base=input.value;
  setMic('Waiting for microphone permission…');
  r.onstart=()=>{if(recording===r)setMic('Listening — tap Talk to finish');};
  r.onresult=event=>{if(recording!==r)return;let words='';for(let i=0;i<event.results.length;i++)words+=event.results[i][0].transcript+' ';input.value=[base,words.trim()].filter(Boolean).join(' ');drafts.set(persona,input.value);};
  r.onerror=event=>{if(recording!==r)return;recording=null;setMic(event.error==='not-allowed'?'Microphone permission denied. You can type instead.':'Voice input stopped. Your words remain in the draft.');};
  r.onend=()=>{if(recording!==r)return;recording=null;setMic('Microphone off — review your words');input.focus();};
  try{r.start();}catch{recording=null;setMic('Microphone could not start. You can type instead.');}
}
$('bridge-talk').addEventListener('click',()=>{if(recordingMode==='hold'){recordingMode=null;return;}talk();});
let holdTimer=0;
$('bridge-talk').addEventListener('pointerdown',event=>{if(event.button!==0||recording)return;holdTimer=setTimeout(()=>{recordingMode='hold';talk();},350);});
window.addEventListener('pointerup',()=>{clearTimeout(holdTimer);if(recordingMode==='hold')recording?.stop();});
window.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);recordingMode=null;recording?.stop();});

async function act(item,decision,values){
  if(busy.has(item.id))return;busy.add(item.id);renderInbox();
  try {
    const response=await fetch('/bridge/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.sourceId,persona:item.persona,decision,revision:item.revision,values}),signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok||!data.ok)throw Error(data.message||data.error||'The action could not be confirmed. Refresh before retrying.');
    if(decision!=='edit')resolved.add(item.id);$('bridge-error').hidden=false;$('bridge-error').textContent=data.message;
    await refresh();
    return true;
  }catch(e){$('bridge-error').hidden=false;$('bridge-error').textContent=e.message;return false;}
  finally{busy.delete(item.id);renderInbox();}
}
function review(item){
  const body=openDialog('Review this exact action','review');body.append(node('p','',item.description||item.title));
  if(item.provenance)body.append(node('p','bridge-detail',item.provenance));
  const actions=node('div','bridge-actions');actions.append(button('Approve',()=>{closeDialog();act(item,'approve');},'bridge-primary'),button('Keep waiting',closeDialog));body.append(actions);
}
async function edit(item){
  const body=openDialog('Edit the proposed action','edit'),status=node('p','bridge-detail','Reading the saved proposal…');status.setAttribute('role','status');body.append(status,button('Cancel',closeDialog));const version=dialogVersion;
  try {
    const response=await fetch('/bridge/review?'+new URLSearchParams({id:item.sourceId,persona:item.persona}),{cache:'no-store',signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok||!data.ok)throw Error(data.message||'The proposal could not be read.');
    if(dialogMode!=='edit'||!dialog.open||version!==dialogVersion)return;
    status.textContent='Saving changes does not approve or run the action.';const fields=[];
    for(const field of data.fields){
      const label=node('label','',field.label);label.htmlFor='edit-'+field.key;
      let input;if(field.type==='boolean'||field.options){input=node('select');const options=field.options||[true,false];if(!field.required){const empty=node('option','','Not set');empty.value='';input.append(empty);}for(const value of options){const option=node('option','',String(value));option.value=String(value);input.append(option);}}
      else if(['number','integer'].includes(field.type)){input=node('input');input.type='number';input.step=field.type==='integer'?'1':'any';}
      else{input=node('textarea');input.rows=3;input.style.minHeight='90px';}
      input.id=label.htmlFor;input.value=field.value==null?'':String(field.value);input.required=field.required;fields.push({field,input});body.append(label,input);if(field.description)body.append(node('p','bridge-detail',field.description));
    }
    const error=node('p','bridge-detail');error.setAttribute('role','alert');
    const submit=button('Save changes',async()=>{
      const values={};for(const {field,input} of fields){if(!input.reportValidity())return;values[field.key]=input.value===''&&!field.required?null:field.type==='boolean'?input.value==='true':['number','integer'].includes(field.type)?Number(input.value):input.value;}
      submit.disabled=true;const ok=await act({...item,revision:data.revision},'edit',values);submit.disabled=false;if(ok)closeDialog();else error.textContent=$('bridge-error').textContent;
    },'bridge-primary');
    body.append(error,node('p','bridge-detail','Unlisted options stay unchanged.'),submit);
    if(!fields.length){submit.disabled=true;error.textContent='This proposal has no fields that can be edited here.';body.append(button('Revise in the hall',()=>composer('Please revise approval #'+item.sourceId+' before it runs. My change: ',item.persona)));}
  }catch(error){if(dialogMode==='edit'&&version===dialogVersion)status.textContent=error.message;}
}
function dismiss(item){dismissed=[...new Set([...dismissed,item.id])].slice(-200);save('asgard:bridge:dismissed',dismissed);renderInbox();refresh();}
function renderInbox(){
  const host=$('bridge-inbox');host.setAttribute('aria-busy',String(!snapshot));host.replaceChildren();
  if(!snapshot){host.append(node('p','bridge-empty','Checking for things that need your attention…'));return;}
  const items=snapshot.needs.filter(item=>!dismissed.includes(item.id)&&!resolved.has(item.id)).slice(0,5);
  $('needs-count').textContent=snapshot.needsTotal==null?'Some records unavailable':snapshot.needsTotal===0?'Clear':snapshot.needsTotal+' waiting';
  if(!items.length)host.append(node('p','bridge-empty',snapshot.needsTotal==null?'Your inbox could not be fully read. Try Refresh.':'Nothing needs you right now. You’re caught up.'));
  for(const item of items){
    const card=node('article','bridge-card');card.dataset.item=item.id;const head=node('div','bridge-card-header');
    head.append(node('span','bridge-kind',item.type),node('span','bridge-owner',item.councillor||item.persona?.toUpperCase()||'ASGARD'),node('time','bridge-time',date(item.at)));
    card.append(head,node('h3','',item.title));
    if(item.description&&item.description!==item.title)card.append(node('p','',item.description));
    if(item.provenance)card.append(node('p','bridge-detail',item.provenance));
    const actions=node('div','bridge-actions');
    if(item.type==='REVIEW')actions.append(button('Approve',()=>review(item),'bridge-primary'),button('Edit',()=>edit(item)),button('Reject',()=>act(item,'reject')));
    else if(item.type==='QUESTION') {
      const label=node('label','','Your answer');const input=node('input');input.id='answer-'+item.id;label.htmlFor=input.id;input.value=drafts.get(item.id)||'';input.addEventListener('input',()=>drafts.set(item.id,input.value));
      actions.append(label,input,button('Answer',()=>{if(input.value.trim())composer(input.value,item.persona);}));
    } else actions.append(button('Dismiss',()=>dismiss(item)),link('Open',item.persona?'/hall/#'+item.persona:'/hud/#'+persona));
    if(busy.has(item.id))for(const b of actions.querySelectorAll('button'))b.disabled=true;
    card.append(actions);host.append(card);
  }
}
function renderPlans(){
  const plans=snapshot?.running||[];$('bridge-running').hidden=plans.length===0;$('bridge-plans').replaceChildren();let pulse=false;
  for(const plan of plans){const card=node('article','bridge-card bridge-plan');card.append(node('span','bridge-owner',plan.persona.toUpperCase()),node('h3','',plan.title),node('p','bridge-detail',plan.percent+'% of recorded steps complete'));const progress=node('progress');progress.max=100;progress.value=plan.percent;progress.setAttribute('aria-label',plan.title+' progress');const list=node('ol');
    for(const step of plan.steps){const li=node('li','',step.title);li.dataset.status=step.status;if(step.status==='in_progress'&&!pulse){li.dataset.pulse='true';pulse=true;}list.append(li);}card.append(progress,list);$('bridge-plans').append(card);}
}
function renderActivity(){
  const host=$('bridge-activity'),opened=new Set([...host.querySelectorAll('details[open]')].map(e=>e.dataset.group));host.replaceChildren();
  if(!snapshot.activity.length){host.append(node('p','bridge-empty',snapshot.sources.activity&&snapshot.sources.ticks?'No new recorded council activity.':'Council activity is unavailable or incomplete.'));return;}
  const groups=new Map();for(const item of snapshot.activity){const key=item.councillor||item.persona;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  for(const [key,rows] of groups){const group=node('details','bridge-history-group');group.dataset.group=key;group.open=opened.has(key);const title=node('summary','',rows[0].name);title.append(node('span','',rows.length+' recorded · '+date(rows[0].at)));const list=node('ul');for(const row of rows){const li=node('li');li.append(node('time','bridge-time',date(row.at)),node('p','',(row.paper?'PAPER / SIM · ':'')+row.summary));if(row.detail)li.append(node('p','bridge-detail',row.detail));list.append(li);}group.append(title,list);host.append(group);}
}
for(const id of realms){const card=node('article','bridge-hall');card.style.setProperty('--hall-accent',THEMES[id].vars['--acc']);const art=node(renderPreviews?'canvas':'img','bridge-hall-art');art.width=300;art.height=160;if(!renderPreviews){art.src='/ui/bridge/hall-'+id+'.png';art.alt='';art.loading='lazy';}art.dataset.hallArt=id;art.setAttribute('aria-hidden','true');const title=node('h3','',id.toUpperCase()),state=node('p','bridge-detail','Reading status…'),quote=node('blockquote','','Reading conversation…'),pending=node('p','bridge-detail');card.append(art,title,state,quote,pending,link('Enter '+id+'’s hall →','/hall/#'+id));$('bridge-halls').append(card);hallNodes.set(id,{state,quote,pending});}
function renderHalls(){for(const hall of snapshot.halls){const view=hallNodes.get(hall.id);if(!view)continue;view.state.textContent=hall.state?.task?'Last recorded: '+hall.state.task+' · '+date(hall.state.at):hall.statusAvailable?'No recorded current task':'Status unavailable';view.quote.textContent=hall.lastSaid||(hall.historyAvailable?'No conversation recorded yet.':'Conversation unavailable.');view.pending.textContent=hall.pendingCount==null?'Review count unavailable':hall.pendingCount+' awaiting review';}}
function renderGlance(){const host=$('bridge-glance'),g=snapshot.glance;host.replaceChildren();const entries=[
  ['Next calendar event',g.nextEvent?g.nextEvent.title:snapshot.sources.calendar?'No upcoming event':'Unavailable',g.nextEvent?[g.nextEvent.date,g.nextEvent.time,g.nextEvent.timeZone].filter(Boolean).join(' · '):'Stored ASGARD calendar'],
  ['Open to-dos',g.openTodos==null?'Unavailable':String(g.openTodos),''],
  ['Weather',g.weather?.text||'Unavailable',g.weather?'Recorded '+date(g.weather.at):'No saved weather result'],
  ['Browser',g.extension?g.extension.connected?'Linked':'Disconnected':'Unavailable',g.extension?.lastSeen?'Last seen '+date(g.extension.lastSeen):''],
  ['Today’s model usage',g.modelSpend?'$'+g.modelSpend.usd.toFixed(4):'Unavailable',g.modelSpend?g.modelSpend.day+' UTC · Estimated. '+g.modelSpend.basis:'No current cost record']
];for(const [title,value,note] of entries){const item=node('div');item.append(node('dt','',title));const desc=node('dd','',value);if(note)desc.append(node('small','',note));item.append(desc);host.append(item);}}
async function refresh(){
  if(disposed||request)return;request=new AbortController();$('bridge-refresh').disabled=true;
  try{const q=new URLSearchParams({since:String(since),dismissed:dismissed.filter(id=>/^notice:[a-f0-9]{24}$/.test(id)).join(',')});const response=await fetch('/bridge/state?'+q,{cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});if(!response.ok)throw Error('The Bridge could not read your records.');const data=await response.json();if(!data.sources||!Array.isArray(data.needs)||!Array.isArray(data.halls)||!Array.isArray(data.activity)||!Array.isArray(data.running)||!data.glance)throw Error('The Bridge received an incomplete response.');snapshot=data;if(readFailure){$('bridge-error').hidden=true;readFailure=false;}$('bridge-freshness').textContent='Updated '+date(data.generatedAt);renderInbox();renderPlans();renderActivity();renderHalls();renderGlance();}
  catch(e){if(disposed)return;readFailure=true;snapshot={needs:[],needsTotal:null,running:[],activity:[],sources:{},halls:realms.map(id=>({id})),glance:{}};renderInbox();renderPlans();renderActivity();renderHalls();renderGlance();$('bridge-error').hidden=false;$('bridge-error').textContent=e.message+' Your conversations are still available in the halls.';$('bridge-freshness').textContent='Records unavailable';}
  finally{request=null;$('bridge-refresh').disabled=false;clearTimeout(timer);if(!disposed&&!document.hidden)timer=setTimeout(refresh,60000);}
}
$('bridge-refresh').addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){save('asgard:bridge:left',Date.now());recording?.stop();}else refresh();});
addEventListener('pagehide',()=>{save('asgard:bridge:left',Date.now());disposed=true;clearTimeout(timer);clearTimeout(holdTimer);request?.abort();recording?.abort();});
addEventListener('pageshow',e=>{if(e.persisted){disposed=false;refresh();}});
window.AsgardBridge={refresh,status:()=>({persona,since,loaded:!!snapshot,recording:!!recording})};
refresh();
if(renderPreviews)import('./hall-previews.js').then(m=>m.renderHallPreviews()).catch(()=>{});
