#!/usr/bin/env node
// scripts/mcp-smoke.mjs [LIVE_BASE_URL]  — lists tools over POST /mcp and calls weather. Bearer = ~/.asgard-admin-token.
import { readFileSync } from 'node:fs'; import { homedir } from 'node:os';
const BASE = (process.argv[2] || 'https://asgrard-backend.rayanfahil2.workers.dev').replace(/\/$/, '');
let token = ''; try { token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim(); } catch {}
if (!token) { console.error('FAIL  ~/.asgard-admin-token missing'); process.exit(2); }
let fails = 0; const ok = (l, x = '') => console.log(`PASS  ${l}  ${x}`); const bad = (l, x = '') => { fails++; console.log(`FAIL  ${l}  ${x}`); };
const rpc = async (id, method, params) => { const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }); return { status: r.status, session: r.headers.get('Mcp-Session-Id'), json: await r.json().catch(() => null) }; };
const init = await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-smoke', version: '1' } });
if (init.status === 200 && init.json && init.json.result && init.json.result.protocolVersion && init.json.result.capabilities && init.json.result.capabilities.tools) ok('initialize', `protocolVersion ${init.json.result.protocolVersion}, no session id: ${init.session === null}`); else bad('initialize', JSON.stringify(init.json).slice(0, 200));
const list = await rpc(2, 'tools/list', {});
const tools = (list.json && list.json.result && list.json.result.tools) || [];
if (list.status === 200 && tools.length) ok('tools/list', `${tools.length} tools`); else bad('tools/list', JSON.stringify(list.json).slice(0, 200));
const names = tools.map(t => t.name);
if (!names.includes('send_text') && !names.includes('make_call')) ok('hard-confirm tools absent from the list'); else bad('hard-confirm tools present');
if (names.includes('weather')) ok('weather listed'); else bad('weather missing');
const call = await rpc(3, 'tools/call', { name: 'weather', arguments: { location: 'Bakersfield, CA' } });
const txt = call.json && call.json.result && call.json.result.content && call.json.result.content[0] && call.json.result.content[0].text;
if (call.status === 200 && txt) ok('tools/call weather', `"${String(txt).slice(0, 60)}"`); else bad('tools/call weather', JSON.stringify(call.json).slice(0, 200));
const refuse = await rpc(4, 'tools/call', { name: 'send_text', arguments: { to: '+15555555555', body: 'x' } });
if (refuse.json && refuse.json.error && /live confirmation/.test(refuse.json.error.message || '')) ok('send_text refused over MCP', refuse.json.error.message); else bad('send_text should be refused', JSON.stringify(refuse.json).slice(0, 200));
const noauth = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list' }) });
if (noauth.status === 401) ok('unauthenticated request → 401'); else bad('unauthenticated request', `status ${noauth.status}`);
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS'); process.exit(fails ? 1 : 0);
