import {TOOLS} from './tools/catalog-business-lab.js';
export const TEXT_LIMITS = {client:120,project:160,problem:3000,scope:4000,acceptance:4000,exclusions:3000,terms:3000,currency:12};
export const NUMBER_LIMITS = {rate:[0.01,100000],discovery:[0,1000],website:[0,1000],automation:[0,1000],testing:[0,1000],costs:[0,1000000],contingency:[0,100]};
export const FIELDS = [...Object.keys(TEXT_LIMITS),...Object.keys(NUMBER_LIMITS)];
export const MAX_DRAFT_BYTES = 100000;
export const EXAMPLE = {client:'Fictional North Studio',project:'Website and intake workflow pilot',problem:'Make the enquiry page clearer and create a reviewed task from a submitted intake.',scope:'One enquiry page on the agreed website platform (TBD); one intake-to-task workflow with integrations to be confirmed; sample-data testing, one revision, a walkthrough and operating notes.',acceptance:'Agree device sizes and confirm the enquiry journey works on each. Validate required fields. Verify workflow success, duplicate prevention, failure reporting and a manual fallback using sample data. Obtain approval before live changes.',exclusions:'Additional pages, additional workflows, ongoing support and third-party subscriptions are outside this draft scope unless agreed separately.',terms:'TBD: platform and integrations, authorised access, customer data handling, delivery dates, payment schedule, taxes, ownership, support and final acceptance process.',currency:'USD',rate:'50',discovery:'2',website:'8',automation:'4',testing:'3',costs:'25',contingency:'10'};
const quote = TOOLS.find(t => t.name === 'business_project_quote');
const taskNames = [['Discovery and scope','discovery'],['Website implementation','website'],['Automation implementation','automation'],['Testing, revision and handoff','testing']];
const ownKeys = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k));
export function validateDraft(value) {
  if (!ownKeys(value,['format','version','example','fields']) || value.format !== 'asgard-service-draft' || value.version !== 1 || typeof value.example !== 'boolean' || !ownKeys(value.fields,FIELDS)) throw Error('Unsupported draft format. Choose an ASGARD service draft JSON file.');
  const fields = {};
  for (const field of FIELDS) {
    const entry = value.fields[field];
    if (typeof entry !== 'string' || entry.length > (TEXT_LIMITS[field] || 40)) throw Error(`Invalid or oversized ${field} field.`);
    if (Object.hasOwn(NUMBER_LIMITS,field) && entry.trim()) {
      const n = Number(entry), [min,max] = NUMBER_LIMITS[field];
      if (!Number.isFinite(n) || n < min || n > max || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(entry.trim())) throw Error(`Invalid ${field}; expected ${min}–${max}.`);
    }
    fields[field] = entry;
  }
  return {format:'asgard-service-draft',version:1,example:value.example,fields};
}
export const makeDraft = (fields,example = false) => validateDraft({format:'asgard-service-draft',version:1,example,fields});
export const serializeDraft = draft => JSON.stringify(validateDraft(draft),null,2);
export function parseDraft(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_DRAFT_BYTES) throw Error('Draft exceeds the 100 KB limit.');
  let value;
  try { value = JSON.parse(source); } catch { throw Error('Draft is not valid JSON.'); }
  return validateDraft(value);
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function buildProposal(input) {
  const draft = validateDraft(input), f = draft.fields;
  for (const field of FIELDS) if (!f[field].trim()) throw Error(`Complete ${field} before building the proposal. Use TBD for terms still to agree.`);
  const tasks = taskNames.map(([name,id]) => ({name,hours:Number(f[id]),rate:Number(f.rate)}));
  if (tasks.every(t => t.hours === 0)) throw Error('Enter some planned work hours.');
  const estimate = JSON.parse(await quote.run({},{tasks,directCosts:Number(f.costs),contingencyPct:Number(f.contingency)}));
  const money = n => `${n.toFixed(2)} ${f.currency.trim()}`;
  const status = draft.example ? 'FICTIONAL EXAMPLE — not a customer or market price' : 'DRAFT ESTIMATE — scope and terms require agreement';
  const sections = [['Desired outcome',f.problem],['Proposed scope',f.scope],['Acceptance checks',f.acceptance],['Exclusions',f.exclusions],['Terms to agree',f.terms]];
  const note = 'Estimate from supplied hours, rates and direct costs; not guaranteed revenue or profit. Delivery dates, payment terms, taxes, ownership and support remain TBD unless separately agreed. No approval, message, invoice or payment is created by this draft.';
  const text = `${f.project}\nPrepared for ${f.client}\n${status}\n\n${sections.map(([heading,body]) => `${heading}\n${body}`).join('\n\n')}\n\nEstimated work\n${estimate.tasks.map(t => `${t.name}: ${t.hours} h × ${money(t.rate)} = ${money(t.amount)}`).join('\n')}\nLabor: ${money(estimate.labor)}\nDirect costs: ${money(Number(f.costs))}\nContingency (${f.contingency}% of labor + costs): ${money(estimate.contingency)}\nEstimated project price: ${money(estimate.quote)}\n\n${note}`;
  const e = escapeHtml;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(f.project)} · Proposal draft</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#18252c;background:#fff;max-width:860px;margin:48px auto;padding:0 28px;overflow-wrap:anywhere}h1{font-size:36px;line-height:1.15}h2{font-size:20px;margin-top:30px}p{white-space:pre-wrap;overflow-wrap:anywhere}.status{font-weight:700;border-block:2px solid #346a61;padding:12px 0}.muted{color:#4a5960;font-size:14px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px 7px;border-bottom:1px solid #bbc9ca;text-align:right;overflow-wrap:anywhere}th:first-child,td:first-child{text-align:left}tfoot{font-weight:600}tr{break-inside:avoid}h2{break-after:avoid}@media print{body{margin:0;padding:0;font-size:11pt}h1{font-size:25pt}h2{font-size:15pt}@page{margin:18mm}}</style></head><body><p class="muted">WEBSITE & AUTOMATION SERVICES / PROPOSAL</p><h1>${e(f.project)}</h1><p>Prepared for ${e(f.client)}</p><p class="status">${e(status)}</p>${sections.map(([heading,body]) => `<section><h2>${e(heading)}</h2><p>${e(body)}</p></section>`).join('')}<h2>Itemized estimate</h2><table><thead><tr><th scope="col">Work</th><th scope="col">Hours</th><th scope="col">Rate</th><th scope="col">Amount</th></tr></thead><tbody>${estimate.tasks.map(t => `<tr><td>${e(t.name)}</td><td>${e(t.hours)}</td><td>${e(money(t.rate))}</td><td>${e(money(t.amount))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Labor</td><td>${e(money(estimate.labor))}</td></tr><tr><td colspan="3">Direct costs</td><td>${e(money(Number(f.costs)))}</td></tr><tr><td colspan="3">Contingency (${e(f.contingency)}% of labor + costs)</td><td>${e(money(estimate.contingency))}</td></tr><tr><td colspan="3">Estimated project price</td><td>${e(money(estimate.quote))}</td></tr></tfoot></table><p class="muted">${e(note)}</p><p class="muted">Open this file in a browser and use Print to print or save a PDF.</p></body></html>`;
  return {draft,estimate,text,html};
}
