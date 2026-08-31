// ---------------------------------------------------------------------------
// WORLD — outside data, no new secrets
// ---------------------------------------------------------------------------
// Every endpoint here was fetched live and its real response inspected before
// it was written in. Nothing is here on the strength of a listicle. The rule
// that shaped this file: a capability that needs an API key cannot live here,
// because there is nowhere in this Worker to put another secret without Rayan
// having to run a command for it -- so everything below is keyless and open.
//
// Two things that WILL bite if they are ever removed:
//   1. Workers send NO User-Agent by default. The SEC blocks that outright, and
//      several others rate-limit it harder. UA is set on every call below.
//   2. These are shared free endpoints. Answers are cached in KV so a chatty
//      day cannot walk into SEC's 10/sec or Mastodon's 300-per-5-minutes.

const UA = 'ASGARD-Assistant/1.0 (+rayanfahil2@gmail.com)';

async function grab(env, url, { ttl = 300, headers = {}, label = '' } = {}) {
  const key = `world:${url}`;
  if (ttl) {
    const hit = await env.RAYVEN_KV.get(key);
    if (hit) return { ok: true, text: hit, cached: true };
  }
  let res, text;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json', ...headers } });
    text = await res.text();
  } catch (err) {
    return { ok: false, text: `Could not reach ${label || url}: ${err.message}` };
  }
  if (!res.ok) return { ok: false, status: res.status, text: `${label || url} answered HTTP ${res.status}: ${text.slice(0, 300)}` };
  if (ttl) await env.RAYVEN_KV.put(key, text, { expirationTtl: ttl });
  return { ok: true, text };
}

function asJson(r) {
  if (!r.ok) return { error: r.text, status: r.status };
  try { return JSON.parse(r.text); } catch { return { error: `Unreadable reply: ${r.text.slice(0, 200)}` }; }
}

const num = (v, d = 2) => {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toFixed(d);
};

// --- video intelligence ----------------------------------------------------

function videoIdOf(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return u.pathname.slice(1, 12);
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const m = u.pathname.match(/\/(shorts|embed|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2];
  } catch {}
  return '';
}

