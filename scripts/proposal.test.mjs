import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELDS,EXAMPLE,MAX_DRAFT_BYTES,makeDraft,serializeDraft,parseDraft,buildProposal,escapeHtml} from '../public/ui/workshop/proposal.js';

test('proposal retains quote labor, costs and contingency arithmetic',async () => {
  const p = await buildProposal(makeDraft({...EXAMPLE},true));
  assert.equal(p.estimate.labor,850);
  assert.equal(p.estimate.base,875);
  assert.equal(p.estimate.contingency,87.5);
  assert.ok(Math.abs(p.estimate.quote - 962.5) < 1e-9);
  assert.deepEqual(p.estimate.tasks.map(t => t.amount),[100,400,200,150]);
  assert.match(p.html,/962\.50 USD/);
  assert.match(p.html,/@media print/);
  assert.doesNotMatch(p.html,/<script|<link|<iframe/i);
});
test('all free text is escaped in standalone HTML including title and currency',async () => {
  const payload = '</title><script>alert("x")</script><img src=x onerror=alert(1)>&\'"';
  const fields = {...EXAMPLE};
  for(const key of ['client','project','problem','scope','acceptance','exclusions','terms']) fields[key] = payload;
  fields.currency = '<svg/onload';
  const p = await buildProposal(makeDraft(fields));
  assert.doesNotMatch(p.html,/<script|<img|<svg/i);
  assert.ok(p.html.includes(escapeHtml(payload)));
  assert.ok(p.html.includes('&lt;svg/onload'));
  assert.ok(p.text.includes(payload));
});
test('edited fictional drafts retain their designation through JSON and both exports',async () => {
  const draft = parseDraft(serializeDraft(makeDraft({...EXAMPLE,project:'Edited sample'},true)));
  assert.equal(draft.example,true);
  const p = await buildProposal(draft);
  assert.match(p.text,/FICTIONAL EXAMPLE/);
  assert.match(p.html,/FICTIONAL EXAMPLE/);
  assert.match(p.html,/Terms to agree/);
  assert.match(p.html,/Exclusions/);
});
test('incomplete drafts can reopen but cannot build a proposal',async () => {
  const draft = makeDraft(Object.fromEntries(FIELDS.map(k => [k,k === 'currency' ? 'USD' : ''])));
  assert.deepEqual(parseDraft(serializeDraft(draft)),draft);
  await assert.rejects(buildProposal(draft),/Complete client/);
  await assert.rejects(buildProposal(makeDraft({...EXAMPLE,discovery:'0',website:'0',automation:'0',testing:'0'})),/planned work hours/);
});
test('imports reject malformed, unknown, oversized, nonfinite and out-of-range inputs',() => {
  const valid = makeDraft({...EXAMPLE},true);
  for (const source of ['{','null','[]',' '.repeat(MAX_DRAFT_BYTES+1),JSON.stringify({...valid,version:2}),JSON.stringify({...valid,extra:'secret'}),JSON.stringify({...valid,example:'true'}),JSON.stringify({...valid,fields:{...valid.fields,accessToken:'secret'}})]) assert.throws(() => parseDraft(source));
  for (const [field,value] of [['rate','NaN'],['rate','Infinity'],['rate','-1'],['website','1001'],['contingency','101'],['costs','1000001'],['rate',5],['project','x'.repeat(161)],['scope',{}]]) {
    assert.throws(() => parseDraft(JSON.stringify({...valid,fields:{...valid.fields,[field]:value}})));
  }
  const polluted = serializeDraft(valid).replace('"format":','"__proto__":{},"format":');
  assert.throws(() => parseDraft(polluted));
  assert.equal({}.polluted,undefined);
});
