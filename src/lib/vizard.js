// ===========================================================================
// VIZARD — the hands-free half of the clipping business.
//
// Odin hands a long video to Vizard; Vizard finds the moments worth cutting,
// crops them to 9:16, burns in subtitles and a headline, and hands back a set
// of finished shorts ranked by how likely they are to travel. Those go into the
// existing clip queue and out to the ten accounts on the existing ramp. The
// only human step left is deciding what to point it at.
//
// Two things are deliberate here:
//
//  1. THE FIRST BATCH WAITS. Until Rayan has seen what the output actually
//     looks like, nothing publishes itself. He approves once, and from then on
//     it runs unattended. Finding out the clips are wrong after twenty of them
//     are live on ten accounts is not a recoverable mistake.
//
//  2. PERMISSION IS RECORDED, NOT ASSUMED. Vizard will happily fetch anyone's
//     video, and the AI editing does not give us rights to the source. Every
//     job stores whether permission exists, and jobs without it are labelled
//     as such everywhere they appear, rather than quietly looking the same as
//     the ones we are entitled to post.
// ===========================================================================

import { queueAdd, queuePeek, queueSetVideoUrl } from './clipping.js';
import { notify } from './notifications.js';

const API = 'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1';

const KV = {
  jobs: 'vizard:jobs',           // in-flight submissions
  held: 'vizard:held',           // first batch, waiting on approval
  auto: 'vizard:auto',           // '1' once Rayan has approved a batch
  lastPoll: 'vizard:last_poll'
};

const POLL_MS = 4 * 60 * 1000;         // cron fires every 5 min; this just guards double-runs
const REFRESH_AFTER_DAYS = 5;
const MAX_JOBS = 25;

// Vizard fetches the source itself, server-side. Which host it came from is
// declared with videoType — a wrong number fails with an unhelpful error, so
// this is derived from the URL rather than left to the model to guess.
//
// Matched on the parsed hostname, NOT with a regex over the whole URL. The
// obvious `/(^|\.)youtube\.com/` misses "https://youtube.com/watch" entirely —
// there is a slash before the host, not a dot or a string start — so a link
// without "www." silently fell through to "direct file" and Vizard was handed
// a web page to download.
const SOURCE_TYPES = [
  [['youtube.com', 'youtu.be'], 2, 'YouTube'],
  [['twitch.tv'], 9, 'Twitch'],
  [['tiktok.com'], 6, 'TikTok'],
  [['instagram.com'], 14, 'Instagram'],
  [['vimeo.com'], 4, 'Vimeo'],
  [['drive.google.com'], 3, 'Google Drive'],
  [['dropbox.com'], 13, 'Dropbox'],
  [['loom.com'], 10, 'Loom'],
  [['facebook.com', 'fb.watch'], 11, 'Facebook'],
  [['linkedin.com'], 12, 'LinkedIn'],
  [['x.com', 'twitter.com'], 7, 'X'],
  [['streamyard.com'], 5, 'StreamYard']
];

// Already-vertical, already-short sources. Feeding these through the clipper is
// pointless — there is nothing to cut down — so they go through Vizard's edit
// mode instead, which reframes and adds captions without slicing.
const ALREADY_SHORT = /(\/shorts\/|\/reels?\/)/i;
const SHORT_HOSTS = ['tiktok.com'];

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

