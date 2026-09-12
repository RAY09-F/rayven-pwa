import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveApproval} from '../src/lib/approvals.js';

function fixture({expired=false,off=false}={}) {
  const input={to:'+15555550123',message:'Hello, I am calling about a reservation.',purpose:'Ask about availability'};
  const data=new Map([
    ['approvals',JSON.stringify([{id:'1234',status:'pending',persona:'thor',tool:'make_call',input,description:'Call the displayed recipient about availability',expiresAt:new Date(Date.now()+(expired?-60000:60000)).toISOString()}])],
    ['permissions',JSON.stringify(off?{make_call:'off'}:{})]
  ]);
  return {input,data,env:{RAYVEN_KV:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)}}};
}

test('one explicit approval executes the exact call without staging a second yes',async()=>{
  const {env,data,input}=fixture(); const calls=[];
  const execute=async(e,tool,args,persona)=>{calls.push({tool,args,persona});return 'Call initiated.';};
  const result=await resolveApproval(env,'1234','approve',execute);
  assert.equal(result.ok,true);
  assert.deepEqual(calls,[{tool:'make_call',args:input,persona:'thor'}]);
  assert.equal(data.has('pending:thor'),false);
  assert.doesNotMatch(result.text,/say.*yes|still needs/i);
  await resolveApproval(env,'1234','approve',execute);
  assert.equal(calls.length,1,'a repeated approval must not place another call');
});

test('rejected, expired, disabled, and unknown approvals do not place calls',async()=>{
  for(const scenario of ['rejected','expired','disabled','unknown']) {
    const {env}=fixture({expired:scenario==='expired',off:scenario==='disabled'});
    let calls=0;
    await resolveApproval(env,scenario==='unknown'?'9999':'1234',scenario==='rejected'?'reject':'approve',async()=>{calls++;});
    assert.equal(calls,0,scenario);
  }
});
