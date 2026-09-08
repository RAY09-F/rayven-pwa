import test from 'node:test';import assert from 'node:assert/strict';
import {TOOL_RENAME_MAP,canonicalToolName,implementationToolName,aliasSchemas} from '../src/lib/tool-aliases.js';
import {TOOL_DEFINITIONS,toolDefinitionsForPersona} from '../src/lib/tools.js';
import {personaAllowsTool} from '../src/lib/personas.js';
import {checkPermission,setToolPermission} from '../src/lib/permissions.js';
test('every implementation has a unique reversible final name',()=>{
 assert.equal(Object.keys(TOOL_RENAME_MAP).length + 3,TOOL_DEFINITIONS.length);
 for(const t of TOOL_DEFINITIONS)assert.equal(implementationToolName(canonicalToolName(t.name)),t.name);
});
test('legacy and canonical names keep identical persona and permission boundaries',async()=>{
 const env={RAYVEN_KV:{get:async()=>JSON.stringify({spotify_play:'off'}),put:async()=>{throw Error('Unexpected write');}}};
 for(const [oldName,newName] of Object.entries(TOOL_RENAME_MAP)){
  for(const p of ['thor','loki','odin'])assert.equal(personaAllowsTool(p,oldName),personaAllowsTool(p,newName));
  assert.equal(await checkPermission(env,oldName),await checkPermission(env,newName));
 }
 assert.match(await setToolPermission(env,'comms_sms_send','auto'),/hardwired/);
});
test('no family activates before its release; enabling one retains deferred legacy schemas',()=>{
 assert.ok(toolDefinitionsForPersona('thor').some(t=>t.name==='spotify_play'));
 const defs=aliasSchemas([{name:'spotify_play',description:'Play music',input_schema:{type:'object'},cache_control:{type:'ephemeral'}},{name:'weather',description:'Weather'}],['music']);
 assert.deepEqual(defs.map(t=>t.name),['music_play','spotify_play','weather']);assert.equal(defs[1].defer_loading,true);assert.equal(defs[1].cache_control,undefined);
});
test('concealed tools remain absent from public schema even through aliases',()=>{
 for(const p of ['thor','loki','odin']){assert.equal(personaAllowsTool(p,'util_lock_in'),false);assert.ok(!toolDefinitionsForPersona(p).some(t=>['util_lock_in','lock_in'].includes(t.name)));}
});
test('discovery keeps every allowed schema, only core eager, caches last eager definition',async()=>{
 const {discoveryTools,cacheToolPrefix,capToolResult}=await import('../src/lib/tool-discovery.js');
 const defs=toolDefinitionsForPersona('thor'), result=cacheToolPrefix(discoveryTools(defs));
 assert.equal(result.length,defs.length+1);assert.equal(result[0].type,'tool_search_tool_bm25_20251119');
 assert.equal(result.filter(t=>t.cache_control).length,1);assert.ok(!result.find(t=>t.cache_control).defer_loading);
 assert.ok(result.filter(t=>!t.defer_loading).length<=5);
 assert.deepEqual(result,cacheToolPrefix(discoveryTools(defs)));
 assert.ok(new TextEncoder().encode(capToolResult('⚡'.repeat(30000),'full')).length<25000);
});
