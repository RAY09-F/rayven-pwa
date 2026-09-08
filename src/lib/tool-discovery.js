// Provider-managed discovery keeps the HTTP schema array byte-stable per persona.
// Activation is gated until the live model compatibility/cache acceptance passes.
const CORE = new Set(['memory_search','search_memory','web_search','plan_todos','list_todos','util_context']);
export function discoveryTools(definitions) {
  return [{type:'tool_search_tool_bm25_20251119',name:'tool_search'}, ...definitions.map(({cache_control,...definition})=>({ ...definition, defer_loading: definition.defer_loading === true || !CORE.has(definition.name) }))];
}
export function cacheToolPrefix(definitions) {
  let last = -1;
  definitions.forEach((tool,index)=>{if(!tool.defer_loading)last=index;});
  return definitions.map(({cache_control,...tool},index)=>index===last?{...tool,cache_control:{type:'ephemeral',ttl:'1h'}}:tool);
}
export function capToolResult(value, format = 'concise') {
  // Keep image blocks as provider content, not JSON text (the extension relies on this).
  if (Array.isArray(value) && value.length && value.every(b=>b && (b.type==='text'||b.type==='image'))) return value.map(b=>b.type==='text'?{...b,text:capToolResult(b.text,format)}:b);
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  const encoder = new TextEncoder(), bytes = encoder.encode(text), limit = format === 'full' ? 24000 : 8000;
  if (bytes.length <= limit) return text;
  // Byte count is a conservative bound, NOT a fabricated provider token count.
  return new TextDecoder().decode(bytes.slice(0,limit)) + '\n[Result shortened. Request a narrower range or response_format="full".]';
}
