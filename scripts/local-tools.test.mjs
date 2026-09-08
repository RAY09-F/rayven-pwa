import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOCAL_TOOLS,runLocalTool} from '../public/ui/prism-v1/local-tools.js';
import {AUTOMATIONS} from '../public/ui/prism-v1/expansion.js';
const get=id=>LOCAL_TOOLS.find(t=>t.id==='local_'+id);
const run=(id,args)=>runLocalTool(get(id),args);

test('every local utility accepts valid representative input and yields finite structured output',()=>{
 assert.equal(LOCAL_TOOLS.length,36);assert.equal(new Set(LOCAL_TOOLS.map(t=>t.id)).size,36);
 const overrides={
  cohort_value:{margin:80,churn:5},target_price:{margin:80},break_even:{price:30,variable:10},discount:{discount:20},retry:{attempts:3},sla:{target:99.9},
  weighted_score:{scores:[10,20],weights:[1,3]},percentiles:{samples:[4,1,2,3]},
  csv:{rows:[{name:'Alice',amount:12},{name:'Bob',amount:24}]},json:{text:'{"ok":true}'},
  utm:{url:'https://example.com/path?existing=1'},url:{url:'https://example.com/path?x=1'},
 };
 for(const tool of LOCAL_TOOLS){const args=Object.fromEntries(Object.entries(tool.schema.properties).map(([k,s])=>[k,s.type==='number'?10:s.type==='array'?[1,2]:'Example text']));Object.assign(args,overrides[tool.id.slice(6)]||{});const value=runLocalTool(tool,args);assert.ok(value&&typeof value==='object',tool.id);assert.ok(!JSON.stringify(value).includes('null'),tool.id+' has no nonfinite JSON coercions');}
});
test('revenue calculations reconcile units and avoid division by zero',()=>{
 assert.deepEqual(run('mrr',{accounts:100,arpu:20}),{mrr:2000,annualized_run_rate:24000});
 assert.deepEqual(run('net_mrr',{start:1000,new:100,expansion:50,contraction:20,churn:30}),{ending_mrr:1100,net_change:100});
 assert.equal(run('nrr',{start:1000,expansion:150,contraction:50,churn:100}).net_revenue_retention_percent,100);
 assert.equal(run('target_price',{cost:20,margin:60}).price,50);
 assert.equal(run('break_even',{fixed:1000,price:50,variable:30}).units,50);
 assert.throws(()=>run('cac',{spend:100,customers:0}),/greater than zero/);
 assert.throws(()=>run('target_price',{cost:10,margin:100}),/greater than zero/);
 assert.throws(()=>run('mrr',{accounts:-1,arpu:10}),/finite number/);
});
test('automation and usage math uses entered rates and bounded schedules',()=>{
 assert.equal(run('usage',{input:1e6,output:5e5,input_rate:3,output_rate:6}).estimated_cost,6);
 assert.deepEqual(run('automation_roi',{runs:100,minutes:6,hourly:20,cost:50}),{hours_saved:10,modeled_net_value:150});
 assert.deepEqual(run('retry',{initial:2,factor:2,attempts:4,cap:10}),{delays_seconds:[2,4,8,10],total_wait_seconds:24});
 assert.throws(()=>run('retry',{initial:2,factor:2,attempts:1000,cap:10}),/0 to 30/);
 assert.deepEqual(run('percentiles',{samples:[4,1,2,3]}),{count:4,median_ms:2,p95_ms:4,p99_ms:4,max_ms:4});
 assert.throws(()=>run('weighted_score',{scores:[1,2],weights:[1]}),/equally sized/);
});
test('content utilities preserve data and escape spreadsheet formulas',()=>{
 assert.equal(run('slug',{text:'Café — My Offer!'}).slug,'cafe-my-offer');
 assert.equal(run('dedupe',{text:'a\nb\na\n\n b'}).unique_lines,'a\nb');
 const u=new URL(run('utm',{url:'https://example.com/?x=1',source:'council',medium:'email',campaign:'Launch 1'}).campaign_url);assert.equal(u.searchParams.get('x'),'1');assert.equal(u.searchParams.get('utm_campaign'),'Launch 1');
 assert.throws(()=>run('utm',{url:'javascript:alert(1)',source:'a',medium:'b',campaign:'c'}),/HTTP/);
 assert.equal(run('csv',{rows:[{name:'=SUM(A1)',note:'a"b'}]}).csv,'"name","note"\r\n"\'=SUM(A1)","a""b"');
 assert.throws(()=>run('json',{text:'not json'}));
 assert.ok(!run('redact',{text:'Email user@example.com; Bearer abc123; api_key=abc123'}).redacted.includes('abc123'));
});
test('the doubled catalogue keeps proposals distinct and does not double-count workflow combinations',()=>{
 const backend=JSON.parse(readFileSync('public/ui/prism-v1/tool-catalog.json')).tools;
 const queue=JSON.parse(readFileSync('public/ui/prism-v1/expansion-catalog.json')).tools;
 assert.equal(queue.length,186);assert.equal(new Set(queue.map(t=>t.id)).size,186);
 assert.ok(queue.every(t=>t.status==='proposed'&&t.requirements&&t.acceptance));
 assert.equal(backend.length+LOCAL_TOOLS.length+queue.length,445);
 assert.equal(AUTOMATIONS.length,24);assert.ok(AUTOMATIONS.every(t=>t.trigger&&t.action&&t.tools));
});
