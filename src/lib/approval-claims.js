// Execution receipts only; approval contents remain in the existing store.
// Run under the existing ledger's concurrency block, never around a tool call.
export async function approvalClaim(store,action,{key,revision,token,status,message}) {
  if(typeof key!=='string'||key.length>200||typeof revision!=='string'||typeof token!=='string')throw Error('Invalid approval claim');
  const name='approval:claim:'+key,previous=await store.get(name);
  if(action==='claim') {
    if(previous&&(previous.status!=='pending'||previous.revision!==revision))return {ok:false,status:previous.status,message:previous.message||'This approval has already been handled or is still being processed. Refresh its record.'};
    await store.put(name,{revision,token,status:'busy',at:Date.now()});return {ok:true};
  }
  if(!previous||previous.token!==token||previous.status!=='busy')throw Error('Approval claim no longer belongs to this request');
  if(!['pending','approved','rejected','unknown'].includes(status))throw Error('Invalid approval outcome');
  await store.put(name,{revision,token,status,message:String(message||'').slice(0,1000),at:Date.now()});return {ok:true};
}
