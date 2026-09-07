// ASGARD AS AN MCP SERVER (asgard-upgrade Phase 5.4).
//
// JSON-RPC 2.0 over POST /mcp, with NO server state: no session id is ever
// issued or required, and `initialize` answers with capabilities { tools: {} }.
// Auth is a Bearer token equal to ADMIN_TOKEN. Only tools whose permission
// level is auto or notify are exposed, never the hidden realm's; confirm and
// hard-confirm tools are omitted from tools/list and refused at tools/call.
// Every call sets the taint bit: an external agent calling through here gets
// no more power than Thor has under untrusted content, and less.
//
// Protocol shape: the 2025-06-18 revision (sessions optional). The spec site's
// newest revision could not be read from this machine (client-rendered pages),
// so the server echoes a client's requested version when it is one of the
// known revisions and otherwise answers 2025-06-18 -- the client then knows
// exactly which versions are spoken.
import { toolDefinitionsForPersona } from './tools.js';
import { checkPermission, HARD_CONFIRM_TOOLS } from './permissions.js';
import { isConsequential } from './containment.js';
import { timingSafeEqual } from './util.js';
import { tickLog } from './tick.js';

const KNOWN_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_VERSION = '2025-06-18';
const EXPOSE_LEVELS = new Set(['auto', 'notify']);

const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

async function exposedTools(env) {
  const out = [];
  for (const t of toolDefinitionsForPersona('thor')) {
    if (HARD_CONFIRM_TOOLS.includes(t.name)) continue;
    let level = 'auto'; try { level = await checkPermission(env, t.name); } catch (e) {}
    if (!EXPOSE_LEVELS.has(level)) continue;
    if (isConsequential(t.name)) continue;   // would need a live confirmation once tainted -- not available over MCP
    out.push({ name: t.name, description: t.description, inputSchema: t.input_schema || { type: 'object', properties: {} } });
  }
  return out;
}

async function handleOne(env, msg, executeTool) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg && msg.id, -32600, 'invalid request');
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined;
  switch (method) {
    case 'initialize': {
      const want = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : DEFAULT_VERSION;
      return rpcResult(id, { protocolVersion: KNOWN_VERSIONS.includes(want) ? want : DEFAULT_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'asgard', version: '1.0.0' }, instructions: `Asgard's tools, read-mostly. Tools that need Rayan's live confirmation are not available here. Known protocol versions: ${KNOWN_VERSIONS.join(', ')}.` });
    }
    case 'notifications/initialized': return null;    // a notification: nothing to send back
    case 'ping': return rpcResult(id, {});
    case 'tools/list': return rpcResult(id, { tools: await exposedTools(env) });
    case 'tools/call': {
      const name = params && params.name, args = (params && params.arguments) || {};
      if (typeof name !== 'string') return rpcError(id, -32602, 'tools/call needs a tool name');
      const allowed = (await exposedTools(env)).some(t => t.name === name);
      if (!allowed) return rpcError(id, -32602, `${name}: requires live confirmation; not available over MCP`);
      try {
        const text = await executeTool(env, name, args, 'thor', { tainted: true, meta: {}, channel: 'mcp' });
        try { tickLog('audit', { persona: 'thor', channel: 'mcp', tool: name, time: new Date().toISOString(), tainted: true }); } catch (e) {}
        return rpcResult(id, { content: [{ type: 'text', text: String(text == null ? '' : text) }], isError: false });
      } catch (e) { return rpcResult(id, { content: [{ type: 'text', text: `That tool failed: ${e && e.message ? e.message : String(e)}` }], isError: true }); }
    }
    default: return isNotification ? null : rpcError(id, -32601, `method not found: ${method}`);
  }
}

export async function handleMcp(request, env, executeTool, corsHeaders = {}) {
  const headers = { ...corsHeaders, 'content-type': 'application/json' };
  const auth = request.headers.get('Authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '').trim();
  if (!env.ADMIN_TOKEN || !provided || !(await timingSafeEqual(provided, env.ADMIN_TOKEN))) {
    return new Response(JSON.stringify(rpcError(null, -32001, 'unauthorized: Bearer token required')), { status: 401, headers });
  }
  if (request.method !== 'POST') return new Response(JSON.stringify(rpcError(null, -32600, 'POST only; this server keeps no session and streams nothing')), { status: 405, headers });
  let body; try { body = await request.json(); } catch (e) { return new Response(JSON.stringify(rpcError(null, -32700, 'parse error')), { status: 400, headers }); }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => handleOne(env, m, executeTool)))).filter(Boolean);
    return out.length ? new Response(JSON.stringify(out), { status: 200, headers }) : new Response(null, { status: 202, headers: corsHeaders });
  }
  const res = await handleOne(env, body, executeTool);
  if (res === null) return new Response(null, { status: 202, headers: corsHeaders });
  return new Response(JSON.stringify(res), { status: 200, headers });
}