export async function videoStats(env, { video } = {}) {
  const id = videoIdOf(video);
  if (!id) return 'Give me a YouTube link or an 11-character video id.';

  const meta = asJson(await grab(env, `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { ttl: 86400, label: 'YouTube oEmbed' }));
  const votes = asJson(await grab(env, `https://returnyoutubedislikeapi.com/votes?videoId=${id}`, { ttl: 3600, label: 'Return YouTube Dislike' }));

  const out = [];
  if (meta.error) out.push(`Could not read the title: ${meta.error}`);
  else out.push(`"${meta.title}" — ${meta.author_name}`);

  if (votes.error) out.push(`No engagement data: ${votes.error}`);
  else {
    const ratio = (votes.likes + votes.dislikes) ? (votes.likes / (votes.likes + votes.dislikes)) * 100 : 0;
    out.push(`${num(votes.viewCount, 0)} views · ${num(votes.likes, 0)} likes · ${num(votes.dislikes, 0)} dislikes · ${ratio.toFixed(1)}% positive`);
    // The judgement a clipper actually wants, stated rather than implied.
    if (votes.viewCount > 500000 && ratio > 90) out.push('Strong source — high reach and the audience liked it. Worth cutting.');
    else if (ratio < 70) out.push('Careful: the audience did not like this one. Clips of disliked content tend to inherit the sentiment.');
  }
  if (meta.thumbnail_url) out.push(meta.thumbnail_url);
  return out.join('\n');
}

export async function videoSegments(env, { video } = {}) {
  const id = videoIdOf(video);
  if (!id) return 'Give me a YouTube link or video id.';
  const r = await grab(env, `https://sponsor.ajay.app/api/skipSegments?videoID=${id}&category=sponsor&category=intro&category=outro&category=selfpromo&category=interaction`, { ttl: 86400, label: 'SponsorBlock' });
  // 404 from SponsorBlock means "nobody has submitted segments", not a failure.
  if (!r.ok && r.status === 404) return 'Nobody has marked up this video, so there is nothing to skip. Cut it by eye.';
  const data = asJson(r);
  if (data.error) return data.error;
  if (!Array.isArray(data) || !data.length) return 'No segments marked on this one.';
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const lines = data.slice(0, 20).map(s => `  ${fmt(s.segment[0])}–${fmt(s.segment[1])}  ${s.category}`);
  return [`Parts of this video worth skipping (crowd-marked), so you do not cut a clip that opens on a sponsor read:`, ...lines].join('\n');
}

// --- what is spiking right now ---------------------------------------------

export async function socialTrends(env, { where = 'all' } = {}) {
  const want = String(where || 'all').toLowerCase();
  const out = [];

  if (want === 'all' || want.includes('blue')) {
    const d = asJson(await grab(env, 'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=8', { ttl: 900, label: 'Bluesky' }));
    if (!d.error && Array.isArray(d.topics)) {
      out.push('BLUESKY — trending now:\n' + d.topics.map(t => `  ${t.displayName || t.topic}`).join('\n'));
    }
  }
  if (want === 'all' || want.includes('mast')) {
    const d = asJson(await grab(env, 'https://mastodon.social/api/v1/trends/tags?limit=8', { ttl: 900, label: 'Mastodon' }));
    if (Array.isArray(d)) {
      out.push('MASTODON — trending tags:\n' + d.map(t => {
        const uses = (t.history || []).slice(0, 2).reduce((a, h) => a + Number(h.uses || 0), 0);
        return `  #${t.name} — ${uses} posts in 48h`;
      }).join('\n'));
    }
  }
  if (want === 'all' || want.includes('music') || want.includes('song') || want.includes('audio')) {
    const d = asJson(await grab(env, 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json', { ttl: 21600, label: 'Apple Music charts' }));
    if (d.feed && Array.isArray(d.feed.results)) {
      out.push('TOP SONGS IN THE US right now — this is the audio people are already primed for:\n' +
        d.feed.results.map((s, i) => `  ${i + 1}. ${s.name} — ${s.artistName}`).join('\n'));
    }
  }
  if (want === 'all' || want.includes('tech') || want.includes('news') || want.includes('hn')) {
    const d = asJson(await grab(env, 'https://hn.algolia.com/api/v1/search_by_date?tags=front_page&hitsPerPage=6', { ttl: 900, label: 'Hacker News' }));
    if (Array.isArray(d.hits)) {
      out.push('HACKER NEWS front page:\n' + d.hits.map(h => `  ${h.title} (${h.points || 0} pts)`).join('\n'));
    }
  }
  return out.length ? out.join('\n\n') : 'Could not reach any of the trend sources just now.';
}

export async function newsSearch(env, { query, limit = 6 } = {}) {
  const q = String(query || '').trim();
  if (!q) return 'What should I search the news for?';
  const d = asJson(await grab(env, `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${Math.min(Number(limit) || 6, 15)}`, { ttl: 600, label: 'Hacker News search' }));
  if (d.error) return d.error;
  if (!d.hits || !d.hits.length) return `Nothing on Hacker News about "${q}".`;
  return d.hits.map(h => `${h.title}\n  ${h.points || 0} points, ${h.num_comments || 0} comments — ${h.url || 'https://news.ycombinator.com/item?id=' + h.objectID}`).join('\n\n');
}

// --- money -----------------------------------------------------------------

export async function cryptoPrice(env, { coin = 'bitcoin' } = {}) {
  const slugGuess = String(coin).toLowerCase().trim()
    .replace(/^btc$/, 'btc-bitcoin').replace(/^eth$/, 'eth-ethereum')
    .replace(/^sol$/, 'sol-solana').replace(/^doge$/, 'doge-dogecoin')
    .replace(/^bitcoin$/, 'btc-bitcoin').replace(/^ethereum$/, 'eth-ethereum')
    .replace(/^solana$/, 'sol-solana').replace(/^dogecoin$/, 'doge-dogecoin');
  const d = asJson(await grab(env, `https://api.coinpaprika.com/v1/tickers/${encodeURIComponent(slugGuess)}`, { ttl: 120, label: 'CoinPaprika' }));
  if (d.error) return `${d.error}\nCoinPaprika wants an id like btc-bitcoin or eth-ethereum.`;
  const q = (d.quotes && d.quotes.USD) || {};
  const fng = asJson(await grab(env, 'https://api.alternative.me/fng/?limit=1', { ttl: 3600, label: 'Fear & Greed' }));
  const mood = (!fng.error && fng.data && fng.data[0]) ? `\nMarket mood: ${fng.data[0].value}/100 — ${fng.data[0].value_classification}.` : '';
  return [
    `${d.name} (${d.symbol}) — $${num(q.price, 4)}`,
    `24h ${Number(q.percent_change_24h) >= 0 ? '+' : ''}${num(q.percent_change_24h)}% · 7d ${Number(q.percent_change_7d) >= 0 ? '+' : ''}${num(q.percent_change_7d)}%`,
    `Market cap $${num(q.market_cap, 0)} · 24h volume $${num(q.volume_24h, 0)} · rank #${d.rank}`
  ].join('\n') + mood;
}

export async function stockPrice(env, { ticker } = {}) {
  const t = String(ticker || '').toUpperCase().replace(/[^A-Z.\-]/g, '');
  if (!t) return 'Which ticker?';
  const d = asJson(await grab(env, `https://api.stockanalysis.com/api/quotes/s/${t}`, { ttl: 120, label: 'StockAnalysis' }));
  if (d.error) return `${d.error}\nThis one is an undocumented public endpoint, so it can change without notice — if it keeps failing, say so and it gets replaced rather than patched.`;
  const q = d.data || {};
  if (q.p == null) return `No price came back for ${t}. Check the ticker.`;
  const dir = Number(q.c) >= 0 ? '+' : '';
  return `${t} — $${num(q.p)} (${dir}${num(q.c)}, ${dir}${num(q.cp)}%)`;
}

export async function companyFilings(env, { ticker } = {}) {
  const t = String(ticker || '').toUpperCase().replace(/[^A-Z.\-]/g, '');
  if (!t) return 'Which company?';
  const map = asJson(await grab(env, 'https://www.sec.gov/files/company_tickers.json', { ttl: 604800, label: 'SEC ticker map' }));
  if (map.error) return map.error;
  const hit = Object.values(map).find(c => String(c.ticker).toUpperCase() === t);
  if (!hit) return `${t} is not in the SEC's company list — it may not be a US-listed company.`;
  const cik = String(hit.cik_str).padStart(10, '0');
  const sub = asJson(await grab(env, `https://data.sec.gov/submissions/CIK${cik}.json`, { ttl: 21600, label: 'SEC submissions' }));
  if (sub.error) return sub.error;
  const r = (sub.filings && sub.filings.recent) || {};
  const rows = [];
  for (let i = 0; i < Math.min(8, (r.form || []).length); i++) {
    rows.push(`  ${r.filingDate[i]}  ${r.form[i]}  ${String(r.primaryDocDescription?.[i] || '').slice(0, 40)}`);
  }
  return [`${sub.name} (${t}) — ${sub.sicDescription || 'no sector listed'}`, 'Most recent SEC filings:', ...rows,
    `Full record: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`].join('\n');
}

export async function tokenSearch(env, { query } = {}) {
  const q = String(query || '').trim();
  if (!q) return 'Which token or pair?';
  const d = asJson(await grab(env, `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { ttl: 120, label: 'DexScreener' }));
  if (d.error) return d.error;
  const pairs = (d.pairs || []).slice(0, 5);
  if (!pairs.length) return `Nothing on DexScreener for "${q}".`;
  return pairs.map(p =>
    `${p.baseToken.symbol}/${p.quoteToken.symbol} on ${p.dexId} (${p.chainId})\n` +
    `  $${p.priceUsd} · 24h ${p.priceChange?.h24 ?? '?'}% · liquidity $${num(p.liquidity?.usd, 0)} · vol $${num(p.volume?.h24, 0)}`
  ).join('\n\n');
}

// --- the day ---------------------------------------------------------------

export async function goldenHour(env, { place, lat, lng, date } = {}) {
  let la = lat, ln = lng, label = place || '';
  if ((la == null || ln == null) && place) {
    const g = asJson(await grab(env, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`, { ttl: 604800, label: 'geocoding' }));
    if (g.error || !g.results || !g.results.length) return `I could not find "${place}" on the map.`;
    la = g.results[0].latitude; ln = g.results[0].longitude;
    label = `${g.results[0].name}, ${g.results[0].country}`;
  }
  if (la == null || ln == null) return 'Give me a place name.';
  const d = asJson(await grab(env, `https://api.sunrisesunset.io/json?lat=${la}&lng=${ln}${date ? `&date=${encodeURIComponent(date)}` : ''}`, { ttl: 3600, label: 'SunriseSunset' }));
  if (d.error || !d.results) return d.error || 'No times came back.';
  const r = d.results;
  return [
    `${label || `${la}, ${ln}`}${date ? ` on ${date}` : ' today'}:`,
    `  first light ${r.first_light}   dawn ${r.dawn}`,
    `  sunrise ${r.sunrise}   solar noon ${r.solar_noon}`,
    `  GOLDEN HOUR ${r.golden_hour}`,
    `  sunset ${r.sunset}   dusk ${r.dusk}   last light ${r.last_light}`,
    `  day length ${r.day_length}`
  ].join('\n');
}

export async function airQuality(env, { place } = {}) {
  if (!place) return 'Which place?';
  const g = asJson(await grab(env, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`, { ttl: 604800, label: 'geocoding' }));
  if (g.error || !g.results || !g.results.length) return `I could not find "${place}".`;
  const p = g.results[0];
  const d = asJson(await grab(env, `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.latitude}&longitude=${p.longitude}&current=us_aqi,pm2_5,pm10,uv_index`, { ttl: 1800, label: 'Open-Meteo air quality' }));
  if (d.error || !d.current) return d.error || 'No air quality reading came back.';
  const c = d.current;
  const aqi = Number(c.us_aqi);
  const verdict = aqi <= 50 ? 'good' : aqi <= 100 ? 'moderate' : aqi <= 150 ? 'unhealthy for sensitive groups' : aqi <= 200 ? 'unhealthy' : 'very unhealthy';
  return `${p.name}, ${p.country} — AQI ${c.us_aqi} (${verdict})\n  PM2.5 ${c.pm2_5} · PM10 ${c.pm10} · UV index ${c.uv_index}`;
}

export async function earthquakes(env, { minMagnitude = 4.5, limit = 6 } = {}) {
  const d = asJson(await grab(env, `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=${Math.min(Number(limit) || 6, 20)}&minmagnitude=${Number(minMagnitude) || 4.5}&orderby=time`, { ttl: 900, label: 'USGS' }));
  if (d.error) return d.error;
  if (!d.features || !d.features.length) return 'Nothing above that magnitude recently.';
  return d.features.map(f => {
    const p = f.properties;
    return `M${p.mag} — ${p.place}\n  ${new Date(p.time).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  }).join('\n');
}

// --- language and links ----------------------------------------------------

export async function wordIdeas(env, { seed, kind = 'related', limit = 12 } = {}) {
  const s = String(seed || '').trim();
  if (!s) return 'Give me a word or phrase to riff on.';
  const k = String(kind).toLowerCase();
  const param = k.startsWith('rhy') ? 'rel_rhy' : k.startsWith('syn') ? 'ml' : k.startsWith('sound') ? 'sl' : 'ml';
  const d = asJson(await grab(env, `https://api.datamuse.com/words?${param}=${encodeURIComponent(s)}&max=${Math.min(Number(limit) || 12, 30)}`, { ttl: 86400, label: 'Datamuse' }));
  if (d.error) return d.error;
  if (!Array.isArray(d) || !d.length) return `Nothing came back for "${s}".`;
  return `${k} to "${s}":\n  ${d.map(w => w.word).join(', ')}`;
}

export async function shortLink(env, { url } = {}) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return 'Give me a full http(s) link to shorten.';
  const d = asJson(await grab(env, `https://is.gd/create.php?format=json&url=${encodeURIComponent(u)}`, { ttl: 0, label: 'is.gd' }));
  if (d.error) return d.error;
  if (d.errormessage) return `is.gd refused: ${d.errormessage}`;
  return d.shorturl || 'No short link came back.';
}

export async function pageHistory(env, { url, when } = {}) {
  const u = String(url || '').trim();
  if (!u) return 'Which page?';
  const d = asJson(await grab(env, `https://archive.org/wayback/available?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}${when ? `&timestamp=${encodeURIComponent(when)}` : ''}`, { ttl: 3600, label: 'Wayback' }));
  if (d.error) return d.error;
  const snap = d.archived_snapshots && d.archived_snapshots.closest;
  if (!snap || !snap.available) return 'The archive has no snapshot of that page.';
  return `Archived ${snap.timestamp.slice(0, 4)}-${snap.timestamp.slice(4, 6)}-${snap.timestamp.slice(6, 8)}:\n${snap.url}`;
}

export async function socialProfile(env, { handle } = {}) {
  const h = String(handle || '').trim().replace(/^@/, '');
  if (!h) return 'Which Bluesky handle?';
  const actor = h.includes('.') ? h : `${h}.bsky.social`;
  const p = asJson(await grab(env, `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, { ttl: 1800, label: 'Bluesky profile' }));
  if (p.error) return p.error;
  const feed = asJson(await grab(env, `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=5`, { ttl: 900, label: 'Bluesky feed' }));
  const posts = (!feed.error && Array.isArray(feed.feed)) ? feed.feed.slice(0, 5).map(f => {
    const r = f.post;
    return `  "${String(r.record?.text || '').replace(/\s+/g, ' ').slice(0, 80)}" — ${r.likeCount || 0} likes, ${r.repostCount || 0} reposts`;
  }) : [];
  return [
    `${p.displayName || actor} (@${p.handle})`,
    `  ${num(p.followersCount, 0)} followers · ${num(p.postsCount, 0)} posts`,
    p.description ? `  ${String(p.description).replace(/\s+/g, ' ').slice(0, 160)}` : '',
    posts.length ? '\nRecent, with how they landed:' : '',
    ...posts
  ].filter(Boolean).join('\n');
}
