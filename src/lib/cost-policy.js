export const MAX_MODEL_ROUNDS=6;
export const CACHE={type:'ephemeral',ttl:'1h'};
function withoutCache(value){
  if(Array.isArray(value))return value.map(withoutCache);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='cache_control').map(([k,v])=>[k,withoutCache(v)]));
  return value;
}
// Only the first stable system block and tool definitions are cache boundaries.
// Time, memory retrieval, request IDs and conversation content follow them.
export function stableRequest(system,tools,messages){
  const cleanTools=withoutCache(tools||[]);let last=-1;
  cleanTools.forEach((t,i)=>{if(!t.defer_loading)last=i;});
  if(last>=0)cleanTools[last].cache_control={...CACHE};
  const cleanSystem=withoutCache(system);
  if(Array.isArray(cleanSystem)&&cleanSystem[0]?.type==='text')cleanSystem[0].cache_control={...CACHE};
  return {system:cleanSystem,tools:cleanTools,messages:withoutCache(messages)};
}
export function modelRoundLimit(value){const n=Number(value);return Number.isFinite(n)&&n>0?Math.min(MAX_MODEL_ROUNDS,Math.floor(n)):MAX_MODEL_ROUNDS;}
export function boundedToolResult(value,max=12000){
  if(Array.isArray(value))return value.map(block=>block?.type==='text'?{...block,text:boundedToolResult(block.text,max)}:block);
  const text=typeof value==='string'?value:JSON.stringify(value??'');
  return text.length>max?text.slice(0,max)+'\n[Result shortened. Narrow the query or request the needed section for more detail.]':text;
}
