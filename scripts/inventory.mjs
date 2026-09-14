// Read-only source inventory; writes documentation, never contacts integrations.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {TOOL_DEFINITIONS,toolDefinitionsForPersona} from '../src/lib/tools.js';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n'))].sort();
const read=p=>{try{return readFileSync(p,'utf8')}catch{return ''}};
const source=files.filter(p=>p.startsWith('src/')&&p.endsWith('.js'));
const rows=source.flatMap(p=>read(p).split('\n').map((line,i)=>({p,line,n:i+1})));
const names=new Set(rows.flatMap(({line})=>[...line.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map(m=>m[1])));
let configured=new Set();
try{configured=new Set(JSON.parse(read(join(process.env.TEMP,'asgard-secret-names.json'))).map(x=>x.name))}catch{}
const purposes=p=>p.startsWith('public/')?'Worker-served static asset':p.startsWith('src/tools/')?'Tool catalog / discovery':p.startsWith('src/lib/')?'Backend integration / domain module':p.startsWith('src/')?'Worker entrypoint / Durable Object':p.startsWith('scripts/')?'Check, build or maintenance script':p.startsWith('asgard-companion/')?'Windows voice companion':p.startsWith('asgard-face/')?'Agent-face Chrome extension':p.startsWith('docs/')?'Documentation / evidence':p.endsWith('.html')?'UI source / page':/\.(png|jpg|webp|svg|ico|woff2|glb)$/i.test(p)?'Media asset':'Repository support file (inspect before modifying)';
let text='# Source inventory — 2026-09-14\n\nBaseline: 212c067, current release lineage; pre-existing companion and extension edits preserved. The older rayven-pwa checkout and origin/main are not deployment baselines.\n\n';
text+='## Deployment\n\nWorker `asgrard-backend`, entry `src/index.js`, static assets `public/`, run_worker_first=true. Frontend is deployed with the Worker, not independently via Pages. One five-minute cron. KV RAYVEN_KV, Vectorize VECTORIZE, Workers AI AI, R2 CLIPS, Durable Objects LEDGER and PAPER_LEDGER. Keep both existing DO migrations.\n\nCloudflare currently reports version b4370f11-1354-4457-81fe-ceae6446f9b7 at 100%. This is a baseline observation, not a new deployment.\n\n';
text+='## Existing subsystems\n\nALWAYS-ON companion: YES, asgard-companion/{asgard,wake,obs}.py. Installed at C:/Asgard/companion. HIGH SEAT: PARTIAL. PaperBroker and throwing LiveBroker, paper ledger, analytics and research exist; complete forty-strategy Forge/tournament is not established. Do not mark the entire brief complete. Test baseline: 187/187 Node tests passed.\n\n';
text+='## Registered tools and persona allow-lists\n\nDerived by importing the real registry (no tool execution). Availability is not proof each external integration works.\n\n';
const allowed=Object.fromEntries(['thor','loki','odin','hela'].map(p=>[p,new Set(toolDefinitionsForPersona(p).map(t=>t.name))]));
text+='| Tool | Allowed personas |\n|---|---|\n'+TOOL_DEFINITIONS.map(t=>`| ${t.name} | ${Object.keys(allowed).filter(p=>allowed[p].has(t.name)).join(', ')} |`).join('\n');
text+='\n\n## HTTP route declarations\n\nStatic source extraction includes conditional/dynamic patterns; delegated routers also appear below. Inspect source for authentication and methods.\n\n';
text+=rows.filter(x=>/pathname|url\.path/.test(x.line)&&/if\s*\(|case |match\(/.test(x.line)).map(x=>`- ${x.p}:${x.n}: \`${x.line.trim().replaceAll('`','\\`')}\``).join('\n');
text+='\n\n## Environment names\n\nIncludes bindings and configuration variables as well as secrets; absent from secret list does not imply missing binding. Presence is not validity.\n\n| Name | Wrangler secret list |\n|---|---|\n'+[...names].sort().map(n=>`| ${n} | ${configured.has(n)?'set':'not listed (binding/var/optional/missing)'} |`).join('\n');
text+='\n\n## KV and ledger key declarations\n\nStatic candidate extraction; dynamic keys require source inspection. Existing names are preserved.\n\n';
const keys=new Set();for(const {line} of rows)for(const m of line.matchAll(/['"`]([a-z][a-z0-9_-]*:[^'"`\n]{0,100})['"`]/g))if(!m[1].includes('//'))keys.add(m[1]);
text+=[...keys].sort().map(k=>'- `'+k+'`').join('\n');
text+='\n\n## Extension permissions and backend endpoints\n\n';
for(const p of ['manifest.json','asgard-face/manifest.json']){text+='### '+p+'\n\n```json\n'+read(p)+'\n```\n';}
text+='\nBackend URLs found in extension sources:\n';
const urls=new Set();for(const p of files.filter(p=>/background|extension|asgard-face/.test(p)&&/\.(js|json)$/.test(p)))for(const m of read(p).matchAll(/https:\/\/[a-z0-9.-]+\.workers\.dev/g))urls.add(m[0]);text+=[...urls].sort().map(u=>'- '+u).join('\n');
text+='\n\n## Public HTML pages\n\n'+files.filter(p=>p.startsWith('public/')&&p.endsWith('.html')).map(p=>'- '+p).join('\n');
text+='\n\n## File map\n\nClassification by source location; not a claim of individual feature acceptance.\n\n| Path | Purpose |\n|---|---|\n'+files.map(p=>`| ${p} | ${purposes(p)} |`).join('\n')+'\n';
writeFileSync('docs/INVENTORY.md',text);console.log(JSON.stringify({files:files.length,tools:TOOL_DEFINITIONS.length,environmentNames:names.size,configuredSecrets:configured.size}));
