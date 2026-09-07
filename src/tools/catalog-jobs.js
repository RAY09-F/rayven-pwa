// CATALOGUE — WORK & JOB HUNT (asgard-upgrade Phase 7.5). Jane Foster, Hunter B-15.
// No-key sources only (Remotive, Jobicy, Arbeitnow, The Muse). Nothing here applies
// on Rayan's behalf. Never.
import { httpJson, clip, capN, stripTags } from '../lib/http.js';
const S = (props, required = []) => ({ type: 'object', properties: props, required });
const str = d => ({ type: 'string', description: d }), int = d => ({ type: 'integer', description: d });
const enc = encodeURIComponent; const G = 'jobs';

export async function searchJobs(env, q, location, n) {
  const k = capN(n), qq = String(q || '').trim(), loc = String(location || '').trim().toLowerCase();
  const out = [];
  const [rem, jic, arb, muse] = await Promise.all([
    httpJson(env, `https://remotive.com/api/remote-jobs?search=${enc(qq)}&limit=${k}`, { cacheSeconds: 1800 }),
    httpJson(env, `https://jobicy.com/api/v2/remote-jobs?count=${k}&tag=${enc(qq)}`, { cacheSeconds: 1800 }),
    httpJson(env, `https://www.arbeitnow.com/api/job-board-api?search=${enc(qq)}`, { cacheSeconds: 1800 }),
    httpJson(env, `https://www.themuse.com/api/public/jobs?page=1&descending=true${loc ? `&location=${enc(location)}` : ''}`, { cacheSeconds: 1800, maxBytes: 1024 * 1024 })
  ]);
  if (rem.ok) for (const j of (rem.json || {}).jobs || []) out.push({ id: `remotive:${j.id}`, title: j.title, company: j.company_name, where: j.candidate_required_location || 'remote', date: String(j.publication_date || '').slice(0, 10), url: j.url, src: 'Remotive' });
  if (jic.ok) for (const j of (jic.json || {}).jobs || []) out.push({ id: `jobicy:${j.id}`, title: j.jobTitle, company: j.companyName, where: j.jobGeo || 'remote', date: String(j.pubDate || '').slice(0, 10), url: j.url, src: 'Jobicy' });
  if (arb.ok) for (const j of (arb.json || {}).data || []) if (!qq || `${j.title} ${j.description}`.toLowerCase().includes(qq.toLowerCase())) out.push({ id: `arbeitnow:${j.slug}`, title: j.title, company: j.company_name, where: j.location || (j.remote ? 'remote' : ''), date: j.created_at ? new Date(j.created_at * 1000).toISOString().slice(0, 10) : '', url: j.url, src: 'Arbeitnow' });
  if (muse.ok) for (const j of (muse.json || {}).results || []) if (!qq || String(j.name).toLowerCase().includes(qq.toLowerCase())) out.push({ id: `muse:${j.id}`, title: j.name, company: (j.company || {}).name, where: (j.locations || []).map(l => l.name).join('; '), date: String(j.publication_date || '').slice(0, 10), url: (j.refs || {}).landing_page, src: 'The Muse' });
  const filtered = loc ? out.filter(j => /remote|anywhere|usa|united states|worldwide/i.test(j.where) || j.where.toLowerCase().includes(loc)) : out;
  const errors = [rem, jic, arb, muse].filter(r => !r.ok).length;
  return { jobs: filtered.slice(0, k), total: out.length, sourcesDown: errors };
}
export const TOOLS = [
  { name: 'jobs_search', group: G, taint: true, description: 'Search job listings (no-key boards: Remotive, Jobicy, Arbeitnow, The Muse — remote-heavy): title, company, location, date, link. Up to 20. Never applies for anything.', input_schema: S({ q: str('role or keywords'), location: str('city or "remote", optional'), n: int('results, default 10, max 20') }, ['q']),
    async run(env, { q, location, n }) { const r = await searchJobs(env, q, location, n); if (!r.jobs.length) return `No listings for "${q}"${location ? ` near ${location}` : ''} on the free boards right now${r.sourcesDown ? ` (${r.sourcesDown} of 4 boards did not answer)` : ''}. Keyed boards (Adzuna, USAJobs) would widen this — Rayan can add a key.`; return clip(r.jobs.map((j, i) => `${i + 1}. ${j.title} — ${j.company}${j.where ? ` (${j.where})` : ''}${j.date ? `, ${j.date}` : ''} [${j.src}]\n   ${j.url}`).join('\n') + (r.sourcesDown ? `\n(${r.sourcesDown} of 4 boards did not answer)` : '')); } },
  { name: 'company_lookup', group: G, taint: true, description: 'A company in brief: the Wikipedia summary (and, if it is public, a pointer to SEC filings by ticker).', input_schema: S({ name: str('company name'), ticker: str('stock ticker, optional') }, ['name']),
    async run(env, { name, ticker }) { const os = await httpJson(env, `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=5&namespace=0&search=${enc(String(name).trim())}`, { cacheSeconds: 86400 }); const titles = os.ok && Array.isArray(os.json) ? (os.json[1] || []) : []; const best = titles.find(t => /\b(inc|corp|corporation|company|co\.|ltd|llc|group|holdings)\b/i.test(t)) || titles.find(t => !/disambiguation|may refer/i.test(t)) || String(name).trim(); const r = await httpJson(env, `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(String(best).replace(/ /g, '_'))}`, { cacheSeconds: 86400 }); const wiki = r.ok && r.json && r.json.extract ? `${r.json.title}: ${String(r.json.extract).slice(0, 700)} ${r.json.content_urls ? r.json.content_urls.desktop.page : ''}` : `No Wikipedia summary for ${name}.`; const sec = ticker ? `\nSEC filings: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${enc(String(ticker).toUpperCase())}&type=10-K&owner=include&count=10` : ''; return wiki + sec; } }
];
