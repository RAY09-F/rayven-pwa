import {LOCAL_TOOLS,runLocalTool} from './local-tools.js';

export const AUTOMATIONS=[
 ['Morning briefing','At a user-chosen morning time','Read calendar, to-dos and selected news; prepare a short factual briefing.','calendar, todos, news'],
 ['Weekly business review','At a user-chosen weekly time','Read supplied revenue records, actual costs and open commitments; prepare a sourced review.','cost_report, calendar, memory'],
 ['Meeting preparation','Before a real calendar event','Gather relevant authorized memory and prepare questions for the meeting.','calendar, search_memory, research'],
 ['Commitment follow-through','After an approved meeting summary','Propose to-dos for explicit commitments; ask before assigning dates or sending messages.','todos, calendar'],
 ['Research watch','On an approved recurring schedule','Search a specific subject, identify new sources and report meaningful changes.','research, web_search'],
 ['Website availability watch','On a supported approved schedule','Run http_check for a selected public URL; report actual failures without claiming continuous monitoring.','http_check, routines'],
 ['Domain review','At the chosen review date','Read DNS, registration and HTTP state; propose configuration changes without applying them.','dns_lookup, whois, http_check'],
 ['Content planning session','At the chosen weekly planning time','Read approved notes and prepare an editorial plan with source links.','memory, research, calendar'],
 ['Newsletter draft','Before an agreed editorial deadline','Gather approved sources, draft the issue and hold it for review.','research, memory'],
 ['Client research packet','On a manually approved client request','Compile permitted public facts and questions for discovery; do not contact the client.','research, web_search'],
 ['Proposal preparation','After scope has been supplied','Draft scope, deliverables, assumptions and acceptance criteria using the supplied facts.','memory, research'],
 ['Follow-up draft','On a chosen reminder','Prepare a follow-up for the named verified recipient; show exact text before sending.','todos, calendar, comms'],
 ['Product idea evaluation','When a user adds an idea','Ask council members for evidence, assumptions and a low-cost validation plan.','delegate, research, memory'],
 ['Customer question digest','After authorized feedback is supplied','Group repeated questions and propose documentation improvements.','memory, research'],
 ['Campaign link preparation','When a campaign brief is approved','Prepare source, medium and campaign values for the local link builder; do not publish.','memory; local UTM builder'],
 ['Usage spending review','At a chosen reporting interval','Read actual cost_report and self_stats, show the reporting period and flag missing data.','cost_report, self_stats'],
 ['Automation maintenance review','At a chosen review interval','Read current routines and propose removing duplicates or repairing failures.','routine_list, routine_templates'],
 ['Opportunity scan','On an approved search schedule','Search relevant job or business opportunities; show sources and prepare next steps without applying.','jobs, research'],
 ['Travel preparation','Before a confirmed journey','Read the calendar, route and weather; explain timing uncertainty.','calendar, maps, weather'],
 ['Weather-dependent reminder','At the agreed planning time','Check actual weather for a named location and flag the stated user thresholds.','weather, routines'],
 ['Paper council digest','At a chosen simulation review time','Read simulated positions and actual reported outcomes; label every figure as paper trading.','paper_trading_status, trading_status'],
 ['Decision review','At the decision review date','Retrieve the recorded assumptions and check which now need fresh evidence.','search_memory, research'],
 ['Weekly handoff','At a chosen weekly close','Summarize actual completed work, open questions and next actions from available records.','todos, calendar, memory'],
 ['Research quality check','After a draft is prepared','Ask an allowed councillor to challenge unsupported claims and identify missing sources.','delegate, research']
].map(([title,trigger,action,tools])=>({title,trigger,action,tools}));

