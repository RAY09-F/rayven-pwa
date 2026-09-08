// Deterministic inventory reconciliation. Imports metadata, never invokes backend tools.
// Run: node scripts/index-backlog.mjs [--check]
// --check regenerates in memory and verifies the two checked-in reports.
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TOOL_DEFINITIONS} from '../src/lib/tools.js';
import {CATALOG, DROPPED} from '../src/tools/catalog.js';
import {personaAllowsTool} from '../src/lib/personas.js';
import {GATEABLE_TOOLS, HARD_CONFIRM_TOOLS, DEFAULT_PERMISSION_LEVELS} from '../src/lib/permissions.js';
import {LOCAL_TOOLS} from '../public/ui/local-tools.js';
import {AUTOMATIONS} from '../public/ui/expansion.js';
import {MISSIONS} from '../public/ui/arsenal.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const read=p=>readFileSync(p,'utf8');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const masterPath='docs/bifrost/MASTER-REFERENCE.md', master=read(masterPath), lines=master.split('\n');
const backendPath='public/ui/tool-catalog.json', proposalPath='public/ui/expansion-catalog.json';
const backend=JSON.parse(read(backendPath)).tools, proposals=JSON.parse(read(proposalPath)).tools;
const counts={B:223,L:36,P:186,A:24,M:16}, personas=['thor','loki','odin'];
const head=git('rev-parse','HEAD'), remote=git('rev-parse','origin/main');
const proofPath='docs/bifrost/evidence/release-proof.json';
const proof=existsSync(proofPath)?JSON.parse(read(proofPath)):null;
const sourceCache=new Map();
const sourceAt=(revision,file)=>{const key=`${revision}:${file}`;if(!sourceCache.has(key))sourceCache.set(key,execFileSync('git',['show',key],{stdio:['ignore','pipe','ignore']}));return sourceCache.get(key);};
const sha=data=>createHash('sha256').update(data).digest('hex');
const deployedAssets=new Map();
if(proof){
 assert.match(proof.sourceRevision,/^[a-f0-9]{40}$/,'Release proof needs full source revision');
 assert.equal(proof.pushedRevision,proof.sourceRevision,'Released revision must match the evidenced push');
 assert.match(proof.workerVersion,/^[a-f0-9-]{36}$/,'Release proof needs Worker version');
 assert.ok(proof.verifiedAt&&proof.base&&proof.release&&Array.isArray(proof.assetChecks),'Release metadata/assets missing');
 for(const asset of proof.assetChecks){
  assert.ok(asset.path.startsWith('/')&&!asset.path.includes('..'),'Invalid asset proof path');
  const file=asset.path==='/'?'public/index.html':`public${asset.path.split('?')[0]}`;
  assert.equal(sha(sourceAt(proof.sourceRevision,file)),asset.sha256,`Release proof/source hash mismatch: ${file}`);
  const expected=file.endsWith('.js')?/^(?:text|application)\/javascript\b/:file.endsWith('.css')?/^text\/css\b/:file.endsWith('.json')?/^application\/json\b/:file.endsWith('.html')?/^text\/html\b/:null;
  if(expected)assert.match(asset.type,expected,`Release proof asset MIME mismatch: ${file}`);
  deployedAssets.set(file,asset);
 }
 assert.ok(deployedAssets.has('public/index.html'),'Release proof must include root HTML');
}
function matchesRelease(files){return !!proof&&files.every(file=>{try{return sourceAt(proof.sourceRevision,file).compare(readFileSync(file))===0;}catch{return false;}});}
function deploymentFor(family,location,relevant){
 if(!proof)return {status:'not checked',evidence:null};
 const frontend=deployedAssets.has(location)&&matchesRelease([location]);
 const backend=proof.backendSourceUnchanged===true&&matchesRelease(relevant.concat('wrangler.toml'));
 const verified=family==='B'?frontend&&backend:frontend;
 if(!verified)return {status:'not checked',evidence:proofPath,note:'Current source or required deployment evidence does not match release snapshot.'};
 return {status:family==='P'?'absent in live revision':'present in live revision',source_revision:proof.sourceRevision,worker_version:proof.workerVersion,release:proof.release,evidence:proofPath,
  scope:family==='B'?'Registered backend handler source and public catalogue; connection and execution unverified.':family==='L'?'Browser implementation asset; individual live result behavior separately verified.':family==='P'?'Proposal catalogue present; executable adapter absent.':'Preparation UI present only; executable workflow or completed mission not established.',
  catalogue_asset_present:true,adapter_or_workflow_established:['B','L'].includes(family)};
}
const definitions=new Map(TOOL_DEFINITIONS.map(t=>[t.name,t]));
const backendById=new Map(backend.map(t=>[t.id,t]));
const localById=new Map(LOCAL_TOOLS.map(t=>[t.id,t]));
const proposalById=new Map(proposals.map(t=>[t.id,t]));
const lineAt=(text,index)=>text.slice(0,index).split('\n').length;
const ref=(file,start,end=start)=>({file,start_line:start,end_line:end});
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${path}/${e.name}`):e.name.endsWith('.js')?[`${path}/${e.name}`]:[]);}
const sourceFiles=walk('src'), sourceText=new Map(sourceFiles.map(f=>[f,read(f)]));
const toolsPath='src/lib/tools.js', dispatcher=sourceText.get(toolsPath);
const cases=[...dispatcher.matchAll(/case '([^']+)':/g)];
const imports=new Map();
for(const m of dispatcher.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)){
 for(const name of m[1].split(',').map(s=>s.trim()).filter(Boolean))imports.set(name,relative(root,resolve(root,dirname(toolsPath),m[2])));
}
function handlerFor(id){
 const index=cases.findIndex(c=>c[1]===id);
 if(index>=0){
  const c=cases[index], end=index+1<cases.length?cases[index+1].index:dispatcher.indexOf('default:',c.index);
  const body=dispatcher.slice(c.index,end), functions=[...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
  const implementation=[];
  for(const name of new Set(functions)){
   const file=imports.get(name);if(!file)continue;
   const text=sourceText.get(file)||read(file);
   const pos=text.search(new RegExp('(?:function\\s+'+name+'\\b|(?:const|let)\\s+'+name+'\\s*=)'));
   implementation.push({...ref(file,pos<0?1:lineAt(text,pos)),symbol:name});
  }
  for(const m of body.matchAll(/import\('([^']+)'\)/g))implementation.push(ref(relative(root,resolve(root,dirname(toolsPath),m[1])),1));
  return {dispatch:ref(toolsPath,lineAt(dispatcher,c.index),lineAt(dispatcher,end)-1),implementation,body};
 }
 if(CATALOG[id]){
  for(const [file,text] of sourceText){
   if(!file.startsWith('src/tools/catalog-'))continue;
   const m=new RegExp("\\bname:\\s*['\"]"+id+"['\"]").exec(text);if(!m)continue;
   const next=text.slice(m.index+m[0].length).search(/\bname:\s*['"]/);
   const end=next<0?text.length:m.index+m[0].length+next;
   return {dispatch:ref('src/tools/catalog.js',48,53),implementation:[ref(file,lineAt(text,m.index),lineAt(text,end)-1)],body:text.slice(m.index,end)};
  }
 }
 return null;
}
function definitionRefs(id){
 const refs=[];
 for(const [file,text]of sourceText){
  const re=new RegExp("\\bname:\\s*['\"]"+id+"['\"]",'g');
  for(const m of text.matchAll(re))refs.push(ref(file,lineAt(text,m.index)));
 }
 return refs;
}
const deliveryCache=new Map();
function delivery(files){
 const unique=[...new Set(files)].sort();
 const changed=unique.filter(file=>{
  if(deliveryCache.has(file))return deliveryCache.get(file);
  let different=true;try{different=execFileSync('git',['show',`${head}:${file}`],{stdio:['ignore','pipe','ignore']}).compare(readFileSync(file))!==0;}catch{}
  deliveryCache.set(file,different);return different;
 });
 return {status:changed.length?'local only':head===remote?'pushed':'committed',revision:head,remote_tracking_revision:remote,local_changes:changed,note:'Compared relevant files to HEAD; origin/main is the locally observed ref, not a fresh remote query.'};
}
const test=spawnSync(process.execPath,['--test','scripts/local-tools.test.mjs'],{encoding:'utf8'});
const localTests={command:'node --test scripts/local-tools.test.mjs',exit_code:test.status,tests:Number(test.stdout.match(/# tests (\d+)/)?.[1]||0),passed:Number(test.stdout.match(/# pass (\d+)/)?.[1]||0),failed:Number(test.stdout.match(/# fail (\d+)/)?.[1]||0)};
assert.equal(test.status,0,`Local tests failed:\n${test.stdout}\n${test.stderr}`);
const starts=lines.flatMap((line,index)=>{
 const m=/^### ([BLPAM]\d{2,3})\. (.+)$/.exec(line);return m?[{inventory_id:m[1],title:m[2],start:index}]:[];
});
assert.equal(starts.length,485,'All 485 inventory/workflow entries must be retained');
const entries=starts.map((entry,i)=>{
 const family=entry.inventory_id[0], next=starts[i+1]?.start??lines.length;
 let end=next;for(let j=entry.start+1;j<next;j++)if(/^## /.test(lines[j])){end=j;break;}
 while(end>entry.start&&!lines[end-1].trim())end--;
 const section=lines.slice(entry.start,end).join('\n');
 const fields=Object.fromEntries([...section.matchAll(/^- ([^:\n]+): (.*)$/gm)].map(m=>[m[1],m[2]]));
 const runtime=section.match(/^- (?:Exact ID|Catalogue ID): `([^`]+)`/m)?.[1]??null;
 const number=Number(entry.inventory_id.slice(1));
 const item=family==='B'?backendById.get(runtime):family==='L'?localById.get(runtime):family==='P'?proposalById.get(runtime):family==='A'?AUTOMATIONS[number-1]:MISSIONS[number-1];
 assert.ok(item,`${entry.inventory_id}: matching repository entry missing`);
 if(family!=='B')assert.equal(item.title,entry.title,`${entry.inventory_id}: title drift`);
 const location=family==='B'?backendPath:family==='L'?'public/ui/local-tools.js':family==='P'?proposalPath:family==='A'?'public/ui/expansion.js':'public/ui/arsenal.js';
 const locationText=read(location), marker=family==='L'?`tool('${runtime.slice(6)}'`:runtime?`"id": "${runtime}"`:`'${entry.title}'`;
 const markerIndex=locationText.indexOf(marker);assert.ok(markerIndex>=0,`Entry marker missing: ${entry.inventory_id}`);
 const handler=family==='B'?handlerFor(runtime):null;
 const def=family==='B'?definitions.get(runtime):null;
 if(family==='B'){
  assert.ok(def,`${runtime}: registration absent`);
  assert.deepEqual(item.schema,def.input_schema,`${runtime}: public/backend schema drift`);
  assert.deepEqual(item.personas,personas.filter(p=>personaAllowsTool(p,runtime)),`${runtime}: persona drift`);
 }
 const sourceStatus=family==='B'?(handler?'implemented':'partial'):family==='L'?'implemented':family==='P'?'absent':'partial';
 const references=handler?[handler.dispatch,...handler.implementation]:[ref(location,lineAt(locationText,markerIndex))];
 const dependencies=family==='B'?references.filter(r=>r.file!==toolsPath).map(r=>({file:r.file,scope:CATALOG[runtime]?'entry':'module (may include dependencies used by other functions)',text:CATALOG[runtime]?handler.body:read(r.file)})):[];
 const dependencyHints=dependencies.map(({file,scope,text})=>({file,scope,hostnames:[...new Set([...text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map(m=>m[1]))].sort(),binding_names:[...new Set([...text.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)].map(m=>m[1]))].sort()}));
 const browserCheck=family==='L'?proof?.localBrowserChecks?.find(c=>c.inventoryId===entry.inventory_id&&c.passed===true&&c.evidence&&c.result):null;
 const blocker=family==='B'?'Provider, live permission/connection and output behavior unverified; UI prepares a chat request, not a direct execution receipt.':family==='L'?(browserCheck?'No provider needed; live browser result evidence applies only to the recorded input case.':proof?'Implementation asset deployed; individual browser result interaction not checked for this entry.':'Production delivery and browser result interaction not checked by this index.'):family==='P'?'Catalogue proposal only; no adapter registered under this ID. Requirements and acceptance need implementation.':family==='A'?'Preparation brief only; no workflow/run ID, activation, dry run, deduplication or stop-path evidence.':'Request template only; no completed artifact or tool-execution evidence.';
 const relevant=[location,...references.map(r=>r.file),...(family==='B'?['src/lib/personas.js','src/lib/permissions.js','public/ui/arsenal.js']:[])];
 return {inventory_id:entry.inventory_id,family,title:entry.title,runtime_id:runtime,source:ref(masterPath,entry.start+1,end),source_fields:fields,
  evidence_date:'2026-09-08',catalogue_reference:ref(location,lineAt(locationText,markerIndex)),
  source_implementation:{status:sourceStatus,meaning:family==='B'?'Registered source dispatcher and implementation exist; operational completeness is unverified.':family==='L'?'Deterministic browser utility with schema and callable implementation.':family==='P'?'Proposal record is present; adapter implementation absent.':'Preparation UI is implemented; requested end-to-end workflow is not established.',definition_references:family==='B'?definitionRefs(runtime):[],handler_references:references},
  repository_delivery:{...delivery(relevant),...(proof&&matchesRelease(relevant)?{released_source_revision:proof.sourceRevision,pushed_revision:proof.pushedRevision}: {})},deployment:deploymentFor(family,location,relevant),connection:{status:family==='L'?'not required':'unknown',provider:family==='L'?'None; local supplied-input computation':family==='B'?'See source dependency hints; credential/provider health not queried':fields['Recorded requirements']||fields['Existing capabilities to inspect']||'Depends on resolved workflow tools',dependency_hints:dependencyHints},
  verification:{status:browserCheck?'live read pass':family==='L'?'fixture pass':'untested',evidence:browserCheck?{fixtures:localTests,browser:browserCheck,release_proof:proofPath}:family==='L'?localTests:null,note:browserCheck?'Client-side calculation exercised in the deployed browser for recorded inputs; no external provider connection or invocation implied.':family==='L'?'All 36 run with representative input; targeted boundaries in same test file. No individual live browser or provider verification for this entry.':'Index/schema correspondence checks are not runtime verification.'},
  user_availability:{status:browserCheck?'ready':family==='B'?'permission restricted':'disabled',note:browserCheck?'Local browser calculation verified for the recorded case; no provider needed.':family==='B'?'Conservative audit status pending live policy/provider checks; not a claim that the server has disabled this tool.':family==='L'?'Local implementation passes fixtures; individual browser behavior has not been cleared by this audit.':'Execution not established; proposal/preparation UI may be visible.'},
  allowed_personas:family==='B'?item.personas:family==='L'?personas:null,
  input_contract:family==='B'?def.input_schema:family==='L'?item.schema:family==='A'?{trigger:item.trigger,action:item.action,tools_to_inspect:item.tools}:family==='M'?{prompt:item.prompt}:null,
  output_contract:family==='L'?{kind:'structured local object',schema:null,note:'Outputs are produced by tool.run; no formal output schema.'}:family==='B'?{kind:'handler-defined; text or structured value',schema:null,note:'No common validated output schema was established; inspect referenced handler.'}:null,
  permission_gate:family==='B'?{gateable:GATEABLE_TOOLS.includes(runtime),hard_confirmation:HARD_CONFIRM_TOOLS.includes(runtime),default_level:DEFAULT_PERMISSION_LEVELS[runtime]||(HARD_CONFIRM_TOOLS.includes(runtime)?'confirm':'auto'),live_setting:'unknown',references:[ref('src/lib/permissions.js',54,62),ref(toolsPath,973,1008)],note:'Chat loop enforces persona/permission/taint checks; executeTool alone is not an authenticated generic endpoint.'}:null,
  blocker};
});
for(const [family,count]of Object.entries(counts)){
 const selected=entries.filter(e=>e.family===family);assert.equal(selected.length,count);
 for(let i=1;i<=count;i++)assert.ok(selected.some(e=>Number(e.inventory_id.slice(1))===i),`${family}${i}: missing ID`);
}
const runtimeIds=entries.filter(e=>e.runtime_id).map(e=>e.runtime_id);
const duplicateRuntimeIds=[...new Set(runtimeIds.filter((id,i)=>runtimeIds.indexOf(id)!==i))];
assert.equal(duplicateRuntimeIds.length,0,'Runtime IDs must not be double counted');
assert.equal(backend.length,223);assert.equal(LOCAL_TOOLS.length,36);assert.equal(proposals.length,186);assert.equal(AUTOMATIONS.length,24);assert.equal(MISSIONS.length,16);
const exactReferences=[];
for(const entry of entries.filter(e=>e.family==='A'||e.family==='M')){
 const text=Object.values(entry.source_fields).join(' ');
 for(const target of entries.filter(e=>e.family==='B'||e.family==='L')){
  if(new RegExp('(?<![a-zA-Z0-9_])'+target.runtime_id+'(?![a-zA-Z0-9_])').test(text))exactReferences.push({from:entry.inventory_id,to:target.inventory_id,runtime_id:target.runtime_id,kind:'exact runtime ID mentioned in source brief; not proof of execution'});
 }
}
// Explicit conceptual overlap, never adapter-equivalence or additional installed tools.
const overlapSeeds=[
 ['P018','local_weighted_score'],['P035','local_capacity'],['P042','local_capacity'],['P088','approvals_list'],
 ['P091','A01'],['P092','A03'],['P093','A04'],['P096','A23'],['P097','A19'],['P098','A20'],
 ['P109','approvals_list'],['P110','local_retry'],['P112','routine_pause'],['P114','local_acceptance'],
 ['P115','cost_report'],['P116','local_rate_budget'],['P119','routine_history'],['P120','routine_pause'],
 ['P136','M12'],['P146','local_redact'],['P147','local_redact'],['P158','local_margin'],['P164','local_capacity'],
 ['P166','A24'],['P169','search_memory'],['P170','delegate'],['P175','remember_this'],['P178','add_todo'],
 ['P182','A18'],['P183','M16'],['P186','routine_history']
];
const conceptualOverlaps=overlapSeeds.map(([a,b])=>{
 const source=entries.find(e=>e.inventory_id===a),target=entries.find(e=>e.inventory_id===b||e.runtime_id===b);
 assert.ok(source&&target,`Invalid correspondence ${a}/${b}`);
 return {from:source.inventory_id,to:target.inventory_id,runtime_id:target.runtime_id,kind:'related concept to reuse/reconcile; existing utility or brief does not fulfill proposed adapter contract'};
});
const hidden=TOOL_DEFINITIONS.filter(t=>!backendById.has(t.name));
const report={format_version:1,evidence_date:'2026-09-08',scope:'485 retained entries; 445 capability catalogue entries plus 24 preparation briefs and 16 mission templates. No backend/live invocation.',source_sha256:createHash('sha256').update(master).digest('hex'),inventory_counts:counts,capability_count:445,total_indexed:entries.length,
 repository_revision:head,remote_tracking_revision:remote,release_evidence:proof?{file:proofPath,source_revision:proof.sourceRevision,pushed_revision:proof.pushedRevision,worker_version:proof.workerVersion,release:proof.release,url:proof.base,verified_at:proof.verifiedAt,asset_hashes_verified:deployedAssets.size,backend_source_unchanged:proof.backendSourceUnchanged===true}:null,verification:localTests,
 reconciliation:{backend_registered_total:TOOL_DEFINITIONS.length,public_backend_total:backend.length,non_public_registered_total:hidden.length,historically_dropped_catalog_ids:[...DROPPED].sort(),duplicate_runtime_ids:duplicateRuntimeIds,unmapped_backend_handlers:entries.filter(e=>e.family==='B'&&e.source_implementation.status!=='implemented').map(e=>e.runtime_id),exact_brief_references:exactReferences,conceptual_overlaps:conceptualOverlaps},entries};
