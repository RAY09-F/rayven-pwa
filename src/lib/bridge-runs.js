import {ledger} from './ledger.js';

const KEY = 'bridge:executions';
const LEASE_MS = 90000;
// Called inside the ledger's serialized operation. This is execution metadata,
// not another job queue: it cannot schedule, restart or execute anything.
export async function executionState(store, action, fields = {}, now = Date.now()) {
  const saved = await store.get(KEY);
  if (saved !== null && !Array.isArray(saved)) throw Error('Invalid execution records');
  const rows = saved || [];
  if (action === 'read') return rows;
  if (!['begin','step','heartbeat','finish'].includes(action)) throw Error('Invalid execution action');
  if (typeof fields.id !== 'string' || !fields.id) throw Error('Execution id required');
  let run = rows.find(r => r.id === fields.id);
  if (action === 'begin') {
    if (run) return false;
    if (!['thor','loki','odin'].includes(fields.persona)) throw Error('Invalid execution owner');
    run = {id:fields.id,persona:fields.persona,councillor:fields.councillor || null,
      title:'Reply processing',state:'running',at:now,leaseUntil:now+LEASE_MS,steps:[{id:'answer',title:'Finish reply processing',status:'pending'}]};
    rows.push(run);
  } else {
    if (!run || run.state !== 'running' || run.leaseUntil <= now) return false;
  }
  if (action === 'step') {
    if (typeof fields.title !== 'string' || !fields.title.trim()) throw Error('Step title required');
    for (const s of run.steps) if (s.status === 'in_progress') s.status = 'done';
    run.steps.splice(run.steps.length-1,0,{id:String(run.steps.length),title:fields.title.slice(0,160),status:'in_progress'});
  }
  if (action === 'finish') {
    if (!['done','failed','cancelled'].includes(fields.state)) throw Error('Invalid execution outcome');
    run.state = fields.state;
    // Failed/cancelled processing does not turn the active step into a success.
    if (fields.state === 'done') for (const s of run.steps) s.status='done';
  }
  run.at=now;run.leaseUntil=now+LEASE_MS;
  // Keep active work even with many completed runs; terminal receipts are bounded.
  const active=rows.filter(r=>r.state==='running' && r.leaseUntil>now);
  const ended=rows.filter(r=>!active.includes(r)).sort((a,b)=>b.at-a.at).slice(0,100);
  await store.put(KEY,[...active,...ended]);
  return true;
}

export async function trackExecution(env, {persona,councillor,enabled=true}={}) {
  const noop={step:async()=>{},finish:async()=>{}};
  if (!enabled || !env.LEDGER || !['thor','loki','odin'].includes(persona)) return noop;
  const id=crypto.randomUUID();
  let stopped=false, heartbeatBusy=false;
  const send=async(action,fields={})=>{
    try { return await ledger.execution(env,action,{id,...fields}); }
    catch { return false; } // Observability cannot take down an existing reply.
  };
  if (!await send('begin',{persona,councillor})) return noop;
  const timer=setInterval(async()=>{
    if(stopped||heartbeatBusy)return;
    heartbeatBusy=true;
    try { if(!await send('heartbeat')) {stopped=true;clearInterval(timer);} }
    finally { heartbeatBusy=false; }
  },20000);
  timer.unref?.();
  return {
    async step(title) { if(!stopped&&!await send('step',{title})) {stopped=true;clearInterval(timer);} },
    async finish(state) { clearInterval(timer);if(stopped)return;stopped=true;await send('finish',{state}); }
  };
}
