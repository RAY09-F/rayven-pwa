const choices = {project:['shelves','bench','other'],timing:['soon','planned','flexible'],budget:['small','medium','large','unknown'],area:['local','outside']};
export function routeBrief(input) {
  for (const [field,values] of Object.entries(choices)) if (!values.includes(input[field])) throw Error('Choose a project type, timing, budget and example service area.');
  if (input.project === 'other' || input.area === 'outside') return {title:'Let’s check the fit.',reason:'The project type or area sits outside the demo’s standard scope.',route:'Scope review queue — human review required.',response:'Thanks for outlining your idea. The next step would be to review the type of work and service area before discussing a project.'};
  if (input.timing === 'soon') return {title:'Timing needs a closer look.',reason:'The requested start is within two weeks; availability is unconfirmed.',route:'Availability review queue — no start date promised.',response:'Thanks for your brief. Your timing would need a personal availability check before any work could be scheduled.'};
  if (['small','unknown'].includes(input.budget)) return {title:'Start with a conversation.',reason:'The illustrative budget is below the demo threshold or still undecided.',route:'Discovery queue — clarify scope and budget.',response:'Thanks for sharing the idea. A conversation about priorities, materials and budget would help define a workable scope.'};
  return {title:'A clear brief to build on.',reason:'Project type, area, timing and illustrative budget match the demo’s design-review rules.',route:'Design brief queue — review scope and availability.',response:'Thanks for outlining your project. Your brief would be ready for a design review, followed by an agreed scope and estimate.'};
}
const $ = id => document.getElementById(id);
if (typeof document !== 'undefined') {
  const fields = Object.keys(choices);
  function clearPreview() { $('sample-result').hidden = true; $('sample-empty').hidden = false; $('sample-error').hidden = true; for(const field of fields) { $(field).removeAttribute('aria-invalid'); $(field).removeAttribute('aria-describedby'); } }
  $('sample-form').addEventListener('change',clearPreview);
  $('sample-form').addEventListener('reset',clearPreview);
  $('sample-form').addEventListener('submit',event => {
    event.preventDefault(); clearPreview();
    const input = Object.fromEntries(fields.map(field => [field,$(field).value]));
    try {
      const result = routeBrief(input);
      for(const field of ['title','reason','route','response']) $('result-'+field).textContent = result[field];
      $('sample-empty').hidden = true; $('sample-result').hidden = false; $('result-title').focus();
    } catch(error) {
      $('sample-error').textContent = error.message; $('sample-error').hidden = false;
      const invalid = fields.filter(field => !choices[field].includes(input[field]));
      for(const field of invalid) { $(field).setAttribute('aria-invalid','true'); $(field).setAttribute('aria-describedby','sample-error'); }
      if(invalid.length) $(invalid[0]).focus();
    }
  });
}
