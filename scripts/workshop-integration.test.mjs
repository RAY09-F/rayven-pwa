import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOOLS as business} from '../src/tools/catalog-business-lab.js';
import {TOOLS as workbench} from '../src/tools/catalog-workbench.js';
import {CATALOG_NAMES,runCatalogTool} from '../src/tools/catalog.js';
import {personaAllowsTool} from '../src/lib/personas.js';
test('100 new tools are unique, discoverable and execute identically through the catalogue',async()=>{
  const tools=[...business,...workbench];assert.equal(tools.length,100);assert.equal(new Set(CATALOG_NAMES).size,CATALOG_NAMES.length);
  for(const t of tools){assert.ok(CATALOG_NAMES.includes(t.name));for(const persona of ['thor','loki','odin'])assert.ok(personaAllowsTool(persona,t.name));const input=structuredClone(t.input_examples[0]);assert.equal(await runCatalogTool({},t.name,input),await t.run({},structuredClone(input)),t.name);}
});
test('browser tool implementations and inventory match current Worker sources',async()=>{
  for(const name of ['catalog-business-lab.js','catalog-workbench.js'])assert.equal(await readFile(new URL('../src/tools/'+name,import.meta.url),'utf8'),await readFile(new URL('../public/ui/workshop/tools/'+name,import.meta.url),'utf8'),name+' needs build-workshop');
  const inventory=JSON.parse(await readFile(new URL('../public/ui/workshop/inventory.json',import.meta.url),'utf8'));assert.equal(inventory.count,100);assert.deepEqual(inventory.tools.map(t=>t.name),[...business,...workbench].map(t=>t.name));
});
