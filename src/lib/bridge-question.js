import {verifyRoutineContinuation,finishRoutineContinuation,activateRoutineQuestion} from './routine-continuation.js';
// A question suspends an existing tool loop. It is not an approval and cannot
// grant tools or bypass permission checks when the loop resumes.
export const QUESTION_TOOL = {
  name:'util_ask_user',
  description:'Pause this work and ask Rayan one necessary question in the Bridge. Use alone in a tool-use turn. Only use when missing information prevents continuing; do not ask for approval through this tool. The same work resumes after an answer.',
  input_schema:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:1200}},required:['question'],additionalProperties:false}
};
export const validQuestion = input => input && typeof input.question==='string' && !!input.question.trim() && input.question.length<=1200;

import {ledger} from './ledger.js';
import {PERSONAS,historyKeyFor} from './personas.js';
import {loadConversation,saveConversation,markTainted,isTainted} from './conversation.js';

export async function answerBridgeQuestion(env,body,runner,{signal}={}) {
  const {id,persona,revision,answer}=body||{};
  if(!Object.hasOwn(PERSONAS,persona)||PERSONAS[persona].hidden||typeof id!=='string'||id.length>80
    ||typeof revision!=='string'||revision.length>80||typeof answer!=='string'||!answer.trim()||answer.length>8000)
    return {ok:false,message:'Enter an answer for the current question.'};
  if(!env.LEDGER)return {ok:false,message:'Saved work is unavailable. Nothing was resumed.'};
  let claimed;
  try {claimed=await ledger.execution(env,'claim',{id,persona,revision,answer,token:crypto.randomUUID()});}
  catch {return {ok:false,message:'The resume request could not be confirmed. Refresh before doing anything else.'};}
  if(!claimed)return {ok:false,message:'This question was already answered, expired, or changed. Refresh to see its current state.'};
  const c=claimed.checkpoint,execution={id:claimed.id,token:claimed.token};
  if(c.options?.routineContinuation){
    try{await verifyRoutineContinuation(env,c.options.routineContinuation);}
    catch{
      await finishRoutineContinuation(env,execution,'failed').catch(()=>{});
      return {ok:false,message:'The routine changed, was disabled, or could not be read. Nothing further was resumed.'};
    }
  }
  try {
    const messages=[...c.messages,{role:'user',content:[{type:'tool_result',tool_use_id:c.toolUseId,content:answer.trim()}]}];
    const result=await runner(env,c.personaAndBaseline,c.channelAndSender,c.longTermMemoryBlock,[],c.allowTools,
      c.extraContext,c.personaId,c.startTainted,c.convo,{...c.options,signal,resumeMessages:messages,executionResume:{id:claimed.id,token:claimed.token}});
    if(!result.ok){if(c.options?.routineContinuation)await finishRoutineContinuation(env,execution,'failed');return {ok:false,message:result.data?.error?.message || 'The resumed work could not finish. Earlier actions may have completed; check their records.'};}
    const reply=result.data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
    if(!reply.trim())return {ok:false,message:'The resumed work returned no answer. Earlier actions may have completed; check their records.'};
    let routineResult=null;
    if(c.options?.routineContinuation){
      if(result.paused)await activateRoutineQuestion(env,{paused:true,execution});
      else{
        const {resumeQuestionRoutine}=await import('./routines.js');
        const {executeTool}=await import('./tools.js');
        routineResult=await resumeQuestionRoutine(env,c.options.routineContinuation,reply,executeTool,execution,c.convo.meta);
        if(!routineResult.paused)await finishRoutineContinuation(env,execution,routineResult.batched?'queued':routineResult.ok?'done':'failed');
      }
    }
    let councillorName=null;
    if(c.options?.councillor){
      const {recordCouncilRun,COUNCIL}=await import('./council.js');
      councillorName=COUNCIL[c.options.councillor]?.name || null;
      await recordCouncilRun(env,c.options.councillor,{summary:result.paused?'Waiting for another answer in the Bridge':'Resumed task returned a reply',detail:reply,didSomething:!result.paused,meta:c.convo.meta});
    }
    const key=historyKeyFor(persona,'web');let current;
    try {current=await loadConversation(env,key,{strict:true});}
    catch {return {ok:true,reply,councillor:c.options?.councillor || null,councillorName,paused:!!result.paused||!!routineResult?.paused,message:'The reply is ready, but the saved conversation could not be read. It was not overwritten. Keep this reply.'};}
    // Keep the current hall's metadata rather than replacing newer conversation
    // state with the older checkpoint. Taint from either context is preserved.
    if(isTainted(c.convo?.meta))for(const source of c.convo.meta.tainted.sources||[])markTainted(current.meta,source.source,PERSONAS[persona].historyTurns||30);
    const known=new Set((current.meta._spool||[]).map(e=>JSON.stringify(e)));
    const additions=(c.convo?.meta?._spool||[]).filter(e=>!known.has(JSON.stringify(e)));
    current.meta._spool=[...(current.meta._spool||[]),...additions].slice(-50);
    const turns=[...current.turns,{role:'user',content:`Answer to “${c.question}”: ${answer.trim()}`},{role:'assistant',content:reply,...(c.options?.councillor?{councillor:c.options.councillor}:{})}].slice(-(PERSONAS[persona].historyTurns||30));
    const saved=await saveConversation(env,key,turns,current.meta);
    return {ok:true,reply,councillor:c.options?.councillor || null,councillorName,paused:!!result.paused||!!routineResult?.paused,routineOutcome:routineResult?(routineResult.paused?'waiting':routineResult.batched?'queued':routineResult.ok?'done':'failed'):null,message:saved===false?'The reply is ready, but saving it to the hall failed. Keep this reply.':routineResult?.batched?'The job continued and is now queued for batch processing. It has not finished.':routineResult&&!routineResult.ok?'The councillor replied, but the scheduled job failed: '+routineResult.error:result.paused||routineResult?.paused?'Your answer was used. Another question is waiting.':'The work resumed and returned this reply.'};
  } catch {
    if(c.options?.routineContinuation)await finishRoutineContinuation(env,execution,'unknown').catch(()=>{});
    // Never release a claimed question for automatic retry: a tool might have
    // completed before the exception or lost acknowledgement.
    return {ok:false,message:'The resumed work was interrupted. Earlier actions may have completed. Refresh and inspect the records before starting new work.'};
  }
}
