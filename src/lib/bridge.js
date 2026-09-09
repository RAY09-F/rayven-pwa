// The Bridge projects existing records. Reading it never starts work, sends a
// notification, executes an approval, or fills gaps with design examples.
import {PERSONAS, historyKeyFor} from './personas.js';
import {COUNCIL} from './council.js';
import {ledger, ledgerBackend} from './ledger.js';
import {approvalRevision} from './approvals.js';

const VISIBLE = Object.keys(PERSONAS).filter(id=>!PERSONAS[id].hidden);
const isObject = value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const timestamp = value=>typeof value==='number'?value:Date.parse(value);
const iso = value=>Number.isFinite(timestamp(value))?new Date(timestamp(value)).toISOString():null;
const text = value=>typeof value==='string'?value:null;
const hasOwner = row=>VISIBLE.includes(row?.persona || row?.owner)
  && (!row.councillor || (COUNCIL[row.councillor]&&!COUNCIL[row.councillor].hidden&&COUNCIL[row.councillor].owner===(row.persona||row.owner)));
const ownerOf = row=>row.persona || row.owner;
const councilName = id=>COUNCIL[id]&&!COUNCIL[id].hidden?COUNCIL[id].name:null;

async function readJSON(env,key,fallback,validate) {
  const raw=await env.RAYVEN_KV.get(key);
  if(raw===null)return fallback;
  const value=JSON.parse(raw);
  if(!validate(value))throw Error('Invalid stored shape');
  return value;
}
const array=(env,key)=>readJSON(env,key,[],Array.isArray);
const object=(env,key)=>readJSON(env,key,null,isObject);

async function tickSnapshot(env) {
  if(ledgerBackend(env)==='do') {
    const [last,ticks]=await Promise.all([ledger.get(env,'tick:last'),ledger.recentTicks(env,12)]);
    if((last!==null&&!isObject(last))||!Array.isArray(ticks))throw Error('Invalid ledger snapshot');
    return {last,ticks};
  }
  const last=await object(env,'tick:last');
  const keys=Array.isArray(last?.recent)?last.recent.slice(-12):[];
  const ticks=await Promise.all(keys.map(key=>object(env,key)));
  return {last,ticks:ticks.filter(Boolean)};
}

function history(raw) {
  if(raw===null)return {turns:[],meta:{}};
  const value=JSON.parse(raw);
  if(Array.isArray(value))return {turns:value,meta:{}};
  if(!isObject(value)||!Array.isArray(value.turns))throw Error('Invalid history');
  return {turns:value.turns,meta:isObject(value.meta)?value.meta:{}};
}

// Never translate a scheduled routine, a model's prose or the old fixed 0.5
// status into measured progress. A running plan requires explicit steps and
// an unexpired execution lease. Writers will update these at actual boundaries.
export function bridgePlan(status,persona,now) {
  const plan=status?.plan;
  if(!isObject(plan)||typeof plan.id!=='string'||!Array.isArray(plan.steps)
    ||!plan.steps.length||timestamp(plan.leaseUntil)<=now||!iso(plan.leaseUntil))return null;
  const steps=plan.steps;
  if(steps.some(s=>!isObject(s)||!text(s.title)||!['pending','in_progress','done'].includes(s.status)))return null;
  if(steps.filter(s=>s.status==='in_progress').length!==1)return null;
  return {id:plan.id,persona,title:text(plan.title)||status.task,updatedAt:iso(status.at),
    steps:steps.map(s=>({id:s.id,title:s.title,status:s.status})),
    percent:Math.round(100*steps.filter(s=>s.status==='done').length/steps.length)};
}

function approvalItems(rows,now) {
  return rows.filter(a=>hasOwner(a)&&a.status==='pending'&&timestamp(a.expiresAt)>now).map(a=>({
    id:'review:'+a.persona+':'+a.id,type:'REVIEW',sourceId:a.id,persona:a.persona,
    councillor:a.councillor||null,title:text(a.description)||text(a.tool)||'Action awaiting review',
    description:text(a.description),provenance:text(a.provenance),tool:text(a.tool),
    at:iso(a.createdAt),expiresAt:iso(a.expiresAt)
  }));
}

