// These tools are pure: the browser and Worker use identical implementation bytes.
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {TOOLS as business} from '../src/tools/catalog-business-lab.js';
import {TOOLS as workbench} from '../src/tools/catalog-workbench.js';
import {existsSync} from 'node:fs';
const root='public/ui/workshop/tools';await mkdir(root,{recursive:true});
for(const name of ['catalog-business-lab.js','business-lab-helpers.js','catalog-workbench.js','workbench-helpers.js'])if(existsSync('src/tools/'+name))await copyFile('src/tools/'+name,root+'/'+name);
const tools=[...business,...workbench];
if(new Set(tools.map(t=>t.name)).size!==tools.length)throw Error('Duplicate workshop tool name');
await writeFile('public/ui/workshop/inventory.json',JSON.stringify({count:tools.length,source:'Same deterministic tools used by the Worker; browser execution needs no provider.',tools:tools.map(({run,...t})=>t)},null,2)+'\n');
console.log(`${tools.length} runnable workshop tools generated.`);
