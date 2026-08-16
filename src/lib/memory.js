// Searchable long-term memory, persona-namespaced. Each persona (see
// personas.js) owns its own KV array of facts — THOR inherits the legacy
// 'memory:longterm' key so nothing saved as RAYVEN is lost. On top of the flat
// arrays this module keeps:
//   - stable per-memory ids, embedded via Workers AI (@cf/baai/bge-base-en-v1.5)
//     and indexed in Vectorize for semantic search (one shared index; results
//     are scoped per persona because search only surfaces ids present in that
//     persona's own array)
//   - conflict handling: adding a near-duplicate fact marks the old one
//     superseded rather than silently duplicating or deleting it
//   - KV read-after-write protection: get() right after put() can return the
//     old value, which silently loses data in read-modify-write cycles (this
//     ate memories in the sibling system — 8 saved, 3 survived). Fix: an
//     in-isolate cache plus a version stamp in a separate key; if KV hands back
//     an older version than the cache has, the cache wins.
//   - sharing across personas for the memory map: sharing COPIES the memory and
//     preserves original attribution, so a secondhand memory never reads as
//     firsthand.
import { PERSONAS, ALL_PERSONA_IDS, DEFAULT_PERSONA_ID, getPersona } from './personas.js';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const CONFLICT_SIMILARITY_THRESHOLD = 0.92;
const RECENT_INLINE_COUNT = 15;

// ---- versioned KV array access (read-after-write safe within this isolate) ----
const memCache = new Map(); // kvKey -> { version, data }

async function getRawByKey(env, kvKey) {
  try {
    const [raw, verRaw] = await Promise.all([
      env.RAYVEN_KV.get(kvKey),
      env.RAYVEN_KV.get(`${kvKey}:ver`)
    ]);
    const kvVersion = verRaw ? parseInt(verRaw, 10) || 0 : 0;
    const cached = memCache.get(kvKey);
    if (cached && cached.version > kvVersion) return cached.data; // stale KV read — trust the cache
    const data = raw ? JSON.parse(raw) : [];
    memCache.set(kvKey, { version: kvVersion, data });
    return data;
  } catch (e) {
    const cached = memCache.get(kvKey);
    return cached ? cached.data : [];
  }
}

async function saveRawByKey(env, kvKey, mem) {
  const trimmed = mem.length > 500 ? mem.slice(-500) : mem;
  const cached = memCache.get(kvKey);
  const newVersion = ((cached && cached.version) || 0) + 1;
  memCache.set(kvKey, { version: newVersion, data: trimmed });
  await Promise.all([
    env.RAYVEN_KV.put(kvKey, JSON.stringify(trimmed)),
    env.RAYVEN_KV.put(`${kvKey}:ver`, String(newVersion))
  ]);
}

function memoryKeyFor(personaId) {
  return getPersona(personaId).memoryKey;
}

async function getRawMemory(env, personaId) {
  return await getRawByKey(env, memoryKeyFor(personaId));
}

// The SHARED core store is THOR's legacy array — it holds who Rayan is, his
// businesses, preferences, plans. LOKI and ODIN read it (read-only) alongside
// their own store so all three personas know Rayan; their writes still land in
// their own arrays. THOR's base IS the shared store, so for him this is empty.
async function getSharedCoreMemory(env, personaId) {
  if (personaId === DEFAULT_PERSONA_ID) return [];
  const own = getPersona(personaId).memoryKey;
  const shared = getPersona(DEFAULT_PERSONA_ID).memoryKey;
  if (own === shared) return [];
  const base = await getRawByKey(env, shared);
  // Skip anything this persona already holds a shared copy of, so the same
  // fact never appears twice in one prompt.
  return base.filter(m => !m.supersededBy);
}

async function saveRawMemory(env, personaId, mem) {
  await saveRawByKey(env, memoryKeyFor(personaId), mem);
}

async function embed(env, text) {
  const result = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  const vector = result && result.data && result.data[0];
  if (!vector) throw new Error('Embedding call returned no vector.');
  return vector;
}

export async function getLongTermMemory(env, personaId = DEFAULT_PERSONA_ID) {
  return await getRawMemory(env, personaId);
}

