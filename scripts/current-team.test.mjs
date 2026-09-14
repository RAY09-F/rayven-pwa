import test from 'node:test';import assert from 'node:assert/strict';
import {PERSONAS} from '../src/lib/personas.js';
import {TOOL_DEFINITIONS} from '../src/lib/tools.js';
import {askSiblingAgent,handleAgentQuery} from '../src/lib/sibling-agents.js';
test('current personas and tool registry use Achilles',()=>{
 for(const persona of Object.values(PERSONAS)){assert.doesNotMatch(persona.systemPrompt,/kevos/i);assert.match(persona.systemPrompt,/ACHILLES/)}
 assert.ok(TOOL_DEFINITIONS.some(t=>t.name==='ask_achilles'));assert.ok(!TOOL_DEFINITIONS.some(t=>t.name==='ask_kevos'));
});
test('Achilles missing configuration is reported instead of sending to a retired endpoint',async()=>{
 assert.match(await askSiblingAgent('ACHILLES',undefined,undefined,'status'),/isn't configured/);
});
test('retired caller cannot authenticate with a legacy key',async()=>{
 const request=new Request('https://asgard.test/agent/query',{method:'POST',headers:{'Content-Type':'application/json','X-Agent-Sig':'test'},body:JSON.stringify({from:'kevos',question:'status',ts:Date.now(),hops:0})});
 const result=await handleAgentQuery(request,{AGENT_KEY_RAYVEN_KEVOS:'legacy-fixture'},{});assert.equal(result.status,401);
});
