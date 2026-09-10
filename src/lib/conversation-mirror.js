// Runs inside the existing SQLite Durable Object, serialized by blockConcurrencyWhile.
// KV is the sole read authority. There is deliberately no cutover or delete operation.
export async function mirrorConversation({get,put,kv,now=Date.now},key,nextRaw) {
 const halt=await get('conversation:migration:halt');
 if(halt)throw Error('Conversation migration is stopped after a copy disagreement.');
 const raw=await kv.get(key), record=await get('conversation:copy:'+key);
 if(record&&record.raw!==raw){await put('conversation:migration:halt',{at:now(),reason:'copy disagreement'});throw Error('Conversation migration stopped: KV and SQLite copies disagree. No history was reconciled.');}
 const startedAt=record?.startedAt||now();
 if(nextRaw!==undefined)await kv.put(key,nextRaw);
 await put('conversation:copy:'+key,{raw:nextRaw===undefined?raw:nextRaw,startedAt,lastVerifiedAt:now()});
 return raw;
}
