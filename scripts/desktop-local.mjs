import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {freemem} from 'node:os';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
const exec=promisify(execFile),dir=join(process.env.LOCALAPPDATA,'ASGARD-RGB'),statePath=join(dir,'desktop-state.json'),base='http://127.0.0.1:16038/api/v1/lighting';
let state={sleeping:false,brightness:100,desktop:false},lastDesktop='',cached=null,cachedAt=0;
try{state={...state,...JSON.parse(readFileSync(statePath,'utf8'))};}catch{}
const save=()=>writeFileSync(statePath,JSON.stringify(state));
async function brightness(value){const r=await fetch(base+'/global_brightness',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({global_brightness:value}),signal:AbortSignal.timeout(4000)});if(!r.ok||(await r.json()).status!=='ok')throw Error('Brightness update failed');}
export async function transitionBrightness(value){await brightness(state.sleeping?0:value);await new Promise(r=>setTimeout(r,80));}
export async function sleepLights(sleeping){
 if(sleeping&&!state.sleeping){const r=await fetch(base,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Lighting unavailable');const j=await r.json();state.brightness=j.data?.attributes?.global_brightness??100;}
 const prior=state.sleeping;state.sleeping=sleeping;try{await brightness(sleeping?0:state.brightness);}catch(e){state.sleeping=prior;throw e;}save();return {sleeping,brightness:sleeping?0:state.brightness};
}
export async function desktopMode(enabled){state.desktop=enabled;save();lastDesktop='';if(!enabled)await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(dir,'desktop-theme.ps1'),'-Mode','restore'],{windowsHide:true,timeout:10000});return {enabled};}
export async function maintainDesktop(mode){
 if(state.sleeping)await brightness(0);
 const persona=mode==='locked'?'thor':mode;
 if(state.desktop&&lastDesktop!==persona&&existsSync(join(dir,'crown-'+persona+'.png'))){await exec('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(dir,'desktop-theme.ps1'),'-Mode',persona],{windowsHide:true,timeout:10000});lastDesktop=persona;}
}
export async function telemetry(){if(cached&&Date.now()-cachedAt<10000)return cached;let gpu=null;try{const {stdout}=await exec('C:/Windows/System32/nvidia-smi.exe',['--query-gpu=temperature.gpu,utilization.gpu','--format=csv,noheader,nounits'],{windowsHide:true,timeout:2500});const [temperature,utilization]=stdout.trim().split(',').map(Number);if(Number.isFinite(temperature)&&Number.isFinite(utilization))gpu={temperature,utilization};}catch{}
 cached={gpu,freeMemoryGB:+(freemem()/1024**3).toFixed(1),sleeping:state.sleeping,desktop:state.desktop,measuredAt:new Date().toISOString()};cachedAt=Date.now();return cached;}
