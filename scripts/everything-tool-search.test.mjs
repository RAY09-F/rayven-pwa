import test from 'node:test';
import assert from 'node:assert/strict';
import {callClaudeWithTools, toolDefinitionsForPersona} from '../src/lib/tools.js';
import {discoveryTools, cacheToolPrefix} from '../src/lib/tool-discovery.js';
import {collectMessage} from '../src/lib/anthropic-stream.js';

const search = {
  type:'server_tool_use', id:'srvtoolu_search', name:'tool_search_tool_bm25',
  input:{query:'calculate arithmetic',limit:5}
};
const found = {
  type:'tool_search_tool_result', tool_use_id:search.id,
  content:{type:'tool_search_tool_search_result',tool_references:[{type:'tool_reference',tool_name:'calculate'}]}
};
const calculation = {type:'tool_use',id:'toolu_calc',name:'calculate',input:{expression:'2+3'}};
const answer = {stop_reason:'end_turn',content:[{type:'text',text:'5'}]};

async function run(responses, {enabled=true, allowTools=true, options={}}={}) {
  const original=globalThis.fetch, requests=[],writes=[];
  const env={TOOL_SEARCH_ENABLED:String(enabled),RAYVEN_KV:{
    get:async()=>null, put:async(...args)=>writes.push(args), delete:async(...args)=>writes.push(args)
  }};
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages','No real tool or vendor request permitted in this test');
    requests.push(JSON.parse(init.body));
    assert.ok(responses.length,'Unexpected inference round trip');
    return Response.json(responses.shift());
  };
  try {
    const result=await callClaudeWithTools(env,'Persona rules\nTHE TOOLBOX: call find_tools first.\nOther rules',
      'Fixture channel','Fixture memory',[{role:'user',content:'Calculate two plus three'}],
      allowTools,null,'thor',false,{meta:{},channel:'web'},options);
    return {result,requests,writes};
  } finally {globalThis.fetch=original;}
}

test('provider catalogue uses the documented name and all permitted schemas without eager alias leaks',()=>{
  for(const persona of ['thor','loki','odin']) {
    const defs=toolDefinitionsForPersona(persona), before=JSON.stringify(defs);
    const tools=cacheToolPrefix(discoveryTools(defs));
    assert.equal(tools[0].type,'tool_search_tool_bm25_20251119');
    assert.equal(tools[0].name,'tool_search_tool_bm25');
    assert.equal(tools.length,defs.length+1);
    assert.deepEqual(tools.slice(1).map(t=>t.name),defs.map(t=>t.name));
    assert.deepEqual(tools.filter(t=>!t.defer_loading).map(t=>t.name),
      ['tool_search_tool_bm25','util_context','web_search','search_memory','list_todos']);
    assert.equal(tools.filter(t=>t.cache_control).length,1);
    assert.ok(tools.filter(t=>t.defer_loading).every(t=>!t.cache_control));
    assert.deepEqual(tools,cacheToolPrefix(discoveryTools(defs)));
    assert.equal(JSON.stringify(defs),before,'Never mutate shared definitions');
  }
});

test('server discovery blocks survive the real loop; only the client tool receives a result',async()=>{
  const content=[search,found,calculation];
  const {result,requests,writes}=await run([{stop_reason:'tool_use',content},answer]);
  assert.equal(result.ok,true);
  assert.deepEqual(result.actions,['calculate']);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1].messages.at(-2),{role:'assistant',content});
  assert.deepEqual(requests[1].messages.at(-1).content.map(b=>b.tool_use_id),['toolu_calc']);
  assert.match(requests[1].messages.at(-1).content[0].content,/5/);
  assert.equal(JSON.stringify(requests[0].tools),JSON.stringify(requests[1].tools));
  assert.match(requests[0].system[0].text,/tool_search_tool_bm25/);
  assert.doesNotMatch(requests[0].system[0].text,/call find_tools first/);
  assert.ok(requests[0].system[0].text.includes('Other rules'));
  assert.deepEqual(writes.map(([key])=>key),['task:log'],'Only the existing execution log is written');
});

