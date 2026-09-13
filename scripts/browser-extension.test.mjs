import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../background.js',import.meta.url),'utf8');
test('extension polls only current ASGARD host and rejects HTTP failures',async()=>{
 const calls=[],alarms=[];
 const context=vm.createContext({console:{log(){},error(){}},AbortSignal,chrome:{alarms:{create:(...args)=>alarms.push(args),onAlarm:{addListener(){}}}},fetch:async(url)=>{calls.push(url);return {ok:true,json:async()=>({command:null})};}});
 vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls[0],'https://asgrard-backend.rayanfahil2.workers.dev/browser/poll');
 assert.equal(alarms[0][0],'rayvenPoll');
 context.fetch=async()=>({ok:false,status:503});
 await assert.rejects(vm.runInContext('backendFetch("/browser/status")',context),/HTTP 503/);
});
