import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanion,SITE} from './rgb-companion.mjs';
test('lighting bridge requires pairing, validates states and rejects other origins',async()=>{
  const calls=[],token='a'.repeat(64),server=createCompanion({token,apply:async mode=>calls.push(mode)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await fetch(base+'/status')).status,401);
    assert.equal((await fetch(base+'/status',{headers:{Origin:'https://example.com','X-ASGARD-Key':token}})).status,403);
    const headers={Origin:SITE,'X-ASGARD-Key':token,'Content-Type':'application/json'};
    assert.equal((await fetch(base+'/state',{method:'POST',headers,body:'{"persona":"shell","locked":false}'})).status,400);
    for(const persona of ['thor','loki','odin'])assert.equal((await fetch(base+'/state',{method:'POST',headers,body:JSON.stringify({persona,locked:false})})).status,200);
    await fetch(base+'/state',{method:'POST',headers,body:JSON.stringify({persona:'thor',locked:true})});
    assert.deepEqual(calls,['thor','loki','odin','locked']);
    const state=await (await fetch(base+'/status',{headers})).json();assert.equal(state.last.color,'#FF0B12');
    const pair=await fetch(base+'/pair',{redirect:'manual'});assert.equal(pair.status,302);assert.equal(pair.headers.get('location'),SITE+'/#rgb-pair='+token);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
