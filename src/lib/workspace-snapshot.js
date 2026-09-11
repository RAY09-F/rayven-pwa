// Read-only projection. A failed source is not reported as an empty account.
export async function workspaceSnapshot(env){
  async function read(key,array=true){try{const raw=await env.RAYVEN_KV.get(key);if(raw==null)return {available:true,data:array?[]:null};const data=JSON.parse(raw);if(array?!Array.isArray(data):(!data||typeof data!=='object'||Array.isArray(data)))throw Error('shape');return {available:true,data};}catch{return {available:false,data:null};}}
  const keys=['todos','calendar:events','kit:timers','paper:trades','paper:portfolio','activity:log'];
  const values=await Promise.all(keys.map(k=>read(k,k!=='paper:portfolio')));
  const [todos,calendar,reminders,trades,portfolio,activity]=values;
  const marks={};await Promise.all(['baldr','vidar','tyr','heimdall','freya'].map(async id=>{const candles=await read('paper:candles:'+id);const last=candles.data?.at(-1);if(last&&Number.isFinite(last.close))marks[id]={price:last.close,at:last.time};}));
  return {generatedAt:new Date().toISOString(),mode:'PAPER / SIM',historyScope:'Retained closed-trade history; older records may have been capped.',todos,calendar,reminders,trades,portfolio,activity,marks};
}
