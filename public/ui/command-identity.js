export const PALETTES={
  thor:{bg:[.012,.02,.034],deep:[.025,.08,.2],mid:[.06,.32,.65],main:[.28,.7,1],hot:[1,1,1],rim:[.86,.96,1],amb1:[.04,.24,.5,.14],amb2:[.25,.55,.8,.04]},
  loki:{bg:[.007,.016,.011],deep:[.008,.055,.022],mid:[.025,.22,.08],main:[.12,.7,.32],hot:[.5,1,.63],rim:[.17,.85,.36],amb1:[.02,.3,.08,.12],amb2:[.02,.09,.035,.05]},
  odin:{bg:[.027,.02,.009],deep:[.12,.07,.012],mid:[.4,.24,.055],main:[.86,.64,.25],hot:[1,1,1],rim:[1,.98,.92],amb1:[.4,.24,.055,.13],amb2:[.6,.5,.32,.04]},
  locked:{bg:[.028,.003,.005],deep:[.16,.005,.01],mid:[.55,.012,.025],main:[1,.045,.07],hot:[1,1,1],rim:[1,1,1],amb1:[.55,.015,.03,.15],amb2:[.6,.04,.06,.06]}
};
export const ROLES={
  thor:{title:'Command & creation',description:'Your main assistant for research, problem-solving and getting work done.',items:['Research & clear answers','Writing, building & practical tools','Council coordination']},
  loki:{title:'Time & follow-through',description:'Your personal organizer for the things you need to remember, plan and finish.',items:['Tasks & reminders','Meetings & calendar planning','Memory, briefs & monitoring']},
  odin:{title:'Markets & perspective',description:'Your market research and strategy assistant, with a council for paper-trading analysis.',items:['Market research & context','PAPER / SIM positions & results','Strategy review & risk analysis']}
};
export function lockIntent(text){
  const t=String(text).trim().toLowerCase().replace(/[’']/g,"'");
  if(/^(?:(?:hey|okay|ok|please)[,\s]+)*(?:(?:thor|loki|odin)[,\s]+)?(?:stand down|unlock|exit lock[ -]in|stop lock[ -]in)\b/.test(t))return false;
  if(/\b(?:don't|do not|never|not|explain|meaning|what|how|why|said|quote)\b/.test(t.split(/\block[ -]+in\b/)[0])||/["“”]/.test(t))return null;
  return /^(?:(?:hey|okay|ok|please)[,\s]+)*(?:(?:thor|loki|odin)[,\s]+)?(?:i want you to |i need you to |can you |could you )?lock[ -]+in\b/.test(t)?true:null;
}
export function createCommandIdentity({figure}){
  const $=id=>document.getElementById(id),locked={thor:false,loki:false,odin:false};let current=figure.current;
  for(const id of Object.keys(locked)){try{locked[id]=localStorage.getItem('asgard:lock-in:'+id)==='1';}catch{}}
  function render(){const on=locked[current],role=ROLES[current];document.body.dataset.locked=String(on);document.body.dataset.identity=current;figure.palette(PALETTES[on?'locked':current]);$('identity-title').textContent=role.title;$('identity-description').textContent=role.description;$('identity-list').replaceChildren(...role.items.map((text,i)=>{const li=document.createElement('li'),n=document.createElement('span');n.textContent='0'+(i+1);li.append(n,document.createTextNode(text));return li;}));$('lock-in').textContent=on?'Stand down':'Lock in';$('lock-in').setAttribute('aria-pressed',String(on));$('identity-mode').textContent=on?'LOCKED IN · RED / WHITE':'YOUR PERSONAL '+current.toUpperCase();$('lock-note').textContent=on?'Say “stand down” to restore your colors.':'Say “lock in” for red-and-white focus.';}
  function set(id,value){locked[id]=value;try{localStorage.setItem('asgard:lock-in:'+id,value?'1':'0');}catch{}if(id===current)render();}
  $('lock-in').addEventListener('click',()=>set(current,!locked[current]));render();
  return {select(id){current=id;render();},command(text,id){const intent=lockIntent(text);if(intent!==null)set(id,intent);}};
}
