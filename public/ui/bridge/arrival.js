import {CAST} from '../council-data.js';
// Reuse model-owned IDs: pointer and keyboard selection have one identity.
const factories={
 thor:async()=>{const [s,m]=await Promise.all([import('../astral-cartographer.js'),import('../astral-cartographer-model.js')]);return [s.createAstralCartographer,m.ASTRAL_AGENT_IDS];},
 loki:async()=>{const [s,m]=await Promise.all([import('../prism-foundry.js'),import('../prism-foundry-model.js')]);return [s.createPrismFoundry,m.PRISM_AGENT_IDS];},
 odin:async()=>{const [s,m]=await Promise.all([import('../solar-throne.js'),import('../solar-throne-model.js')]);return [s.createSolarThrone,m.SOLAR_AGENT_IDS];}
};
const title=id=>CAST[id]?.name||id;
const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
export function mountArrival({persona,onRealm,onCompose,paused:initialPaused=false}){
 const host=document.getElementById('bridge-presence'),status=document.getElementById('arrival-scene-status');
 const motion=document.getElementById('arrival-motion'),roster=document.getElementById('arrival-council'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let scene=null,generation=0,disposed=false,paused=initialPaused,visible=true,current=persona,selected=null,returnFocus=null;
 const listeners=[];const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
 const dialog=node('dialog');dialog.className='arrival-advisor';dialog.setAttribute('aria-labelledby','arrival-advisor-title');document.body.append(dialog);
 function close(){dialog.close();returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});}
 listen(dialog,'cancel',event=>{event.preventDefault();close();});
 function select(id){
  const advisor=CAST[id];if(!advisor||advisor.hall!==current)return;
  selected=id;scene?.select(id);
  for(const b of roster.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.councillor===id));
  returnFocus=roster.querySelector(`[data-councillor="${id}"]`)||document.activeElement;
  const eyebrow=node('p',title(current)+'’s council');eyebrow.className='bridge-eyebrow';const name=node('h2',advisor.name);name.id='arrival-advisor-title';
  const role=node('p',advisor.role);role.className='arrival-advisor-role';
  const note=node('p','Open the hall to read the full profile or prepare a question. Nothing is sent when you open it.');note.className='bridge-detail';
  const actions=node('div');actions.className='bridge-actions';const link=node('a','View '+advisor.name+' in the hall ↗');link.className='bridge-primary';link.href='/hall/'+(advisor.kind==='councillor'?'?advisor='+encodeURIComponent(id):'')+'#'+current;
  const dismiss=node('button','Close');dismiss.type='button';dismiss.addEventListener('click',close);actions.append(link,dismiss);dialog.replaceChildren(eyebrow,name,role,note,actions);if(!dialog.open)dialog.showModal();
 }
 function toggle(){
  const ready=!!scene?.status().ready;scene?.setStill(paused||reduced.matches||!visible);
  motion.textContent=!ready?'Motion unavailable':reduced.matches?'Reduced motion':paused?'Resume motion':'Pause motion';motion.disabled=!ready||reduced.matches;motion.setAttribute('aria-pressed',String(paused||reduced.matches));
 }
 listen(motion,'click',()=>{paused=!paused;toggle();});listen(reduced,'change',toggle);
 listen(document.getElementById('arrival-compose'),'click',onCompose);
 for(const b of document.querySelectorAll('[data-realm-choice]'))listen(b,'click',()=>onRealm(b.dataset.realmChoice));
 async function setRealm(id){
  if(disposed||!factories[id])return;
  current=id;selected=null;const own=++generation;scene?.dispose();scene=null;host.replaceChildren();if(dialog.open)dialog.close();
  const hallLink=document.getElementById('arrival-hall');hallLink.href='/hall/#'+id;hallLink.textContent='Enter '+title(id)+'’s hall ↗';
  document.getElementById('arrival-compose').firstChild.textContent='Message '+title(id)+' ';
  for(const b of document.querySelectorAll('[data-realm-choice]'))b.setAttribute('aria-pressed',String(b.dataset.realmChoice===id));
  roster.replaceChildren();roster.setAttribute('aria-label',title(id)+'’s council');
  for(const member of CAST[id].councillors){const advisor=CAST[member],b=node('button',advisor.name);b.type='button';b.dataset.councillor=member;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',advisor.name+' — '+advisor.role);b.style.setProperty('--member-color',advisor.color);b.addEventListener('click',()=>select(member));roster.append(b);}
  status.dataset.important='false';status.textContent='Opening '+title(id)+'…';motion.textContent='Opening realm…';motion.disabled=true;
  try{
   const [create,ids]=await factories[id]();if(disposed||own!==generation)return;
   scene=create(host,{still:paused||reduced.matches||!visible,onStatus:value=>{if(own===generation&&!disposed){status.dataset.important=String(!!value);status.textContent=value||'Drag to orbit · choose a council member';if(scene)toggle();}},onSelect:key=>select(ids[key])});toggle();
  }catch{if(own!==generation||disposed)return;host.replaceChildren();const fallback=node('img');fallback.src='/ui/bridge/hall-'+id+'.png';fallback.alt=title(id)+' realm preview';host.append(fallback);status.dataset.important='true';status.textContent='Static preview · council and hall still available';toggle();}
 }
 const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;toggle();});visibility.observe(host);setRealm(persona);
 return {setRealm,status:()=>({persona:current,selected,paused,visible,scene:scene?.status()||null}),dispose(){disposed=true;generation++;visibility.disconnect();listeners.forEach(off=>off());scene?.dispose();dialog.remove();}};
}
