import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root = new URL('../',import.meta.url);
export const outputPath = fileURLToPath(new URL('public/workshop/sample-download.html',root));
const read = async path => (await readFile(new URL(path,root),'utf8')).replace(/\r\n/g,'\n');
const hash = text => createHash('sha256').update(text).digest('base64');
export async function buildServiceSample() {
  let [html,css,js] = await Promise.all([read('public/workshop/sample.html'),read('public/ui/workshop/sample.css'),read('public/ui/workshop/sample.js')]);
  if (!js.includes('export function routeBrief(') || /\bimport\s/.test(js) || /<\/script/i.test(js) || /<\/style/i.test(css)) throw Error('Sample source needs an explicit bundler update.');
  js = `(()=>{\n${js.replace('export function routeBrief(','function routeBrief(')}\n})();`;
  const policy = `default-src 'none'; script-src 'sha256-${hash(js)}'; style-src 'sha256-${hash(css)}'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/,`<meta http-equiv="Content-Security-Policy" content="${policy}">`)
    .replace('<link rel="stylesheet" href="/ui/workshop/sample.css">',`<style>${css}</style>`)
    .replace('<script type="module" src="/ui/workshop/sample.js"></script>',`<script>${js}</script>`)
    .replaceAll('href="/workshop/services.html"','href="#about-sample"')
    .replace('Back to service studio ↗','About this offline sample ↗')
    .replace('Scope a website & automation project ↗','About this website & workflow sample ↗')
    .replace('</main>','<section id="about-sample" class="work"><p class="eyebrow">SHAREABLE OFFLINE PORTFOLIO SAMPLE</p><h2>A website and workflow,<br>in one file.</h2><p>This fictional Alder &amp; Line concept demonstrates service positioning, a project intake form and transparent routing rules. Open this file in a browser to try it; no server or account is needed.</p><p>The four review queues and acknowledgements are previews only. Nothing is sent, saved, booked or connected to a real business. This sample is not evidence of customers or revenue.</p><p>To discuss a real project, return to the person who shared this file and agree on the website scope, integrations, acceptance checks and terms.</p><a href="#intake">Try the interactive brief ↑</a></section></main>');
  if (/\b(?:href|src)="(?!#)[^"]*"/.test(html) || /\bexport\s/.test(js)) throw Error('Standalone output has an unresolved dependency.');
  return html;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const html = await buildServiceSample();
  if (process.argv.includes('--check')) {
    if (await readFile(outputPath,'utf8') !== html) throw Error('Sample download is stale. Run node scripts/build-service-sample.mjs.');
    console.log('Standalone sample matches source.');
  } else { await writeFile(outputPath,html); console.log(`Built ${outputPath}`); }
}