assert.equal(report.reconciliation.unmapped_backend_handlers.length,0,'Every public backend definition needs dispatcher evidence');
const summaryRows=Object.keys(counts).map(f=>{const e=entries.filter(e=>e.family===f),status=e[0];return `| ${f} | ${e.length} | ${status.source_implementation.status} | ${[...new Set(e.map(x=>x.verification.status))].join(' / ')} | ${status.connection.status} |`;}).join('\n');
const md=`# Capability status — deterministic inventory audit\n\nEvidence date: 2026-09-08. Source revision: \`${head}\`; locally observed origin/main: \`${remote}\`. Full per-entry matrix: [CAPABILITY-STATUS.json](CAPABILITY-STATUS.json). Source ranges refer to [MASTER-REFERENCE.md](MASTER-REFERENCE.md).\n\n**All 485 entries are retained:** 223 public backend definitions + 36 local utilities + 186 proposals = 445 catalogue entries; the additional 24 automation briefs and 16 missions are workflow/request records, not installed tools. Backend registry has ${TOOL_DEFINITIONS.length} total registrations; ${hidden.length} non-public registrations are counted only; their identities and private hints are intentionally omitted. ${DROPPED.size} historically dropped catalogue IDs remain recorded as excluded, without implying a fresh live failure test.\n\n| Family | Count | Source implementation | Verification | Connection |\n| --- | ---: | --- | --- | --- |\n${summaryRows}\n\nEvery entry has independent source, repository delivery, deployment, connection, verification and conservative user-availability dimensions; exact schema, persona policy, handler/source references and blockers are preserved. ${proof?`**Released source is present:** Worker version ${proof.workerVersion}, release ${proof.release}, pushed source ${proof.sourceRevision}. ${deployedAssets.size} frontend asset hashes match that source. B/L source presence is recorded; P adapters remain absent and A/M surfaces remain preparation only. See [release-proof.json](evidence/release-proof.json). Backend connection and execution stay unknown/untested. ${entries.filter(e=>e.verification.status==='live read pass').length} local browser calculation case(s) have specific live evidence; other local tools retain fixture status.`:'**Deployment is not checked for every entry**, pending lead release verification. No capability is marked ready.'} Source “implemented” means a registered source handler exists, not that credentials, provider behavior, tenant scope or output validation are complete. Local-only changes are detected against HEAD per referenced file. Unchanged files use pushed only when HEAD equals the locally observed origin/main; no fresh remote fetch is implied.\n\n## Verification\n\n\`node scripts/index-backlog.mjs\` parses all five appendix families, rejects missing/duplicate inventory IDs, compares all 223 public schemas and persona lists to runtime definitions, checks every public dispatcher/handler, and runs existing local fixture tests.\n\n\`node --test scripts/local-tools.test.mjs\`: ${localTests.tests} tests, ${localTests.passed} passed, ${localTests.failed} failed. The first test exercises all 36 local implementations with representative inputs; remaining tests cover selected numerical boundaries, content escaping and inventory counts. These are fixture tests, not browser or provider tests.\n\n\`node scripts/index-backlog.mjs --check\` verifies report bytes after regenerating in memory. Only the script and these two reports are owned by CATALOG-D. This generator makes no app/backend/config change, provider invocation, schedule activation, secret inspection or deployment. When present, it consumes the lead’s checked-in release evidence and verifies asset hashes against the released Git revision.\n\n## Correspondences and limitations\n\nThere are ${duplicateRuntimeIds.length} duplicate runtime IDs. JSON records ${exactReferences.length} exact runtime-ID mentions in automation/mission briefs and ${conceptualOverlaps.length} explicit conceptual overlaps. Examples: P018 → L23 (local_weighted_score), P091 → A01 (morning brief), P110 → L20 (local_retry), P120 → existing routine_pause, P147 → L35 (local_redact), P186 → existing routine_history. These relationships identify reuse opportunities; they do not fulfill the proposal contracts. Generic words such as “calendar” and “research” are retained as unresolved capability hints rather than fabricated runtime IDs.\n\nHandler/provider mapping is static: case dispatch plus imported implementation symbols, or registered catalogue run functions. Dependency hostname/binding hints explicitly distinguish entry-level from whole-module scope; they can overapproximate dependencies used by a particular tool and are not connection checks. No common output schema has been established. Backend behavior tests are untested in this pass; historical documentation does not promote that status. Automation/mission preparation UIs exist, but activation and completed artifacts are unverified.\n\n## Missing foundations for the next integrated slice\n\n1. ${proof?'The index release is evidenced. Keep deployment presence separate from provider health and tool execution; next verify the chosen capability end to end against this release.':'Keep the index release gate first. Verify delivered frontend entry/module hashes and renderer; only then record production capability presence against that exact release.'}\n2. Complete one research path using existing web_search/tavily_research and source-reading tools: validate input, preflight provider/permission context, retain source URL/retrieval time, and return a structured receipt with partial/failure state. Arsenal currently prepares chat text; that is not direct execution proof.\n3. Establish authoritative per-user/tenant auth context before customer offers or a generic execution endpoint. Reuse current persona, permissions, containment and approval checks; do not bypass them by calling executeTool directly from a new unauthenticated route.\n4. Add bounded timeout/cancellation semantics, normalized provider errors, output validation and idempotency/reconciliation where consequential tools need them. Cover invalid schema, wrong persona, unavailable credential, provider timeout, cross-user request and duplicate submission using fixtures before live writes.\n5. Reuse existing routines, cron, ledger and approvals for one chosen automation brief. Require persisted workflow/run IDs, supported timezone/timing, dry run, failure and duplicate-event evidence, budget, concurrency cap and visible pause/stop before activation. All 24 briefs remain preparation records.\n6. Billing/checkout/entitlement and client delivery proposals remain proposals: select a concrete offer, isolate customer data and verify sandbox webhook signatures, idempotency, entitlement, failed payment/cancellation and actual delivery receipt before charging customers. No paid service or automation is enabled by this index.\n\n## Entry index\n\n| ID | Runtime ID / preparation type | Title | Master lines |\n| --- | --- | --- | --- |\n${entries.map(e=>`| ${e.inventory_id} | ${e.runtime_id?`\`${e.runtime_id}\``:e.family==='A'?'Automation brief':'Mission template'} | ${e.title.replaceAll('|','\\|')} | ${e.source.start_line}–${e.source.end_line} |`).join('\n')}\n`;
const outputs={'docs/bifrost/CAPABILITY-STATUS.json':JSON.stringify(report,null,2)+'\n','docs/bifrost/CAPABILITY-STATUS.md':md};
for(const content of Object.values(outputs)){
 for(const withheld of hidden)assert.ok(!new RegExp('(?<![a-zA-Z0-9_])'+withheld.name+'(?![a-zA-Z0-9_])').test(content),'Withheld registration must not appear in public inventory output');
}
for(const [file,content]of Object.entries(outputs)){
 if(process.argv.includes('--check'))assert.ok(read(file)===content,`${file} is stale; run node scripts/index-backlog.mjs`);
 else writeFileSync(file,content);
}
console.log(JSON.stringify({result:'PASS',mode:process.argv.includes('--check')?'check':'write',counts,total:entries.length,public_schema_matches:backend.length,backend_handlers_mapped:223,duplicates:duplicateRuntimeIds.length,local_fixture_tests:localTests,exact_references:exactReferences.length,conceptual_overlaps:conceptualOverlaps.length}));