function hostIs(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function detectSource(url) {
  const host = hostOf(url);
  for (const [domains, type, label] of SOURCE_TYPES) {
    if (domains.some(d => hostIs(host, d))) return { type, label };
  }
  return { type: 1, label: 'direct file' };   // a plain downloadable link
}

function isAlreadyShort(url) {
  const host = hostOf(url);
  return SHORT_HOSTS.some(d => hostIs(host, d)) || ALREADY_SHORT.test(url);
}

async function readJson(env, key, fallback) {
  try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
async function writeJson(env, key, value) {
  await env.RAYVEN_KV.put(key, JSON.stringify(value));
}

async function vizardFetch(env, path, init) {
  if (!env.VIZARD_API_KEY) {
    throw new Error('Vizard is not connected. Add VIZARD_API_KEY as a Worker secret — it is on the API page of the Vizard dashboard, and API access needs a paid plan.');
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { VIZARDAI_API_KEY: env.VIZARD_API_KEY, 'content-type': 'application/json', ...(init?.headers || {}) }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Vizard sent something unreadable (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`Vizard HTTP ${res.status}: ${(data.errMsg || text).slice(0, 200)}`);
  return data;
}

// Vizard's error codes, taken from their documentation rather than guessed at.
// The first version of this map was invented — 4006 was labelled "no upload
// minutes left" when it actually means "illegal parameter", which sent Rayan to
// top up a plan that had 581 of 600 credits sitting unused. The raw code and
// their own message now always ride along with the translation, so a wrong
// guess here can never again be the only thing anyone sees.
const VIZARD_CODES = {
  4001: 'invalid API key — check VIZARD_API_KEY',
  4002: 'project creation failed on their side',
  4003: 'rate limit exceeded — wait a minute and try again',
  4004: 'unsupported video format',
  4005: 'the video file is broken',
  4006: 'illegal parameter — something in the request is wrong, not something in your account',
  4007: 'genuinely out of remaining minutes on the Vizard plan',
  4008: 'Vizard could not download the video from that URL. It has to be public and directly reachable.',
  4009: 'that video URL is invalid',
  4010: 'could not detect the spoken language — name it explicitly'
};

function explainCode(code, errMsg) {
  const known = VIZARD_CODES[code];
  const raw = `[Vizard code ${code}${errMsg ? `: ${errMsg}` : ''}]`;
  return known ? `${known} ${raw}` : `${errMsg || 'no message given'} ${raw}`;
}

// ---------------------------------------------------------------------------
// SUBMIT
// ---------------------------------------------------------------------------
// Vizard's preferLength codes. Verified against their docs rather than guessed:
// 0 auto (cannot be combined with anything), 1 under 30s, 2 thirty to sixty,
// 3 sixty to ninety, 4 ninety seconds to three minutes.
const LENGTHS = {
  short: [1],          // under 30s — punchy, best hit rate on TikTok
  minute: [2, 3],      // 30-90s, centred on a minute — the default
  long: [4],           // 90s to 3 min
  mixed: [1, 2, 3],    // variety under 90s
  auto: [0]            // let Vizard decide; must be alone
};

export async function vizardClip(env, { videoUrl, maxClips, keyword, lang, permission, mode, length, note } = {}) {
  const url = String(videoUrl || '').trim();
  if (!url) return 'Give me the link to the long video you want cut up.';
  if (!/^https:\/\//i.test(url)) return 'That needs to be an https link.';
  if (hostIs(hostOf(url), 'kick.com')) {
    return 'Vizard cannot fetch from Kick — it is not on their supported list. Download the VOD and put it in R2, then give me that link instead and it will go through as a direct file.';
  }

  const jobs = await readJson(env, KV.jobs, []);
  if (jobs.length >= MAX_JOBS) return `${MAX_JOBS} jobs are already in flight. Let those finish first — check with vizard_jobs.`;
  if (jobs.some(j => j.source === url)) return 'That video is already being processed. vizard_jobs shows where it is up to.';

  const { type, label } = detectSource(url);
  const polish = mode === 'polish' || (mode !== 'clip' && isAlreadyShort(url));

  // videoType 1 is a direct file, and for that Vizard REQUIRES the extension in
  // its own field — it will not read it off the URL. Omitting it is rejected as
  // an illegal parameter, which reads like an account problem and is not one.
  // Every R2-hosted clip goes through this path, so it has to be right.
  const EXTS = ['mp4', 'mov', 'avi', '3gp'];
  let ext = '';
  if (type === 1) {
    const guess = (hostOf(url) ? new URL(url).pathname : url).toLowerCase().split('.').pop();
    ext = EXTS.includes(guess) ? guess : '';
    if (!ext) return `Vizard needs to know the file type, and "${url.split('/').pop().slice(0, 40)}" does not end in one it accepts. Rename the file so it ends in .mp4 (or .mov, .avi, .3gp) and give me the link again.`;
  }

  const body = {
    videoUrl: url,
    videoType: type,
    lang: lang || 'en',
    ratioOfClip: 1,          // 9:16 — this whole operation is vertical
    subtitleSwitch: 1,       // burned-in captions
    headlineSwitch: 1,       // hook overlay in the first 3 seconds
    removeSilenceSwitch: 1   // dead air is what kills retention in the first 2s
  };
  if (ext) body.ext = ext;
  if (polish) body.getClips = 0;                        // edit an already-short video, do not cut it
  // Was [1, 2] with a comment claiming it aimed at 30-90s. It did not: 1 is
  // UNDER thirty seconds and 2 is thirty to sixty, so it was quietly capping
  // every clip at a minute. [2, 3] is what that comment meant.
  // Default is SHORT now, not minute. Completion rate is the strongest ranking
  // signal there is, and a 20s clip watched to the end beats a 75s clip abandoned
  // at 30. The Omoggle brief floors at 10s, so under-30s still qualifies -- but see
  // the 10-second guard in the poller, because code 1 can return clips shorter
  // than that and those would be rejected after doing the work.
  else body.preferLength = LENGTHS[String(length || 'short').toLowerCase()] || LENGTHS.short;
  if (maxClips) body.maxClipNumber = Math.min(Math.max(Number(maxClips) || 10, 1), 100);
  if (keyword) body.keyword = String(keyword).slice(0, 200);

  let data;
  try { data = await vizardFetch(env, '/project/create', { method: 'POST', body: JSON.stringify(body) }); }
  catch (err) { return `Could not start that job: ${err.message}`; }

  if (data.code !== 2000 || !data.projectId) return `Vizard would not take it: ${explainCode(data.code, data.errMsg)}`;

  const permitted = String(permission || '').toLowerCase();
  const rights = ['yes', 'own', 'mine', 'permission'].some(w => permitted.includes(w)) ? 'cleared' : 'not on file';

  jobs.push({
    projectId: String(data.projectId),
    source: url,
    sourceLabel: label,
    mode: polish ? 'polish' : 'clip',
    rights,
    note: (note || '').slice(0, 200),
    submittedAt: new Date().toISOString()
  });
  await writeJson(env, KV.jobs, jobs);

  const auto = (await env.RAYVEN_KV.get(KV.auto)) === '1';
  return [
    `Sent to Vizard — ${label} source, ${polish ? 'reframe and caption' : 'clip extraction'} mode.`,
    'It takes a few minutes to tens of minutes depending on length. I check every five minutes; nothing needed from you.',
    rights === 'cleared' ? null : 'Rights: not on file for this one. The AI edit does not grant them — worth knowing before it goes to ten accounts.',
    auto ? 'Finished clips go straight into the queue and out on the ramp.'
         : 'This is the first batch, so it will wait for your yes before anything publishes.'
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// COLLECT
// ---------------------------------------------------------------------------
function clipsFrom(data) {
  const raw = Array.isArray(data.videos) ? data.videos : (Array.isArray(data.clips) ? data.clips : []);
  return raw
    .map(v => ({
      videoId: String(v.videoId ?? v.id ?? ''),
      videoUrl: v.videoUrl || '',
      title: (v.title || '').trim(),
      transcript: (v.transcript || '').trim(),
      score: Number(v.viralScore) || 0,
      reason: (v.viralReason || '').trim(),
      seconds: Math.round((Number(v.videoMsDuration) || 0) / 1000)
    }))
    .filter(c => c.videoUrl)
    .sort((a, b) => b.score - a.score);      // best first, so a cap keeps the good ones
}

// Vizard's headline is the hook. queueAdd insists on at least a dozen
// characters for a reason — an untransformed repost is what all three networks
// demote — so a clip whose title is too thin borrows the reason it scored well
// rather than being pushed through with a placeholder.
function hookFor(clip) {
  const t = clip.title.replace(/\s+/g, ' ').trim();
  if (t.length >= 12) return t.slice(0, 120);
  const alt = (clip.reason || clip.transcript).replace(/\s+/g, ' ').trim();
  return alt.length >= 12 ? alt.slice(0, 120) : '';
}

// Campaign briefs set a minimum clip length -- the Call of Duty one is 10s, and
// a clip under it is REJECTED after doing the work: it posts, it gets views, and
// it earns nothing. Now that the default cut is "under 30 seconds", Vizard can
// legitimately hand back a 6-second clip, so this floor has to exist. Anything
// shorter is dropped here rather than published and written off later.
const MIN_SECONDS = 10;

async function queueClips(env, job, clips) {
  const added = [];
  const skipped = [];
  for (const c of clips) {
    const secs = Number(c.seconds) || 0;
    if (secs && secs < MIN_SECONDS) {
      skipped.push(`${c.videoId} (${secs}s — under the ${MIN_SECONDS}s campaign floor)`);
      continue;
    }
    const hook = hookFor(c);
    if (!hook) { skipped.push(`${c.videoId} (no usable hook)`); continue; }
    const res = await queueAdd(env, {
      clipId: `vizard:${job.projectId}:${c.videoId}`,
      clipUrl: job.source,
      videoUrl: c.videoUrl,
      hook,
      caption: c.reason ? c.reason.slice(0, 300) : '',
      credit: job.rights === 'cleared' ? job.source : ''
    });
    if (/^Queued/.test(res)) added.push(`${c.score.toFixed(1)} — "${hook.slice(0, 50)}" ${c.seconds}s`);
    else skipped.push(`${c.videoId}: ${res.slice(0, 80)}`);
  }
  return { added, skipped };
}

async function pollOne(env, job) {
  const data = await vizardFetch(env, `/project/query/${encodeURIComponent(job.projectId)}`, { method: 'GET' });
  if (data.code === 1000) return { done: false };
  if (data.code !== 2000) return { done: true, error: explainCode(data.code, data.errMsg) };
  return { done: true, clips: clipsFrom(data) };
}

// ---------------------------------------------------------------------------
// THE CRON PASS — this is what makes it hands-free
// ---------------------------------------------------------------------------
export async function runVizardPollIfDue(env) {
  if (!env.VIZARD_API_KEY) return null;
  const last = Number(await env.RAYVEN_KV.get(KV.lastPoll)) || 0;
  if (Date.now() - last < POLL_MS) return null;

  // Nothing in flight means nothing to poll: return BEFORE stamping lastPoll.
  // With the key set and no jobs, the stamp alone was 288 writes a day for a
  // loop that then did nothing (asgard-upgrade Phase 0.4, Rule 5c).
  const jobs = await readJson(env, KV.jobs, []);
  if (!jobs.length) return null;
  await env.RAYVEN_KV.put(KV.lastPoll, String(Date.now()));

  await refreshExpiringUrls(env);

  const auto = (await env.RAYVEN_KV.get(KV.auto)) === '1';
  const remaining = [];
  const report = [];

  for (const job of jobs) {
    let out;
    try { out = await pollOne(env, job); }
    catch (err) { remaining.push(job); report.push(`${job.projectId}: could not check — ${err.message}`); continue; }

    if (!out.done) { remaining.push(job); continue; }
    if (out.error) { report.push(`Vizard gave up on ${job.sourceLabel} job: ${out.error}`); continue; }

    const clips = out.clips || [];
    if (!clips.length) { report.push(`${job.sourceLabel} job finished but produced nothing usable.`); continue; }

    if (!auto) {
      // First batch. Park it and say so — do not publish on a guess.
      const held = await readJson(env, KV.held, []);
      held.push({ ...job, clips, readyAt: new Date().toISOString() });
      await writeJson(env, KV.held, held);
      const preview = clips.slice(0, 5).map(c => `  ${c.score.toFixed(1)} — "${c.title.slice(0, 60)}" ${c.seconds}s`).join('\n');
      const msg = `${clips.length} clips are ready from the ${job.sourceLabel} video and are WAITING FOR YOU.\n${preview}\nSay "approve the clips" to queue them and let it run unattended from here on.`;
      // This one blocks the whole pipeline until answered, so it goes out
      // immediately rather than into the half-hourly digest.
      await notify(env, {
        source: 'clipping', priority: 'high',
        title: `${clips.length} clips ready to approve`,
        body: msg, dedupeKey: `vizard:held:${job.projectId}`
      });
      report.push(msg);
      continue;
    }

    const { added, skipped } = await queueClips(env, job, clips);
    const line = `Queued ${added.length} clips from the ${job.sourceLabel} video${job.rights === 'cleared' ? '' : ' (rights not on file)'}.` +
      (added.length ? `\n${added.slice(0, 5).map(a => `  ${a}`).join('\n')}` : '') +
      (skipped.length ? `\n  skipped ${skipped.length}` : '');
    // Running unattended by then, so this is news rather than a decision —
    // low priority lets it ride the digest instead of buzzing his phone.
    await notify(env, {
      source: 'clipping', priority: 'low',
      title: `${added.length} new clips queued`,
      body: line, dedupeKey: `vizard:done:${job.projectId}`
    });
    report.push(line);
  }

  await writeJson(env, KV.jobs, remaining);
  return report.length ? report.join('\n\n') : null;
}

// Vizard's download links die after 7 days. A queued clip that outlives its URL
// fails at the publisher with a 403 that looks nothing like an expiry, so
// refresh anything approaching the edge while the project is still queryable.
async function refreshExpiringUrls(env) {
  let queue;
  try { queue = await queuePeek(env); } catch { return; }
  const stale = queue.filter(q =>
    typeof q.clipId === 'string' && q.clipId.startsWith('vizard:') &&
    q.addedAt && (Date.now() - new Date(q.addedAt).getTime()) > REFRESH_AFTER_DAYS * 864e5);
  if (!stale.length) return;

  const byProject = new Map();
  for (const q of stale) {
    const [, projectId] = q.clipId.split(':');
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(q);
  }

  for (const [projectId, entries] of byProject) {
    let data;
    try { data = await vizardFetch(env, `/project/query/${encodeURIComponent(projectId)}`, { method: 'GET' }); }
    catch { continue; }
    if (data.code !== 2000) continue;
    const fresh = new Map(clipsFrom(data).map(c => [c.videoId, c.videoUrl]));
    for (const q of entries) {
      const videoId = q.clipId.split(':')[2];
      const url = fresh.get(videoId);
      if (url && url !== q.videoUrl) await queueSetVideoUrl(env, q.clipId, url);
    }
  }
}

// ---------------------------------------------------------------------------
// THE ONE MANUAL GATE
// ---------------------------------------------------------------------------
export async function vizardApprove(env) {
  const held = await readJson(env, KV.held, []);
  if (!held.length) {
    await env.RAYVEN_KV.put(KV.auto, '1');
    return 'Nothing is waiting, but I have switched to unattended — future batches queue and publish on their own.';
  }
  const lines = [];
  for (const batch of held) {
    const { added, skipped } = await queueClips(env, batch, batch.clips || []);
    lines.push(`${batch.sourceLabel}: queued ${added.length}${skipped.length ? `, skipped ${skipped.length}` : ''}`);
  }
  await writeJson(env, KV.held, []);
  await env.RAYVEN_KV.put(KV.auto, '1');
  return `${lines.join('\n')}\n\nUnattended from here. Everything Vizard finishes goes straight into the queue and out on the ramp.`;
}

export async function vizardHeld(env) {
  const held = await readJson(env, KV.held, []);
  if (!held.length) return 'Nothing is waiting on approval.';
  return held.map(b =>
    `From the ${b.sourceLabel} video (${b.source.slice(0, 60)})${b.rights === 'cleared' ? '' : ' — rights not on file'}:\n` +
    (b.clips || []).map(c => `  ${c.score.toFixed(1)} — "${c.title.slice(0, 60)}" ${c.seconds}s${c.reason ? `\n      ${c.reason.slice(0, 90)}` : ''}`).join('\n')
  ).join('\n\n') + '\n\nSay "approve the clips" to queue these and run unattended from then on.';
}

export async function vizardJobs(env) {
  const [jobs, held, auto] = await Promise.all([
    readJson(env, KV.jobs, []),
    readJson(env, KV.held, []),
    env.RAYVEN_KV.get(KV.auto)
  ]);
  const lines = [`Mode: ${auto === '1' ? 'unattended' : 'first batch waits for approval'}.`];
  if (!jobs.length) lines.push('Nothing in flight.');
  else lines.push(`${jobs.length} in flight:\n` + jobs.map(j => {
    const mins = Math.round((Date.now() - new Date(j.submittedAt).getTime()) / 60000);
    return `  ${j.sourceLabel} — ${j.mode} — ${mins} min ago${j.rights === 'cleared' ? '' : ' — rights not on file'}\n    ${j.source.slice(0, 70)}`;
  }).join('\n'));
  if (held.length) lines.push(`${held.length} finished batch(es) waiting on your approval — vizard_held to see them.`);
  return lines.join('\n');
}

// What Vizard itself can publish to. This matters for more than curiosity:
// Ayrshare costs $299/month and exists solely to hold audited TikTok and
// YouTube clients. Vizard's Business plan carries 20 social accounts and its
// own publish endpoint — so if all ten of Rayan's accounts show up here as
// active, the $299 line item may be replaceable by something already paid for.
// Read this before the September 13 decision rather than guessing at it.
export async function vizardAccounts(env) {
  let data;
  try { data = await vizardFetch(env, '/project/social-accounts', { method: 'GET' }); }
  catch (err) { return `Could not read the connected accounts: ${err.message}`; }

  const list = Array.isArray(data) ? data
    : (Array.isArray(data.socialAccounts) ? data.socialAccounts
      : (Array.isArray(data.accounts) ? data.accounts : (Array.isArray(data.data) ? data.data : [])));
  if (!list.length) return `Vizard reports no connected social accounts. Raw reply: ${JSON.stringify(data).slice(0, 300)}`;

  const byPlatform = new Map();
  const lines = [];
  for (const a of list) {
    const p = String(a.platform || '?').toLowerCase();
    byPlatform.set(p, (byPlatform.get(p) || 0) + 1);
    const state = String(a.status || 'active').toLowerCase();
    const expiry = a.expiresAt ? new Date(Number(a.expiresAt) * 1000).toISOString().slice(0, 10) : '';
    lines.push(`  ${p} ${a.username || a.page || '(unnamed)'}${state !== 'active' ? `  ** ${state.toUpperCase()} **` : ''}${expiry ? `  auth expires ${expiry}` : ''}\n    id ${a.id}`);
  }

  const tally = [...byPlatform.entries()].map(([p, n]) => `${n} ${p}`).join(', ');
  const out = [`${list.length} account(s) connected to Vizard — ${tally}.`, ...lines];

  const tt = byPlatform.get('tiktok') || 0;
  const yt = byPlatform.get('youtube') || 0;
  if (tt >= 5 && yt >= 5) {
    out.push('', 'NOTE: five TikTok and five YouTube accounts are visible here, which is the whole set Ayrshare is currently carrying. Vizard can publish to them directly through its own endpoint, on a plan already paid for. That makes the $299/month Ayrshare subscription a genuine question rather than a given — worth settling before September 13.');
  }
  return out.join('\n');
}

export async function vizardCancel(env, { projectId, source } = {}) {
  const jobs = await readJson(env, KV.jobs, []);
  const before = jobs.length;
  const kept = jobs.filter(j =>
    !(projectId && j.projectId === String(projectId)) &&
    !(source && j.source.includes(String(source))));
  if (kept.length === before) return 'No job matched that.';
  await writeJson(env, KV.jobs, kept);
  return `Stopped tracking ${before - kept.length} job(s). Vizard may still finish them on their side; the minutes are already spent.`;
}


// One page that answers "why is nothing posting?" without anyone interpreting
// it. Every stage of the chain, read straight from storage, with a verdict at
// the top naming the first thing that is actually blocking. Built because four
// separate times this session an assistant's summary of a state was wrong and
// the raw state was right.
export async function pipelineState(env) {
  const get = async (k, f) => { try { const r = await env.RAYVEN_KV.get(k); return r ? JSON.parse(r) : f; } catch { return f; } };
  const jobs = await get('vizard:jobs', []);
  const held = await get('vizard:held', []);
  const auto = await env.RAYVEN_KV.get('vizard:auto');
  const queue = await get('clips:queue', []);
  const accounts = await get('clips:accounts', []);
  const posted = await get('clips:posted', {});
  const platforms = await get('clips:platforms', ['tiktok', 'youtube']);
  const campaign = await get('clips:campaign', null);
  const startedAt = await env.RAYVEN_KV.get('clips:started_at');

  const day = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 864e5) : 0;
  const perAccount = day <= 3 ? 2 : day <= 7 ? 3 : day <= 11 ? 4 : 5;
  const today = new Date().toISOString().slice(0, 10);
  const counts = posted[today] || {};
  const usedToday = Object.values(counts).reduce((a, b) => a + b, 0);
  const allowance = perAccount * accounts.length;
  const heldClips = held.reduce((a, b) => a + ((b.clips || []).length), 0);

  const L = [];
  L.push('=== VERDICT ===');
  if (!env.VIZARD_API_KEY) L.push('BLOCKED: VIZARD_API_KEY is not set.');
  else if (!env.AYRSHARE_API_KEY) L.push('BLOCKED: AYRSHARE_API_KEY is not set.');
  else if (!accounts.length) L.push('BLOCKED: no publishing accounts configured. Run clips_set_accounts.');
  else if (heldClips) L.push(`BLOCKED: ${heldClips} finished clip(s) are WAITING FOR YOUR APPROVAL and will never post until released. Say "approve the clips" to Odin, or open /debug-approve-clips to release them right now.`);
  else if (!queue.length && jobs.length) L.push(`WAITING: nothing queued yet, but ${jobs.length} Vizard job(s) are still processing. Give it time.`);
  else if (!queue.length && !jobs.length) L.push('IDLE: the queue is empty and no Vizard job is running. Nothing has been sent to clip.');
  else if (usedToday >= allowance) L.push(`DONE FOR TODAY: ${usedToday} of ${allowance} posts used. The ramp resets at midnight UTC.`);
  else L.push(`READY: ${queue.length} clip(s) queued, ${allowance - usedToday} of ${allowance} posts still allowed today. The cron publishes one per tick.`);

  L.push('', '=== VIZARD ===');
  L.push(`Mode: ${auto === '1' ? 'unattended (batches auto-queue)' : 'FIRST BATCH WAITS FOR APPROVAL'}`);
  L.push(`In flight: ${jobs.length}`);
  for (const j of jobs) {
    const mins = Math.round((Date.now() - new Date(j.submittedAt).getTime()) / 60000);
    L.push(`  ${j.sourceLabel} ${j.mode} - ${mins} min ago - project ${j.projectId}`);
  }
  L.push(`Waiting on approval: ${held.length} batch(es), ${heldClips} clip(s)`);
  for (const b of held) for (const c of (b.clips || [])) L.push(`  ${(c.score || 0).toFixed(1)} "${String(c.title || '').slice(0, 44)}" ${c.seconds || 0}s`);

  L.push('', '=== QUEUE ===');
  L.push(`${queue.length} clip(s) ready to publish`);
  for (const q of queue.slice(0, 8)) L.push(`  "${String(q.hook || '').slice(0, 50)}"`);

  L.push('', '=== RAMP ===');
  L.push(`Day ${day + 1}. Allowance ${perAccount} per account x ${accounts.length} accounts = ${allowance} posts today.`);
  L.push(`Used today: ${usedToday}`);
  for (let i = 0; i < accounts.length; i++) L.push(`  account ${i + 1}: ${counts[accounts[i]] || 0} / ${perAccount}`);

  L.push('', '=== SETTINGS ===');
  L.push(`Posting to: ${platforms.join(', ')}`);
  L.push(`Campaign: ${campaign ? campaign.name : 'none - captions will be plain'}`);
  L.push('', 'Read straight from storage. Nothing above is interpreted.');
  return L.join(String.fromCharCode(10));
}



export async function vizardDebugSubmit(env, target) {
  const url = String(target || '').trim();
  if (!url.startsWith('https://pub-772ecf10131b467a9a78ef8842e1242e.r2.dev/')) return 'Only asgardclips URLs allowed.';
  if (!env.VIZARD_API_KEY) return 'VIZARD_API_KEY is not set.';
  const guess = new URL(url).pathname.toLowerCase().split('.').pop();
  const body = { videoUrl: url, videoType: 1, ext: ['mp4','mov','avi','3gp'].includes(guess) ? guess : 'mp4', lang: 'en', preferLength: [1], ratioOfClip: 1, subtitleSwitch: 1, headlineSwitch: 1, removeSilenceSwitch: 1 };
  let status='?', text='';
  try {
    const res = await fetch('https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create', { method:'POST', headers:{ VIZARDAI_API_KEY: env.VIZARD_API_KEY, 'content-type':'application/json' }, body: JSON.stringify(body) });
    status = res.status; text = await res.text();
  } catch (err) { return `Could not reach Vizard: ${err.message}`; }
  return ['WHAT WE SENT:', JSON.stringify(body, null, 2), '', `WHAT VIZARD SENT BACK (HTTP ${status}):`, text].join(String.fromCharCode(10));
}


// Throw away everything waiting on approval WITHOUT releasing it and WITHOUT
// flipping the pipeline to unattended. The counterpart to vizardApprove, and
// the thing that was missing the moment a batch turned out to be the wrong
// footage: the only exit from the hold was to publish it.
export async function discardHeld(env) {
  const raw = await env.RAYVEN_KV.get('vizard:held');
  let held = [];
  try { held = raw ? JSON.parse(raw) : []; } catch { held = []; }
  const n = held.reduce((a, b) => a + ((b.clips || []).length), 0);
  await env.RAYVEN_KV.put('vizard:held', JSON.stringify([]));
  return `Discarded ${n} clip(s) across ${held.length} batch(es). Nothing was published. The pipeline is still in approval mode, so the next batch will wait for you too.`;
}
