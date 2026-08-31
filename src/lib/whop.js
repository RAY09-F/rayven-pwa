// ---------------------------------------------------------------------------
// WHOP SUBMISSION
// ---------------------------------------------------------------------------
// Whop Content Rewards has NO submission API. Checked 2026-08-18 against their
// developer docs (docs.whop.com) and their official TypeScript SDK: the SDK
// covers products, reviews, access checks and memberships, and nothing else.
// Submission is a person pasting a post URL into a dashboard.
//
// So this drives the browser Rayan already has under control. That makes it the
// most fragile thing in the whole pipeline -- it depends on his Chromebook being
// awake, Chrome being open, the extension running, him being logged into Whop,
// and Whop not redesigning the page. Every one of those is a real failure mode,
// so this module's guiding rule is: NEVER report a submission that did not
// visibly happen, and never submit the same post twice.

import { enqueueBrowserCommand } from './browser.js';
import { callAnthropicSimple } from './anthropic.js';

const KV = {
  url: 'whop:campaign_url',
  done: 'whop:submitted',        // { "<postUrl>": "<iso>" }
  auto: 'whop:auto',             // '1' once Rayan has seen it work
  last: 'whop:last_run',
  log: 'whop:last_attempt'
};

const CYCLE_MS = 20 * 60 * 1000;

