// ---------------------------------------------------------------------------
// THE APPROVALS INBOX (asgard-upgrade Phase 1.5)
// ---------------------------------------------------------------------------
// When a session that has read untrusted content asks for something that
// could carry data out, publish, change future behaviour or write permanent
// memory, the action is not run and not merely "confirmed" -- it is queued
// here with the LITERAL recipient and body and where the content came from,
// built by string concatenation (never by the model), and Rayan is told on his
// private Telegram: "[APPROVAL 1234] ... reply APPROVE 1234 or REJECT 1234".
// Those two replies are honoured only from Rayan's id in a private chat.
// Hard-confirm tools (SMS, calls) keep the live confirmation ON TOP: approving
// one stages it for the existing "say yes" flow rather than sending it.
//
// One KV key, `approvals`, capped at 50. Creating one is the ONE extra write
// the reply path is allowed (Rule 5a); resolving one is a second, on a turn
// Rayan explicitly started. Both are counted against the Rule 5e ceiling.
import { HARD_CONFIRM_TOOLS, checkPermission } from './permissions.js';
import { ledger } from './ledger.js';
import { getPersonaBotToken, getPersona } from './personas.js';
import { sendTelegramMessage, getRayanPrivateChatId } from './telegram.js';
import { describeAction } from './containment.js';
import { writeBudget } from './tick.js';
import { emit } from './events.js';

const KEY = 'approvals';
const CAP = 50;
const TTL_MS = 7 * 86400000;

async function readAll(env) {
  try { const raw = await env.RAYVEN_KV.get(KEY); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? list : []; } catch (e) { return []; }
}
async function writeAll(env, list) {
  await env.RAYVEN_KV.put(KEY, JSON.stringify(list.slice(-CAP)));
}

function newId(list) {
  for (let i = 0; i < 50; i++) { const id = String(1000 + Math.floor(Math.random() * 9000)); if (!list.some(a => a.id === id && a.status === 'pending')) return id; }
  return String(Date.now()).slice(-4);
}

// what: one line for the Telegram message; description: the full literal text.
export async function createApproval(env, { persona, tool, input, tainted, sources, provenance, channel, councillor }) {
  const budget = await writeBudget(env);
  if (!budget.ok) return { ok: false, error: `the daily write ceiling (${budget.ceiling}) is reached; nothing new is queued until 00:00 UTC` };
  const list = await readAll(env);
  const id = newId(list);
  const description = describeAction(tool, input, tainted, sources);
  const rec = {
    id, status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    persona, councillor: councillor || null, channel: channel || 'web', tool, input: input || {},
    description, provenance: provenance || (tainted ? 'derived from untrusted content' : 'clean session')
  };
  list.push(rec);
  try { await writeAll(env, list); } catch (e) { return { ok: false, error: `could not save the approval: ${e.message}` }; }

  // Tell Rayan, from this persona's own bot.
  try {
    const chatId = await getRayanPrivateChatId(env);
    const token = getPersonaBotToken(env, persona) || env.TELEGRAM_BOT_TOKEN;
    if (chatId && token) {
      await sendTelegramMessage(env, chatId, `[APPROVAL ${id}] ${firstLine(description)} — from ${getPersona(persona).name}${rec.provenance ? `\n${rec.provenance}` : ''}\n\n${description}\n\nReply APPROVE ${id} or REJECT ${id}, or use the buttons.`, token,
        { reply_markup: { inline_keyboard: [[{ text: `APPROVE ${id}`, callback_data: `approve:${id}` }, { text: `REJECT ${id}`, callback_data: `reject:${id}` }]] } });   // Phase 6.7: honoured only from Rayan in his private chat
    }
  } catch (e) { console.error('approval notify failed:', e && e.message); }
  emit('approval.created', { id, tool, persona, councillor: councillor || null });
  return { ok: true, id, record: rec, writes: 1 };
}

