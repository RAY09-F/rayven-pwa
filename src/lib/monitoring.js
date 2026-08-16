// Proactive web monitoring — persistent watchlist, per-watch check cadence,
// change detection, relevance filtering, and dedup. Reuses only integrations that
// already exist (Tavily, Anthropic) — no new credentials required.
//
// A watch is either:
//   'page'   — target is a URL. We extract the page text, hash it, and diff
//              against the last snapshot when it changes.
//   'search' — target is a query (company/topic/keyword/competitor/news). We run
//              a search and track which result URLs are new since last check.
// Mode is inferred automatically from whether the target looks like a URL.
import { sha256Hex } from './util.js';
import { tavilyExtractRaw, tavilySearchRaw } from './search.js';
import { callAnthropicSimple } from './anthropic.js';
import { notify } from './notifications.js';
import { logActivity } from './activity.js';

const WATCH_LIST_KEY = 'monitor:list';
const DEFAULT_INTERVAL_MINUTES = 30;
const MAX_WATCHES_PER_TICK = 10;
const SNAPSHOT_CHARS = 1500;
const SEEN_URLS_CAP = 50;

async function getWatches(env) {
  try {
    const raw = await env.RAYVEN_KV.get(WATCH_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

async function saveWatches(env, watches) {
  await env.RAYVEN_KV.put(WATCH_LIST_KEY, JSON.stringify(watches));
}

function inferMode(target) {
  return /^https?:\/\//i.test(target.trim()) ? 'page' : 'search';
}

// --- tools (add/list/remove/pause/resume) -------------------------------------

export async function watchAdd(env, { target, label, condition, intervalMinutes }) {
  if (!target) return "Need something to watch — a URL or a search topic/company/keyword.";
  const mode = inferMode(target);
  const watch = {
    id: crypto.randomUUID(),
    label: (label || target).trim(),
    target: target.trim(),
    mode,
    condition: condition ? String(condition).trim() : '',
    intervalMinutes: intervalMinutes && intervalMinutes > 0 ? intervalMinutes : DEFAULT_INTERVAL_MINUTES,
    active: true,
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastError: null,
    lastContentHash: null,
    lastContentSnapshot: null,
    seenUrls: []
  };

  // Establish a baseline immediately so the first real sweep compares against
  // actual prior state instead of alerting on "everything" the moment it's added.
  if (mode === 'page') {
    const result = await tavilyExtractRaw(env, watch.target, SNAPSHOT_CHARS);
    if (result.ok) {
      watch.lastContentHash = await sha256Hex(result.content);
      watch.lastContentSnapshot = result.content;
    } else {
      watch.lastError = result.error;
    }
  } else {
    const result = await tavilySearchRaw(env, watch.target);
    if (result.ok) {
      watch.seenUrls = result.results.map(r => r.url).slice(0, SEEN_URLS_CAP);
    } else {
      watch.lastError = result.error;
    }
  }
  watch.lastCheckedAt = new Date().toISOString();

  const watches = await getWatches(env);
  watches.push(watch);
  await saveWatches(env, watches);

  await logActivity(env, {
    subsystem: 'monitoring',
    observed: `New watch added: "${watch.label}" (${mode === 'page' ? 'page' : 'search'} mode)`,
    decided: watch.lastError ? `Baseline capture failed: ${watch.lastError}` : 'Baseline captured, will alert on future changes.',
    action: 'watch_add',
    success: !watch.lastError
  });

  if (watch.lastError) {
    return `Added "${watch.label}" to your watchlist, but I couldn't fetch a baseline yet (${watch.lastError}) — I'll keep trying every ${watch.intervalMinutes} min.`;
  }
  return `Watching "${watch.label}" now, sir — checking every ${watch.intervalMinutes} min. I'll only alert you when something meaningful changes.`;
}

export async function watchList(env) {
  const watches = await getWatches(env);
  if (!watches.length) return "You're not watching anything right now, sir.";
  return watches.map((w, i) => {
    const status = w.active ? 'active' : 'paused';
    const checked = w.lastCheckedAt ? new Date(w.lastCheckedAt).toISOString().slice(0, 16).replace('T', ' ') : 'never';
    const err = w.lastError ? ` — last error: ${w.lastError}` : '';
    return `${i + 1}. "${w.label}" [${status}] — ${w.mode === 'page' ? w.target : `search: ${w.target}`} — every ${w.intervalMinutes} min, last checked ${checked}${err}`;
  }).join('\n');
}

function findWatch(watches, match) {
  const lower = String(match).toLowerCase();
  return watches.find(w => w.label.toLowerCase().includes(lower));
}

export async function watchRemove(env, match) {
  const watches = await getWatches(env);
  const found = findWatch(watches, match);
  if (!found) return `Couldn't find a watch matching "${match}", sir.`;
  const remaining = watches.filter(w => w.id !== found.id);
  await saveWatches(env, remaining);
  return `Stopped watching "${found.label}".`;
}

export async function watchPause(env, match) {
  const watches = await getWatches(env);
  const found = findWatch(watches, match);
  if (!found) return `Couldn't find a watch matching "${match}", sir.`;
  found.active = false;
  await saveWatches(env, watches);
  return `Paused "${found.label}".`;
}

export async function watchResume(env, match) {
  const watches = await getWatches(env);
  const found = findWatch(watches, match);
  if (!found) return `Couldn't find a watch matching "${match}", sir.`;
  found.active = true;
  await saveWatches(env, watches);
  return `Resumed watching "${found.label}".`;
}

export async function getWatchList(env) {
  return await getWatches(env);
}

// --- change classification (relevance filter + alert copy in one call) -------

async function classifyPageChange(env, watch, oldSnapshot, newSnapshot) {
  const system = `You are RAYVEN's monitoring relevance filter. A watched webpage's text content changed. Decide if this is worth interrupting Rayan for, given what he asked to be watched for, then write the alert.

Respond with ONLY valid JSON, no markdown fences: {"alert": true or false, "summary": "one or two plain sentences, only if alert is true"}

Alert only for genuinely meaningful changes matching the watch condition (e.g. a price crossing a threshold, an item back in stock, real new content). Do NOT alert for cosmetic/irrelevant changes (ads, timestamps, unrelated boilerplate, minor wording).`;
  const userText = `Watch label: "${watch.label}"\nWhat Rayan wants to know: ${watch.condition || '(no specific condition given — use judgment on what counts as meaningful)'}\n\n--- PREVIOUS content snapshot ---\n${oldSnapshot}\n\n--- NEW content snapshot ---\n${newSnapshot}`;
  const result = await callAnthropicSimple(env, system, userText, 300);
  if (!result.ok) return { alert: false, error: result.error };
  try {
    const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return { alert: !!parsed.alert, summary: String(parsed.summary || '').trim() };
  } catch (e) {
    return { alert: false, error: `Could not parse classification response: ${result.text}` };
  }
}

async function classifySearchChange(env, watch, newResults) {
  const system = `You are RAYVEN's monitoring relevance filter. New search results appeared for something Rayan is watching. Decide if this is worth interrupting him for, then write the alert.

Respond with ONLY valid JSON, no markdown fences: {"alert": true or false, "summary": "one or two plain sentences, only if alert is true"}

Alert only for genuinely meaningful/new developments matching the watch condition. Do NOT alert for minor/repetitive/low-relevance results.`;
  const resultsText = newResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n');
  const userText = `Watch label: "${watch.label}" (search: "${watch.target}")\nWhat Rayan wants to know: ${watch.condition || '(no specific condition given — use judgment on what counts as meaningful)'}\n\n--- NEW search results since last check ---\n${resultsText}`;
  const result = await callAnthropicSimple(env, system, userText, 300);
  if (!result.ok) return { alert: false, error: result.error };
  try {
    const cleaned = result.text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    return { alert: !!parsed.alert, summary: String(parsed.summary || '').trim() };
  } catch (e) {
    return { alert: false, error: `Could not parse classification response: ${result.text}` };
  }
}

// --- scheduled sweep -----------------------------------------------------------

function isDue(watch) {
  if (!watch.active) return false;
  if (!watch.lastCheckedAt) return true;
  const elapsedMs = Date.now() - new Date(watch.lastCheckedAt).getTime();
  return elapsedMs >= watch.intervalMinutes * 60 * 1000;
}

async function processWatch(env, watch) {
  watch.lastCheckedAt = new Date().toISOString();

  if (watch.mode === 'page') {
    const result = await tavilyExtractRaw(env, watch.target, SNAPSHOT_CHARS);
    if (!result.ok) {
      watch.lastError = result.error;
      await logActivity(env, { subsystem: 'monitoring', observed: `Checked "${watch.label}"`, decided: `Fetch failed: ${result.error}`, action: 'none', success: false, error: result.error });
      return;
    }
    watch.lastError = null;
    const newHash = await sha256Hex(result.content);

    if (!watch.lastContentHash) {
      // No baseline yet (e.g. it failed at creation) — establish it now, don't alert.
      watch.lastContentHash = newHash;
      watch.lastContentSnapshot = result.content;
      await logActivity(env, { subsystem: 'monitoring', observed: `Checked "${watch.label}"`, decided: 'Baseline captured (none existed yet).', action: 'none', success: true });
      return;
    }
    if (newHash === watch.lastContentHash) {
      return; // no change — nothing worth logging every 30 min
    }

    const classification = await classifyPageChange(env, watch, watch.lastContentSnapshot, result.content);
    watch.lastContentHash = newHash;
    watch.lastContentSnapshot = result.content;

    if (classification.error) {
      await logActivity(env, { subsystem: 'monitoring', observed: `"${watch.label}" changed`, decided: `Relevance check failed: ${classification.error}`, action: 'none', success: false, error: classification.error });
      return;
    }
    if (!classification.alert) {
      await logActivity(env, { subsystem: 'monitoring', observed: `"${watch.label}" changed`, decided: 'Filtered as not meaningful.', action: 'none', success: true });
      return;
    }

    await notify(env, {
      source: 'monitoring', priority: 'normal',
      title: `Watch: ${watch.label}`, body: classification.summary,
      dedupeKey: `monitor:${watch.id}:${newHash}`
    });
    await logActivity(env, { subsystem: 'monitoring', observed: `"${watch.label}" changed`, decided: classification.summary, action: 'notify', success: true, meta: { watchId: watch.id } });
    return;
  }

  // search mode
  const result = await tavilySearchRaw(env, watch.target);
  if (!result.ok) {
    watch.lastError = result.error;
    await logActivity(env, { subsystem: 'monitoring', observed: `Checked "${watch.label}"`, decided: `Search failed: ${result.error}`, action: 'none', success: false, error: result.error });
    return;
  }
  watch.lastError = null;
  const seen = new Set(watch.seenUrls || []);
  const newResults = result.results.filter(r => r.url && !seen.has(r.url));
  const allUrls = result.results.map(r => r.url).filter(Boolean);
  watch.seenUrls = Array.from(new Set([...(watch.seenUrls || []), ...allUrls])).slice(-SEEN_URLS_CAP);

  if (!newResults.length) return; // nothing new — routine, not logged

  const classification = await classifySearchChange(env, watch, newResults);
  if (classification.error) {
    await logActivity(env, { subsystem: 'monitoring', observed: `New results for "${watch.label}"`, decided: `Relevance check failed: ${classification.error}`, action: 'none', success: false, error: classification.error });
    return;
  }
  if (!classification.alert) {
    await logActivity(env, { subsystem: 'monitoring', observed: `New results for "${watch.label}"`, decided: 'Filtered as not meaningful.', action: 'none', success: true });
    return;
  }

  await notify(env, {
    source: 'monitoring', priority: 'normal',
    title: `Watch: ${watch.label}`, body: classification.summary,
    dedupeKey: `monitor:${watch.id}:${newResults.map(r => r.url).sort().join(',')}`
  });
  await logActivity(env, { subsystem: 'monitoring', observed: `New results for "${watch.label}"`, decided: classification.summary, action: 'notify', success: true, meta: { watchId: watch.id } });
}

export async function runMonitoringSweep(env) {
  const watches = await getWatches(env);
  const due = watches.filter(isDue).slice(0, MAX_WATCHES_PER_TICK);
  if (!due.length) return { ok: true, checked: 0 };

  await Promise.allSettled(due.map(w => processWatch(env, w)));
  await saveWatches(env, watches);
  return { ok: true, checked: due.length };
}
