// ===========================================================================
// CLIPPING — Odin's pipeline: find, transform, queue, publish.
//
// Deliberate constraints baked in, because they are what keeps the accounts
// alive rather than what makes the numbers big:
//
//  1. GAMING AND IRL ONLY. No movie clips, no league sports. There is no
//     self-serve licence for studio film clips, and the major sports leagues
//     are the most aggressive rights-holders online. Both were dropped on
//     purpose; do not add them back without a signed licence.
//
//  2. NOTHING PUBLISHES UNTRANSFORMED. YouTube, Meta and TikTok all changed
//     policy in 2025-26 to demonetise and downrank straight reposts — YouTube
//     bans them even WITH the creator's permission. Every clip therefore needs
//     a written hook and a caption track before it is allowed into the queue.
//
//  3. THE RAMP IS ENFORCED IN CODE, not left to good intentions. Brand-new
//     accounts posting five times a day is the classic spam signature, and 15
//     accounts doing it together is a network-level one.
// ===========================================================================

const KV = {
  token: 'clips:twitch_token',
  queue: 'clips:queue',
  posted: 'clips:posted',
  accounts: 'clips:accounts',
  started: 'clips:started_at',
  lastRun: 'clips:last_run',
  monthly: 'clips:monthly',
  cap: 'clips:monthly_cap',
  platforms: 'clips:platforms'
};

// Which networks each profile publishes to. TikTok and YouTube Shorts to start;
// Instagram is one command away (clips_set_platforms) and needs nothing else,
// because an Ayrshare profile carries one account per network either way.
const DEFAULT_PLATFORMS = ['tiktok', 'youtube'];
const KNOWN_PLATFORMS = ['tiktok', 'youtube', 'instagram', 'facebook'];

// Free posting tiers are small and silent about it — you find the ceiling by
// hitting it. Default to Upload-Post's free allowance so the first month cannot
// quietly overrun; raise it the day the plan is upgraded.
const DEFAULT_MONTHLY_CAP = 400;   // generous; lower it to match a small free plan

const MAX_QUEUE = 200;
const CYCLE_MS = 55 * 60 * 1000;          // publish pass roughly hourly

// Warm-up. Index is days since the first post; value is posts per account per
// day. Starts at 2 and reaches 5 in a fortnight — new accounts going straight to
// five is the signature that gets a whole network flagged at once.
function postsPerAccountForDay(day) {
  if (day <= 3) return 2;
  if (day <= 7) return 3;
  if (day <= 11) return 4;
  return 5;
}

