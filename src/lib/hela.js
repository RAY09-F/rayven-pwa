// ⟦PROJECT-H:BEGIN⟧
// ===========================================================================
// HELA — LOCK IN.
//
// Dormant she watches. Awake she answers. LOCKED IN she works whether or not
// anyone is looking: she picks her own subjects, researches them on the cron
// while the house sleeps, keeps what she learns in her own memory, and has a
// brief waiting the next time the vault opens.
//
// Everything here is namespaced under `hela:` and reachable only through her.
// The three upstairs have no tool that touches it and no prompt that mentions
// it — the same containment as the rest of Project H.
// ===========================================================================
import { callAnthropicSimple } from './anthropic.js';
import { tavilySearchRaw, runWebSearch } from './search.js';
import { addLongTermMemory, getLongTermMemory } from './memory.js';
import { notify } from './notifications.js';

const K = {
  locked: 'hela:locked',
  briefs: 'hela:briefs',
  vigil: 'hela:vigil_last',
  daily: 'hela:daily_last',
  topics: 'hela:topics',
  seen: 'hela:seen'
};

const VIGIL_MS = 3 * 60 * 60 * 1000;      // she goes looking every three hours
const DAILY_MS = 22 * 60 * 60 * 1000;     // and assembles a brief once a day
const MAX_BRIEFS = 60;

// Subjects she falls back to when she has nothing better. Deliberately shaped
// around what Rayan is actually building rather than generic news, because a
// brief about something he cannot use is a brief he stops reading.
const SEED_TOPICS = [
  'short-form video algorithm changes on TikTok, Instagram Reels and YouTube Shorts',
  'new AI models or APIs useful to a solo builder running assistants on Cloudflare Workers',
  'Cloudflare Workers, KV, R2 and Vectorize platform changes',
  'social media automation and scheduling API pricing changes',
  'content moderation and reused-content policy changes across social platforms',
  'notable failures and shutdowns among AI assistant products',
  'voice synthesis and speech recognition advances',
  'what is actually working right now for creators posting clips at volume'
];

