#!/usr/bin/env node
// scripts/export-vault.mjs [LIVE_BASE_URL] [--hela]   (plain Node, no deps)
// Calls GET /admin/vault.json on the LIVE Worker with the admin token read from
// ~/.asgard-admin-token (a file, never an argument), writes the folder
// ~/asgard-vault/ laid out as an Obsidian vault, and prints a count of files.
// --hela adds the X-Asgard-Vault: hela header so her folders are included
// (by default they are left out entirely).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
const args = process.argv.slice(2);
const BASE = (args.find(a => /^https?:\/\//.test(a)) || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
const withHela = args.includes('--hela');
let token = '';
try { token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim(); } catch {}
if (!token) { console.error('~/.asgard-admin-token is missing; the vault route needs it.'); process.exit(2); }
const headers = { 'X-Asgard-Admin': token }; if (withHela) headers['X-Asgard-Vault'] = 'hela';
const res = await fetch(BASE + '/admin/vault.json', { headers });
if (!res.ok) { console.error(`GET /admin/vault.json → ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1); }
const files = await res.json();
if (!Array.isArray(files)) { console.error('unexpected body'); process.exit(1); }
const root = join(homedir(), 'asgard-vault');
let n = 0;
for (const f of files) {
  if (!f || typeof f.path !== 'string' || /(^|\/)\.\.(\/|$)/.test(f.path) || f.path.startsWith('/')) continue;
  const p = join(root, f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, String(f.content ?? '')); n++;
}
console.log(`wrote ${n} file(s) to ${root}${withHela ? ' (including the hidden realm)' : ''}`);
