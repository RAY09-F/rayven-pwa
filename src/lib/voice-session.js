// One speech connection survives turns. Control transitions serialize independently
// from model generation, so an interrupt is never queued behind a long reply.
export function voiceSession({send,connectSpeech,runTurn}) {
 let speech,active,closed=false,sequence=0,controls=Promise.resolve();
 const emit=message=>{if(!closed)send(message);};
 const control=fn=>{const result=controls.then(fn);controls=result.catch(()=>{});return result;};
 async function commit(turn,heard){
  const write=turn.receipt.commit;turn.receipt.commit=null;
  if(write)await write(Math.max(0,Math.min(turn.text.length,Number(heard)||0)));
 }
 function stop(heard=0){
  const turn=active;if(!turn)return Promise.resolve();
  if(turn.stopping)return turn.stopping;
  turn.stopping=(async()=>{
   try{speech?.send(JSON.stringify({context_id:turn.contextId,close_context:true}));}catch{}
   turn.abort.abort();
   await turn.work?.catch(()=>{});
   await commit(turn,heard);
   if(active===turn)active=null;
  })();return turn.stopping;
 }
 async function begin(message){
  if(closed)return null;
  await stop(message.heardChars);
  const turn={id:String(message.id).slice(0,80),contextId:`turn-${++sequence}`,abort:new AbortController(),receipt:{},text:''};active=turn;
  turn.work=(async()=>{
   try{
    if(!speech||!speech.isOpen())speech=await connectSpeech(payload=>{
     if(active?.contextId!==payload.context_id)return;
     emit({type:'audio',id:active.id,audio:payload.audio,alignment:payload.alignment,isFinal:payload.is_final,format:'pcm_16000'});
    },turn.abort.signal);
    turn.abort.signal.throwIfAborted();
    speech.send(JSON.stringify({context_id:turn.contextId,text:' '}));
    const result=await runTurn(message.text,{
     signal:turn.abort.signal,voiceTurn:turn.receipt,
     onText:text=>{turn.abort.signal.throwIfAborted();turn.text+=text;turn.receipt.generated=turn.text;emit({type:'text',id:turn.id,text});speech.send(JSON.stringify({context_id:turn.contextId,text}));},
     onReset:()=>{speech.send(JSON.stringify({context_id:turn.contextId,close_context:true}));turn.contextId=`turn-${++sequence}`;turn.text='';turn.receipt.generated='';emit({type:'reset',id:turn.id});speech.send(JSON.stringify({context_id:turn.contextId,text:' '}));}
    });
    if(result?.error)throw new Error(result.error);
    if(!turn.text&&result?.reply){turn.text=result.reply;turn.receipt.generated=turn.text;emit({type:'text',id:turn.id,text:result.reply});speech.send(JSON.stringify({context_id:turn.contextId,text:result.reply}));}
    speech.send(JSON.stringify({context_id:turn.contextId,text:' ',flush:true}));
    emit({type:'done',id:turn.id,reply:result?.reply||turn.text});
   }catch(error){if(!turn.abort.signal.aborted)emit({type:'error',id:turn.id,message:error.message||'Voice reply failed.'});}
  })();
  return turn;
 }
 async function receive(message){
  if(closed)return;
  if(message.type==='interrupt')return control(()=>message.id&&message.id!==active?.id?undefined:stop(message.heardChars));
  if(message.type==='heard')return control(()=>active?.id===message.id?commit(active,message.heardChars):undefined);
  if(message.type!=='turn'||typeof message.text!=='string'||!message.text.trim()||message.text.length>10000)return;
  const turn=await control(()=>begin(message));return turn?.work;
 }
 return {receive,async close(){closed=true;await control(()=>stop(0));try{speech?.close();}catch{}speech=null;}};
}
