import {readTool,field} from './api-tool.js';
const repo = i => {if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(i.repo))throw Error('Use owner/repository.');return i.repo;};
const headers = env => ({Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(env.GITHUB_TOKEN?{Authorization:`Bearer ${env.GITHUB_TOKEN}`}:{})});
export async function selfCheck(env) {
 const result={checkedAt:new Date().toISOString(),rootOk:false,release:null,releaseMatches:null,extensionConnected:false,mode:'log-only'};
 // Fixed own-host probes deliberately bypass the external-URL tool guard. No user URL or credentials.
 const base='https://asgrard-backend.rayanfahil2.workers.dev';
 await Promise.allSettled([
  (async()=>{const r=await fetch(base+'/',{redirect:'error',signal:AbortSignal.timeout(8000)});result.rootOk=r.ok&&/text\/html/.test(r.headers.get('content-type')||'');await r.body?.cancel();})(),
  (async()=>{const r=await fetch(base+'/ui/release.json',{redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Release unavailable');const v=await r.json();result.release=v.fingerprint||v.id||v.release;result.releaseMatches=env.ASGARD_EXPECTED_FINGERPRINT?result.release===env.ASGARD_EXPECTED_FINGERPRINT:null;})(),
  (async()=>{const last=Number(await env.RAYVEN_KV.get('browser:lastpoll'));result.extensionConnected=last>0&&Date.now()-last<600000;})()
 ]);
 result.ok=result.rootOk&&result.releaseMatches===true&&result.extensionConnected;
 return result;
}
export async function logSelfCheck(env){if(env.SELF_CHECK_ENABLED!=='true')return;console.log('ASGARD_SELF_CHECK',JSON.stringify(await selfCheck(env)));}
export const TOOLS=[
 readTool({name:'dev_repo_status',group:'dev',description:'Read repository branch, latest push and open-issue count from GitHub. Optional GITHUB_TOKEN raises the shared free request allowance.',properties:{repo:field('owner/repository')},required:['repo'],example:{repo:'RAY09-F/rayven-pwa'},request:(env,i)=>({url:`https://api.github.com/repos/${repo(i)}`,headers:headers(env)}),select:v=>({name:v.full_name,defaultBranch:v.default_branch,pushedAt:v.pushed_at,openIssues:v.open_issues_count,url:v.html_url})}),
 readTool({name:'dev_actions_status',group:'dev',description:'Read the latest five GitHub Actions workflow runs. A successful push alone is not proof of a deployment.',properties:{repo:field('owner/repository')},required:['repo'],example:{repo:'RAY09-F/rayven-pwa'},request:(env,i)=>({url:`https://api.github.com/repos/${repo(i)}/actions/runs?per_page=5`,headers:headers(env)}),select:v=>v.workflow_runs.map(r=>({name:r.name,status:r.status,conclusion:r.conclusion,commit:r.head_sha,url:r.html_url}))}),
 {name:'dev_self_check',group:'dev',taint:true,defer_loading:true,input_examples:[{}],description:'Check the actual ASGARD homepage, expected release fingerprint and extension heartbeat. Log-only; never sends notifications.',input_schema:{type:'object',properties:{},additionalProperties:false},run:selfCheck}
];