async function readJson(env, key, fallback) {
  try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
async function writeJson(env, key, value) {
  await env.RAYVEN_KV.put(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// TWITCH — source material
// ---------------------------------------------------------------------------
async function twitchToken(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new Error('Twitch is not connected. Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET as Worker secrets.');
  }
  const cached = await readJson(env, KV.token, null);
  if (cached && cached.expires > Date.now() + 60000) return cached.token;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Twitch auth failed: ${JSON.stringify(data).slice(0, 200)}`);
  await writeJson(env, KV.token, { token: data.access_token, expires: Date.now() + (data.expires_in - 120) * 1000 });
  return data.access_token;
}

async function twitchGet(env, path, params) {
  const token = await twitchToken(env);
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twitch ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export async function findClips(env, { game, broadcaster, days = 2, limit = 20 }) {
  const params = { first: Math.min(100, Math.max(1, limit)) };
  if (days) {
    params.started_at = new Date(Date.now() - days * 864e5).toISOString();
    params.ended_at = new Date().toISOString();
  }
  if (broadcaster) {
    const users = await twitchGet(env, 'users', { login: String(broadcaster).toLowerCase() });
    if (!users.data || !users.data.length) return `No Twitch channel called "${broadcaster}".`;
    params.broadcaster_id = users.data[0].id;
  } else if (game) {
    const games = await twitchGet(env, 'games', { name: game });
    if (!games.data || !games.data.length) return `Twitch has no game called "${game}". Try the exact store name.`;
    params.game_id = games.data[0].id;
  } else {
    return 'Give me either a game or a broadcaster to search.';
  }

  const clips = await twitchGet(env, 'clips', params);
  if (!clips.data || !clips.data.length) return 'No clips found for that in the window.';
  const rows = clips.data.map(c =>
    `${c.id} | ${c.view_count} views | ${c.duration}s | ${c.broadcaster_name} | ${c.title.replace(/\s+/g, ' ').slice(0, 70)} | ${c.url}`
  );
  return `Found ${rows.length} clips (id | views | length | streamer | title | url):\n${rows.join('\n')}\n\n` +
    `This is DISCOVERY ONLY — it tells us what is performing, it does not give us the video file. ` +
    `Twitch has no download API and their staff have stated plainly that pulling the mp4 programmatically breaks the Developer Agreement, ` +
    `so I will not do it and neither should anything else in this pipeline. ` +
    `To actually post one of these: get the file from someone entitled to give it to you — the streamer (they can export it from their own Creator Dashboard in one click, and most mid-size streamers are glad to, it is free distribution) or your own recordings. ` +
    `Put it somewhere with a public https link, then call clips_queue_add with that videoUrl and a written hook.`;
}

// ---------------------------------------------------------------------------
// QUEUE
// ---------------------------------------------------------------------------
// A queued clip needs THREE things, and the third is the one people get wrong:
// a direct link to the video FILE. Ayrshare and Instagram both fetch the media
// themselves, server-side, from the URL we hand them. A twitch.tv/clips page is
// an HTML page, not a video, so it fails at the publisher with an error that
// reads like an auth problem and sends you looking in entirely the wrong place.
const PAGE_NOT_FILE = /(clips\.twitch\.tv|twitch\.tv\/[^/]+\/clip\/|youtube\.com|youtu\.be|tiktok\.com|instagram\.com)/i;

export async function queueAdd(env, { clipId, clipUrl, videoUrl, hook, caption, credit }) {
  if (!hook || hook.trim().length < 12) {
    return 'Refused: every clip needs a real written hook of its own, at least a dozen characters. This is not bureaucracy — an unmodified repost is what all three platforms now demote, so a clip without a hook is not worth the upload slot.';
  }
  const video = String(videoUrl || '').trim();
  if (!video) {
    return 'Refused: I need videoUrl — a direct https link to the actual video file (ends in .mp4 or similar). ' +
      'A Twitch clip page link will not work: the publisher downloads the media itself from whatever URL I give it, and a web page is not a video. ' +
      'Upload the file to your R2 bucket (or any public host), copy the link, and pass it as videoUrl.';
  }
  if (!/^https:\/\//i.test(video)) return 'Refused: videoUrl must start with https:// and be reachable without a login.';
  if (PAGE_NOT_FILE.test(video)) {
    return `Refused: "${video.slice(0, 60)}" is a web page, not a video file. ` +
      'I need the direct file link — the one that plays the raw video with no site around it. ' +
      'Note also that scraping the file off Twitch programmatically breaks their Developer Agreement, so the file has to come from the streamer or from you.';
  }
  const queue = await readJson(env, KV.queue, []);
  if (queue.length >= MAX_QUEUE) return `Queue is full at ${MAX_QUEUE}. Publish or prune before adding more.`;
  if (queue.some(q => q.videoUrl === video || (clipId && q.clipId === clipId))) return 'That clip is already queued.';
  queue.push({
    clipId: clipId || null,
    clipUrl: clipUrl || null,
    videoUrl: video,
    hook: hook.trim(),
    caption: (caption || '').trim(),
    credit: (credit || '').trim(),
    addedAt: new Date().toISOString(),
    status: 'ready'
  });
  await writeJson(env, KV.queue, queue);
  return `Queued. ${queue.length} clip(s) waiting.`;
}

export async function queueList(env) {
  const queue = await readJson(env, KV.queue, []);
  if (!queue.length) return 'The queue is empty.';
  return `${queue.length} queued:\n` + queue.slice(0, 40).map((q, i) =>
    `${i + 1}. [${q.status}] ${q.hook.slice(0, 60)} — ${q.clipUrl || q.clipId}`).join('\n');
}

export async function queueRemove(env, { index }) {
  const queue = await readJson(env, KV.queue, []);
  const i = Number(index) - 1;
  if (!(i >= 0 && i < queue.length)) return 'No queue entry at that number.';
  const [gone] = queue.splice(i, 1);
  await writeJson(env, KV.queue, queue);
  return `Removed "${gone.hook.slice(0, 50)}". ${queue.length} left.`;
}

// ---------------------------------------------------------------------------
// ACCOUNTS — Upload-Post profile names, one per platform trio
// ---------------------------------------------------------------------------
export async function setPlatforms(env, { platforms }) {
  const list = String(platforms || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  const bad = list.filter(x => !KNOWN_PLATFORMS.includes(x));
  if (bad.length) return `Not a network I can post to: ${bad.join(', ')}. Choose from ${KNOWN_PLATFORMS.join(', ')}.`;
  if (!list.length) return 'Give me at least one network.';
  await writeJson(env, KV.platforms, list);
  return `Publishing to ${list.join(' + ')} from now on.`;
}

export async function setMonthlyCap(env, { cap }) {
  const n = Number(cap);
  if (!(n > 0)) return 'Give me a number — how many uploads a month the current plan allows. 0 or blank is not a cap, it is a surprise.';
  await env.RAYVEN_KV.put(KV.cap, String(Math.floor(n)));
  return `Monthly ceiling set to ${Math.floor(n)} uploads. I will stop there rather than fail mid-post.`;
}

async function monthlyUsed(env) {
  const m = await readJson(env, KV.monthly, {});
  const key = new Date().toISOString().slice(0, 7);
  return { key, used: m[key] || 0, all: m };
}

export async function setAccounts(env, { profiles }) {
  const list = String(profiles || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return 'Give me the profile identifiers, comma separated — Ayrshare Profile-Keys if you are on Ayrshare, Upload-Post profile names if you are on Upload-Post.';
  await writeJson(env, KV.accounts, list);
  return `Rotation set: ${list.join(', ')} (${list.length} profiles).`;
}

// ---------------------------------------------------------------------------
// PUBLISH
// ---------------------------------------------------------------------------
// Ayrshare answers HTTP 200 even when every network refused the post. The
// verdict lives in the body: `status`, a `postIds` array with a per-network
// status, and an `errors` array. Reading only res.ok — which is what this did
// until a clip "published" to nowhere and still burned a slot — means treating
// a total failure as a success, deleting the clip from the queue, and telling
// Rayan it went out. Everything below exists to make the body the verdict.
function readAyrshareResult(text) {
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error(`Ayrshare sent something unreadable: ${String(text).slice(0, 300)}`);

  const ref = data.id ? ` [Ayrshare post id ${data.id}]` : '';
  const entries = Array.isArray(data.postIds) ? data.postIds : [];

  const live = [];
  const waiting = [];
  const failed = [];

  for (const e of entries) {
    const state = String(e.status || 'success').toLowerCase();
    const where = e.platform || 'unknown';
    if (state === 'success') live.push(`${where}${e.postUrl ? ` → ${e.postUrl}` : ''}`);
    // `pending` on TikTok means accepted but not public — a draft sitting in
    // the app's Inbox, or a private post. It is not a published clip and must
    // never be reported as one.
    else if (state === 'pending' || state === 'processing') waiting.push(`${where} (${state} — accepted but NOT public yet)`);
    else failed.push(`${where}: ${e.message || e.error || state}`);
  }

  for (const e of (Array.isArray(data.errors) ? data.errors : [])) {
    const where = e.platform || 'unknown';
    const code = e.code ? ` (code ${e.code})` : '';
    failed.push(`${where}${code}: ${e.message || e.error || 'no message given'}`);
  }

  // Nothing reached a real profile. Throw, so publishNext puts the clip back
  // and does not spend a slot on it.
  if (!live.length) {
    const why = failed.length ? failed.join(' | ')
      : waiting.length ? waiting.join(' | ')
      : `status "${data.status || 'unknown'}" with no post ids and no error text`;
    throw new Error(`nothing published${ref}. ${why}`);
  }

  const parts = [`live on ${live.join(', ')}`];
  if (waiting.length) parts.push(`NOT public: ${waiting.join(', ')}`);
  if (failed.length) parts.push(`refused: ${failed.join(' | ')}`);
  return parts.join(' — ') + ref;
}

// Two publishers, chosen by whichever key is present. Both exist because both
// hold their own audited TikTok and YouTube clients — that is the entire reason
// to use one. Posting to TikTok or YouTube from our own unaudited app would
// publish everything PRIVATE, permanently and without appeal.
async function publishOne(env, item, profile, platforms) {
  const video = item.renderedUrl || item.videoUrl;
  if (!video) throw new Error('This queue entry has no video file link. Remove it and re-add it with a videoUrl.');
  const description = [item.caption, item.credit ? `Clip: ${item.credit}` : ''].filter(Boolean).join('\n\n');

  if (env.AYRSHARE_API_KEY) {
    const headers = {
      Authorization: `Bearer ${env.AYRSHARE_API_KEY}`,
      'content-type': 'application/json'
    };
    // profile here is an Ayrshare Profile-Key; omit for a single-profile account
    if (profile && profile !== 'default') headers['Profile-Key'] = profile;
    const res = await fetch('https://api.ayrshare.com/api/post', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        post: [item.hook, description].filter(Boolean).join('\n\n').slice(0, 2000),
        platforms,
        mediaUrls: [video],
        isVideo: true,
        youTubeOptions: { title: item.hook.slice(0, 95), visibility: 'public' },
        // Spelled out rather than left to the default. A TikTok post created
        // private or as a draft sits in `pending` forever and never appears on
        // the profile, which looks identical to "it worked" from out here.
        tikTokOptions: { visibility: 'public', draft: false }
      })
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Ayrshare HTTP ${res.status}: ${text.slice(0, 600)}`);
    return readAyrshareResult(text);
  }

  if (env.UPLOAD_POST_API_KEY) {
    const res = await fetch('https://api.upload-post.com/api/upload', {
      method: 'POST',
      headers: {
        // Verify this header against the Upload-Post dashboard on first run —
        // their docs show the SDK rather than the raw header, and a wrong auth
        // header surfaces as a flat 401 with nothing descriptive in it.
        Authorization: `Apikey ${env.UPLOAD_POST_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ user: profile, platform: platforms, video, title: item.hook, description })
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Upload-Post ${res.status}: ${text.slice(0, 250)}`);
    return text.slice(0, 200);
  }

  throw new Error('No publisher connected. Set AYRSHARE_API_KEY (28-day free trial, no card) or UPLOAD_POST_API_KEY.');
}

function dayIndex(startedIso) {
  if (!startedIso) return 0;
  return Math.floor((Date.now() - new Date(startedIso).getTime()) / 864e5);
}

async function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function publishNext(env, { count = 1 } = {}) {
  const [queue, accounts, startedAt, posted] = await Promise.all([
    readJson(env, KV.queue, []),
    readJson(env, KV.accounts, []),
    env.RAYVEN_KV.get(KV.started),
    readJson(env, KV.posted, {})
  ]);
  if (!accounts.length) return 'No accounts configured. Call clips_set_accounts first — with your Ayrshare Profile-Keys, or your Upload-Post profile names if you are on that instead.';
  if (!queue.length) return 'Nothing queued.';

  const started = startedAt || new Date().toISOString();
  if (!startedAt) await env.RAYVEN_KV.put(KV.started, started);

  const day = dayIndex(started);
  const perAccount = postsPerAccountForDay(day);
  const today = await todayKey();
  const todayCounts = posted[today] || {};
  const results = [];

  const capRaw = await env.RAYVEN_KV.get(KV.cap);
  const cap = Number(capRaw) || DEFAULT_MONTHLY_CAP;
  const month = await monthlyUsed(env);
  const platforms = await readJson(env, KV.platforms, DEFAULT_PLATFORMS);

  for (let n = 0; n < count; n++) {
    if (month.used >= cap) {
      results.push(`Monthly ceiling reached — ${month.used} of ${cap} uploads used. Nothing more goes out until the plan is raised (clips_set_monthly_cap) or the month turns.`);
      break;
    }
    // Round-robin, not first-with-room. Filling account 1 to its daily limit
    // before account 2 posts at all gives every account a burst-then-silent
    // pattern; spreading by lowest-count-so-far keeps all five looking like
    // ordinary accounts posting through the day.
    const eligible = accounts.filter(p => (todayCounts[p] || 0) < perAccount);
    if (!eligible.length) { results.push(`Day ${day + 1} ramp is met — ${perAccount} per account. Nothing more goes out today.`); break; }
    const profile = eligible.reduce((best, p) =>
      (todayCounts[p] || 0) < (todayCounts[best] || 0) ? p : best, eligible[0]);
    const item = queue.shift();
    if (!item) { results.push('Queue emptied.'); break; }
    try {
      const out = await publishOne(env, item, profile, platforms);
      todayCounts[profile] = (todayCounts[profile] || 0) + 1;
      month.used += 1;
      month.all[month.key] = month.used;
      results.push(`Posted to ${profile}: "${item.hook.slice(0, 50)}" — ${out} (${month.used}/${cap} this month)`);
    } catch (err) {
      // Put it back. A failed publish must not silently consume a clip.
      queue.unshift(item);
      results.push(`FAILED on ${profile} — ${err.message}\nThe clip is still queued and no slot was spent. Run clips_history for what the publisher recorded.`);
      break;
    }
  }

  posted[today] = todayCounts;
  for (const k of Object.keys(posted)) if (k < today) delete posted[k];   // keep it small
  await Promise.all([
    writeJson(env, KV.queue, queue),
    writeJson(env, KV.posted, posted),
    writeJson(env, KV.monthly, month.all)
  ]);
  return results.join('\n');
}

export async function clippingStatus(env) {
  const [queue, accounts, startedAt, posted] = await Promise.all([
    readJson(env, KV.queue, []),
    readJson(env, KV.accounts, []),
    env.RAYVEN_KV.get(KV.started),
    readJson(env, KV.posted, {})
  ]);
  const day = dayIndex(startedAt);
  const perAccount = postsPerAccountForDay(day);
  const today = (posted[await todayKey()]) || {};
  const done = Object.values(today).reduce((a, b) => a + b, 0);
  const target = perAccount * (accounts.length || 0);
  return [
    startedAt ? `Day ${day + 1} of the ramp.` : 'Not started — the ramp begins on the first post.',
    `Allowance today: ${perAccount} per account, ${target} total.`,
    `Posted today: ${done}.`,
    `Queue: ${queue.length} ready.`,
    await (async () => {
      const capRaw = await env.RAYVEN_KV.get(KV.cap);
      const cap = Number(capRaw) || DEFAULT_MONTHLY_CAP;
      const m = await monthlyUsed(env);
      return `This month: ${m.used} of ${cap} uploads used.`;
    })(),
    `Accounts: ${accounts.length ? accounts.join(', ') : 'none configured'}.`,
    await (async () => {
      const pl = await readJson(env, KV.platforms, DEFAULT_PLATFORMS);
      return `Networks: ${pl.join(' + ')} — ${accounts.length * pl.length} accounts in play.`;
    })(),
    (!env.AYRSHARE_API_KEY && !env.UPLOAD_POST_API_KEY)
      ? 'No publisher connected — set AYRSHARE_API_KEY or UPLOAD_POST_API_KEY.'
      : `Publisher: ${env.AYRSHARE_API_KEY ? 'Ayrshare' : 'Upload-Post'}.`,
    !env.TWITCH_CLIENT_ID ? 'Twitch not connected — sourcing is disabled.' : ''
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// CRON — one publish pass an hour, inside the ramp, never outside it
// ---------------------------------------------------------------------------
export async function runClipCycleIfDue(env) {
  const last = Number(await env.RAYVEN_KV.get(KV.lastRun)) || 0;
  if (Date.now() - last < CYCLE_MS) return null;
  await env.RAYVEN_KV.put(KV.lastRun, String(Date.now()));
  const accounts = await readJson(env, KV.accounts, []);
  const queue = await readJson(env, KV.queue, []);
  if (!accounts.length || !queue.length || (!env.AYRSHARE_API_KEY && !env.UPLOAD_POST_API_KEY)) return null;
  return await publishNext(env, { count: 1 });
}

// The publisher's own record, not ours. Our KV counter only ever knew that we
// made a request; it could not tell whether a clip reached a profile. When
// Rayan says "nothing is showing up", this is the only thing worth reading —
// it carries the real per-network status, the live URL, and the refusal text.
export async function clipsHistory(env, { profile, limit = 5 } = {}) {
  if (!env.AYRSHARE_API_KEY) return 'Ayrshare is not connected, so there is no publisher history to read.';

  const accounts = await readJson(env, KV.accounts, []);
  const targets = profile ? [profile] : (accounts.length ? accounts : ['default']);
  const n = Math.min(Math.max(Number(limit) || 5, 1), 25);
  const out = [];

  for (const p of targets.slice(0, 6)) {
    const headers = { Authorization: `Bearer ${env.AYRSHARE_API_KEY}` };
    if (p && p !== 'default') headers['Profile-Key'] = p;

    let res, text;
    try {
      res = await fetch(`https://api.ayrshare.com/api/history?limit=${n}&lastDays=7`, { headers });
      text = await res.text();
    } catch (err) {
      out.push(`${p}: could not reach Ayrshare — ${err.message}`);
      continue;
    }
    if (!res.ok) { out.push(`${p}: Ayrshare HTTP ${res.status} — ${text.slice(0, 200)}`); continue; }

    let data;
    try { data = JSON.parse(text); } catch { out.push(`${p}: unreadable reply — ${text.slice(0, 200)}`); continue; }
    const posts = Array.isArray(data) ? data : (Array.isArray(data.history) ? data.history : (Array.isArray(data.posts) ? data.posts : []));
    if (!posts.length) { out.push(`${p}: no posts recorded in the last 7 days.`); continue; }

    const lines = posts.slice(0, n).map(post => {
      const when = (post.created || post.scheduleDate || '').slice(0, 16).replace('T', ' ');
      const head = String(post.post || '').replace(/\s+/g, ' ').slice(0, 44);
      const per = (Array.isArray(post.postIds) ? post.postIds : []).map(e =>
        `${e.platform}=${e.status || 'success'}${e.postUrl ? ` ${e.postUrl}` : ''}`).join(', ');
      const errs = (Array.isArray(post.errors) ? post.errors : []).map(e =>
        `${e.platform || '?'}${e.code ? `/${e.code}` : ''}: ${String(e.message || e.error || '').replace(/\s+/g, ' ').slice(0, 160)}`).join(' | ');
      return `  ${when} [${post.status || '?'}] "${head}"${per ? `\n    ${per}` : ''}${errs ? `\n    REFUSED — ${errs}` : ''}`;
    });
    out.push(`${p}:\n${lines.join('\n')}`);
  }

  return out.join('\n\n') || 'Nothing to report.';
}

// Where do our keys actually point? Ayrshare answered "not linked" for a profile
// whose dashboard plainly showed both networks linked. Both cannot be true of
// the same profile — so the Profile-Key we send under the name "rig1" is
// reaching a different profile than the one Rayan linked the accounts to. This
// proves it either way, and it never prints a key: it asks Ayrshare which
// profile each key resolves to, and cross-checks that against what Ayrshare
// says is linked where.
export async function clipsVerifyAccounts(env) {
  if (!env.AYRSHARE_API_KEY) return 'Ayrshare is not connected, so there is nothing to verify.';
  const auth = { Authorization: `Bearer ${env.AYRSHARE_API_KEY}` };
  const out = [];

  // 1. Ayrshare's own inventory: every profile, and what is linked to it.
  const linkedByTitle = new Map();
  const suspended = [];
  try {
    const r = await fetch('https://api.ayrshare.com/api/profiles', { headers: auth });
    const t = await r.text();
    if (!r.ok) out.push(`Could not list profiles — HTTP ${r.status}: ${t.slice(0, 160)}`);
    else {
      const d = JSON.parse(t);
      const list = Array.isArray(d) ? d : (d.profiles || []);
      out.push(`WHAT AYRSHARE HAS (${list.length} profile${list.length === 1 ? '' : 's'}):`);
      for (const p of list) {
        const name = p.title || p.displayTitle || p.refId || 'unnamed';
        const nets = Array.isArray(p.activeSocialAccounts) ? p.activeSocialAccounts : [];
        linkedByTitle.set(name, nets);
        // A suspended profile refuses posts while still showing its accounts as
        // linked in the dashboard — and Ayrshare suspends every user profile
        // when the Primary is suspended, so one billing problem reads as five
        // separate linking problems.
        const flag = p.suspended ? '  ** SUSPENDED **' : (p.status && p.status !== 'active' ? `  ** status: ${p.status} **` : '');
        out.push(`  ${name} — ${nets.length ? nets.join(' + ') : 'NOTHING LINKED'}${flag}`);
        if (p.suspended) suspended.push(name);
      }
    }
  } catch (err) { out.push(`Could not list profiles — ${err.message}`); }

  // 2. Resolve each configured key to the profile it actually reaches.
  const accounts = await readJson(env, KV.accounts, []);
  out.push('', `WHERE OUR ${accounts.length} CONFIGURED KEY${accounts.length === 1 ? '' : 'S'} ACTUALLY POINT:`);
  if (!accounts.length) out.push('  None configured. Set them with clips_set_accounts.');

  const seen = new Map();
  const handleOwner = new Map();   // "tiktok @name" -> which key claimed it first
  const problems = [];

  for (let i = 0; i < accounts.length; i++) {
    const key = accounts[i];
    const label = `key ${i + 1}`;
    const headers = { ...auth };
    if (key && key !== 'default') headers['Profile-Key'] = key;

    let r, t;
    try { r = await fetch('https://api.ayrshare.com/api/user', { headers }); t = await r.text(); }
    catch (err) { out.push(`  ${label}: could not reach Ayrshare — ${err.message}`); continue; }

    if (!r.ok) {
      out.push(`  ${label}: REJECTED — HTTP ${r.status}: ${t.slice(0, 140)}`);
      problems.push(`${label} is not a Profile-Key Ayrshare recognises.`);
      continue;
    }
    let d;
    try { d = JSON.parse(t); } catch { out.push(`  ${label}: unreadable reply`); continue; }

    // A key that is missing, blank, or not honoured silently resolves to the
    // Primary Profile — which is exactly the failure that looks like "not
    // linked" while the dashboard shows everything linked.
    const isPrimary = !d.title && !!d.email;
    const who = d.title || (isPrimary ? 'PRIMARY PROFILE' : (d.refId || 'unnamed'));
    const nets = Array.isArray(d.activeSocialAccounts) ? d.activeSocialAccounts : [];
    // The handle, not just the network name. Linking five TikTok accounts in
    // one browser is the moment this setup quietly breaks: TikTok's consent
    // screen has no account picker, so it authorises whoever is logged in and
    // happily attaches the SAME account to a second profile. "tiktok" appearing
    // on both rigs looks correct right up until you notice it is one account
    // posting twice while another never posts at all.
    const names = Array.isArray(d.displayNames) ? d.displayNames : [];
    const handleFor = new Map(names.map(x => [x.platform, x.username || x.displayName || '']));
    const netStr = nets.length
      ? nets.map(nw => `${nw}${handleFor.get(nw) ? ` ${handleFor.get(nw)}` : ''}`).join(' + ')
      : 'NOTHING LINKED';
    const quota = (d.monthlyPostQuota !== undefined)
      ? `  [${d.monthlyPostCount ?? '?'}/${d.monthlyPostQuota} posts used this month]` : '';
    out.push(`  ${label} -> ${who} — ${netStr}${quota}`);

    for (const nw of nets) {
      const handle = handleFor.get(nw);
      if (!handle) continue;
      const tag = `${nw} ${handle}`;
      if (handleOwner.has(tag)) {
        problems.push(`DUPLICATE ACCOUNT — ${tag} is attached to BOTH ${handleOwner.get(tag)} and ${who}. That is one account posting twice a day while another posts nothing. Unlink it from ${who} and relink the right one (log out of that network in the browser first).`);
      } else handleOwner.set(tag, who);
    }

    if (isPrimary) problems.push(`${label} lands on the Primary Profile, not a rig. Posts sent with it use whatever the Primary has linked.`);
    if (!nets.length) problems.push(`${label} reaches "${who}", which has no networks linked — every post through it will be refused as "not linked".`);
    if (seen.has(who)) problems.push(`${label} and ${seen.get(who)} both reach "${who}". Two rigs sharing one key means one rig never posts and the other double-posts.`);
    else seen.set(who, label);
  }

  // 3. Name the profiles that ARE ready but that no key of ours reaches.
  const reached = new Set(seen.keys());
  const stranded = [...linkedByTitle.entries()].filter(([n, nets]) => nets.length && !reached.has(n)).map(([n]) => n);
  if (suspended.length) problems.push(`SUSPENDED: ${suspended.join(', ')}. A suspended profile refuses every post while still showing its accounts as linked. If the Primary Profile is suspended, all of them are — check billing on the account, not the linking.`);
  if (stranded.length) problems.push(`These profiles have accounts linked but no key of ours reaches them: ${stranded.join(', ')}. Their Profile-Keys are the ones we should be using.`);

  out.push('', problems.length ? `PROBLEMS:\n  - ${problems.join('\n  - ')}` : 'No mismatch found — every key reaches a distinct profile with networks linked.');
  return out.join('\n');
}
