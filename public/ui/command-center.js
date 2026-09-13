const $=id=>document.getElementById(id),services=new Map();
const money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD'}):'Unavailable';
function tile(label,value){const a=document.createElement('article'),s=document.createElement('small'),b=document.createElement('strong');s.textContent=label;b.textContent=value;a.append(s,b);return a;}
function service(id,label,value,note,tone='unknown'){
 let a=services.get(id);if(!a){a=tile(label,value);a.className='service';a.append(document.createElement('p'));services.set(id,a);$('services').append(a);}
 a.querySelector('strong').textContent=value;a.querySelector('p').textContent=note;a.dataset.tone=tone;
}
async function read(url,headers={}){const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
let busy=false,healthChecked=0;
async function paper(){
 try{const s=await read('/paper-trading/status'),v=s.valuation,h=s.scheduler;
  $('metrics').replaceChildren(tile('Marked PAPER equity',money(v?.equity)),tile('Available cash',money(s.currentCash)),tile('Realized P/L',money(s.allTime?.pnl)),tile('Open P/L',money(v?.unrealizedPnl)));$('metrics').classList.remove('unavailable');
  const fresh=Number.isFinite(h?.ageMinutes)&&h.ageMinutes<=15,ok=fresh&&h.status==='ok'&&!h.alert;
  service('paper','Cloud paper scheduler',ok?'Active':h?.completedAt?'Needs attention':'Unverified',h?.completedAt?`Last cycle ${new Date(h.completedAt).toLocaleTimeString()} · every 5 minutes · simulation only`:'No completed cycle reported.',ok?'ok':'warn');
  const ages=(v?.positions||[]).map(p=>p.ageMinutes).filter(Number.isFinite),age=ages.length?Math.max(...ages):null;
  $('health').textContent=(h?.alert?`${h.alert} · `:'')+'Cached marks, before exit costs.'+(age!==null?` Oldest open-position quote: ${Math.round(age)} minutes old.`:'');
 }catch{service('paper','Cloud paper scheduler','Unreachable','Could not refresh. Any retained figures are stale.','warn');$('metrics').classList.add('unavailable');$('health').textContent='Account refresh failed. Retry or check your connection.';}
}
async function cloud(force){
 if(!force&&Date.now()-healthChecked<120000)return;
 try{const h=await read('/healthz?public=1');healthChecked=Date.now();
  service('extension','Browser-control extension',h.extension_online===true?'Connected':h.extension_online===false?'Offline':'Unverified','Server heartbeat check; separate from RGB and this dashboard.',h.extension_online===true?'ok':'warn');
  service('agents','Agent activity',Number.isFinite(h.gods_awake)?`${h.gods_awake} reported busy`:'Unverified',`${h.councillors??'Unknown number of'} councillors configured. Recorded task activity, not a chat-response test.`);
 }catch{service('extension','Browser-control extension','Unverified','Health check unavailable.','warn');service('agents','Agent activity','Unverified','Health check unavailable.');}
}
async function pc(){
 try{
  const token=localStorage.getItem('asgard:pc-lights-key');if(!token)throw Error('Pair this browser from ASGARD Settings to read local services.');
  const headers={'X-ASGARD-Key':token},base='http://127.0.0.1:18771',p=await read(base+'/telemetry',headers);
  $('pc').replaceChildren(tile('GPU temperature',p.gpu?.temperature==null?'Unavailable':p.gpu.temperature+' °C'),tile('GPU utilization',p.gpu?.utilization==null?'Unavailable':p.gpu.utilization+'%'),tile('Available memory',Number.isFinite(p.freeMemoryGB)?p.freeMemoryGB+' GB':'Unavailable'));
  service('local','Local PC helper','Connected',`Sensor sample ${new Date(p.measuredAt).toLocaleTimeString()}.`,'ok');
  service('rgb','RGB sleep setting',p.sleeping?'Lights sleeping':'Awake','Saved helper setting; physical LEDs are not independently measured.',p.sleeping?'unknown':'ok');
  service('desktop','Matching desktop',p.desktop?'Enabled':'Off','Wallpaper and accent follow agent changes while this PC is running.',p.desktop?'ok':'unknown');
  $('local').textContent='Actual local sensor readings. Fortnite FPS and CPU temperature are not measured.';
  try{const s=await read(base+'/status',headers);service('theme','Last applied RGB theme',s.last?`${s.last.persona.toUpperCase()}${s.last.locked?' · locked':''}`:'No applied state',s.last?`Helper applied ${new Date(s.last.at).toLocaleString()}. Not an independent hardware readback.`:'Switch agents in ASGARD to send a theme.');}catch{service('theme','Last applied RGB theme','Unverified','Lighting status request failed.');}
 }catch(e){$('pc').replaceChildren();$('local').textContent=e.message.startsWith('Pair this')?e.message:'PC helper unreachable. It may be stopped, unpaired, or blocked by browser permissions.';for(const [id,label]of [['local','Local PC helper'],['rgb','RGB sleep setting'],['desktop','Matching desktop'],['theme','Last applied RGB theme']])service(id,label,'Unverified','Local status unavailable; this does not establish that the lights are off.');}
}
async function refresh(force=false){if(busy)return;busy=true;$('refresh').disabled=true;try{await Promise.all([paper(),cloud(force),pc()]);$('updated').textContent='Last check '+new Date().toLocaleTimeString();}finally{busy=false;$('refresh').disabled=false;}}
$('refresh').onclick=()=>refresh(true);
$('full').onclick=()=>document.documentElement.requestFullscreen().catch(()=>{$('updated').textContent='Full screen unavailable in this browser.';});
function clock(){$('clock').textContent=new Date().toLocaleString();}clock();refresh(true);
setInterval(()=>{if(!document.hidden){clock();refresh();}},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){clock();refresh();}});
