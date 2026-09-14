import {ledger} from './ledger.js';
export const SCHEDULED_CONTEXT=Symbol('asgard scheduled model context');
export const SCHEDULED_MODEL_CAP=30;
export function reserveBudget(previous,count,now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10);
 const used=previous?.day===day?Math.max(0,Number(previous.used)||0):0;
 if(!Number.isSafeInteger(count)||count<1||count>SCHEDULED_MODEL_CAP)return {state:{day,used},result:{allowed:false,used,cap:SCHEDULED_MODEL_CAP}};
 const allowed=used+count<=SCHEDULED_MODEL_CAP;
 return {state:{day,used:allowed?used+count:used},result:{allowed,used:allowed?used+count:used,cap:SCHEDULED_MODEL_CAP}};
}
export async function reserveScheduledModels(env,count=1){
 if(!env[SCHEDULED_CONTEXT])return;
 // No KV read/modify/write fallback: it would allow concurrent ticks to exceed the cap.
 const result=await ledger.reserveScheduledModels(env,count);
 if(!result.allowed)throw new Error('SCHEDULED_MODEL_BUDGET_EXHAUSTED: daily cap is 30 model requests');
}
export function scheduledEnvironment(env){
 const wrapped={...env,[SCHEDULED_CONTEXT]:true};
 if(env.AI)wrapped.AI={run:async(...args)=>{await reserveScheduledModels(wrapped);return env.AI.run(...args)}};
 return wrapped;
}
export async function scheduledModelFetch(env,url,init,count=1){
 await reserveScheduledModels(env,count);
 return fetch(url,{...init,signal:init?.signal||AbortSignal.timeout(20000)});
}
