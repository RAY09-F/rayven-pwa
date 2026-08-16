// Conversation history, long-term memory, to-dos, and content ideas — ported
// unchanged from worker.js, just made explicit-env functions instead of closures
// over the request handler's `env`.

export const MAX_HISTORY = 30;
// A persona may keep a deeper conversation than the house default. Anyone
// without an override stays at MAX_HISTORY exactly as before.
export function historyLimitFor(persona) {
  return (persona && persona.historyTurns) || MAX_HISTORY;
}

export async function loadHistory(env, key) {
  try {
    const stored = await env.RAYVEN_KV.get(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

export async function saveHistory(env, key, history) {
  try { await env.RAYVEN_KV.put(key, JSON.stringify(history)); } catch (e) { console.error('History save failed:', e); }
}

export function sanitizeHistory(history) {
  const cleaned = [];
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      const hasToolUse = msg.content.some(b => b && b.type === 'tool_use');
      if (hasToolUse) {
        const next = history[i + 1];
        const nextHasResult = next && next.role === 'user' && Array.isArray(next.content) &&
          next.content.some(b => b && b.type === 'tool_result');
        if (!nextHasResult) continue;
      }
    }
    if (msg && msg.role === 'user' && Array.isArray(msg.content)) {
      const hasOrphanResult = msg.content.some(b => b && b.type === 'tool_result');
      if (hasOrphanResult) {
        const prev = cleaned[cleaned.length - 1];
        const prevHasMatchingUse = prev && prev.role === 'assistant' && Array.isArray(prev.content) &&
          prev.content.some(b => b && b.type === 'tool_use');
        if (!prevHasMatchingUse) continue;
      }
    }
    cleaned.push(msg);
  }
  return cleaned;
}

// Long-term memory lives in ./memory.js now (adds embeddings + search on top of
// the same KV array) — kept out of this file to avoid two competing implementations.

export async function getTodos(env) {
  try {
    const raw = await env.RAYVEN_KV.get('todos');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function addTodo(env, text) {
  const todos = await getTodos(env);
  todos.push({ id: crypto.randomUUID(), text: String(text).trim(), done: false, created: new Date().toISOString() });
  await env.RAYVEN_KV.put('todos', JSON.stringify(todos));
  return `Added to your to-do list: "${text}".`;
}

export async function listTodos(env) {
  const todos = (await getTodos(env)).filter(t => !t.done);
  if (!todos.length) return "Your to-do list is empty, sir.";
  return "Open items:\n" + todos.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
}

export async function completeTodo(env, match) {
  const todos = await getTodos(env);
  const lower = String(match).toLowerCase();
  const found = todos.find(t => !t.done && t.text.toLowerCase().includes(lower));
  if (!found) return `Couldn't find an open to-do matching "${match}".`;
  found.done = true;
  found.completedAt = new Date().toISOString();
  await env.RAYVEN_KV.put('todos', JSON.stringify(todos));
  return `Marked "${found.text}" as done.`;
}

// ---- calendar (LOKI's lane) — same flat-JSON-blob pattern as todos ----

export async function getCalendarEvents(env) {
  try {
    const raw = await env.RAYVEN_KV.get('calendar:events');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function addCalendarEvent(env, title, date, time, notes) {
  const clean = String(title || '').trim();
  if (!clean) return 'An event needs a title.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return 'An event needs a date in YYYY-MM-DD form.';
  const events = await getCalendarEvents(env);
  events.push({
    id: crypto.randomUUID(), title: clean, date: String(date),
    time: time ? String(time) : null, notes: notes ? String(notes).trim() : null,
    created: new Date().toISOString()
  });
  events.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
  const trimmed = events.length > 400 ? events.slice(-400) : events;
  await env.RAYVEN_KV.put('calendar:events', JSON.stringify(trimmed));
  return `Added "${clean}" on ${date}${time ? ` at ${time}` : ''}.`;
}

export async function removeCalendarEvent(env, match) {
  const events = await getCalendarEvents(env);
  const lower = String(match || '').toLowerCase();
  const idx = events.findIndex(e => e.id === match || e.title.toLowerCase().includes(lower));
  if (idx === -1) return `Couldn't find an event matching "${match}".`;
  const [removed] = events.splice(idx, 1);
  await env.RAYVEN_KV.put('calendar:events', JSON.stringify(events));
  return `Removed "${removed.title}" (${removed.date}).`;
}

export async function listCalendarEventsText(env, fromDate, toDate) {
  let events = await getCalendarEvents(env);
  const today = new Date().toISOString().slice(0, 10);
  const from = fromDate || today;
  events = events.filter(e => e.date >= from && (!toDate || e.date <= toDate));
  if (!events.length) return `Nothing on the calendar${toDate ? ` between ${from} and ${toDate}` : ` from ${from} onward`}.`;
  return events.slice(0, 25).map(e => `- ${e.date}${e.time ? ` ${e.time}` : ''}: ${e.title}${e.notes ? ` (${e.notes})` : ''}`).join('\n');
}

export async function getContentIdeas(env) {
  try {
    const raw = await env.RAYVEN_KV.get('content:ideas');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function addContentIdea(env, platform, idea) {
  const ideas = await getContentIdeas(env);
  ideas.push({ id: crypto.randomUUID(), platform: String(platform).trim(), idea: String(idea).trim(), created: new Date().toISOString() });
  const trimmed = ideas.length > 300 ? ideas.slice(-300) : ideas;
  await env.RAYVEN_KV.put('content:ideas', JSON.stringify(trimmed));
  return `Logged that ${platform} idea, sir.`;
}

export async function listContentIdeas(env, platform) {
  let ideas = await getContentIdeas(env);
  if (platform) ideas = ideas.filter(i => i.platform.toLowerCase().includes(String(platform).toLowerCase()));
  if (!ideas.length) return "No content ideas queued" + (platform ? ` for ${platform}` : '') + ".";
  return ideas.slice(-15).map((i, idx) => `${idx + 1}. [${i.platform}] ${i.idea}`).join('\n');
}
