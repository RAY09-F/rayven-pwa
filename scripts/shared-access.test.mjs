import test from 'node:test';
import assert from 'node:assert/strict';
import { personaAllowsTool } from '../src/lib/personas.js';
import { toolDefinitionsForPersona } from '../src/lib/tools.js';
import { checkPermission, getToolPermissionsText } from '../src/lib/permissions.js';

for (const persona of ['thor', 'loki', 'odin']) {
  test(`${persona} can discover and dispatch research, calls and Chrome tools`, () => {
    const visible = new Set(toolDefinitionsForPersona(persona).map(t => t.name));
    for (const tool of ['web_search', 'tavily_research', 'tavily_extract', 'make_call', 'send_text', 'browser_navigate', 'browser_read_page', 'browser_probe', 'browser_screenshot', 'browser_click', 'browser_type', 'browser_scroll', 'browser_click_coords', 'browser_type_coords']) {
      assert.equal(personaAllowsTool(persona, tool), true, tool);
      assert.equal(visible.has(tool), true, tool);
    }
    assert.equal(personaAllowsTool(persona, 'lock_in'), false);
  });
}

test('reported permissions match enforcement, including legacy auto call settings', async () => {
  for (const permissions of [{}, {make_call:'auto', send_text:'notify'}, {make_call:'off', browser_click:'confirm'}]) {
    const env = {RAYVEN_KV:{get:async()=>JSON.stringify(permissions)}};
    const reported = Object.fromEntries((await getToolPermissionsText(env)).split('\n').map(line=>line.split(': ')));
    for (const tool of ['make_call', 'send_text', 'browser_click', 'browser_navigate']) {
      assert.equal(reported[tool], await checkPermission(env, tool));
    }
    assert.equal(await checkPermission(env, 'web_search'), 'auto');
  }
});