function firstLine(s) { return String(s || '').split('\n')[0].slice(0, 80); }

export async function approvalRevision(rec) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([rec.id,rec.persona,rec.createdAt,rec.expiresAt,rec.tool,rec.input])));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function readApproval(env,id,persona) {
  return (await readAll(env)).find(a=>a.id===String(id)&&a.persona===persona)||null;
}

async function claim(env,rec,revision,required=false) {
  if(!env.LEDGER){if(required)throw Error('Approval coordination is unavailable. Nothing was executed.');return null;}
  const fields={key:rec.persona+':'+rec.id+':'+rec.createdAt,revision,token:crypto.randomUUID()};
  let result;try{result=await ledger.approvalClaim(env,'claim',fields);}catch{throw Error('Approval coordination could not respond. Nothing was executed. Refresh before trying again.');}
  if(!result.ok)throw Error(result.message);
  return fields;
}
async function finish(env,fields,status,revision,message) {
  if(fields)await ledger.approvalClaim(env,'finish',{...fields,status,revision,message});
}

export async function editApproval(env,id,persona,input,expectedRevision) {
  const list=await readAll(env),rec=list.find(a=>a.id===String(id)&&a.persona===persona);
  if(!rec||rec.status!=='pending'||(!Number.isFinite(Date.parse(rec.expiresAt))||Date.parse(rec.expiresAt)<=Date.now()))return {ok:false,text:'This approval is no longer waiting. Refresh its record.'};
  const revision=await approvalRevision(rec);
  if(revision!==expectedRevision)return {ok:false,text:'The proposed action changed. Read it again before editing.'};
  let held;
  try {
    held=await claim(env,rec,revision,true);
    rec.input=input;rec.description=describeAction(rec.tool,input,true,[rec.provenance||'previous proposal']);rec.editedAt=new Date().toISOString();
    await writeAll(env,list);
    await finish(env,held,'pending',await approvalRevision(rec),'The proposal was edited; it still needs approval.');
    return {ok:true,text:'Saved your changes. The action is still waiting for approval.'};
  }catch(error){if(held)await finish(env,held,'unknown',revision,'An edit was interrupted. Refresh and inspect the saved proposal.').catch(()=>{});return {ok:false,text:error.message};}
}

export async function listApprovals(env) {
  const list = (await readAll(env)).filter(a => a.status === 'pending' && Date.parse(a.expiresAt) > Date.now());
  if (!list.length) return 'Nothing is waiting for approval.';
  return `${list.length} waiting:\n` + list.map(a => `[${a.id}] ${a.createdAt.slice(0, 16).replace('T', ' ')} ${getPersona(a.persona).name}${a.councillor ? '/' + a.councillor : ''} — ${firstLine(a.description)}\n    ${a.provenance}`).join('\n') + '\n\nSay "approve 1234" or "reject 1234".';
}

// APPROVE 1234 / REJECT 1234, tolerant of case and punctuation.
export function matchApprovalReply(text) {
  const m = /^\s*(approve|reject|deny)\s+#?(\d{4})\s*[.!]?\s*$/i.exec(String(text || ''));
  if (!m) return null;
  return { decision: m[1].toLowerCase() === 'approve' ? 'approve' : 'reject', id: m[2] };
}