// Only the most recent N, formatted for inline system-prompt injection. Older
// context is expected to come through search_memory instead.
export async function getRecentMemoryBlock(env, personaId = DEFAULT_PERSONA_ID) {
  const [mem, sharedCore] = await Promise.all([
    getRawMemory(env, personaId),
    getSharedCoreMemory(env, personaId)
  ]);
  if (!mem.length && !sharedCore.length) return `Your permanent long-term memory is currently empty.`;

  const formatItem = (m) => {
    const shared = m.sharedFrom ? ` (told to you by ${m.sharedFrom.toUpperCase()})` : '';
    return `- [${m.date}]${m.supersededBy ? ' (superseded by a newer memory)' : ''}${shared} ${m.fact}`;
  };

  let block = '';
  if (sharedCore.length) {
    // All three personas share one brain: the household core (who Rayan is,
    // his businesses, preferences) is always visible, firsthand.
    const coreRecent = sharedCore.slice(-RECENT_INLINE_COUNT);
    block += `Shared household memory (known to all three of you — treat as firsthand knowledge):\n` +
      coreRecent.map(formatItem).join('\n') + '\n\n';
  }
  if (mem.length) {
    const recent = mem.slice(-RECENT_INLINE_COUNT);
    const olderCount = mem.length - recent.length;
    block += `Your ${recent.length} most recent long-term memories:\n` + recent.map(formatItem).join('\n');
    if (olderCount > 0) {
      block += `\n\n${olderCount} older memories exist beyond this — use search_memory to look them up by topic, person, project, date, or keyword whenever something from before might be relevant, rather than assuming this recent list is everything you know.`;
    }
  } else {
    block += `You have not saved any memories of your own yet.`;
  }
  return block;
}

export async function addLongTermMemory(env, fact, personaId = DEFAULT_PERSONA_ID, sharedFrom = null) {
  const cleanFact = String(fact).trim();
  const mem = await getRawMemory(env, personaId);
  const id = crypto.randomUUID();
  const entry = { id, date: new Date().toISOString().slice(0, 10), fact: cleanFact, supersededBy: null };
  if (sharedFrom) entry.sharedFrom = sharedFrom;

  let vector = null;
  try {
    vector = await embed(env, cleanFact);
  } catch (err) {
    console.error('Embedding failed for new memory:', err.message);
  }

  if (vector) {
    // Conflict/duplicate handling — if this is near-identical to an existing,
    // still-current memory OF THIS PERSONA, mark that one superseded. The
    // Vectorize index is shared, but `mem.find` scopes the effect per persona.
    try {
      const queryResult = await env.VECTORIZE.query(vector, { topK: 1, returnMetadata: 'none' });
      const best = queryResult && queryResult.matches && queryResult.matches[0];
      if (best && best.score >= CONFLICT_SIMILARITY_THRESHOLD) {
        const prior = mem.find(m => m.id === best.id && !m.supersededBy);
        if (prior) prior.supersededBy = id;
      }
    } catch (err) {
      console.error('Vectorize conflict-check query failed:', err.message);
    }

    try {
      await env.VECTORIZE.upsert([{ id, values: vector, metadata: { date: entry.date, persona: personaId } }]);
    } catch (err) {
      console.error('Vectorize upsert failed for new memory:', err.message);
    }
  }

  mem.push(entry);
  await saveRawMemory(env, personaId, mem);
  return "Got it — I'll remember that.";
}

function keywordMatches(item, keyword) {
  if (!keyword) return false;
  return item.fact.toLowerCase().includes(keyword.toLowerCase());
}

function inDateRange(item, dateFrom, dateTo) {
  if (dateFrom && item.date < dateFrom) return false;
  if (dateTo && item.date > dateTo) return false;
  return true;
}

// query: natural-language search text; keyword: substring filter; dateFrom/dateTo bounds.
export async function searchMemory(env, { query, keyword, dateFrom, dateTo }, personaId = DEFAULT_PERSONA_ID) {
  // Search spans the persona's own store PLUS the shared household core, so
  // Loki and Odin can always find who Rayan is, his businesses, his plans.
  const [own, sharedCore] = await Promise.all([
    getRawMemory(env, personaId),
    getSharedCoreMemory(env, personaId)
  ]);
  const mem = own.concat(sharedCore.filter(s => !own.some(o => o.sharedFromId === s.id)));
  if (!mem.length) return "Your long-term memory is empty, sir.";

  const byId = new Map(mem.map(m => [m.id, m]));
  const ranked = new Map(); // id -> score

  if (query) {
    try {
      const vector = await embed(env, query);
      const queryResult = await env.VECTORIZE.query(vector, { topK: 10, returnMetadata: 'none' });
      for (const match of (queryResult.matches || [])) {
        if (byId.has(match.id)) ranked.set(match.id, match.score);
      }
    } catch (err) {
      console.error('Semantic search failed, falling back to keyword/date only:', err.message);
    }
  }

  if (keyword) {
    for (const item of mem) {
      if (keywordMatches(item, keyword) && !ranked.has(item.id)) ranked.set(item.id, 0.5);
    }
  }

  // No query and no keyword — a pure date-range browse.
  if (!query && !keyword) {
    for (const item of mem) ranked.set(item.id, 0.5);
  }

  let results = Array.from(ranked.entries())
    .map(([id, score]) => ({ item: byId.get(id), score }))
    .filter(r => r.item && inDateRange(r.item, dateFrom, dateTo));

  if (!results.length) return "Nothing in memory matches that, sir.";

  results.sort((a, b) => b.score - a.score || (a.item.date < b.item.date ? 1 : -1));
  results = results.slice(0, 8);

  return results.map(r => {
    const supersededNote = r.item.supersededBy ? ' (note: superseded by a more recent memory)' : '';
    const sharedNote = r.item.sharedFrom ? ` (told to you by ${r.item.sharedFrom.toUpperCase()} — secondhand)` : '';
    return `- [${r.item.date}]${sharedNote} ${r.item.fact}${supersededNote}`;
  }).join('\n');
}