async function readJson(env, key, fallback) {
  try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
async function writeJson(env, key, value) {
  await env.RAYVEN_KV.put(key, JSON.stringify(value));
}

export async function whopSetCampaign(env, { url } = {}) {
  const u = String(url || '').trim();
  if (!/^https:\/\//i.test(u)) return 'Give me the full https link to the campaign page where submissions are pasted.';
  let host = '';
  try { host = new URL(u).hostname.toLowerCase(); } catch { return 'That is not a URL I can parse.'; }
  if (!(host === 'whop.com' || host.endsWith('.whop.com'))) {
    return `That link points at ${host}, not Whop. Paste the campaign page from your Whop dashboard.`;
  }
  await env.RAYVEN_KV.put(KV.url, u);
  return `Campaign submission page saved: ${u}\nRun the inspection next (clips_whop_inspect) so I can see the page before anything gets clicked.`;
}

export async function whopStatus(env) {
  const url = await env.RAYVEN_KV.get(KV.url);
  const done = await readJson(env, KV.done, {});
  const auto = (await env.RAYVEN_KV.get(KV.auto)) === '1';
  const last = await env.RAYVEN_KV.get(KV.log);
  const n = Object.keys(done).length;
  return [
    url ? `Campaign page: ${url}` : 'No campaign page set. Use clips_whop_set_campaign with the link from your Whop dashboard.',
    `${n} post${n === 1 ? '' : 's'} submitted so far.`,
    auto ? 'Automatic submission is ON — new posts get submitted without being asked.'
         : 'Automatic submission is OFF. It stays off until an inspection and one successful submission have both been seen.',
    last ? `Last attempt: ${last}` : ''
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// What is waiting to be submitted
// ---------------------------------------------------------------------------
// Read from the PUBLISHER's own record, never from our counters. Our counters
// record what we attempted; Ayrshare records what actually went live, with the
// real post URL. That distinction has already cost this project hours once.
export async function whopPending(env) {
  if (!env.AYRSHARE_API_KEY) return { error: 'Ayrshare is not connected, so there are no live post URLs to submit.' };
  const accounts = await readJson(env, 'clips:accounts', []);
  const targets = accounts.length ? accounts : ['default'];
  const done = await readJson(env, KV.done, {});
  const found = [];

  for (const p of targets.slice(0, 6)) {
    const headers = { Authorization: `Bearer ${env.AYRSHARE_API_KEY}` };
    if (p && p !== 'default') headers['Profile-Key'] = p;
    let res, text;
    try {
      res = await fetch('https://api.ayrshare.com/api/history?limit=25&lastDays=7', { headers });
      text = await res.text();
    } catch (err) { found.push({ profile: p, error: `could not reach Ayrshare — ${err.message}` }); continue; }
    if (!res.ok) { found.push({ profile: p, error: `Ayrshare HTTP ${res.status} — ${text.slice(0, 200)}` }); continue; }
    let data; try { data = JSON.parse(text); } catch { found.push({ profile: p, error: 'unreadable reply' }); continue; }
    const posts = Array.isArray(data) ? data : (data.history || data.posts || []);
    for (const post of (Array.isArray(posts) ? posts : [])) {
      for (const e of (Array.isArray(post.postIds) ? post.postIds : [])) {
        const live = e.postUrl && String(e.status || 'success').toLowerCase() !== 'error';
        if (!live) continue;
        if (done[e.postUrl]) continue;
        found.push({ profile: p, platform: e.platform, url: e.postUrl, when: post.created || '' });
      }
    }
  }
  return { pending: found.filter(f => f.url), problems: found.filter(f => f.error) };
}

// ---------------------------------------------------------------------------
// INSPECT — look, report, touch nothing
// ---------------------------------------------------------------------------
// Run this before trusting any of the below. It opens the campaign page and
// prints the actual form controls on it. No clicking, no typing, no submitting.
export async function whopInspect(env) {
  const url = await env.RAYVEN_KV.get(KV.url);
  if (!url) return 'No campaign page saved yet. Use clips_whop_set_campaign first.';

  const nav = await enqueueBrowserCommand(env, 'navigate', { url });
  if (!nav.success) return `Could not open the page: ${nav.data}`;
  await new Promise(r => setTimeout(r, 4000));      // let the app render

  const probe = await enqueueBrowserCommand(env, 'probe', {});
  if (!probe.success) return `Opened the page but could not read it: ${probe.data}`;

  const text = await enqueueBrowserCommand(env, 'read', {});
  return [
    'WHOP PAGE INSPECTION — nothing was clicked.',
    '',
    '--- form controls ---',
    String(probe.data).slice(0, 4000),
    '',
    '--- visible text (first 1200 chars) ---',
    String(text.success ? text.data : '(unavailable)').slice(0, 1200),
    '',
    'If you are looking at a login screen here, log into Whop in Chrome and run this again.'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// SUBMIT ONE
// ---------------------------------------------------------------------------
// Deliberately one post per call. Each browser step blocks up to 20 seconds
// waiting for the extension, so a batch would run for minutes and time out
// halfway with no record of how far it got.
export async function whopSubmitOne(env, { postUrl, dryRun = false } = {}) {
  const campaign = await env.RAYVEN_KV.get(KV.url);
  if (!campaign) return 'No campaign page saved. Use clips_whop_set_campaign first.';
  if (!postUrl) return 'Give me the post URL to submit.';

  const done = await readJson(env, KV.done, {});
  if (done[postUrl]) return `Already submitted on ${done[postUrl].slice(0, 10)}. Not sending it twice — duplicate submissions get rejected.`;

  const nav = await enqueueBrowserCommand(env, 'navigate', { url: campaign });
  if (!nav.success) return `Could not open the campaign page: ${nav.data}`;
  await new Promise(r => setTimeout(r, 4000));

  const probe = await enqueueBrowserCommand(env, 'probe', {});
  if (!probe.success) return `Could not read the campaign page: ${probe.data}`;

  // Let the model pick the field and the button from what is REALLY there,
  // rather than hardcoding selectors against a page that will be redesigned.
  const plan = await callAnthropicSimple(env,
    [
      'You are given a JSON inventory of the visible form controls on a Whop Content Rewards campaign page.',
      'The goal is to submit ONE social media post URL to the campaign.',
      'Reply with ONLY a JSON object, no prose, no code fence:',
      '{"ready":true|false,"openButton":"<exact button text to click first, or empty>","fieldHint":"<placeholder/name/id/aria-label of the URL input>","submitButton":"<exact submit button text>","why":"<one short sentence>"}',
      'Set ready=false if this looks like a login page, an error page, or has no URL field and no button that would reveal one.',
      'Prefer the most specific text. Do not invent controls that are not in the inventory.'
    ].join('\n'),
    String(probe.data).slice(0, 5000), 500);

  if (!plan.ok) return `Could not work out the page layout: ${plan.error}`;
  let p;
  try { p = JSON.parse(String(plan.text).replace(/^```(?:json)?|```$/gm, '').trim()); }
  catch { return `Could not read the page plan. Raw reply: ${String(plan.text).slice(0, 300)}`; }

  if (!p.ready) {
    await env.RAYVEN_KV.put(KV.log, `stopped — ${p.why || 'page did not look like a submission form'}`);
    return [
      'STOPPED before touching anything.',
      `Reason: ${p.why || 'the page does not look like a submission form.'}`,
      '',
      'What was on the page:',
      String(probe.data).slice(0, 1500)
    ].join('\n');
  }

  if (dryRun) {
    return [
      'DRY RUN — nothing was typed or clicked.',
      `Would click open: ${p.openButton || '(nothing)'}`,
      `Would type ${postUrl} into the field matching: ${p.fieldHint}`,
      `Would then click: ${p.submitButton}`,
      `Reasoning: ${p.why || ''}`
    ].join('\n');
  }

  const steps = [];
  if (p.openButton) {
    const r = await enqueueBrowserCommand(env, 'click', { text: p.openButton });
    steps.push(`open "${p.openButton}": ${r.success ? 'clicked' : 'NOT FOUND'}`);
    if (!r.success) return `Stopped — could not find "${p.openButton}" to click.\n${steps.join('\n')}`;
    await new Promise(r2 => setTimeout(r2, 2500));
  }

  const typed = await enqueueBrowserCommand(env, 'type', { fieldHint: p.fieldHint, text: postUrl });
  steps.push(`type into "${p.fieldHint}": ${typed.success ? 'ok' : 'FAILED'}`);
  if (!typed.success) return `Stopped before submitting — no field matched "${p.fieldHint}".\n${steps.join('\n')}`;

  // Read the page back and confirm the URL is actually in it. React forms can
  // accept a keystroke visually and hold nothing; submitting into that posts an
  // empty entry and burns the submission.
  await new Promise(r2 => setTimeout(r2, 800));
  const check = await enqueueBrowserCommand(env, 'probe', {});
  const landed = check.success && String(check.data).includes(postUrl.slice(0, 40));
  if (!landed) {
    await env.RAYVEN_KV.put(KV.log, 'typed but the URL did not stick in the field — did not submit');
    return [
      'STOPPED. The URL did not stick in the field, so nothing was submitted.',
      'Submitting an empty form would have used up the entry for this post.',
      steps.join('\n')
    ].join('\n');
  }

  const sent = await enqueueBrowserCommand(env, 'click', { text: p.submitButton });
  steps.push(`submit "${p.submitButton}": ${sent.success ? 'clicked' : 'NOT FOUND'}`);
  if (!sent.success) return `Typed the URL but could not find "${p.submitButton}" to click. Nothing submitted.\n${steps.join('\n')}`;

  await new Promise(r2 => setTimeout(r2, 3000));
  const after = await enqueueBrowserCommand(env, 'read', {});
  done[postUrl] = new Date().toISOString();
  await writeJson(env, KV.done, done);
  await env.RAYVEN_KV.put(KV.log, `submitted ${postUrl} at ${new Date().toISOString().slice(0, 16)}`);

  return [
    `Submitted ${postUrl}.`,
    steps.join('\n'),
    '',
    'Page afterwards (check this actually says it was received):',
    String(after.success ? after.data : '(could not read)').slice(0, 700)
  ].join('\n');
}

export async function whopSubmitPending(env) {
  const { pending, problems, error } = await whopPending(env);
  if (error) return error;
  if (problems && problems.length) {
    return problems.map(p => `${p.profile}: ${p.error}`).join('\n');
  }
  if (!pending.length) return 'Nothing waiting — every live post has already been submitted.';
  const first = pending[0];
  const out = await whopSubmitOne(env, { postUrl: first.url });
  return `${pending.length} waiting. Taking the oldest (${first.platform}, ${first.profile}):\n\n${out}\n\n${pending.length - 1} still to go — they submit one at a time so a failure never cascades.`;
}

export async function whopAuto(env, { on } = {}) {
  const want = on === false ? false : true;
  if (want) {
    const url = await env.RAYVEN_KV.get(KV.url);
    if (!url) return 'Set the campaign page first with clips_whop_set_campaign.';
    const done = await readJson(env, KV.done, {});
    if (!Object.keys(done).length) {
      return 'Not yet. One submission has to succeed by hand first (clips_whop_submit) so we know the page works. Turning this on blind would fail silently every 20 minutes.';
    }
    await env.RAYVEN_KV.put(KV.auto, '1');
    return 'Automatic Whop submission is ON. Every new live post gets submitted within 20 minutes, one at a time. Say "stop submitting to whop" to turn it off.';
  }
  await env.RAYVEN_KV.delete(KV.auto);
  return 'Automatic Whop submission is OFF. Posts still publish; they just wait for you to submit them.';
}

// Cron. Does nothing at all unless Rayan has explicitly turned automation on
// AND a submission has already succeeded once.
export async function runWhopSubmitIfDue(env) {
  if ((await env.RAYVEN_KV.get(KV.auto)) !== '1') return null;
  const last = Number(await env.RAYVEN_KV.get(KV.last)) || 0;
  if (Date.now() - last < CYCLE_MS) return null;
  await env.RAYVEN_KV.put(KV.last, String(Date.now()));
  try { return await whopSubmitPending(env); }
  catch (err) { await env.RAYVEN_KV.put(KV.log, `cron error: ${err.message}`); return null; }
}
