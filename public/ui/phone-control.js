const $=id=>document.getElementById(id),KEY='asgard:phone-owner';
let token=localStorage.getItem(KEY)||'',watch=null;
async function api(path,body){
  const r=await fetch('/phone-api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Asgard-Phone':token},body:body===undefined?undefined:JSON.stringify(body)});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Connection unavailable');return j;
}
function say(text){$('status').textContent=text;}
function showTiming(state){
  let section=document.getElementById('phone-timing');
  if(!section){section=document.createElement('section');section.id='phone-timing';$('calls').closest('section').after(section);}
  const h=document.createElement('h2'),note=document.createElement('p'),list=document.createElement('ul');h.textContent='Response timing';
  note.textContent='Server processing measurements from recent owner calls. These exclude speech recognition, carrier delay and playback; they are not total mouth-to-ear latency.';
  const rows=state.calls.flatMap(c=>Object.entries(c.turns||{}).map(([turn,t])=>({persona:t.persona||c.persona,turn:Number(turn)+1,timing:t.timing,at:c.at}))).filter(x=>Number.isFinite(x.timing?.readyMs)).slice(0,12);
  for(const x of rows){const t=x.timing,li=document.createElement('li'),sec=n=>(n/1000).toFixed(2)+'s';li.textContent=`${new Date(x.at).toLocaleDateString()} · ${x.persona} turn ${x.turn}: ${sec(t.readyMs)} processing; model/tools ${sec(t.modelMs||0)}${Number.isFinite(t.speechReadyMs)?'; voice/storage '+sec(t.speechReadyMs):''}${t.audioStorage?' · '+t.audioStorage.toUpperCase():''}${t.voice==='fallback'?' · backup voice':''}`;list.append(li);}
  if(!rows.length){const li=document.createElement('li');li.textContent='No measured call turns yet. Timing appears after your next conversation.';list.append(li);}
  section.replaceChildren(h,note,list);
}
async function refresh(){
  const s=await api('status');
  showTiming(s);
  say(s.config.enabled?'Connected · calls enabled':'Connected · calls paused');
  $('presence').textContent=s.presence.state==='unknown'?'Unknown — update your status':`${s.presence.state==='home'?'Home':'Away'} · ${s.presence.source}`;
  $('schedule').textContent=`Calls to ${s.config.to||'no number configured'}, ${s.config.callStart||'11:00'}–${s.config.callEnd||'03:00'} (${s.config.timeZone}). ${s.config.allUpdates?'All updates':'Important updates'}${s.config.awayOnly?' while Away':' whether Home or Away'}. ${s.config.maxDaily===null?'No daily call cap':`Maximum ${s.config.maxDaily} calls per day`}. Nearby updates are grouped; at least 10 minutes between calls. ${s.todayCount} attempted today.`;
  $('calls').replaceChildren(...s.calls.map(c=>{const li=document.createElement('li');li.textContent=`${new Date(c.at).toLocaleString()} · ${c.persona} · ${c.status}${c.voice==='fallback'?' · backup voice':''}`;if(c.opening){const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');summary.textContent='Update and replies';text.textContent=c.opening+(c.transcript||[]).map(t=>'\n'+(t.role==='user'?'You: ':c.persona+': ')+t.content).join('');details.append(summary,text);li.append(details);}return li;}));
}
function safe(fn){return ()=>Promise.resolve().then(fn).catch(e=>say(e.message));}
function stopWatch(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;}
async function presence(state,source='manual'){await api('presence',{state,source});await refresh();}
$('home').onclick=safe(()=>{stopWatch();return presence('home');});
$('away').onclick=safe(()=>{stopWatch();return presence('away');});
$('pause').onclick=safe(async()=>{await api('pause',{});await refresh();});
const resume=document.createElement('button');resume.textContent='Resume calls';$('pause').after(resume);
resume.onclick=safe(async()=>{await api('resume',{});await refresh();});
$('save-home').onclick=safe(async()=>{
  const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
  if(p.coords.accuracy>150)throw Error('Location is too imprecise. Try again near a window.');
  localStorage.setItem('asgard:home-location',JSON.stringify({latitude:p.coords.latitude,longitude:p.coords.longitude}));
  await presence('home','location');say('Home saved on this phone. Tap Use phone location when ready.');
});
$('location').onclick=safe(()=>{
  const home=JSON.parse(localStorage.getItem('asgard:home-location')||'null');if(!home)throw Error('Set your home location while at home first.');
  stopWatch();let last=0;
  watch=navigator.geolocation.watchPosition(p=>{
    if(Date.now()-last<30000)return;last=Date.now();
    const rad=x=>x*Math.PI/180,dlat=rad(p.coords.latitude-home.latitude),dlon=rad(p.coords.longitude-home.longitude);
    const a=Math.sin(dlat/2)**2+Math.cos(rad(home.latitude))*Math.cos(rad(p.coords.latitude))*Math.sin(dlon/2)**2;
    const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    const status=p.coords.accuracy>250?'unknown':distance+p.coords.accuracy<300?'home':distance-p.coords.accuracy>300?'away':'unknown';
    presence(status,'location').catch(e=>say(e.message));
  },e=>{presence('unknown','location').catch(()=>{});say(e.message);},{enableHighAccuracy:false,timeout:15000,maximumAge:30000});
  say('Location sharing started while this page is active.');
});
$('stop-location').onclick=safe(async()=>{stopWatch();localStorage.removeItem('asgard:home-location');await presence('unknown','location');say('Location stopped and saved home coordinates removed. You can use Home/Away manually.');});
try{
  const match=location.hash.match(/^#pair=([a-f0-9]{64})$/);history.replaceState(null,'',location.pathname);
  if(match){const r=await api('pair',{code:match[1]});token=r.token;localStorage.setItem(KEY,token);}
  if(!token)throw Error('This phone is not paired yet. Open the private pairing link provided during setup.');
  await refresh();
}catch(e){say(e.message);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)refresh().catch(e=>say(e.message));});
