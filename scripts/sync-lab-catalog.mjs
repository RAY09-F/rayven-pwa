import {readFileSync,writeFileSync} from 'node:fs';
import {TOOL_DEFINITIONS} from '../src/lib/tools.js';
import {personaAllowsTool} from '../src/lib/personas.js';
import {groupOf} from '../src/tools/meta.js';
import {TOOLS} from '../src/tools/catalog-lab.js';
const personas=['thor','loki','odin'],names=new Set(TOOLS.map(t=>t.name));
const entries=TOOL_DEFINITIONS.map(t=>({id:t.name,title:t.name.replace(/_/g,' '),description:t.description,group:groupOf(t.name),personas:personas.filter(p=>personaAllowsTool(p,t.name)),schema:t.input_schema})).filter(t=>t.personas.length&&t.group!=='hidden');
for(const directory of ['ui','ui/prism-v1','ui/astral-v1','ui/hud-real-v1']){
  const path=`public/${directory}/tool-catalog.json`,old=JSON.parse(readFileSync(path,'utf8'));
  old.tools=directory==='ui/prism-v1'?entries:[...old.tools.filter(t=>!names.has(t.id)),...entries.filter(t=>names.has(t.id))];
  writeFileSync(path,JSON.stringify(old,null,2)+'\n');
}
