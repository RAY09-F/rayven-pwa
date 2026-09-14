import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../background.js',import.meta.url),'utf8');
test('extension polls only current ASGARD host and rejects HTTP failures',async()=>{
 const calls=[],alarms=[];
 const context=vm.createContext({ASGARD_BROWSER_TOKEN:'fixture-'.repeat(8),console:{log(){},error(){}},AbortSignal,chrome:{alarms:{create:(...args)=>alarms.push(args),onAlarm:{addListener(){}}}},fetch:async(url,init)=>{assert.equal(init.headers['X-Asgard-Browser'],'fixture-'.repeat(8));calls.push(url);return {ok:true,json:async()=>({command:null})};}});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls[0],'https://asgrard-backend.rayanfahil2.workers.dev/browser/poll');
 assert.equal(alarms[0][0],'rayvenPoll');
 context.fetch=async()=>({ok:false,status:503});
 await assert.rejects(vm.runInContext('backendFetch("/browser/status")',context),/HTTP 503/);
});

test('unpaired extension never polls or submits a browser result',async()=>{
 let calls=0;const context=vm.createContext({console:{log(){},error(){}},AbortSignal,chrome:{alarms:{create(){},onAlarm:{addListener(){}}}},fetch:async()=>{calls++;}});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(vm.runInContext('backendFetch("/browser/result", {method:"POST"})',context),/pairing is missing/);
 assert.equal(calls,0);
});
