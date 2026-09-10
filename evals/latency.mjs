import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*0.95)-1];
export function gradeLatency(samples){
 if(!Array.isArray(samples)||samples.length<20)throw Error('BLOCKED: at least 20 real measured turns are required.');
 for(const s of samples)if(s.origin!=='live'||!s.release||!s.sessionId||!Number.isFinite(s.ttftMs)||s.ttftMs<0||!Number.isFinite(s.firstAudioMs)||s.firstAudioMs<0||!Number.isInteger(s.turn)||s.turn<1)throw Error('BLOCKED: complete, release-labeled live timing records required.');
 const second=samples.filter(s=>s.turn===2);if(!second.length)throw Error('BLOCKED: no second-turn cache observation.');
 const result={samples:samples.length,ttftP95Ms:p95(samples.map(s=>s.ttftMs)),firstAudioP95Ms:p95(samples.map(s=>s.firstAudioMs)),secondTurnCachePass:second.every(s=>s.cache_read_input_tokens>0)};
 result.pass=result.ttftP95Ms<400&&result.firstAudioP95Ms<800&&result.secondTurnCachePass;return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(!process.argv[2])throw Error('BLOCKED: supply actual live timing evidence; this grader makes no paid requests.');const result=gradeLatency(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}
}
