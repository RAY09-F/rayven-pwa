import test from 'node:test';import assert from 'node:assert/strict';import {PERSONAS} from '../src/lib/personas.js';
for(const id of ['thor','loki','odin'])test(`${id} stable spoken instructions and four diverse examples`,()=>{
 const text=PERSONAS[id].systemPrompt;
 assert.match(text,/Everything you say is spoken aloud through a text-to-speech voice/);
 assert.equal((text.match(/<example>/g)||[]).length,4);assert.ok(!/^\s*[-*#]/m.test(text));
 assert.match(text,/avoid_excessive_markdown_and_bullet_points/);assert.match(text,/explicit approval/);
 assert.ok(!text.includes('HELA'));assert.equal(text,PERSONAS[id].systemPrompt);
});
