const BASE='http://127.0.0.1:18771',KEY='asgard:pc-lights-key';
export function connectPCLights(){
  const section=document.createElement('section');
  section.innerHTML='<h3>PC lights</h3><p id="pc-lights-status" role="status">Not connected on this browser.</p><a href="http://127.0.0.1:18771/pair" referrerpolicy="no-referrer">Connect PC lights</a> <button type="button" id="pc-lights-off">Disconnect</button>';
  const form=document.querySelector('#settings-dialog form');
  form?.insertBefore(section,form.querySelector('button:not([type])'));
  const status=section.querySelector('#pc-lights-status');let token='',timer,busy=false,again=false;
  for(const [label,path,enabled]of [['Sleep lights','sleep',true],['Wake lights','sleep',false],['Match desktop','desktop',true],['Restore desktop','desktop',false]]){const b=document.createElement('button');b.type='button';b.textContent=label;section.append(b);b.onclick=async()=>{if(!token){status.textContent='Connect PC lights first.';return;}try{const r=await fetch(BASE+'/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-ASGARD-Key':token},body:JSON.stringify({enabled}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();status.textContent=label+' applied.';schedule();}catch{status.textContent='Local control unavailable. Keep the PC helper running.';}};}
  try{
    const match=location.hash.match(/^#rgb-pair=([a-f0-9]{64})$/);
    if(match){localStorage.setItem(KEY,match[1]);history.replaceState(null,'',location.pathname+location.search);}
    token=localStorage.getItem(KEY)||'';
  }catch{}
  async function sync(){
    if(!token||document.hidden)return;
    if(busy){again=true;return;}
    busy=true;again=false;
    const persona=document.body.dataset.identity||'thor',locked=document.body.dataset.locked==='true';
    try{
      const res=await fetch(BASE+'/state',{method:'POST',headers:{'Content-Type':'application/json','X-ASGARD-Key':token},body:JSON.stringify({persona,locked}),signal:AbortSignal.timeout(6500)});
      if(!res.ok)throw Error('unavailable');
      if(token)status.textContent='Connected · '+(locked?'red focus':persona[0].toUpperCase()+persona.slice(1))+' lighting';
    }catch{if(token)status.textContent='Not connected. Check the PC helper, SignalRGB Pro and browser local-network permission.';}
    finally{busy=false;if(again)sync();}
  }
  function schedule(){clearTimeout(timer);sync();}
  section.querySelector('#pc-lights-off').onclick=()=>{token='';try{localStorage.removeItem(KEY);}catch{}clearTimeout(timer);status.textContent='Disconnected. Lights keep their last color.';};
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-identity','data-locked']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  window.addEventListener('focus',schedule);
  setInterval(()=>{if(token&&!document.hidden)sync();},15000);
  if(token){status.textContent='Connecting to this PC…';schedule();}
}
