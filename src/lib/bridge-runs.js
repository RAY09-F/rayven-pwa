import {ledger} from './ledger.js';

const KEY = 'bridge:executions';
const LEASE_MS = 90000;
// Called inside the ledger's serialized operation. This is execution metadata,
// not another job queue: it cannot schedule, restart or execute anything.
export async function executionState(store, action, fields = {}, now = Date.now()) {
  const saved = await store.get(KEY);
  if (saved !== null && !Array.isArray(saved)) throw Error('Invalid execution records');
  const rows = saved || [];
  if (action === 'read') return rows.map(({checkpoint,token,...row})=>({...row,
    state:row.state==='running'&&row.leaseUntil<=now || row.state==='waiting'&&row.question?.expiresAt<=now ? 'unknown' : row.state}));
  if (!['begin','step','heartbeat','finish','pause','claim'].includes(action)) throw Error('Invalid execution action');
  if (typeof fields.id !== 'string' || !fields.id) throw Error('Execution id required');
  let run = rows.find(r => r.id === fields.id);
  if (action === 'begin') {
    if (run) return false;
    if (!['thor','loki','odin'].includes(fields.persona)) throw Error('Invalid execution owner');
    run = {id:fields.id,persona:fields.persona,councillor:fields.councillor || null,
      token:fields.token || null,title:'Reply processing',state:'running',at:now,leaseUntil:now+LEASE_MS,steps:[{id:'answer',title:'Finish reply processing',status:'pending'}]};
    rows.push(run);
  } else if (action === 'claim') {
    if(!run || run.state!=='waiting' || run.persona!==fields.persona || run.question?.revision!==fields.revision || run.question.expiresAt<=now)return null;
    if(typeof fields.answer!=='string'||!fields.answer.trim()||fields.answer.length>8000||!fields.token)return null;
    const checkpoint=await store.get(run.checkpoint);
    if(!checkpoint)throw Error('Question context unavailable');
    run.state='running';run.token=fields.token;run.at=now;run.leaseUntil=now+LEASE_MS;
    run.question.answeredAt=now;run.question.answer=fields.answer.trim();
    await store.put(KEY,rows);
    return {checkpoint,id:run.id,token:run.token};
  } else {
    if (!run || run.state !== 'running' || run.leaseUntil <= now || run.token !== (fields.token || null)) return false;
  }
  if (action === 'step') {
    if (typeof fields.title !== 'string' || !fields.title.trim()) throw Error('Step title required');
    for (const s of run.steps) if (s.status === 'in_progress') s.status = 'done';
    run.steps.splice(run.steps.length-1,0,{id:String(run.steps.length),title:fields.title.slice(0,160),status:'in_progress'});
  }
  if (action === 'pause') {
    if(typeof fields.question!=='string'||!fields.question.trim()||fields.question.length>1200||!fields.checkpoint)return false;
    if(JSON.stringify(fields.checkpoint).length>512000)throw Error('Context exceeds pause limit');
    const revision=crypto.randomUUID();
    const key='bridge:checkpoint:'+run.id+':'+revision;
    await store.put(key,fields.checkpoint);
    run.councillor=fields.checkpoint.options?.councillor || run.councillor;
    run.checkpoint=key;run.question={text:fields.question.trim(),revision,expiresAt:now+7*86400000};
    run.state='waiting';
  }
  if (action === 'finish') {
    if (!['done','failed','cancelled'].includes(fields.state)) throw Error('Invalid execution outcome');
    run.state = fields.state;
    // Failed/cancelled processing does not turn the active step into a success.
    if (fields.state === 'done') for (const s of run.steps) s.status='done';
  }
  run.at=now;run.leaseUntil=now+LEASE_MS;
  // Keep active work even with many completed runs; terminal receipts are bounded.
  const active=rows.filter(r=>r.state==='waiting' && r.question?.expiresAt>now || r.state==='running' && r.leaseUntil>now);
  const ended=rows.filter(r=>!active.includes(r)).sort((a,b)=>b.at-a.at).slice(0,100);
  await store.put(KEY,[...active,...ended]);
  return true;
}

export async function trackExecution(env, {persona,councillor,enabled=true,resume}={}) {
  const noop={step:async()=>{},finish:async()=>{},pause:async()=>false};
  if (!enabled || !env.LEDGER || !['thor','loki','odin'].includes(persona)) return noop;
  const id=resume?.id || crypto.randomUUID(),token=resume?.token || crypto.randomUUID();
  let stopped=false, heartbeatBusy=false;
  const send=async(action,fields={})=>{
    try { return await ledger.execution(env,action,{id,token,...fields}); }
    catch { return false; } // Observability cannot take down an existing reply.
  };
  if (!await send(resume?'heartbeat':'begin',{persona,councillor})) {
    if(resume)throw Error('The resumed execution lease is unavailable');
    return noop;
  }
  const timer=setInterval(async()=>{
    if(stopped||heartbeatBusy)return;
    heartbeatBusy=true;
    try { if(!await send('heartbeat')) {stopped=true;clearInterval(timer);} }
    finally { heartbeatBusy=false; }
  },20000);
  timer.unref?.();
  return {
    async pause(question,checkpoint) {
      if(stopped)return false;
      const ok=await send('pause',{question,checkpoint});
      if(ok){stopped=true;clearInterval(timer);}return ok;
    },
    async step(title) { if(!stopped&&!await send('step',{title})) {stopped=true;clearInterval(timer);} },
    async finish(state) { clearInterval(timer);if(stopped)return;stopped=true;await send('finish',{state}); }
  };
}
