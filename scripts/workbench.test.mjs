import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOLS} from '../src/tools/catalog-workbench.js';

// Each tool's real form example has a concrete result assertion and a tool-specific
// malformed input. Shared tests also exercise required fields and JSON safety.
const cases = {
 csv_parse:[r=>assert.deepEqual(r.rows,[{name:'Ada',score:'9'}]),{text:'a,a\n1,2'}],
 table_select:[r=>assert.deepEqual(r.rows,[{b:2}]),{columns:['missing']}],
 table_filter:[r=>assert.deepEqual(r.rows,[{n:3}]),{value:'2'}],
 table_sort:[r=>assert.deepEqual(r.rows,[{n:1},{n:2}]),{rows:[{n:1},{n:'a'}]}],
 table_group_sum:[r=>assert.deepEqual(r.groups,[{group:'A',count:2,sum:5}]),{measure:'missing'}],
 table_join:[r=>assert.deepEqual(r.rows,[{id:1,r_id:1,r_label:'A'}]),{prefix:''}],
 table_duplicates:[r=>assert.deepEqual(r.duplicates,[{key:[1],indexes:[0,1]}]),{keys:[]}],
 table_pivot:[r=>assert.deepEqual(r,{row_labels:['A'],column_labels:['X'],matrix:[[2]]}),{measure:'r'}],
 table_unpivot:[r=>assert.deepEqual(r.rows,[{id:'a',attribute:'jan',value:2},{id:'a',attribute:'feb',value:3}]),{value_columns:[]}],
 table_profile:[r=>assert.deepEqual(r.columns,[{name:'a',missing:1,nulls:1,types:['number','null'],distinct:2}]),{rows:[{a:{nested:1}}]}],
 table_crosstab:[r=>assert.deepEqual(r.cells,[{values:['A','B'],count:2}]),{x:'missing'}],
 table_fill_missing:[r=>assert.deepEqual(r,{rows:[{a:0},{a:0}],filled:2}),{column:'__proto__'}],
 text_line_endings:[r=>assert.deepEqual(r,{text:'a\nb\nc\n',crlf:1,lf:1,cr:1}),{style:'bad'}],
 text_whitespace_audit:[r=>assert.deepEqual(r.issues,[{line:1,kind:'trailing'},{line:1,kind:'repeated_spaces'},{line:2,kind:'tab'}]),{text:4}],
 text_word_frequency:[r=>assert.deepEqual(r.words,[{word:'red',count:2}]),{stop_words:[3]}],
 text_ngram_frequency:[r=>assert.deepEqual(r.phrases,[{phrase:'one two',count:2}]),{size:1}],
 text_literal_replace:[r=>assert.deepEqual(r,{text:'x x',replacements:2}),{find:''}],
 text_line_diff:[r=>assert.deepEqual(r.changes,[{type:'equal',text:'a'},{type:'remove',text:'b'},{type:'add',text:'c'}]),{after:'a\n'.repeat(201)}],
 markdown_heading_audit:[r=>assert.deepEqual(r.issues,[{line:2,kind:'skipped_level',previous:1,level:3}]),{text:[]}],
 text_chunk:[r=>assert.deepEqual(r.chunks,['abc','cde','ef']),{overlap:3}],
 text_unicode_audit:[r=>assert.deepEqual(r.issues,[{code_point_index:1,code:'U+200B'}]),{text:null}],
 text_term_audit:[r=>assert.deepEqual(r.matches,[{index:0,term:'very',replacement:'omit'},{index:11,term:'very',replacement:'omit'}]),{terms:[{term:'',replacement:'x'}]}],
 url_query_edit:[r=>assert.equal(r.url,'https://example.com/?a=3'),{url:'javascript:alert(1)'}],
 url_tracking_strip:[r=>assert.deepEqual(r,{url:'https://example.com/?q=cat',removed:['utm_source','gclid']}),{url:'https://u:p@example.com/'}],
 url_resolve:[r=>assert.deepEqual(r.links,[{link:'../b',url:'https://example.com/b'},{link:'#x',url:'https://example.com/a/#x'}]),{base:'/relative'}],
 url_query_compare:[r=>assert.deepEqual(r.changes,[{name:'a',before:['1'],after:['2']},{name:'b',before:[],after:['3']}]),{after:'not a url'}],
 web_sitemap_build:[r=>assert.equal(r.xml,'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/?a=1&amp;b=2</loc></url></urlset>'),{urls:['ftp://example.com/']}],
 web_meta_build:[r=>assert.equal(r.html,'<title>A &amp; B</title>\n<meta name="description" content="A page">\n<link rel="canonical" href="https://example.com/">\n<meta property="og:title" content="A &amp; B">\n<meta property="og:description" content="A page">\n<meta property="og:url" content="https://example.com/">'),{url:'data:text/html,x'}],
 web_link_audit:[r=>assert.deepEqual(r.issues,[{index:0,kind:'generic_label'}]),{links:[{label:'x',url:'x'}]}],
 web_redirect_audit:[r=>assert.deepEqual(r.routes,[{from:'https://e.com/a',cycle:false,hops:2,destination:'https://e.com/c'},{from:'https://e.com/b',cycle:false,hops:1,destination:'https://e.com/c'}]),{redirects:[{from:'https://e.com/',to:'https://e.com/a'},{from:'https://e.com/',to:'https://e.com/b'}]}],
 json_compare:[r=>assert.deepEqual(r.changes,[{path:'/a',type:'change',before:1,after:2},{path:'/b',type:'add',after:3}]),{before:NaN}],
 json_flatten:[r=>assert.deepEqual(r.entries,[{path:'/a/0',value:1},{path:'/a/1',value:2}]),{value:undefined}],
 json_pointer_get:[r=>assert.deepEqual(r,{value:7}),{pointer:'/a~2b'}],
 json_merge_patch:[r=>assert.deepEqual(r.value,{b:2,c:3}),{patch:JSON.parse('{"__proto__":1}')}],
 json_shape:[r=>assert.deepEqual(r.shape,{type:'object',properties:{a:{type:'array',items:[{type:'number'}]},b:{type:'null'}}}),{value:Infinity}],
 list_set_compare:[r=>assert.deepEqual(r,{intersection:[2],left_only:[1],right_only:[3]}),{left:[{}]}],
 records_reconcile:[r=>assert.deepEqual(r,{added:[{id:2,n:4}],removed:[],changed:[{before:{id:1,n:2},after:{id:1,n:3}}]}),{before:[{id:1},{id:1}]}],
 jsonl_parse:[r=>assert.deepEqual(r.records,[{a:1},{a:2}]),{text:'{}\ninvalid'}],
 color_contrast:[r=>assert.deepEqual(r,{ratio:21,aa_normal:true,aa_large:true,aaa_normal:true,aaa_large:true}),{foreground:'red'}],
 color_palette_pairs:[r=>assert.deepEqual(r.pairs,[{first:'#000000',second:'#ffffff',ratio:21,passes:true}]),{minimum:22}],
 color_alpha_composite:[r=>assert.equal(r.color,'#800000'),{alpha:2}],
 color_gradient:[r=>assert.deepEqual(r.colors,['#000000','#808080','#ffffff']),{steps:1}],
 color_contrast_adjust:[r=>{assert.equal(r.possible,true);assert.equal(r.color,'#767676');assert.ok(r.ratio>=4.5);},{target:0}],
 color_distance:[r=>assert.equal(r.oklab_distance,0),{first:'#zzz000'}],
 dependency_order:[r=>assert.deepEqual(r.order,['build','test']),{edges:[{from:'test',to:'build'},{from:'build',to:'test'}]}],
 critical_path:[r=>assert.deepEqual(r,{duration:5,tasks:[{id:'a',start:0,finish:2,slack:0,critical:true},{id:'b',start:2,finish:5,slack:0,critical:true}]}),{edges:[{from:'a',to:'unknown'}]}],
 interval_merge:[r=>assert.deepEqual(r,{intervals:[{start:1,end:5}],covered:4}),{intervals:[{start:3,end:1}]}],
 interval_conflicts:[r=>assert.deepEqual(r.conflicts,[{first:'a',second:'b',overlap:1}]),{events:[{id:'a',start:0,end:0}]}],
 bin_pack:[r=>assert.deepEqual(r,{bins:[{items:[0,1],used:10,remaining:0},{items:[2,3],used:10,remaining:0}],lower_bound:2}),{sizes:[11]}],
 round_robin_schedule:[r=>assert.deepEqual(r.rounds,[{round:1,matches:[['B','C']],byes:['A']},{round:2,matches:[['A','C']],byes:['B']},{round:3,matches:[['A','B']],byes:['C']}]),{participants:['A','A']}],
};