test('pause_turn resumes with unchanged server content and never invents a server result',async()=>{
  const paused=[search];
  const {result,requests}=await run([
    {stop_reason:'pause_turn',content:paused},
    {stop_reason:'tool_use',content:[found,calculation]},answer
  ]);
  assert.equal(result.ok,true);
  assert.deepEqual(requests[1].messages.at(-1),{role:'assistant',content:paused});
  assert.equal(requests.length,3);
  assert.ok(requests.every(r=>JSON.stringify(r.tools)===JSON.stringify(requests[0].tools)));
});

test('exhausted pause is a failure, not a completed answer',async()=>{
  const {result,requests}=await run([{stop_reason:'pause_turn',content:[search]}],{options:{maxIter:1}});
  assert.equal(result.ok,false);
  assert.match(result.data.error.message,/before finishing/);
  assert.deepEqual(result.actions,[]);
  assert.equal(requests.length,1);
});

test('final reserved round rejects unexpected tool execution without claiming completion',async()=>{
  const {result}=await run([{stop_reason:'tool_use',content:[calculation]}],{options:{maxIter:1}});
  assert.equal(result.ok,false);
  assert.deepEqual(result.actions,[]);
  assert.match(result.data.error.message,/No further action was run/);
});

test('restricted catalogue is searchable but an out-of-scope client call cannot run',async()=>{
  const only=toolDefinitionsForPersona('thor').filter(t=>t.name==='calculate');
  const denied={...calculation,id:'toolu_send',name:'send_text',input:{to:'fixture',message:'must not send'}};
  const {result,requests,writes}=await run([{stop_reason:'tool_use',content:[denied]},answer],{options:{toolsOverride:only}});
  assert.deepEqual(requests[0].tools.map(t=>t.name),['tool_search_tool_bm25','calculate']);
  assert.equal(requests[0].tools[1].defer_loading,true);
  assert.deepEqual(result.actions,[]);
  assert.match(requests[1].messages.at(-1).content[0].content,/outside.*permissions/);
  assert.equal(writes.length,0);
});

test('tools disabled means no discovery entry and no tool execution',async()=>{
  const {result,requests}=await run([{stop_reason:'tool_use',content:[calculation]},answer],{allowTools:false});
  assert.ok(requests.every(r=>r.tools.length===0));
  assert.deepEqual(result.actions,[]);
  assert.match(requests[1].messages.at(-1).content[0].content,/disabled/);
});

test('rollback flag retains legacy discovery instructions and ordinary tool schemas',async()=>{
  const {requests}=await run([answer],{enabled:false});
  assert.match(requests[0].system[0].text,/call find_tools first/);
  assert.ok(requests[0].tools.every(t=>t.defer_loading===undefined&&!t.type?.startsWith('tool_search')));
});

test('stream collector preserves server search input, references and search errors',async()=>{
  const error={...found,content:{type:'tool_search_tool_result_error',error_code:'unavailable'}};
  const events=[
    {type:'message_start',message:{id:'fixture',content:[],usage:{input_tokens:10}}},
    {type:'content_block_start',index:0,content_block:{...search,input:{}}},
    {type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify(search.input)}},
    {type:'content_block_stop',index:0},
    {type:'content_block_start',index:1,content_block:found},
    {type:'content_block_stop',index:1},
    {type:'content_block_start',index:2,content_block:error},
    {type:'content_block_stop',index:2},
    {type:'message_delta',delta:{stop_reason:'pause_turn'},usage:{output_tokens:4}},
    {type:'message_stop'}
  ];
  const wire=events.map(data=>`data: ${JSON.stringify(data)}\n\n`).join('');
  const result=await collectMessage(new Response(wire).body);
  assert.deepEqual(result.content,[search,found,error]);
  assert.equal(result.stop_reason,'pause_turn');
});
