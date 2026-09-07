// Optional maintenance command: regenerate the checked-in browser catalogue after backend tool changes.
// This imports schemas only; it executes no tools and needs no credentials.
import {writeFileSync} from 'node:fs';
import {TOOL_DEFINITIONS} from '../src/lib/tools.js';
import {personaAllowsTool} from '../src/lib/personas.js';
import {groupOf} from '../src/tools/meta.js';
const personas=['thor','loki','odin'];
const entries=TOOL_DEFINITIONS.map(t=>({id:t.name,title:t.name.replace(/_/g,' '),description:t.description,group:groupOf(t.name),personas:personas.filter(p=>personaAllowsTool(p,t.name)),schema:t.input_schema})).filter(t=>t.personas.length&&t.group!=='hidden');
writeFileSync('public/ui/tool-catalog.json',JSON.stringify({version:1,source:'Repository tool definitions; service availability is checked on use.',tools:entries},null,2)+'\n');
console.log(`${entries.length} public tools; ${new Set(entries.map(t=>t.group)).size} groups.`);
