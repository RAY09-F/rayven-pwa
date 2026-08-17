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

// Their error codes are numeric and the messages are terse, so translate the
// ones that actually happen into something that says what to do about it.
function explainCode(code, errMsg) {
  const map = {
    4001: 'the API key was rejected — check VIZARD_API_KEY',
    4002: 'that video URL could not be reached. It has to be public, and live streams are not supported',
    4003: 'unsupported source. Kick is not on their list; download the file and give me a direct link instead',
    4004: 'the video is too long — their ceiling is 600 minutes',
    4005: 'that video is over 3 minutes, so it cannot go through edit mode. Let me run it as a clipping job instead',
    4006: 'no upload minutes left on the Vizard plan this month',
    4008: 'the video is under a minute, which is too short to cut clips from'
  };
  return map[code] || errMsg || `Vizard refused it with code ${code}`;
}

// ---------------------------------------------------------------------------
// SUBMIT
// ---------------------------------------------------------------------------
export async function vizardClip(env, { videoUrl, maxClips, keyword, lang, permission, mode, note } = {}) {
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

  const body = {
    videoUrl: url,
    videoType: type,
    lang: lang || 'en',
    ratioOfClip: 1,          // 9:16 — this whole operation is vertical
    subtitleSwitch: 1,       // burned-in captions
    headlineSwitch: 1,       // hook overlay in the first 3 seconds
    removeSilenceSwitch: 1   // dead air is what kills retention in the first 2s
  };
  if (polish) body.getClips = 0;                        // edit an already-short video, do not cut it
  else body.preferLength = [1, 2];                      // aim at the 30s–90s band
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

async function queueClips(env, job, clips) {
  const added = [];
  const skipped = [];
  for (const c of clips) {
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
  await env.RAYVEN_KV.put(KV.lastPoll, String(Date.now()));

  await refreshExpiringUrls(env);

  const jobs = await readJson(env, KV.jobs, []);
  if (!jobs.length) return null;

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
