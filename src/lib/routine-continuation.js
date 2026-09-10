import {ledger} from './ledger.js';

export async function routineRevision(routine) {
  const {id,owner,name,intent,steps,deliver,trigger,onlyIf,enabled,deleted,intro}=routine;
  const bytes=new TextEncoder().encode(JSON.stringify({id,owner,name,intent,steps,deliver,trigger,onlyIf,enabled,deleted,intro}));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyRoutineContinuation(env,saved) {
  const raw=await env.RAYVEN_KV.get('routines:'+saved.routineId);
  const current=raw?JSON.parse(raw):null;
  if(!current||current.owner!==saved.owner||current.deleted||current.enabled===false||await routineRevision(current)!==saved.revision)
    throw Error('The routine changed or was disabled while waiting. Nothing further was resumed.');
  return current;
}
export async function routineHasPendingWork(env,id) {
  if(!env.LEDGER)return false;
  const rows=await ledger.execution(env,'read');
  return rows.some(r=>r.routine?.id===id&&['waiting','running','unknown','queued'].includes(r.routine.status));
}
export async function activateRoutineQuestion(env,run) {
  if(run.paused&&run.execution){
    const ok=await ledger.execution(env,'activateRoutineQuestion',run.execution);
    if(!ok)throw Error('The routine question could not be activated. Its work remains paused.');
  } else if(run.execution) {
    const ok=await finishRoutineContinuation(env,run.execution,run.batched?'queued':run.ok?'done':'failed');
    if(!ok)throw Error('The routine outcome could not be confirmed. Check the Bridge before starting again.');
  }
}
export async function finishRoutineContinuation(env,execution,state) {
  return ledger.execution(env,'routineComplete',{...execution,state});
}
