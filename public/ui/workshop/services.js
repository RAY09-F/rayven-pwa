import {FIELDS,EXAMPLE,MAX_DRAFT_BYTES,makeDraft,serializeDraft,parseDraft,buildProposal} from './proposal.js';
const $ = id => document.getElementById(id);
let proposal = null, example = false, revision = 0;
const currentDraft = () => makeDraft(Object.fromEntries(FIELDS.map(field => [field,$('service-'+field).value])),example);
function showError(error) { $('service-error').textContent = error.message; $('service-error').hidden = false; }
function invalidate() { revision++; proposal = null; $('service-output').hidden = true; $('service-error').hidden = true; }
function updateStatus(message = '') { $('service-draft-status').textContent = message || (example ? 'Fictional example draft — this label remains when edited or reopened. Start a blank draft for a real prospect.' : 'Unsaved draft — download JSON to reopen later. No automatic browser storage.'); }
function fill(draft) { for (const field of FIELDS) $('service-'+field).value = draft.fields[field]; example = draft.example; invalidate(); updateStatus(); }
function download(contents,type,name) {
  const url = URL.createObjectURL(new Blob([contents],{type})), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('service-example').addEventListener('click',() => fill(makeDraft({...EXAMPLE},true)));
$('service-blank').addEventListener('click',() => fill(makeDraft(Object.fromEntries(FIELDS.map(field => [field,field === 'currency' ? 'USD' : ''])))));
$('service-form').addEventListener('input',() => { invalidate(); updateStatus(); });
$('service-form').addEventListener('submit',async event => {
  event.preventDefault(); invalidate(); const builtAt = revision;
  try {
    const built = await buildProposal(currentDraft());
    if (builtAt !== revision) return;
    proposal = built;
    $('service-output-title').textContent = built.draft.fields.project;
    $('service-example-status').textContent = example ? 'Fictional example · replace assumptions before use; the example label stays attached.' : 'Built from your inputs · review scope and terms before sharing.';
    $('service-proposal').textContent = built.text; $('service-output').hidden = false;
  } catch (error) { if (builtAt === revision) showError(error); }
});
$('service-download').addEventListener('click',() => { if(proposal) download(proposal.html,'text/html;charset=utf-8','service-proposal.html'); });
$('service-download-text').addEventListener('click',() => { if(proposal) download(proposal.text,'text/plain;charset=utf-8','service-proposal.txt'); });
$('service-save').addEventListener('click',() => {
  try { download(serializeDraft(currentDraft()),'application/json','service-draft.json'); updateStatus('Draft download requested. It contains the form text; store it privately.'); } catch(error) { showError(error); }
});
$('service-import').addEventListener('change',async event => {
  const file = event.target.files[0], startedAt = revision;
  if (!file) return;
  try {
    if (file.size > MAX_DRAFT_BYTES) throw Error('Draft exceeds the 100 KB limit.');
    const draft = parseDraft(await file.text());
    if (startedAt !== revision) throw Error('The form changed while reading the file. Choose the file again to reopen it.');
    fill(draft); updateStatus(example ? 'Fictional example draft reopened. Review inputs and build the proposal again.' : 'Draft reopened. Review inputs and build the proposal again.');
  } catch(error) { showError(error); }
  finally { event.target.value = ''; }
});
updateStatus();
