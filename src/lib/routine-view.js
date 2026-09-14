import {readRoutinesIndex,readRoutineRaw,routinePause,routineResume} from './routines.js';
import {isDue,localParts,describeSchedule,DEFAULT_TZ} from './schedule.js';

export function nextRoutineCheck(trigger,state={},now=Date.now()){
 if(trigger?.kind==='event')return null;
 if(!trigger)return null;
 const tick=300000;
 if(trigger.every!=null){const due=Math.max(now,(Number(state.lastRunAt)||0)+Number(trigger.every)*60000-15000);return new Date(Math.ceil(due/tick)*tick).toISOString()}
 const tz=trigger.tz||DEFAULT_TZ,start=Date.parse(localParts(now,tz).date+'T12:00:00Z');
 if(!/^\d\d:\d\d$/.test(trigger.at||''))return null;
 for(let day=0;day<370;day++){
  const date=new Date(start+day*86400000).toISOString().slice(0,10);const target=Date.parse(date+'T'+trigger.at+':00Z');let candidate=target;
  for(let i=0;i<3;i++){const p=localParts(candidate,tz);const local=Date.parse(p.date+'T'+String(p.hour).padStart(2,'0')+':'+String(p.minute).padStart(2,'0')+':00Z');candidate+=target-local}
  candidate=Math.ceil(Math.max(now,candidate)/tick)*tick;
  if(isDue(trigger,state,candidate)){
   // Match the runner's catch-up window when a spring-forward skips the requested clock time.
   while(candidate-tick>=now&&isDue(trigger,state,candidate-tick))candidate-=tick;
   return new Date(candidate).toISOString();
  }
 }
 return null;
}
export async function routineView(env,now=Date.now()){
 const rows=[];
 for(const entry of await readRoutinesIndex(env)){
  if(entry.deleted)continue;const r=await readRoutineRaw(env,entry.id);if(!r||r.deleted)continue;
  let trigger=r.trigger;
  if(trigger?.atFromConfig){const config=trigger.atFromConfig;const raw=await env.RAYVEN_KV.get(config.key);const hour=raw==null||raw===''?NaN:Number(raw);trigger={...trigger,at:Number.isInteger(hour)&&hour>=0&&hour<24?`${String(hour).padStart(2,'0')}:${config.minute||'05'}`:config.defaultAt||trigger.at}}
  rows.push({id:r.id,owner:r.owner,name:r.name,enabled:r.enabled!==false,schedule:trigger?.kind==='event'?`Event: ${trigger.event}`:describeSchedule(trigger),nextCheck:r.enabled===false?null:nextRoutineCheck(trigger,r.state,now),last:(r.runs||[]).slice(-1).map(x=>({at:x.at,ok:x.ok,delivered:x.delivered}))[0]||null});
 }
 return rows;
}
export async function toggleRoutine(env,id,enabled){
 if(typeof id!=='string'||typeof enabled!=='boolean')throw Error('Invalid routine update');
 const found=(await readRoutinesIndex(env)).find(r=>r.id===id&&!r.deleted);if(!found)throw Error('Routine not found');
 return {id,enabled,message:await (enabled?routineResume:routinePause)(env,found.owner,id)};
}