test('workbench has exactly 50 unique documented tools and 50 semantic fixtures',()=>{
 assert.equal(TOOLS.length,50);assert.equal(new Set(TOOLS.map(t=>t.name)).size,50);
 assert.equal(Object.keys(cases).length,50);
 for(const t of TOOLS){assert.equal(t.input_schema.type,'object');assert.equal(t.input_schema.additionalProperties,false);assert.equal(t.input_examples.length,1);assert.equal(t.taint,false);}
});
for(const t of TOOLS){const [verify,invalid]=cases[t.name.slice(3)];
 test(t.name+' expected output',async()=>{const input=structuredClone(t.input_examples[0]),before=JSON.stringify(input);const result=JSON.parse(await t.run({},input));assert.equal(result.error,undefined);verify(result);assert.equal(JSON.stringify(input),before,'must not mutate arguments');});
 test(t.name+' rejects malformed input and missing arguments',async()=>{for(const input of [{...t.input_examples[0],...invalid},{},null,{...t.input_examples[0],unexpected:true}]){const result=JSON.parse(await t.run({},input));assert.equal(typeof result.error,'string');assert.ok(result.error.length>0);}});
}
const call=async(name,input)=>JSON.parse(await TOOLS.find(t=>t.name==='wb_'+name).run({},input));
test('CSV multiline, escaped quote and trailing empty field',async()=>{assert.deepEqual((await call('csv_parse',{text:'a,b,c\r\n"x\ny","say ""hi""",\r\n',delimiter:','})).rows,[{a:'x\ny',b:'say "hi"',c:''}]);assert.match((await call('csv_parse',{text:'a,b\n"x',delimiter:','})).error,/Unclosed/);assert.match((await call('csv_parse',{text:'a,b\n1',delimiter:','})).error,/Uneven/);});
test('JSON pointer escaping and merge array replacement',async()=>{assert.deepEqual(await call('json_pointer_get',{value:{'~':[1]},pointer:'/~0/0'}),{value:1});assert.deepEqual(await call('json_merge_patch',{document:{a:[1,2]},patch:{a:[3]}}),{value:{a:[3]}});assert.deepEqual(await call('json_flatten',{value:{a:[],b:{}}}),{entries:[{path:'/a',value:[]},{path:'/b',value:{}}]});});
test('size, nesting and hazardous key guards',async()=>{assert.match((await call('text_chunk',{text:'x'.repeat(20001),size:50,overlap:0})).error,/long/);let deep=0;for(let i=0;i<22;i++)deep={x:deep};assert.match((await call('json_shape',{value:deep})).error,/depth/);assert.match((await call('jsonl_parse',{text:'{"constructor":1}'})).error,/Unsafe/);assert.match((await call('json_shape',{value:Array(501).fill(1)})).error,/many items/);});
test('round robin schedules each pair once with balanced byes',async()=>{for(const n of [2,3,4,7,8]){const people=Array.from({length:n},(_,i)=>String(i));const {rounds}=await call('round_robin_schedule',{participants:people});const pairs=rounds.flatMap(r=>r.matches.map(m=>m.sort().join(':')));assert.equal(pairs.length,n*(n-1)/2);assert.equal(new Set(pairs).size,pairs.length);for(const r of rounds)assert.equal(new Set([...r.matches.flat(),...r.byes]).size,n);}});
test('critical-path parallel branch has meaningful slack',async()=>{const r=await call('critical_path',{tasks:[{id:'a',duration:2},{id:'b',duration:5},{id:'c',duration:1}],edges:[{from:'a',to:'c'},{from:'b',to:'c'}]});assert.equal(r.duration,6);assert.equal(r.tasks.find(t=>t.id==='a').slack,3);assert.equal(r.tasks.find(t=>t.id==='a').critical,false);});
test('redirect cycle is reported, unsupported relative schemes stay data',async()=>{assert.equal((await call('web_redirect_audit',{redirects:[{from:'https://e.com/a',to:'https://e.com/b'},{from:'https://e.com/b',to:'https://e.com/a'}]})).routes[0].cycle,true);assert.deepEqual((await call('url_resolve',{base:'https://e.com/',links:['javascript:alert(1)']})).links,[{link:'javascript:alert(1)',error:'Unsupported or invalid URL'}]);});
test('replacement growth is bounded before materializing and array pointers exclude metadata',async()=>{assert.match((await call('text_literal_replace',{text:'a'.repeat(20000),find:'a',replacement:'x'.repeat(20000)})).error,/too large/);for(const pointer of ['/length','/01'])assert.match((await call('json_pointer_get',{value:[1,2],pointer})).error,/canonical index/);});
