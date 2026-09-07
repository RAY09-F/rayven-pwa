// scripts/patch.mjs <file> <anchorFile> <replacementFile>
// Replaces the anchor text with the replacement text. The anchor must appear
// EXACTLY once or nothing is written and the exit code is non-zero.
// No regex. Prints only the byte delta.
import { readFileSync, writeFileSync } from 'node:fs';
const [file, anchorFile, replFile] = process.argv.slice(2);
if (!file || !anchorFile || !replFile) { console.error('usage: patch.mjs <file> <anchorFile> <replacementFile>'); process.exit(2); }
const src = readFileSync(file, 'utf8');
const anchor = readFileSync(anchorFile, 'utf8');
const repl = readFileSync(replFile, 'utf8');
if (!anchor.length) { console.error('empty anchor'); process.exit(3); }
let count = 0, idx = -1, from = 0;
for (;;) { const i = src.indexOf(anchor, from); if (i < 0) break; count++; if (idx < 0) idx = i; from = i + anchor.length; }
if (count !== 1) { console.error(`anchor found ${count} times in ${file}; expected exactly 1`); process.exit(4); }
const out = src.slice(0, idx) + repl + src.slice(idx + anchor.length);
writeFileSync(file, out);
console.log((out.length - src.length >= 0 ? '+' : '') + (Buffer.byteLength(out) - Buffer.byteLength(src)));
