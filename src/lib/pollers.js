// THE POLLERS (asgard-upgrade Phase 7.13a). One duty per event kind, at { every: 15 },
// seen-state in that councillor's own state key, written only on a new hit (Rule 5c).
// A poller makes NO subrequest unless at least one ENABLED routine subscribes to its
// event -- so an idle house costs nothing. Sylvie: weather.alert, fire.incident, quake.
// Odin's court: market.move, sentiment.extreme, yield.cross. Kang: trend.new, feed.new.
import { emit } from './events.js';
import { readCouncilState, recordCouncilRun } from './council.js';
import { readRoutinesIndex, readRoutineRaw } from './routines.js';
import { httpJson, httpGet, parseFeed } from './http.js';
import { CATALOG } from '../tools/catalog.js';

const EVERY_MS = 15 * 60000;
const BAK = { lat: 35.3733, lon: -119.0187 };
const miles = (a, b, c, d) => { const R = 3958.8, dLat = (c - a) * Math.PI / 180, dLon = (d - b) * Math.PI / 180, x = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// Which event kinds have at least one enabled routine listening (one index read + a routine read per enabled event routine).
async function subscribedKinds(env) {
  const kinds = new Set();
  try {
    const idx = await readRoutinesIndex(env);
    for (const e of idx) { if (e.enabled === false || e.deleted) continue; const r = await readRoutineRaw(env, e.id); if (r && r.enabled !== false && !r.deleted && r.trigger && r.trigger.kind === 'event') kinds.add(r.trigger.event); }
  } catch (e) {}
  return kinds;
}
const due = (state, key) => !state[key] || Date.now() - state[key] >= EVERY_MS - 15000;

export async function runPollersIfDue(env) {
  const kinds = await subscribedKinds(env);
  if (!kinds.size) return { ok: true, skipped: 'no enabled routine subscribes to a polled event' };
  const out = [];
  // ---- Sylvie: weather.alert, fire.incident, quake
  if (['weather.alert', 'fire.incident', 'quake'].some(k => kinds.has(k))) {
    const st = await readCouncilState(env, 'sylvie'); const seen = st.pollers || {}; let hit = false; const patch = { pollers: { ...seen } };
    if (kinds.has('weather.alert') && due(seen, 'weatherAt')) {
      patch.pollers.weatherAt = Date.now();
      const r = await httpJson(env, `https://api.weather.gov/alerts/active?point=${BAK.lat},${BAK.lon}`, { accept: 'application/geo+json, application/json' });
      if (r.ok) { const ids = new Set(seen.weatherIds || []); const now = []; for (const f of (r.json || {}).features || []) { const p = f.properties || {}; now.push(f.id); if (!ids.has(f.id)) { hit = true; emit('weather.alert', { id: f.id, event: p.event, severity: p.severity, headline: p.headline, areas: p.areaDesc, ends: p.ends }); } } patch.pollers.weatherIds = now.slice(-50); }
    }
    if (kinds.has('fire.incident') && due(seen, 'fireAt')) {
      patch.pollers.fireAt = Date.now();
      const r = await httpJson(env, `https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?year=${new Date().getFullYear()}`);
      if (r.ok && Array.isArray(r.json)) { const ids = new Set(seen.fireIds || []); const now = []; for (const x of r.json) { if (x.IsActive === false) continue; now.push(x.UniqueId); const d = (x.Latitude && x.Longitude) ? miles(BAK.lat, BAK.lon, Number(x.Latitude), Number(x.Longitude)) : null; if (!ids.has(x.UniqueId) && d != null && d <= 50) { hit = true; emit('fire.incident', { id: x.UniqueId, name: x.Name, county: x.County, acres: x.AcresBurned, containment: x.PercentContained, distanceMiles: Math.round(d), url: x.Url }); } } patch.pollers.fireIds = now.slice(-200); }
    }
    if (kinds.has('quake') && due(seen, 'quakeAt')) {
      patch.pollers.quakeAt = Date.now();
      const r = await httpJson(env, `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}&minmagnitude=4&latitude=${BAK.lat}&longitude=${BAK.lon}&maxradiuskm=161&limit=20`);
      if (r.ok) { const ids = new Set(seen.quakeIds || []); const now = []; for (const f of (r.json || {}).features || []) { now.push(f.id); if (!ids.has(f.id)) { hit = true; const p = f.properties, [lon, lat] = f.geometry.coordinates; emit('quake', { id: f.id, mag: p.mag, place: p.place, time: new Date(p.time).toISOString(), distanceMiles: Math.round(miles(BAK.lat, BAK.lon, lat, lon)) }); } } patch.pollers.quakeIds = now.slice(-50); }
    }
    if (hit) await recordCouncilRun(env, 'sylvie', { summary: 'Poller: new weather/fire/quake event', didSomething: true, patch }); else if (JSON.stringify(patch.pollers) !== JSON.stringify(seen)) { /* only timestamps changed: no write (Rule 5c) */ }
    out.push('sylvie');
  }
  // ---- Odin's court: market.move (BTC 24h ≥ 5%), sentiment.extreme, yield.cross (level from config:yield:level)
  if (['market.move', 'sentiment.extreme', 'yield.cross'].some(k => kinds.has(k))) {
    const st = await readCouncilState(env, 'fandral'); const seen = st.pollers || {}; let hit = false; const patch = { pollers: { ...seen } };
    if (kinds.has('market.move') && due(seen, 'marketAt')) {
      patch.pollers.marketAt = Date.now();
      const r = await httpJson(env, 'https://api.coinbase.com/v2/prices/BTC-USD/spot');
      const price = r.ok && r.json && r.json.data ? Number(r.json.data.amount) : null;
      if (price) { const ref = seen.btcRef || { price, at: Date.now() }; const age = Date.now() - ref.at; const change = (price - ref.price) / ref.price * 100; if (age >= 86400000) patch.pollers.btcRef = { price, at: Date.now() }; else patch.pollers.btcRef = ref; if (Math.abs(change) >= 5 && (!seen.lastMoveAt || Date.now() - seen.lastMoveAt > 6 * 3600000)) { hit = true; patch.pollers.lastMoveAt = Date.now(); emit('market.move', { symbol: 'BTC', price, changePct: Math.round(change * 10) / 10, sinceHours: Math.round(age / 3600000) }); } }
    }
    if (kinds.has('sentiment.extreme') && due(seen, 'fngAt')) {
      patch.pollers.fngAt = Date.now();
      const r = await httpJson(env, 'https://api.alternative.me/fng/?limit=1');
      const d = r.ok ? (((r.json || {}).data || [])[0] || null) : null;
      if (d) { const v = Number(d.value); const extreme = v <= 20 || v >= 80; if (extreme && seen.fngLastExtremeDay !== d.timestamp) { hit = true; patch.pollers.fngLastExtremeDay = d.timestamp; emit('sentiment.extreme', { value: v, label: d.value_classification }); } }
    }
    if (kinds.has('yield.cross') && due(seen, 'yieldAt')) {
      patch.pollers.yieldAt = Date.now();
      const levelRaw = await env.RAYVEN_KV.get('config:yield:level').catch(() => null); const level = Number(levelRaw);
      if (isFinite(level) && level > 0 && CATALOG.treasury_yields) { const txt = await CATALOG.treasury_yields.run(env, {}); const m = /10 yr ([\d.]+)%/.exec(txt); if (m) { const v = Number(m[1]); const prev = seen.yieldPrev; if (prev != null && ((prev < level && v >= level) || (prev > level && v <= level))) { hit = true; emit('yield.cross', { level, value: v, previous: prev }); } patch.pollers.yieldPrev = v; } }
    }
    if (hit) await recordCouncilRun(env, 'fandral', { summary: 'Poller: market / sentiment / yield event', didSomething: true, patch });
    out.push('odin-court');
  }
  // ---- Kang: trend.new, feed.new (feeds from rss_watch in Kang's state)
  if (['trend.new', 'feed.new'].some(k => kinds.has(k))) {
    const st = await readCouncilState(env, 'kang'); const seen = st.pollers || {}; let hit = false; const patch = { pollers: { ...seen } };
    if (kinds.has('trend.new') && due(seen, 'trendAt')) {
      patch.pollers.trendAt = Date.now();
      const r = await httpGet(env, 'https://trends.google.com/trending/rss?geo=US', { accept: 'application/rss+xml, */*' });
      if (r.ok) { const feed = parseFeed(r.text, 20); const known = new Set(seen.trendTitles || []); const now = []; for (const it of feed.items) { now.push(it.title); if (!known.has(it.title)) { hit = true; emit('trend.new', { title: it.title, link: it.link }); } } patch.pollers.trendTitles = now.slice(0, 40); }
    }
    if (kinds.has('feed.new') && due(seen, 'feedAt')) {
      patch.pollers.feedAt = Date.now();
      const feeds = Array.isArray(st.feeds) ? st.feeds : [];
      for (const f of feeds.slice(0, 10)) { const r = await httpGet(env, f.url, { accept: 'application/rss+xml, application/atom+xml, */*' }); if (!r.ok) continue; const feed = parseFeed(r.text, 10); const known = new Set(f.seen || []); const ids = feed.items.map(i => i.link || i.title); for (const it of feed.items) { const id = it.link || it.title; if (!known.has(id)) { hit = true; emit('feed.new', { feed: feed.title || f.url, url: f.url, title: it.title, link: it.link, date: it.date }); } } f.seen = ids.slice(0, 40); }
      if (hit) patch.feeds = feeds;
    }
    if (hit) await recordCouncilRun(env, 'kang', { summary: 'Poller: new trend / feed item', didSomething: true, patch });
    out.push('kang');
  }
  return { ok: true, polled: out };
}