// ---- memory map support (frontend force-directed graph) ----

// Every persona's memories, keyed by persona id — one hub per persona.
export async function getMemoryMap(env) {
  const map = {};
  for (const id of ALL_PERSONA_IDS) {
    map[id] = await getRawMemory(env, id);
  }
  return map;
}

// Sharing copies the memory into the target persona's store and preserves
// original attribution (sharedFrom), so a secondhand memory never reads as
// firsthand. The original stays where it is.
export async function shareMemory(env, memId, fromPersonaId, toPersonaId) {
  if (!PERSONAS[fromPersonaId] || !PERSONAS[toPersonaId]) return { ok: false, error: 'Unknown persona.' };
  if (fromPersonaId === toPersonaId) return { ok: false, error: 'Cannot share a memory with its own owner.' };
  const sourceMem = await getRawMemory(env, fromPersonaId);
  const item = sourceMem.find(m => m.id === memId);
  if (!item) return { ok: false, error: 'Memory not found on source persona.' };
  const targetMem = await getRawMemory(env, toPersonaId);
  if (targetMem.some(m => m.sharedFromId === memId)) return { ok: false, error: 'Already shared with that persona.' };
  const copy = {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    fact: item.fact,
    supersededBy: null,
    sharedFrom: item.sharedFrom || fromPersonaId, // original attribution survives re-shares
    sharedFromId: memId
  };
  targetMem.push(copy);
  await saveRawMemory(env, toPersonaId, targetMem);
  try {
    const vector = await embed(env, item.fact);
    await env.VECTORIZE.upsert([{ id: copy.id, values: vector, metadata: { date: copy.date, persona: toPersonaId } }]);
  } catch (err) {
    console.error('Vectorize upsert failed for shared memory:', err.message);
  }
  return { ok: true, copy };
}

// Click-to-edit from the memory map.
export async function updateMemoryFact(env, personaId, memId, newFact) {
  if (!PERSONAS[personaId]) return { ok: false, error: 'Unknown persona.' };
  const clean = String(newFact || '').trim();
  if (!clean) return { ok: false, error: 'Empty fact.' };
  const mem = await getRawMemory(env, personaId);
  const item = mem.find(m => m.id === memId);
  if (!item) return { ok: false, error: 'Memory not found.' };
  item.fact = clean;
  await saveRawMemory(env, personaId, mem);
  try {
    const vector = await embed(env, clean);
    await env.VECTORIZE.upsert([{ id: memId, values: vector, metadata: { date: item.date, persona: personaId } }]);
  } catch (err) {
    console.error('Vectorize re-embed failed for edited memory:', err.message);
  }
  return { ok: true, item };
}

// Hand-delete from the memory viewer. Removes the fact from the persona's
// array and best-effort removes its vector so search can't resurface it.
export async function deleteMemoryFact(env, personaId, memId) {
  if (!PERSONAS[personaId]) return { ok: false, error: 'Unknown persona.' };
  const mem = await getRawMemory(env, personaId);
  const idx = mem.findIndex(m => m.id === memId);
  if (idx === -1) return { ok: false, error: 'Memory not found.' };
  const [removed] = mem.splice(idx, 1);
  // Anything superseded by the deleted memory becomes current again rather
  // than pointing at a ghost.
  for (const m of mem) if (m.supersededBy === memId) m.supersededBy = null;
  await saveRawMemory(env, personaId, mem);
  try { await env.VECTORIZE.deleteByIds([memId]); } catch (err) {
    console.error('Vectorize delete failed for removed memory:', err.message);
  }
  return { ok: true, removed };
}

// One-time backfill for memories that predate embeddings (no id yet). Run
// manually via /debug-memory-migrate. Covers every persona's store.
export async function migrateMemoryEmbeddings(env) {
  let migrated = 0, failed = 0, total = 0;
  for (const personaId of ALL_PERSONA_IDS) {
    const mem = await getRawMemory(env, personaId);
    total += mem.length;
    for (const item of mem) {
      if (item.id) continue; // already migrated
      item.id = crypto.randomUUID();
      item.supersededBy = item.supersededBy || null;
      try {
        const vector = await embed(env, item.fact);
        await env.VECTORIZE.upsert([{ id: item.id, values: vector, metadata: { date: item.date, persona: personaId } }]);
        migrated++;
      } catch (err) {
        failed++;
        console.error('Migration embedding failed for one memory:', err.message);
      }
    }
    await saveRawMemory(env, personaId, mem);
  }
  return { ok: true, migrated, failed, total };
}