function activityItems(legacy,ticks,since,now) {
  const rows=[...legacy];
  for(const tick of ticks)if(isObject(tick))rows.push(...(Array.isArray(tick.autonomy)?tick.autonomy:[]),...(Array.isArray(tick.drained)?tick.drained:[]).filter(e=>e?.kind==='autonomy'));
  const seen=new Set();
  return rows.filter(row=>hasOwner(row)&&text(row.summary)&&Number.isFinite(timestamp(row.time||row.ts)))
    .map(row=>({persona:ownerOf(row),councillor:row.councillor||null,
      name:councilName(row.councillor)||PERSONAS[ownerOf(row)].name,
      at:iso(row.time||row.ts),summary:row.summary,detail:text(row.detail),paper:ownerOf(row)==='odin'&&!!COUNCIL[row.councillor]?.paperAgentId}))
    .filter(row=>timestamp(row.at)>since&&timestamp(row.at)<=now)
    .sort((a,b)=>timestamp(b.at)-timestamp(a.at))
    .filter(row=>{const key=JSON.stringify([row.persona,row.councillor,row.at,row.summary]);if(seen.has(key))return false;seen.add(key);return true;});
}

export async function getBridgeSnapshot(env,{now=Date.now(),since=0,dismissed=[]}={}) {
  const requests={
    approvals:()=>array(env,'approvals'),
    executions:async()=>{if(!env.LEDGER)throw Error('Execution tracking unavailable');const rows=await ledger.execution(env,'read');if(!Array.isArray(rows))throw Error('Invalid executions');return rows;},
    notifications:()=>array(env,'notif:log'),
    activity:()=>array(env,'agent:autonomy:log'),
    ticks:()=>tickSnapshot(env),
    calendar:()=>array(env,'calendar:events'),
    todos:()=>array(env,'todos'),
    extension:async()=>{const raw=await env.RAYVEN_KV.get('browser:lastpoll');if(raw===null)return null;const n=Number(raw);if(!Number.isFinite(n)||n<0)throw Error('Invalid heartbeat');return n;}
  };
  for(const id of VISIBLE) {
    requests['history:'+id]=async()=>history(await env.RAYVEN_KV.get(historyKeyFor(id,'web')));
    requests['status:'+id]=()=>object(env,'status:'+id);
  }
  const entries=Object.entries(requests);
  const results=await Promise.allSettled(entries.map(([,fn])=>fn()));
  const values={},sources={};
  entries.forEach(([key],i)=>{sources[key]=results[i].status==='fulfilled';values[key]=sources[key]?results[i].value:null;});
  const reviews=approvalItems(values.approvals||[],now);
  await Promise.all(reviews.map(async item=>{const rec=values.approvals.find(a=>a&&a.id===item.sourceId&&a.persona===item.persona);item.revision=await approvalRevision(rec);}));
  const visibleSources=new Set([...VISIBLE,'system','health','monitoring','calendar','timer',...Object.keys(COUNCIL).filter(id=>!COUNCIL[id].hidden)]);
  const notices=await Promise.all((values.notifications||[]).filter(n=>n&&visibleSources.has(n.source)&&text(n.title)&&iso(n.time)
    &&!String(n.status).startsWith('suppressed_cooldown')).map(async n=>{
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([n.source,n.time,n.title,n.body])));
      const id='notice:'+Array.from(new Uint8Array(digest).slice(0,12),b=>b.toString(16).padStart(2,'0')).join('');
      return {id,type:'NOTIFY',persona:VISIBLE.includes(n.source)?n.source:COUNCIL[n.source]?.owner||null,
        councillor:COUNCIL[n.source]?n.source:null,title:n.title,description:text(n.body),at:iso(n.time)};
    }));
  const dismissedSet=new Set(Array.isArray(dismissed)?dismissed.filter(id=>typeof id==='string').slice(-200):[]);
  const questions=(values.executions||[]).filter(hasOwner).filter(r=>r.state==='waiting'&&r.question?.expiresAt>now&&(!r.routine||r.routine.ready)).map(r=>({
    id:'question:'+r.id+':'+r.question.revision,sourceId:r.id,type:'QUESTION',persona:r.persona,councillor:r.councillor,
    title:r.question.text,revision:r.question.revision,at:iso(r.at),expiresAt:iso(r.question.expiresAt)}));
  const needs=[...reviews,...questions,...notices.filter(n=>!dismissedSet.has(n.id))].sort((a,b)=>
    (a.type==='NOTIFY'?1:0)-(b.type==='NOTIFY'?1:0)||timestamp(b.at)-timestamp(a.at));
  const running=(values.executions||[]).filter(hasOwner).filter(r=>r.state==='running').map(r=>
    bridgePlan({at:r.at,plan:r},r.persona,now)).filter(Boolean);
  const halls=VISIBLE.map(id=>{
    const h=values['history:'+id],status=values['status:'+id];
    const last=h?.turns.filter(t=>t?.role==='assistant'&&text(t.content)).at(-1);
    return {id,name:PERSONAS[id].name,state:status?{task:text(status.task),at:iso(status.at)}:null,
      lastSaid:last?.content??null,pendingCount:sources.approvals?reviews.filter(r=>r.persona===id).length:null,
      historyAvailable:sources['history:'+id],statusAvailable:sources['status:'+id]};
  });
  const boundedSince=Number.isFinite(since)?Math.max(0,Math.min(since,now)):0;
  const outcomes={queued:'Routine queued for batch processing; remaining steps have not finished.',done:'Reply processing returned a result.',failed:'Reply processing failed; earlier actions may have completed.',cancelled:'Reply processing was cancelled; earlier actions may have completed.',unknown:'Execution updates stopped or the question expired. The outcome is unknown.'};
  const executionActivity=(values.executions||[]).filter(hasOwner).filter(r=>outcomes[r.state]).map(r=>({
    persona:r.persona,councillor:r.councillor,time:r.at,summary:outcomes[r.state],
    detail:'Recorded execution '+r.id+'. Check the hall and action records before starting the work again.'}));
  const activity=activityItems([...(values.activity||[]),...executionActivity],values.ticks?.ticks||[],boundedSince,now);
  const localParts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const parts=Object.fromEntries(localParts.map(p=>[p.type,p.value]));
  const localNow=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  const calendar=values.calendar?.filter(e=>text(e.title)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')
    && (!e.time||/^\d{2}:\d{2}$/.test(e.time))&&`${e.date} ${e.time||'23:59'}`>=localNow)
    .sort((a,b)=>`${a.date} ${a.time||''}`.localeCompare(`${b.date} ${b.time||''}`))[0];
  const lastTick=values.ticks?.last;
  const cost=lastTick?.day===new Date(now).toISOString().slice(0,10)&&Number.isFinite(lastTick.costToday?.usd)?lastTick.costToday:null;
  const weather=values['history:thor']?.meta?.council?.valkyrie?.weather;
  return {generatedAt:new Date(now).toISOString(),since:new Date(boundedSince).toISOString(),sources,
    needs:needs.slice(0,5),needsTotal:sources.approvals&&sources.notifications&&sources.executions&&!(values.executions||[]).some(r=>hasOwner(r)&&r.state==='waiting'&&r.routine&&!r.routine.ready)?needs.length:null,
    running,halls,activity,
    glance:{nextEvent:sources.calendar?(calendar?{title:calendar.title,date:calendar.date,time:calendar.time||null,timeZone:'America/Los_Angeles'}:null):null,
      openTodos:sources.todos?values.todos.filter(t=>isObject(t)&&!t.done).length:null,
      weather:weather&&text(weather.text)&&iso(weather.at)?{text:weather.text,at:iso(weather.at)}:null,
      extension:sources.extension?{connected:!!(values.extension&&now-values.extension>=0&&now-values.extension<600000),lastSeen:iso(values.extension)}:null,
      modelSpend:cost?{usd:cost.usd,day:lastTick.day,basis:'Recorded model usage at list prices; excludes speech, search and hosting',estimated:true}:null}
  };
}
