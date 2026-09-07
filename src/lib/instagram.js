// ===========================================================================
// INSTAGRAM DIRECT — free, public, no App Review, forever.
//
// Instagram is the one network of the three that lets you publish PUBLICLY to
// accounts you own using your own app, with no audit. Meta grants Standard
// Access automatically: "If your app only serves your Instagram professional
// account or an account you manage, Standard Access is all your app needs."
//
// TikTok and YouTube do not work this way and there is no trick that makes them.
// TikTok forces unaudited clients to SELF_ONLY; YouTube locks uploads from
// unverified projects to private with no appeal. Those two need a rented,
// audited client. This one does not, so it costs nothing and keeps working after
// any trial ends.
//
// Requirements per account: Instagram Professional (Business or Creator), and
// the managing user holds a role on your Meta app.
//
// Publishing is two-step and asynchronous — create a container, wait for Meta to
// finish transcoding, then publish. Anyone who treats it as one call gets
// intermittent failures on longer videos.
// ===========================================================================

const HOST = 'https://graph.instagram.com';
const VERSION = 'v25.0';
const KV_ACCOUNTS = 'ig:accounts';        // [{ name, igId, token, expires }]
const KV_REFRESHED = 'ig:last_refresh';

const CONTAINER_POLL_MS = 4000;
const CONTAINER_MAX_WAIT_MS = 150000;     // Reels transcode is slow; be patient

async function igGet(path, params) {
  const url = new URL(`${HOST}/${VERSION}/${path}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${path} ${res.status}: ${JSON.stringify(data).slice(0, 220)}`);
  return data;
}
async function igPost(path, params) {
  const url = new URL(`${HOST}/${VERSION}/${path}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${path} ${res.status}: ${JSON.stringify(data).slice(0, 220)}`);
  return data;
}

async function readAccounts(env) {
  try { const raw = await env.RAYVEN_KV.get(KV_ACCOUNTS); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
async function writeAccounts(env, list) {
  await env.RAYVEN_KV.put(KV_ACCOUNTS, JSON.stringify(list));
}

// ---------------------------------------------------------------------------
// ACCOUNTS
// ---------------------------------------------------------------------------
export async function igAddAccount(env, { name, igId, token }) {
  if (!name || !igId || !token) {
    return 'Need three things: a name to call it, the Instagram user id, and a long-lived access token.';
  }
  // Prove it works now rather than at 3am on the first cron run.
  let handle = null;
  try {
    const me = await igGet(`${igId}`, { fields: 'username', access_token: token });
    handle = me.username || null;
  } catch (err) {
    return `That token did not work: ${err.message}`;
  }
  const list = await readAccounts(env);
  const existing = list.findIndex(a => a.name === name || a.igId === String(igId));
  const entry = { name, igId: String(igId), token, handle, addedAt: new Date().toISOString() };
  if (existing >= 0) list[existing] = entry; else list.push(entry);
  await writeAccounts(env, list);
  return `Connected @${handle} as "${name}". ${list.length} Instagram account(s) ready.`;
}

export async function igListAccounts(env) {
  const list = await readAccounts(env);
  if (!list.length) return 'No Instagram accounts connected yet.';
  const lines = [];
  for (const a of list) {
    let left = '';
    try {
      const lim = await igGet(`${a.igId}/content_publishing_limit`, { fields: 'config,quota_usage', access_token: a.token });
      const used = lim.data && lim.data[0] ? lim.data[0].quota_usage : null;
      const cap = lim.data && lim.data[0] && lim.data[0].config ? lim.data[0].config.quota_total : null;
      if (used !== null) left = ` — ${used}${cap ? `/${cap}` : ''} posts used in the last 24h`;
    } catch (e) { left = ' — could not read its quota (token may need refreshing)'; }
    lines.push(`${a.name}: @${a.handle || a.igId}${left}`);
  }
  return lines.join('\n');
}

export async function igRemoveAccount(env, { name }) {
  const list = await readAccounts(env);
  const next = list.filter(a => a.name !== name);
  if (next.length === list.length) return `Nothing connected under "${name}".`;
  await writeAccounts(env, next);
  return `Removed "${name}". ${next.length} left.`;
}

// ---------------------------------------------------------------------------
// PUBLISH
// ---------------------------------------------------------------------------
async function publishToAccount(env, account, { videoUrl, caption }) {
  const container = await igPost(`${account.igId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: (caption || '').slice(0, 2200),
    access_token: account.token
  });
  if (!container.id) throw new Error('Instagram accepted the request but returned no container id.');

  // Wait for the transcode. Publishing before FINISHED fails, and the failure
  // reads as a permissions problem, which sends you looking in the wrong place.
  const deadline = Date.now() + CONTAINER_MAX_WAIT_MS;
  let status = 'IN_PROGRESS';
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, CONTAINER_POLL_MS));
    const s = await igGet(`${container.id}`, { fields: 'status_code,status', access_token: account.token });
    status = s.status_code || 'IN_PROGRESS';
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram could not process the video (${status}): ${s.status || 'no detail given'}`);
    }
  }
  if (status !== 'FINISHED') throw new Error('Instagram was still transcoding after two and a half minutes. The video may be too long or too large.');

  const published = await igPost(`${account.igId}/media_publish`, {
    creation_id: container.id,
    access_token: account.token
  });
  return published.id || 'published';
}

export async function igPublish(env, { videoUrl, caption, account }) {
  const list = await readAccounts(env);
  if (!list.length) return 'No Instagram accounts connected. Use ig_add_account first.';
  if (!videoUrl) return 'Need a public https URL to the video.';
  const targets = account ? list.filter(a => a.name === account) : list;
  if (!targets.length) return `No account called "${account}".`;

  const results = [];
  for (const a of targets) {
    try {
      const id = await publishToAccount(env, a, { videoUrl, caption });
      results.push(`${a.name} (@${a.handle || a.igId}): posted, id ${id}`);
    } catch (err) {
      results.push(`${a.name}: FAILED — ${err.message}`);
    }
  }
  return results.join('\n');
}

// ---------------------------------------------------------------------------
// TOKEN REFRESH — the thing that silently kills this in 60 days
//
// Long-lived Instagram tokens last 60 days. Without refreshing, everything works
// perfectly for two months and then stops with an auth error nobody is expecting.
// Refreshed weekly on the cron; a token must be at least 24 hours old to refresh.
// ---------------------------------------------------------------------------
export async function igRefreshTokens(env, { force } = {}) {
  const list = await readAccounts(env);
  if (!list.length) return 'No Instagram accounts to refresh.';
  const results = [];
  for (const a of list) {
    try {
      const r = await igGet('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: a.token });
      if (r.access_token) {
        a.token = r.access_token;
        a.expires = Date.now() + (Number(r.expires_in) || 5184000) * 1000;
        results.push(`${a.name}: refreshed, good for ~${Math.round((Number(r.expires_in) || 5184000) / 86400)} days`);
      } else {
        results.push(`${a.name}: no new token returned`);
      }
    } catch (err) {
      results.push(`${a.name}: refresh failed — ${err.message}`);
    }
  }
  await writeAccounts(env, list);
  await env.RAYVEN_KV.put(KV_REFRESHED, String(Date.now()));
  return results.join('\n');
}

export async function igRefreshIfDue(env) {
  const last = Number(await env.RAYVEN_KV.get(KV_REFRESHED)) || 0;
  if (Date.now() - last < 7 * 864e5) return null;
  const list = await readAccounts(env);
  if (!list.length) { await env.RAYVEN_KV.put(KV_REFRESHED, String(Date.now())); return null; }
  return await igRefreshTokens(env, {});
}
