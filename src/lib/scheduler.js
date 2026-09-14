// Named registry over the existing cron jobs; no second timer or storage log.
import {tickLog,readRecentTicks} from './tick.js';
export const JOB_IDS=['phone-updates','phone-audio-cleanup','proactive-checkin','morning-briefing','code-check','persona-autonomy','calendar-reminders','extension-health','system-health','loki-brief','odin-report','paper-cycle','paper-close','vault-backup','pollers','clip-cycle','vizard-poll','whop-submit','timers','instagram-refresh','hela-vigil','hela-daily','capability-forge','monitoring'];
const CONFIG='config:scheduler';
export async function schedulerConfig(env){
 const raw=await env.RAYVEN_KV.get(CONFIG);
 if(!raw)return {version:1,disabled:[]};
 const parsed=JSON.parse(raw);
 if(parsed.version!==1||!Array.isArray(parsed.disabled)||parsed.disabled.some(id=>!JOB_IDS.includes(id)))throw new Error('Invalid scheduler config');
 return parsed;
}
export async function setSchedulerEnabled(env,id,enabled){
 if(!JOB_IDS.includes(id)||typeof enabled!=='boolean')throw new Error('Unknown job or invalid enabled value');
 const config=await schedulerConfig(env);const disabled=new Set(config.disabled);
 if(enabled)disabled.delete(id);else disabled.add(id);
 const next={version:1,disabled:[...disabled].sort()};
 if(JSON.stringify(next)!==JSON.stringify(config))await env.RAYVEN_KV.put(CONFIG,JSON.stringify(next));
 return {id,enabled};
}
export async function dispatchJobs(env,jobs,{onError=async()=>{}}={}){
 if(jobs.length!==JOB_IDS.length||new Set(jobs.map(j=>j.id)).size!==jobs.length||jobs.some(j=>!JOB_IDS.includes(j.id)))throw new Error('Scheduler registry mismatch');
 const config=await schedulerConfig(env);
 return Promise.all(jobs.map(async({id,run})=>{
  if(config.disabled.includes(id))return {id,status:'disabled'};
  const started=Date.now();
  try{const value=await run(env);const result={id,status:value==null?'idle':'checked',ms:Date.now()-started};if(value!=null)tickLog('notes',{scheduler:result});return result;}
  catch(error){const result={id,status:'failed',ms:Date.now()-started};tickLog('notes',{scheduler:result});try{await onError(id,error)}catch{}return result;}
 }));
}
export async function schedulerStatus(env){
 const config=await schedulerConfig(env);const ticks=await readRecentTicks(env,60);const latest=new Map();
 for(const tick of ticks)for(const note of tick.notes||[]){const r=note.scheduler;if(r&&JOB_IDS.includes(r.id)&&!latest.has(r.id))latest.set(r.id,{...r,checkedAt:tick.at})}
 return {cadence:'*/5 * * * *',note:'Checked means the job evaluated its own due conditions, not that it performed work. User routines retain their existing schedules.',jobs:JOB_IDS.map(id=>({id,enabled:!config.disabled.includes(id),last:latest.get(id)||null}))};
}