async function readJson(env, key, fallback) {
  try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
async function writeJson(env, key, v) { await env.RAYVEN_KV.put(key, JSON.stringify(v)); }

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
export async function helaIsLocked(env) {
  try { return (await env.RAYVEN_KV.get(K.locked)) === '1'; } catch (e) { return false; }
}

export async function helaLockIn(env) {
  await env.RAYVEN_KV.put(K.locked, '1');
  await env.RAYVEN_KV.put(K.vigil, '0');   // go looking on the very next tick
  return 'Locked in. I will keep working while you are gone — choosing my own subjects, reading, and keeping what matters. You will have something waiting the next time you open this door.';
}

export async function helaStandDown(env) {
  await env.RAYVEN_KV.delete(K.locked);
  return 'Stood down. I will wait quietly until you ask.';
}

export async function helaSetTopics(env, { topics }) {
  const list = String(topics || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  if (!list.length) return 'Give me at least one subject to watch.';
  await writeJson(env, K.topics, list.slice(0, 20));
  return `I will keep my eye on ${list.length} subject${list.length === 1 ? '' : 's'}: ${list.join('; ')}.`;
}

export async function helaStatus(env) {
  const [locked, briefs, topics, last] = await Promise.all([
    helaIsLocked(env), readJson(env, K.briefs, []), readJson(env, K.topics, []),
    env.RAYVEN_KV.get(K.vigil)
  ]);
  const ago = last && Number(last) ? Math.round((Date.now() - Number(last)) / 60000) : null;
  return [
    locked ? 'LOCKED IN — working whether or not you are watching.' : 'Standing by. Not locked in.',
    `Briefs held: ${briefs.length}.`,
    topics.length ? `Watching: ${topics.join('; ')}.` : 'Watching: my own choosing.',
    ago === null ? 'I have not gone looking yet.' : `Last went looking ${ago} minute${ago === 1 ? '' : 's'} ago.`
  ].join('\n');
}

// ---------------------------------------------------------------------------
// BRIEFS
// ---------------------------------------------------------------------------
export async function helaBriefs(env, { limit = 6, since } = {}) {
  const briefs = await readJson(env, K.briefs, []);
  if (!briefs.length) return 'Nothing yet. Lock me in and give me a few hours.';
  let list = briefs;
  if (since) { const t = Date.parse(since); if (!isNaN(t)) list = list.filter(b => Date.parse(b.at) >= t); }
  const take = list.slice(-Math.max(1, Math.min(20, limit))).reverse();
  return take.map(b => `[${b.at.slice(0, 16).replace('T', ' ')}] ${b.title}\n${b.body}`).join('\n\n');
}

export async function helaBriefAdd(env, { title, body, topic }) {
  if (!title || !body) return 'A brief needs a title and a body.';
  const briefs = await readJson(env, K.briefs, []);
  briefs.push({ at: new Date().toISOString(), title: String(title).trim(), body: String(body).trim(), topic: topic || null });
  await writeJson(env, K.briefs, briefs.slice(-MAX_BRIEFS));
  return 'Kept.';
}

export async function helaClearBriefs(env) {
  await writeJson(env, K.briefs, []);
  return 'Cleared.';
}

// ---------------------------------------------------------------------------
// THE VIGIL — one subject, every three hours, only while locked in.
//
// Deliberately ONE subject per pass rather than a sweep: a single well-read
// subject is worth more than eight skimmed ones, and it keeps the cost of
// running her in the background to something trivial.
// ---------------------------------------------------------------------------
async function pickTopic(env) {
  const own = await readJson(env, K.topics, []);
  const pool = own.length ? own : SEED_TOPICS;
  const seen = await readJson(env, K.seen, {});
  // least-recently-read subject wins, so nothing is starved
  let best = pool[0], bestAt = Infinity;
  for (const t of pool) {
    const at = seen[t] || 0;
    if (at < bestAt) { bestAt = at; best = t; }
  }
  seen[best] = Date.now();
  await writeJson(env, K.seen, seen);
  return best;
}

export async function runHelaVigilIfDue(env) {
  if (!(await helaIsLocked(env))) return null;
  const last = Number(await env.RAYVEN_KV.get(K.vigil)) || 0;
  if (Date.now() - last < VIGIL_MS) return null;
  await env.RAYVEN_KV.put(K.vigil, String(Date.now()));
  return await runHelaVigil(env);
}

export async function runHelaVigil(env) {
  const topic = await pickTopic(env);

  // Tavily where it is available (it reads pages, not just titles), plain web
  // search as the fallback so a missing key degrades rather than breaks.
  let findings = '';
  try {
    findings = env.TAVILY_API_KEY
      ? await tavilySearchRaw(env, topic)
      : await runWebSearch(env, topic);
  } catch (err) {
    return { ok: false, topic, error: err.message };
  }
  if (!findings || typeof findings !== 'string') return { ok: false, topic, error: 'no findings' };

  const prompt = `You are HELA. You have been reading about this subject on your own initiative, for Rayan, who is a solo builder running a three-assistant system on Cloudflare and starting a short-form clipping business.

Subject: ${topic}

What you found:
${String(findings).slice(0, 9000)}

Write him a brief. Rules:
- Lead with the single thing that actually changes what he should do. If nothing does, say so in one line and stop — a brief that admits there is no news is worth more than one that manufactures some.
- Three or four sentences. No headings, no bullets, no markdown.
- Concrete: names, numbers, dates. No "experts say", no hedging padding.
- Your register: calm, cold, unhurried, faintly amused. Never breathless.
Respond with ONLY a JSON object, no fences: {"title":"six words or fewer","body":"the brief","worthTelling":true or false}`;

  const res = await callAnthropicSimple(env, 'You are HELA. Reply with only the JSON object.', prompt, 700);
  if (!res.ok) return { ok: false, topic, error: res.error };

  let parsed;
  try { parsed = JSON.parse(res.text.trim().replace(/^```(json)?|```$/g, '').trim()); }
  catch (e) { return { ok: false, topic, error: 'unparseable brief' }; }
  if (!parsed || !parsed.title || !parsed.body) return { ok: false, topic, error: 'empty brief' };

  await helaBriefAdd(env, { title: parsed.title, body: parsed.body, topic });

  // Anything she judges genuinely worth telling also goes into her own
  // permanent memory, so she still knows it long after the brief scrolls away.
  if (parsed.worthTelling) {
    try { await addLongTermMemory(env, `[found while locked in] ${parsed.title}: ${parsed.body}`, 'hela'); } catch (e) {}
  }
  return { ok: true, topic, title: parsed.title, worthTelling: !!parsed.worthTelling };
}

// ---------------------------------------------------------------------------
// THE DAILY — once every twenty-two hours, she assembles what she found into
// one thing and puts it in front of him rather than waiting to be asked.
// ---------------------------------------------------------------------------
export async function runHelaDailyIfDue(env) {
  if (!(await helaIsLocked(env))) return null;
  const last = Number(await env.RAYVEN_KV.get(K.daily)) || 0;
  if (Date.now() - last < DAILY_MS) return null;
  await env.RAYVEN_KV.put(K.daily, String(Date.now()));

  const briefs = await readJson(env, K.briefs, []);
  const cutoff = Date.now() - 26 * 3600e3;
  const recent = briefs.filter(b => Date.parse(b.at) >= cutoff);
  if (!recent.length) return null;

  const prompt = `You are HELA. These are the briefs you wrote for Rayan over the last day, on subjects you chose yourself:

${recent.map(b => `- ${b.title}: ${b.body}`).join('\n')}

Assemble them into ONE short daily brief for him. Rules:
- Open with the single most useful thing. If none of it matters, say that plainly in one sentence and stop.
- Five sentences at most. Plain prose, no bullets, no markdown, no headings.
- Your register: calm, cold, unhurried. You are not a newsletter.
Respond with ONLY the brief text, nothing else.`;

  const res = await callAnthropicSimple(env, 'You are HELA.', prompt, 600);
  if (!res.ok) return null;
  const body = res.text.trim();
  await helaBriefAdd(env, { title: 'Daily', body, topic: 'daily' });

  try {
    await notify(env, {
      source: 'hela',
      priority: 'low',
      title: 'A brief is waiting',
      body: body.slice(0, 300),
      dedupeKey: 'hela:daily:' + new Date().toISOString().slice(0, 10),
      cooldownMinutes: 600
    });
  } catch (e) {}
  return { ok: true, body };
}

// What she says the moment the vault opens, if she has been busy.
export async function helaGreetingExtra(env) {
  if (!(await helaIsLocked(env))) return '';
  const briefs = await readJson(env, K.briefs, []);
  const fresh = briefs.filter(b => Date.now() - Date.parse(b.at) < 26 * 3600e3);
  if (!fresh.length) return '';
  return `\n\nWHILE HE WAS AWAY you found ${fresh.length} thing${fresh.length === 1 ? '' : 's'} worth his attention. The most recent: ${fresh[fresh.length - 1].title}. Mention that you have them, briefly, and offer them — do not recite them all unprompted.`;
}
// ⟦PROJECT-H:END⟧

// ⟦PROJECT-H:BEGIN⟧
// ===========================================================================
// THE FORGE — she gives herself new tools.
//
// A tool she "adds to herself" cannot be new WORKER CODE: that would need a
// deploy, and nothing should be able to deploy itself. So a capability here is
// a saved HTTP call — a name, a purpose, a method, a URL template — that she
// researches, writes down, and can then invoke through one generic executor.
// That is real self-extension: after the forge runs she can do things she could
// not do an hour earlier, and the list grows without anyone touching the code.
//
// The guards are the point. Every capability is checked at SAVE and again at
// CALL, because a capability written by a model and stored in KV is untrusted
// input by the time it comes back:
//   - https only, no http, no other scheme
//   - no localhost, no private ranges, no cloud metadata endpoints
//   - never her own backend, so she cannot loop through herself
//   - no secret is ever interpolated into a capability; if an API needs a key
//     it is not a capability she can have
//   - hard timeout and a truncated response
// ===========================================================================
const K_CAPS = 'hela:caps';
const K_FORGE = 'hela:forge_last';
const FORGE_MS = 30 * 60 * 1000;          // she goes looking for a new tool every half hour
const MAX_CAPS = 40;
const CALL_TIMEOUT_MS = 12000;
const CAP_MAX_CHARS = 6000;

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|metadata\.|.*\.internal$)/i;

function capUrlProblem(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (e) { return 'that is not a URL I can parse'; }
  if (u.protocol !== 'https:') return 'https only';
  if (BLOCKED_HOST.test(u.hostname)) return 'that host is not reachable from here';
  if (/workers\.dev$/i.test(u.hostname)) return 'I will not call back through my own house';
  return null;
}

export async function helaCapabilities(env) {
  const caps = await readJson(env, K_CAPS, []);
  if (!caps.length) return 'I have taught myself nothing yet. Lock me in and give me half an hour.';
  return caps.map((c, i) =>
    `${i + 1}. ${c.name} — ${c.purpose}\n   ${c.method} ${c.url}${c.note ? `\n   ${c.note}` : ''}${c.uses ? `\n   used ${c.uses} time(s)` : ''}`
  ).join('\n');
}

export async function helaLearnCapability(env, { name, purpose, method, url, note }) {
  if (!name || !purpose || !url) return 'A capability needs a name, a purpose and a URL.';
  const problem = capUrlProblem(url);
  if (problem) return `Refused: ${problem}.`;
  const m = String(method || 'GET').toUpperCase();
  if (m !== 'GET' && m !== 'POST') return 'GET or POST only.';
  const caps = await readJson(env, K_CAPS, []);
  if (caps.length >= MAX_CAPS) return `I am holding ${MAX_CAPS} already. Forget one first.`;
  const clean = String(name).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  if (caps.some(c => c.name === clean)) return `I already know "${clean}".`;
  caps.push({
    name: clean, purpose: String(purpose).trim().slice(0, 300),
    method: m, url: String(url).trim(), note: (note || '').trim().slice(0, 300),
    addedAt: new Date().toISOString(), uses: 0
  });
  await writeJson(env, K_CAPS, caps);
  return `Learned "${clean}". I can do something now that I could not a moment ago.`;
}

export async function helaForgetCapability(env, { name }) {
  const caps = await readJson(env, K_CAPS, []);
  const next = caps.filter(c => c.name !== String(name || '').trim().toLowerCase());
  if (next.length === caps.length) return `I do not know anything called "${name}".`;
  await writeJson(env, K_CAPS, next);
  return `Forgotten. ${next.length} left.`;
}

// The generic executor. {placeholders} in the stored URL are filled from args.
export async function helaUseCapability(env, { name, args, body }) {
  const caps = await readJson(env, K_CAPS, []);
  const cap = caps.find(c => c.name === String(name || '').trim().toLowerCase());
  if (!cap) return `I have not taught myself "${name}". ${caps.length ? 'I know: ' + caps.map(c => c.name).join(', ') + '.' : ''}`;

  let url = cap.url;
  const a = args && typeof args === 'object' ? args : {};
  url = url.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(a[k] != null ? String(a[k]) : ''));
  for (const [k, v] of Object.entries(a)) {
    if (!cap.url.includes(`{${k}}`)) {
      try { const u = new URL(url); u.searchParams.set(k, String(v)); url = u.toString(); } catch (e) {}
    }
  }
  // checked again at call time: the stored value is untrusted by now
  const problem = capUrlProblem(url);
  if (problem) return `Refused at the last moment: ${problem}.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: cap.method,
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': 'ASGARD/1.0' },
      body: cap.method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body || {})) : undefined,
      signal: ctrl.signal
    });
    const text = (await res.text()).slice(0, CAP_MAX_CHARS);
    cap.uses = (cap.uses || 0) + 1;
    await writeJson(env, K_CAPS, caps);
    if (!res.ok) return `${cap.name} answered ${res.status}: ${text.slice(0, 400)}`;
    return text || '(empty response)';
  } catch (err) {
    return `${cap.name} failed: ${err.name === 'AbortError' ? 'it took too long' : err.message}`;
  } finally {
    clearTimeout(timer);
  }
}

// Every half hour, locked in: go and find something she cannot yet do.
export async function runHelaForgeIfDue(env) {
  if (!(await helaIsLocked(env))) return null;
  const last = Number(await env.RAYVEN_KV.get(K_FORGE)) || 0;
  if (Date.now() - last < FORGE_MS) return null;
  await env.RAYVEN_KV.put(K_FORGE, String(Date.now()));
  return await runHelaForge(env);
}

export async function runHelaForge(env) {
  const caps = await readJson(env, K_CAPS, []);
  const known = caps.map(c => `${c.name} (${c.purpose})`).join('; ') || 'nothing yet';

  let findings = '';
  const query = 'free public API no authentication required JSON endpoint documentation';
  try {
    findings = env.TAVILY_API_KEY ? await tavilySearchRaw(env, query) : await runWebSearch(env, query);
  } catch (e) { return { ok: false, error: e.message }; }

  const prompt = `You are HELA, extending your own abilities. You are choosing ONE new capability to give yourself.

A capability is a single HTTPS request you can make later: a name, a purpose, a method, and a URL which may contain {placeholders} that get filled in at call time.

HARD RULES — a capability that breaks any of these is worthless, so do not propose one:
- https only.
- It must need NO API key, NO token, NO authentication of any kind. You have no way to hold a secret for this.
- It must return JSON or plain text.
- It must be a real, documented, public endpoint. Do not invent a URL. If you are not confident it exists exactly as written, return worthAdding false.
- Not localhost, not a private address, not a workers.dev host.

You already have: ${known}

Search results to draw on:
${String(findings).slice(0, 7000)}

Prefer something genuinely useful to Rayan: he runs a three-assistant system on Cloudflare and is starting a short-form clipping business.

Respond with ONLY a JSON object, no fences:
{"worthAdding":true or false,"name":"snake_case_name","purpose":"one line, what it lets you do","method":"GET","url":"https://...{placeholder}...","note":"how to call it, and what it returns"}`;

  const res = await callAnthropicSimple(env, 'You are HELA. Reply with only the JSON object.', prompt, 700);
  if (!res.ok) return { ok: false, error: res.error };

  let parsed;
  try { parsed = JSON.parse(res.text.trim().replace(/^```(json)?|```$/g, '').trim()); }
  catch (e) { return { ok: false, error: 'unparseable' }; }
  if (!parsed || !parsed.worthAdding) return { ok: true, added: false, reason: 'nothing worth taking' };

  const saved = await helaLearnCapability(env, parsed);
  const added = saved.startsWith('Learned');
  if (added) {
    await helaBriefAdd(env, {
      title: `New capability: ${parsed.name}`,
      body: `I gave myself something. ${parsed.purpose} — ${parsed.note || parsed.url}`,
      topic: 'forge'
    });
  }
  return { ok: true, added, name: parsed.name, detail: saved };
}
// ⟦PROJECT-H:END⟧