export function createExpansion({shell,prepare,parseField,openTools}){
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const button=(label,fn,cls='')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
 let proposals=null,proposalFailure=false;
 function navigation(body,active){const bar=node('nav','expansion-nav');bar.setAttribute('aria-label','Arsenal sections');for(const [label,fn]of [['Backend tools',openTools],['Local tools',openLocal],['Automation briefs',openAutomation],['Build queue',openQueue]]){const b=button(label,fn);if(label===active)b.setAttribute('aria-current','page');bar.append(b);}body.prepend(bar);}
 function openLocal(){const body=shell('Local workbench','36 browser tools for revenue, operations, content and reliability. No network calls.');navigation(body,'Local tools');
  body.append(node('p','tool-truth','Calculations use your inputs and assumptions. These are scenario tools, not forecasts or live account data. Results stay in this page unless you choose to prepare them for chat.'));
  const grid=node('div','tool-grid');for(const t of LOCAL_TOOLS){const b=button('',()=>detail(t),'tool-card');b.append(node('span','tool-category',t.group),node('strong','',t.title),node('p','',t.description),node('span','tool-arrow','↗'));grid.append(b);}body.append(grid);
 }
 function detail(tool){const body=shell(tool.title,tool.description);navigation(body,'Local tools');const form=node('form','tool-form'),fields=[];
  for(const [key,spec]of Object.entries(tool.schema.properties)){const label=node('label'),input=node(spec.type==='number'?'input':'textarea');if(spec.type==='number'){input.type='number';input.step='any';input.min=spec.minimum??0;if(spec.maximum!=null)input.max=spec.maximum;}input.required=true;input.name=key;input.setAttribute('aria-label',spec.title);input.maxLength=200000;label.append(node('span','',spec.title),input);if(spec.description)label.append(node('small','',spec.description));form.append(label);fields.push([key,spec,input]);}
  const error=node('p','form-error');error.setAttribute('role','alert');const submit=node('button','primary-action','Calculate locally');submit.type='submit';form.append(error,submit);const output=node('section','local-result');output.setAttribute('aria-live','polite');
  form.addEventListener('submit',e=>{e.preventDefault();error.textContent='';output.replaceChildren();try{const args=Object.fromEntries(fields.map(([k,s,i])=>[k,parseField(i.value,s)]));const value=runLocalTool(tool,args);const printed=JSON.stringify(value,null,2);output.append(node('h3','','Local result'),node('pre','',printed),node('p','tool-truth','Computed locally from your inputs. Nothing was sent.'),button('Prepare result for chat',()=>prepare(`Help me interpret this ${tool.title} result. These are user-supplied assumptions, not verified live figures.\nInputs: ${JSON.stringify(args)}\nResult: ${printed}`)));}catch(e){error.textContent=e.message;}});
  body.append(form,output);
 }
 function openAutomation(){const body=shell('Automation briefs','24 editable workflow briefs. Preparing one does not schedule or activate it.');navigation(body,'Automation briefs');body.append(node('p','tool-truth','The assistant must inspect the existing routine engine and available tools first. Exact timing, data connectors and actions depend on the current backend.'));
  const grid=node('div','tool-grid');for(const a of AUTOMATIONS){const b=button('',()=>prepare(`Design this workflow using existing ASGARD capabilities: ${a.title}.\nProposed trigger: ${a.trigger}.\nAction: ${a.action}\nTools to inspect: ${a.tools}.\nUse find_tools and read current routine_templates/routine_list where permitted. Explain missing connections. Show the exact supported trigger, inputs, permissions, cost cap, duplicate-event handling, failure response and stop mechanism. Run a dry review first. Do not create, activate, publish, send or purchase anything until I approve the concrete workflow.`),'mission-card');b.append(node('span','tool-category','DRAFT WORKFLOW'),node('strong','',a.title),node('p','',a.action),node('small','',a.trigger));grid.append(b);}body.append(grid);
 }
 async function openQueue(){const body=shell('Expansion build queue','186 proposed integrations. These are design briefs, not installed tools.');navigation(body,'Build queue');body.append(node('p','tool-truth','The full catalogue has 445 entries: 223 existing backend definitions, 36 implemented local tools and these 186 proposals. Workflows combine tools and are not counted again.'));
  const status=node('p','tool-truth','Loading proposed integrations…');body.append(status);
  if(!proposals)try{const r=await fetch('/ui/expansion-catalog.json?v=rendered-realms-1');if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.tools))throw Error();proposals=data.tools;proposalFailure=false;}catch{proposalFailure=true;}
  if(!body.isConnected)return;
  if(proposalFailure){status.textContent='Could not load the build queue. Existing tools and conversation remain available.';body.append(button('Retry',openQueue));return;}
  status.textContent='Choose an idea to prepare an implementation brief. This never installs or enables a service.';
  const search=node('input','expansion-search');search.type='search';search.placeholder='Search monetization and automation ideas…';search.setAttribute('aria-label','Search proposed integrations');body.append(search);const count=node('p','tool-count'),grid=node('div','tool-grid');body.append(count,grid);
  function render(){const words=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean),filtered=proposals.filter(t=>words.every(w=>(t.title+' '+t.description+' '+t.group).toLowerCase().includes(w)));count.textContent=filtered.length+' proposed integrations';grid.replaceChildren();for(const t of filtered){const b=button('',()=>proposal(t),'tool-card');b.append(node('span','tool-category',t.group+' · PROPOSED'),node('strong','',t.title),node('p','',t.description));grid.append(b);}}
  search.addEventListener('input',render);render();
 }
 function proposal(t){const body=shell(t.title,'PROPOSED · '+t.group);navigation(body,'Build queue');body.append(node('p','',t.description),node('h3','','What it needs'),node('p','',t.requirements),node('h3','','Acceptance criteria'),node('p','',t.acceptance),button('Prepare implementation brief',()=>prepare(`Prepare a concrete implementation plan for this proposed ASGARD integration, without claiming it already works.\nName: ${t.title}\nPurpose: ${t.description}\nRequirements: ${t.requirements}\nAcceptance: ${t.acceptance}\nInspect existing code and tools first. Identify actual missing credentials or external contracts. Preserve persona and tenant boundaries, use server-side secrets, and include tests and a reversible rollout. Do not activate paid services or send external messages as part of planning.`),'primary-action'));}
 return {navigation};
}