// Resolve one. `execute(env, tool, input, personaId)` is passed in so this
// module does not import the dispatcher (which imports this module).
export async function resolveApproval(env, id, decision, execute, options={}) {
  const list = await readAll(env);
  const rec = list.find(a => a.id === String(id));
  if (!rec) return { ok: false, text: `No approval numbered ${id}.` };
  if(!['approve','reject'].includes(decision))return {ok:false,text:'Unknown approval decision. Nothing was executed.'};
  if(options.persona&&options.persona!==rec.persona)return {ok:false,text:'That approval belongs to another hall.'};
  if (rec.status !== 'pending') return { ok: false, text: `Approval ${id} was already ${rec.status}.` };
  if (!Number.isFinite(Date.parse(rec.expiresAt)) || Date.parse(rec.expiresAt) <= Date.now()) { rec.status = 'expired'; await writeAll(env, list); return { ok: false, text: `Approval ${id} expired.` }; }

  const revision=await approvalRevision(rec);
  if(options.revision&&options.revision!==revision)return {ok:false,text:'The proposed action changed. Review it again before approving.'};
  if(decision==='approve'&&await checkPermission(env,rec.tool)==='off')return {ok:false,text:'This tool is turned off. Nothing was executed.'};
  let held;
  try{held=await claim(env,rec,revision,options.requireClaim);}catch(error){return {ok:false,text:error.message};}
  try {

  if (decision === 'reject') {
    rec.status = 'rejected'; rec.resolvedAt = new Date().toISOString();
    await writeAll(env, list);
    emit('approval.resolved', { id: rec.id, tool: rec.tool, decision: 'rejected' });
    await finish(env,held,'rejected',revision,'This approval was rejected. Nothing was executed.');
    return { ok: true, text: `Rejected ${id}. Nothing was ${rec.tool === 'send_text' ? 'sent' : 'done'}.`, record: rec };
  }

  // Hard-confirm tools: approval unlocks the LIVE confirmation, it never sends.
  if (HARD_CONFIRM_TOOLS.includes(rec.tool)) {
    rec.status = 'approved'; rec.resolvedAt = new Date().toISOString(); rec.note = 'staged for live confirmation';
    await writeAll(env, list);
    await env.RAYVEN_KV.put(`pending:${rec.persona}`, JSON.stringify({ toolName: rec.tool, toolInput: rec.input, personaId: rec.persona, created: Date.now(), approvalId: rec.id }), { expirationTtl: 300 });
    await finish(env,held,'approved',revision,'Approved and staged for the existing live confirmation. Nothing sent yet.');
    return { ok: true, text: `Approved ${id}. This one still needs your live word — it is a real ${rec.tool === 'send_text' ? 'text' : 'call'}:\n\n${rec.description}\n\nSay "yes" or "go ahead" within 5 minutes and ${getPersona(rec.persona).name} will do exactly that.`, record: rec, staged: true };
  }

  rec.status = 'approved'; rec.resolvedAt = new Date().toISOString();
  await writeAll(env, list);
  emit('approval.resolved', { id: rec.id, tool: rec.tool, decision: 'approved' });
  let result;
  try { result = await execute(env, rec.tool, rec.input, rec.persona); }
  catch (e) { await finish(env,held,'unknown',revision,'The tool call was interrupted; its outcome is unknown. Inspect its records before retrying.');return {ok:false,text:'The tool call was interrupted; its outcome is unknown. Inspect its records before retrying.',record:rec}; }
  const text = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 1500);
  await finish(env,held,'approved',revision,'Approval handled. Inspect the tool result for its outcome.');
  return { ok: true, text: `Approved ${id} — ${rec.tool} returned:\n${text}`, record: rec, result };
  }catch(error){if(held)await finish(env,held,'unknown',revision,'Approval handling was interrupted. Its outcome needs checking.').catch(()=>{});return {ok:false,text:'Approval handling was interrupted. Its outcome needs checking before retrying.'};}
}

export const APPROVAL_TOOL_DEFINITIONS = [
  { name: 'approvals_list', description: 'Show every action waiting for Rayan\'s approval — things a session that had read untrusted content asked for and that were queued instead of run.', input_schema: { type: 'object', properties: {} } },
  { name: 'approve', description: 'Approve a queued action by its four-digit number. Only when Rayan himself says so in this conversation. Texts and calls still get the live "say yes" on top.', input_schema: { type: 'object', properties: { id: { type: 'string', description: 'the four-digit approval number' } }, required: ['id'] } },
  { name: 'reject', description: 'Reject a queued action by its four-digit number.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } }
];
