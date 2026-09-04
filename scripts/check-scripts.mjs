// scripts/check-scripts.mjs <file.html>
// Splits every <script> block out of a big HTML file, skips importmap / JSON /
// shader blocks, writes module blocks as .mjs and the rest as .js, runs
// `node --check` on each and prints PASS or FAIL per block.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const file = process.argv[2];
if (!file) { console.error('usage: check-scripts.mjs <file.html>'); process.exit(2); }
const html = readFileSync(file, 'utf8');
const dir = join(process.env.SCRATCH || tmpdir(), 'check-scripts-' + process.pid);
mkdirSync(dir, { recursive: true });
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, n = 0, fails = 0;
while ((m = re.exec(html))) {
  n++;
  const attrs = m[1], body = m[2];
  if (/\bsrc\s*=/.test(attrs)) { continue; }
  const type = (/type\s*=\s*["']([^"']+)["']/.exec(attrs) || [])[1] || '';
  if (/importmap|json|x-shader|text\/plain|template/i.test(type)) { console.log(`#${n} SKIP (${type})`); continue; }
  const ext = /module/i.test(type) ? '.mjs' : '.js';
  const line = html.slice(0, m.index).split('\n').length;
  const p = join(dir, `block${n}${ext}`);
  writeFileSync(p, body);
  const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  if (r.status === 0) console.log(`#${n} (line ${line}) PASS`);
  else { fails++; console.log(`#${n} (line ${line}) FAIL\n${(r.stderr || '').split('\n').slice(0, 6).join('\n')}`); }
}
process.exit(fails ? 1 : 0);
