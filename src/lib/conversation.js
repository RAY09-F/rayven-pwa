import { ledger } from './ledger.js';
// ---------------------------------------------------------------------------
// THE CONVERSATION OBJECT (asgard-upgrade Phase 1, Hard Rule 5a)
// ---------------------------------------------------------------------------
// A persona's history used to be a bare array of turns under one KV key. It is
// now an envelope { v:2, turns:[...], meta:{...} } under the SAME key, so the
// one write the reply already makes carries everything else the upgrade needs
// on the reply path -- with zero extra writes:
//   meta.tainted   the taint bit, with sources and when it entered
//   meta.domains   hosts the browser has been driven to in this conversation
//   meta._spool    ring buffer (last 50) of audit lines, autonomy-log entries,
//                  events and queued delegations; the cron tick drains it
//   meta.groups    (Phase 7) open tool groups
// Legacy arrays are read transparently and upgraded on the next save. Nothing
// is ever dropped from turns by this file beyond the existing per-persona cap.
export const SPOOL_CAP = 50;

export function unwrap(raw) {
  if (!raw) return { turns: [], meta: {} };
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return { turns: [], meta: {} }; }
  if (Array.isArray(parsed)) return { turns: parsed, meta: {} };
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.turns)) return { turns: parsed.turns, meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {} };
  return { turns: [], meta: {} };
}

export function wrap(turns, meta) {
  return JSON.stringify({ v: 2, turns: Array.isArray(turns) ? turns : [], meta: meta && typeof meta === 'object' ? meta : {} });
}

export async function loadConversation(env, key) {
  if(env.CONVERSATION_MIRROR_ENABLED==='true')return unwrap(await ledger.conversationMirror(env,key));
  try { return unwrap(await env.RAYVEN_KV.get(key)); } catch (e) { return { turns: [], meta: {} }; }
}

export async function saveConversation(env, key, turns, meta) {
  if(env.CONVERSATION_MIRROR_ENABLED==='true'){await ledger.conversationMirror(env,key,wrap(turns,meta));return;}
  try { await env.RAYVEN_KV.put(key, wrap(turns, meta)); } catch (e) { console.error('Conversation save failed:', e && e.message); }
}

// One spool entry: { ts, kind, ...fields }. Oldest entries fall off at the cap.
export function spoolPush(meta, kind, entry) {
  if (!meta || typeof meta !== 'object') return;
  if (!Array.isArray(meta._spool)) meta._spool = [];
  meta._spool.push({ ts: Date.now(), kind, ...entry });
  if (meta._spool.length > SPOOL_CAP) meta._spool = meta._spool.slice(-SPOOL_CAP);
}

// ---- the taint bit, persisted per conversation ---------------------------
// Set the moment untrusted content enters the context. It clears on its own
// only once the turns that carried the untrusted content have rolled out of
// the history window -- turnsLeft counts down one per turn from the history
// cap at the time of tainting. A group chat is re-tainted on every turn.
export function isTainted(meta) {
  return !!(meta && meta.tainted && (meta.tainted.turnsLeft == null || meta.tainted.turnsLeft > 0));
}

export function markTainted(meta, source, historyCap) {
  if (!meta || typeof meta !== 'object') return;
  const now = Date.now();
  if (!isTainted(meta)) meta.tainted = { at: now, sources: [], turnsLeft: historyCap || 30 };
  else meta.tainted.turnsLeft = historyCap || meta.tainted.turnsLeft;
  const src = String(source || 'unknown').slice(0, 80);
  if (!meta.tainted.sources.some(s => s.source === src)) meta.tainted.sources.push({ source: src, at: now });
  if (meta.tainted.sources.length > 12) meta.tainted.sources = meta.tainted.sources.slice(-12);
}

export function tickTaint(meta) {
  if (meta && meta.tainted && typeof meta.tainted.turnsLeft === 'number') {
    meta.tainted.turnsLeft -= 1;
    if (meta.tainted.turnsLeft <= 0) delete meta.tainted;
  }
}

// "derived from a page fetched at 14:02" -- built by string concatenation from
// the recorded sources, never by the model.
export function taintProvenance(meta) {
  if (!isTainted(meta)) return '';
  const fmt = (t) => new Date(t).toISOString().slice(11, 16) + ' UTC';
  return meta.tainted.sources.map(s => `${s.source} at ${fmt(s.at)}`).join(', ');
}

export function noteDomain(meta, url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    if (!meta.domains) meta.domains = [];
    if (!meta.domains.includes(host)) { meta.domains.push(host); if (meta.domains.length > 40) meta.domains = meta.domains.slice(-40); }
    return host;
  } catch (e) { return null; }
}

export function isKnownDomain(meta, url) {
  try { const host = new URL(String(url)).hostname.toLowerCase(); return !!(meta && Array.isArray(meta.domains) && meta.domains.includes(host)); }
  catch (e) { return false; }
}

// The provenance shape every memory write carries from now on (Phase 1.1).
// trust: 'rayan' | 'trusted-tool' | 'untrusted-content'. Entries without one
// are read as 'legacy' and never rewritten.
export function provenance(source, persona, trust) {
  const t = ['rayan', 'trusted-tool', 'untrusted-content'].includes(trust) ? trust : 'trusted-tool';
  return { source: String(source || 'unknown').slice(0, 60), persona: persona || null, ts: new Date().toISOString(), trust: t };
}
