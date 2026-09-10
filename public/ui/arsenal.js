// Tool discovery uses the checked-in backend schemas. Requests still pass through existing chat and approval gates.
import {CAST} from './council-data.js';
import {createExpansion} from './expansion.js?v=reference-realms-1';
export const MISSIONS=[
  ['research','Evidence brief','Compare sources, separate facts from assumptions.','Use find_tools to locate research and web-search tools. Research my subject, cross-check important claims against independent sources, and give me a concise sourced brief. Subject: '],
  ['calendar','Plan my day','Calendar, priorities and room to breathe.','Read my existing calendar and to-dos using the available tools. Propose a realistic day with breaks and conflicts called out. Do not change any events without my confirmation. My priority: '],
  ['browser','Inspect a website','Read the actual page before proposing actions.','Use the connected browser tools to read the current page and, if useful, take a screenshot. Explain its state and propose next steps. Do not click consequential actions or submit forms. My goal: '],
  ['memory','Recover context','Find the decision behind an old conversation.','Search my existing memory for the following subject. Distinguish remembered facts from missing information and show what needs my confirmation: '],
  ['maps','Plan a journey','Routes, local conditions and timing.','Use available maps and weather tools to compare routes and conditions for this journey. State when the data was checked and what information is missing: '],
  ['paper','Paper council review','A sourced readout of the simulation.','Read paper_trading_status and trading_status. Summarize simulated positions and P&L from those results only. No real trades, signals or invented values. Explain the council’s current book.'],
  ['dev','Domain inspection','DNS, registration and HTTP behavior.','Use find_tools to locate dns_lookup, whois and http_check. Inspect this public domain and explain the actual results; do not change configuration: '],
  ['research','Document digest','Extract, explain and retain source references.','Find the available document-reading tools. Read this document, summarize the argument, quote sparingly and identify uncertainty and source locations: '],
  ['jobs','Opportunity scan','Find openings that match your constraints.','Find available job-search tools and search for matching openings. Report source links and missing details, without applying or sending messages. My requirements: '],
  ['weather','Outside briefing','Weather, air and plans that need adjusting.','Check available weather and air-quality tools for this place. Highlight conditions that could change my plans and include the data timing: '],
  ['self','Usage review','Understand reported model and system usage.','Read cost_report and available self_stats. Explain the reported period and limitations; do not invent missing counts or change spending limits.'],
  ['routines','Routine architect','Design the workflow before enabling it.','Read routine_templates and my current routine_list. Propose an existing-tool workflow for the goal below, including triggers and failure handling. Do not enable it until I confirm: '],
  ['comms','Message workshop','Draft the message; keep the final say.','Help draft this message. Check relevant context where available. Show me the exact recipient and wording for approval before any sending tool is used: '],
  ['markets','Company evidence','Filings, current facts and source links.','Use available price, filings and news tools to produce a factual company brief. Include retrieval times and uncertainties; do not produce a trade recommendation. Company: '],
  ['life','Personal toolkit','Find the right utility for an everyday job.','Search find_tools for the practical task below. Explain the useful tool and use it if it is read-only; prepare consequential changes for my approval: '],
  ['council','Council perspective','Delegate a focused question to the right advisor.','Review the available council roles and use delegate for this question. Identify whose report you received and distinguish their evidence from suggestions: ']
].map(([group,title,detail,prompt])=>({group,title,detail,prompt}));
export function filterTools(tools,{persona='thor',query='',group='all',favorites=null}={}) {
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return tools.filter(t=>t.personas.includes(persona)&&(group==='all'||t.group===group)&&(!favorites||favorites.includes(t.id))&&words.every(w=>(t.title+' '+t.id+' '+t.description+' '+t.group).toLowerCase().includes(w)));
}
export function toolRequest(tool,values,persona) {
  if(!tool.personas.includes(persona))throw new Error('This tool is not listed for this persona.');
  return `Use find_tools to locate ${tool.id}, then use that tool with these inputs: ${JSON.stringify(values)}. Keep all existing approval and permission rules. If unavailable, explain what is missing; do not claim success. Report the actual result.`;
}
export function parseField(raw,spec) {
  if(raw==='')return undefined;
  if(spec.type==='integer'||spec.type==='number'){const n=Number(raw);if(!Number.isFinite(n)||(spec.type==='integer'&&!Number.isInteger(n)))throw new Error('Enter a valid '+spec.type+'.');if(spec.minimum!=null&&n<spec.minimum)throw new Error('Minimum: '+spec.minimum);if(spec.maximum!=null&&n>spec.maximum)throw new Error('Maximum: '+spec.maximum);return n;}
  if(spec.type==='boolean')return raw==='true';
  if(spec.type==='object'||spec.type==='array'){let value;try{value=JSON.parse(raw);}catch{throw new Error('Enter valid JSON for this structured field.');}if(spec.type==='array'?!Array.isArray(value):!value||Array.isArray(value)||typeof value!=='object')throw new Error('Expected '+spec.type+'.');return value;}
  return raw;
}
export function createArsenal({getPersona,getDraft,setDraft,onSelect=()=>{},resetView=()=>{}}) {
  let catalogError=false,fieldDrafts={};
  let tools=[],group='all',query='',onlyFavorites=false,returnFocus=null,requestCounter=0;
  let favorites=[];try{const v=JSON.parse(localStorage.getItem('asgard:tool-favorites')||'[]');if(Array.isArray(v))favorites=v.filter(x=>typeof x==='string').slice(0,30);}catch{}
  const journal=[],modal=document.createElement('dialog');modal.id='arsenal-dialog';modal.className='arsenal-dialog';modal.setAttribute('aria-labelledby','arsenal-title');document.body.append(modal);
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const button=(text,action,cls='')=>{const b=node('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
  function close(){modal.close();onSelect(null);returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});}
  modal.addEventListener('cancel',e=>{e.preventDefault();close();});
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  function shell(title,subtitle){
    if(!modal.open){const settings=document.getElementById('settings-dialog');if(settings?.open){settings.close();returnFocus=document.querySelector('.settings-btn');}else returnFocus=document.activeElement;}
    modal.replaceChildren();const head=node('header','arsenal-head'),h=node('div');h.append(node('span','eyebrow','ASGARD / '+getPersona().toUpperCase()),node('h2','',title),node('p','',subtitle));h.querySelector('h2').id='arsenal-title';head.append(h,button('×',close,'arsenal-close'));head.lastChild.setAttribute('aria-label','Close tools panel');modal.append(head);
    const body=node('div','arsenal-body');modal.append(body);if(!modal.open)modal.showModal();return body;
  }
  function prepare(text){
    if(getDraft().trim()){
      const body=shell('Keep your draft','Choose how to combine this request with the text you already wrote.');
      body.append(button('Add to my draft',()=>commit(getDraft()+'\n\n'+text),'primary-action'),button('Replace my draft',()=>commit(text)),button('Cancel',close));return;
    }commit(text);
  }
  function commit(text){close();setDraft(text);}
  function saveFavorites(){try{localStorage.setItem('asgard:tool-favorites',JSON.stringify(favorites));}catch{}}
  function detail(tool){
    const body=shell(tool.title,tool.description),form=node('form','tool-form');
    body.append(node('p','tool-truth','Defined in your backend. Service setup and availability are checked when the assistant uses it.'));
    const fields=[];
    for(const [key,spec] of Object.entries(tool.schema?.properties||{})){
      const label=node('label'),caption=node('span','',key.replace(/_/g,' ')+(tool.schema.required?.includes(key)?' *':''));let input;
      if(spec.enum||spec.type==='boolean'){
        input=node('select');input.append(node('option','',''));for(const v of spec.enum||[true,false]){const opt=node('option','',String(v));opt.value=String(v);input.append(opt);}
      }else{input=node(['array','object'].includes(spec.type)?'textarea':'input');if(input.tagName==='INPUT')input.type=['number','integer'].includes(spec.type)?'number':'text';if(spec.type==='number')input.step='any';input.maxLength=8000;}
      input.value=fieldDrafts[tool.id]?.[key]??'';input.addEventListener('input',()=>{fieldDrafts[tool.id]??={};fieldDrafts[tool.id][key]=input.value;});
      input.name=key;input.required=!!tool.schema.required?.includes(key);input.setAttribute('aria-label',caption.textContent);if(spec.minimum!=null)input.min=spec.minimum;if(spec.maximum!=null)input.max=spec.maximum;
      label.append(caption,input);if(spec.description)label.append(node('small','',spec.description));form.append(label);fields.push([key,spec,input]);
    }
    if(!fields.length)form.append(node('p','','This tool needs no additional fields.'));
    const error=node('p','form-error');error.setAttribute('role','alert');form.append(error);
    const submit=node('button','primary-action','Prepare request');submit.type='submit';form.append(submit,button(favorites.includes(tool.id)?'★ Saved':'☆ Save tool',()=>{favorites=favorites.includes(tool.id)?favorites.filter(x=>x!==tool.id):[...favorites,tool.id].slice(-30);saveFavorites();detail(tool);}));
    form.addEventListener('submit',e=>{e.preventDefault();try{const args={};for(const [key,spec,input]of fields){const value=parseField(input.value,spec);if(value!==undefined)args[key]=value;}prepare(toolRequest(tool,args,getPersona()));}catch(err){error.textContent=err.message;}});
    body.append(form,button('← All tools',openTools,'back-link'));
  }
  const expansion=createExpansion({shell,prepare,parseField,openTools});
  function openTools(){
    const body=shell('The Arsenal','Find the right capability. Shape the request. Keep control.'),bar=node('div','arsenal-search');
    const search=node('input');search.type='search';search.value=query;search.placeholder='Search tools…';search.setAttribute('aria-label','Search tools');
    const groups=node('select');groups.setAttribute('aria-label','Tool category');const all=node('option','','All categories');all.value='all';groups.append(all);
    for(const g of [...new Set(tools.filter(t=>t.personas.includes(getPersona())).map(t=>t.group))].sort()){const o=node('option','',g);o.value=g;groups.append(o);}groups.value=group;
    const saved=button(onlyFavorites?'★ Saved only':'☆ Show saved',()=>{onlyFavorites=!onlyFavorites;openTools();});bar.append(search,groups,saved);body.append(bar);
    const count=node('p','tool-count'),grid=node('div','tool-grid');body.append(count,grid);expansion.navigation(body,'Backend tools');
    function render(){const results=filterTools(tools,{persona:getPersona(),query,group,favorites:onlyFavorites?favorites:null});count.textContent=catalogError?'Catalogue unavailable':results.length+' backend tools · availability checked on use';grid.replaceChildren();
      for(const t of results.slice(0,60)){const b=button('',()=>detail(t),'tool-card');b.append(node('span','tool-category',t.group),node('strong','',t.title),node('p','',t.description),node('span','tool-arrow','↗'));grid.append(b);}
      if(results.length>60)grid.append(node('p','tool-truth','Showing the first 60. Search or choose a category to narrow the list.'));if(!results.length)grid.append(node('p','tool-truth',tools.length?'No matching tools. Try a broader search.':catalogError?'Couldn’t load the tool catalogue. Conversation still works.':'Loading the tool catalogue…'));
    }
    search.addEventListener('input',()=>{query=search.value;render();});groups.addEventListener('change',()=>{group=groups.value;render();});render();search.focus();
  }
  function openMissions(){const body=shell('Mission briefs','Sixteen useful starting points, powered by existing tools.'),grid=node('div','tool-grid');
    for(const m of MISSIONS){const b=button('',()=>prepare(m.prompt),'mission-card');b.append(node('span','tool-category',m.group),node('strong','',m.title),node('p','',m.detail),node('span','tool-arrow','↗'));grid.append(b);}body.append(grid);}
  function openAgent(id){const activity=node('p','tool-truth','Loading recorded council activity…');const p=CAST[id];if(!p||p.hall!==getPersona())return;onSelect(id);const body=shell(p.name,p.title);body.append(node('p','agent-role',p.role));
    for(const [title,text]of [['What they do',p.does],['What they look for',p.watch],['Standing duties',p.duties.map(d=>d.description).join(' ')]] ){body.append(node('h3','',title),node('p','',text));}
    if(p.hall==='odin')body.append(node('p','tool-truth','Paper simulation only. '+p.market+(p.backendId?' · paper-agent id: '+p.backendId:'')));
    readAgentActivity(p,activity);
    body.append(activity,button('Prepare delegation',()=>prepare(`Use delegate to ask ${p.id==='hunter_b15'?'hunter_b15':p.id} (${p.name}) for help with: `),'primary-action'),button('Ask for current status',()=>prepare(`Tell me what ${p.name} is currently working on. Read actual council status where available; do not infer activity from the visual model.`)));
  }
  async function readAgentActivity(p,activity){
    try{const response=await fetch('/council/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('status');const data=await response.json();
      const list=data.councils?.[p.hall]||[];
      const entry=p.hall==='odin'?list.find(x=>x.paperAgentId===p.backendId):list.find(x=>x.id===p.id);
      if(!entry)throw Error('missing');
      activity.textContent=(p.hall==='odin'?'PAPER / SIM · ':'')+(entry.lastRun?'Last recorded run: '+new Date(entry.lastRun).toLocaleString()+' · '+(entry.lastSummary||'No summary recorded'):'No run recorded yet.')+' · '+(Number(entry.runs)||0)+' recorded runs. This is the last recorded activity, not a live progress indicator.';
    }catch{activity.textContent='Recorded activity is unavailable. You can still prepare a question for this agent.';}
  }
  function renderCouncil(){const bar=document.getElementById('council-dock');bar.replaceChildren();for(const id of CAST[getPersona()].councillors){const p=CAST[id],b=button('',()=>openAgent(id),'council-member');b.dataset.advisor=id;b.style.setProperty('--member',p.color);b.append(node('span','council-diamond','◇'),node('span','',p.name));b.setAttribute('aria-label',p.name+' — council dossier');bar.append(b);}}
  function openActivity(){const body=shell('Session activity','Actual chat requests in this page. This is not a live backend tool trace.');
    if(!journal.length)body.append(node('p','tool-truth','No chat requests yet. A prepared draft does not count as a completed action.'));
    for(const item of [...journal].reverse()){const row=node('div','activity-row');row.append(node('span','tool-category',item.hall),node('strong','',item.state),node('small','',new Date(item.at).toLocaleTimeString()+(item.ms!=null?' · '+(item.ms/1000).toFixed(1)+' s':'')));body.append(row);}
  }
  document.querySelectorAll('[data-open-arsenal]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.openArsenal||'all';query='';openTools();}));
  document.querySelector('[data-open-missions]').addEventListener('click',openMissions);
  document.querySelector('[data-open-activity]').addEventListener('click',openActivity);
  document.querySelector('[data-reset-view]').addEventListener('click',resetView);
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openTools();}});
  renderCouncil();
  fetch('/ui/tool-catalog.json?v=rendered-realms-1').then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();}).then(data=>{tools=Array.isArray(data.tools)?data.tools:[];document.getElementById('arsenal-count').textContent=tools.length+' backend · 36 local';if(modal.open&&document.getElementById('arsenal-title').textContent==='The Arsenal')openTools();}).catch(()=>{catalogError=true;document.getElementById('arsenal-count').textContent='Catalogue unavailable';if(modal.open&&document.getElementById('arsenal-title').textContent==='The Arsenal')openTools();});
  return {openAgent,openTools,switchPersona(){group='all';renderCouncil();if(modal.open)close();},
    startRequest(hall){const item={id:++requestCounter,hall,at:Date.now(),start:performance.now(),state:'Awaiting reply'};journal.push(item);if(journal.length>30)journal.shift();return item.id;},
    finishRequest(id,outcome){const item=journal.find(i=>i.id===id);if(item){item.state=outcome==='cancelled'?'Stopped waiting · server work unconfirmed':outcome==='received'?'Reply received':'Request failed · server work unconfirmed';item.ms=performance.now()-item.start;}},
    status:()=>({tools:tools.length,requests:journal.length})};
}
