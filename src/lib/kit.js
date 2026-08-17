// ===========================================================================
// THE KIT — the ordinary competences an assistant is expected to have.
//
// Everything here runs on what ASGARD already pays for: the Workers AI binding,
// KV, R2, and a handful of public APIs that need no key and no signup. Nothing
// in this file adds a subscription, and nothing in it needs Rayan to register
// for anything. That constraint is the whole point — every capability that
// costs a monthly fee is one more thing that can silently lapse and take a
// feature down with it six weeks later.
//
// Sources used, all keyless:
//   Open-Meteo      weather + geocoding      (no key, non-commercial)
//   Wikipedia REST  summaries                (no key)
//   dictionaryapi   definitions              (no key)
//   Frankfurter     currency, ECB reference  (no key)
//   Nager.Date      public holidays          (no key)
// ===========================================================================

import { notify } from './notifications.js';

const KV = { timers: 'kit:timers' };

// R2 holds anything we generate that needs a URL — images today, rendered clips
// later. The public base is the bucket's dev URL; override it with a secret if
// a custom domain ever goes in front of the bucket.
const R2_PUBLIC = 'https://pub-772ecf10131b467a9a78ef8842e1242e.r2.dev';
function publicBase(env) { return (env.R2_PUBLIC_BASE || R2_PUBLIC).replace(/\/+$/, ''); }

async function readJson(env, key, fallback) {
  try { const raw = await env.RAYVEN_KV.get(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
async function writeJson(env, key, value) {
  await env.RAYVEN_KV.put(key, JSON.stringify(value));
}

async function getJson(url, label) {
  const res = await fetch(url, { headers: { 'user-agent': 'ASGARD/1.0 (personal assistant)' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} returned ${res.status}: ${text.slice(0, 140)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`${label} sent something that was not JSON: ${text.slice(0, 140)}`); }
}

// ---------------------------------------------------------------------------
// WORKERS AI — image, speech, translation, condensing
// ---------------------------------------------------------------------------
export async function makeImage(env, { prompt, name } = {}) {
  const p = String(prompt || '').trim();
  if (!p) return 'Describe the image you want.';
  if (!env.AI) return 'The Workers AI binding is missing from wrangler.toml.';

  let out;
  try {
    out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt: p.slice(0, 2048),
      steps: 6                       // ceiling is 8; 6 is the quality/latency knee
    });
  } catch (err) { return `The image model refused that: ${err.message}`; }
  if (!out || !out.image) return 'The model returned nothing. Try rewording the prompt.';

  // Base64 → bytes. Uint8Array.from over the binary string is the documented
  // route and avoids building a second intermediate array.
  const bytes = Uint8Array.from(atob(out.image), c => c.charCodeAt(0));

  if (!env.CLIPS) {
    return `Made it, but there is nowhere to put it — the R2 binding "CLIPS" is not in wrangler.toml, so I cannot give you a link. ${Math.round(bytes.length / 1024)} KB generated.`;
  }
  const slug = (name || p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'image';
  const key = `made/${slug}-${Math.abs(hashString(p + bytes.length)).toString(36)}.jpg`;
  try { await env.CLIPS.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } }); }
  catch (err) { return `Made the image but could not store it: ${err.message}`; }
  return `${publicBase(env)}/${key}`;
}

export async function transcribe(env, { audioUrl } = {}) {
  const url = String(audioUrl || '').trim();
  if (!/^https:\/\//i.test(url)) return 'Give me a public https link to the audio or video file.';
  if (!env.AI) return 'The Workers AI binding is missing from wrangler.toml.';
  let bytes;
  try {
    const res = await fetch(url);
    if (!res.ok) return `Could not fetch that file — HTTP ${res.status}.`;
    const buf = await res.arrayBuffer();
    // Workers have a hard memory ceiling; a long video will blow it and the
    // failure looks like the Worker simply dying, so refuse it explicitly.
    if (buf.byteLength > 24 * 1024 * 1024) return `That file is ${Math.round(buf.byteLength / 1048576)} MB. Anything over about 24 MB will kill the Worker mid-request — trim it or pull the audio track out first.`;
    bytes = [...new Uint8Array(buf)];
  } catch (err) { return `Could not fetch that file: ${err.message}`; }

  try {
    const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: bytes });
    const text = (out && (out.text || out.transcription)) || '';
    return text ? text.trim() : 'Nothing came back — there may be no speech in that file.';
  } catch (err) { return `Transcription failed: ${err.message}`; }
}

export async function translate(env, { text, to, from } = {}) {
  const t = String(text || '').trim();
  if (!t) return 'Give me something to translate.';
  if (!to) return 'Tell me which language to translate into.';
  if (!env.AI) return 'The Workers AI binding is missing from wrangler.toml.';
  try {
    const out = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: t.slice(0, 4000),
      source_lang: (from || 'en').toLowerCase().slice(0, 5),
      target_lang: String(to).toLowerCase().slice(0, 5)
    });
    return (out && out.translated_text) || 'The model returned nothing.';
  } catch (err) { return `Translation failed: ${err.message}. Language codes are two letters — en, es, fr, ar, ja.`; }
}

export async function condense(env, { text, words } = {}) {
  const t = String(text || '').trim();
  if (t.length < 240) return 'That is already short enough to just read.';
  if (!env.AI) return 'The Workers AI binding is missing from wrangler.toml.';
  try {
    const out = await env.AI.run('@cf/facebook/bart-large-cnn', {
      input_text: t.slice(0, 12000),
      max_length: Math.min(Math.max(Number(words) || 120, 30), 400)
    });
    return (out && out.summary) || 'The model returned nothing.';
  } catch (err) { return `Could not condense that: ${err.message}`; }
}

// ---------------------------------------------------------------------------
// WEATHER — Open-Meteo, no key
// ---------------------------------------------------------------------------
const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow',
  77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers',
  85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorms',
  96: 'thunderstorms with hail', 99: 'thunderstorms with heavy hail'
};

export async function weather(env, { place, days } = {}) {
  const q = String(place || '').trim();
  if (!q) return 'Which place?';
  let geo;
  try { geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`, 'Geocoding'); }
  catch (err) { return `Could not look that place up: ${err.message}`; }
  const hit = geo && geo.results && geo.results[0];
  if (!hit) return `No place called "${q}". Try adding the country.`;

  const n = Math.min(Math.max(Number(days) || 3, 1), 7);
  let w;
  try {
    w = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&forecast_days=${n}&timezone=auto`, 'Weather');
  } catch (err) { return `Could not get the forecast: ${err.message}`; }

  const where = [hit.name, hit.admin1, hit.country].filter(Boolean).join(', ');
  const c = w.current || {};
  const lines = [
    `${where} — right now ${Math.round(c.temperature_2m)}°C (feels ${Math.round(c.apparent_temperature)}°C), ${WMO[c.weather_code] || 'unclear'}, wind ${Math.round(c.wind_speed_10m)} km/h, humidity ${c.relative_humidity_2m}%.`
  ];
  const d = w.daily || {};
  for (let i = 0; i < (d.time || []).length; i++) {
    const day = i === 0 ? 'Today' : new Date(d.time[i] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
    const rain = d.precipitation_probability_max?.[i];
    lines.push(`  ${day}: ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C, ${WMO[d.weather_code[i]] || '—'}${rain != null ? `, ${rain}% chance of rain` : ''}`);
  }
  if (d.sunrise && d.sunset) lines.push(`  Sun: up ${String(d.sunrise[0]).slice(11, 16)}, down ${String(d.sunset[0]).slice(11, 16)}.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// REFERENCE — Wikipedia, dictionary, currency, holidays
// ---------------------------------------------------------------------------
export async function lookUp(env, { subject } = {}) {
  const q = String(subject || '').trim();
  if (!q) return 'Look up what?';
  try {
    const d = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g, '_'))}?redirect=true`, 'Wikipedia');
    if (d.type === 'disambiguation') return `"${q}" points at several things. Be more specific.`;
    if (!d.extract) return `Nothing on Wikipedia for "${q}".`;
    return `${d.title} — ${d.extract}\n${d.content_urls?.desktop?.page || ''}`.trim();
  } catch (err) {
    if (/404/.test(err.message)) return `Nothing on Wikipedia for "${q}".`;
    return `Wikipedia lookup failed: ${err.message}`;
  }
}

export async function define(env, { word } = {}) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return 'Define what?';
  let d;
  try { d = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, 'Dictionary'); }
  catch (err) { return /404/.test(err.message) ? `No dictionary entry for "${w}".` : `Dictionary lookup failed: ${err.message}`; }
  const entry = Array.isArray(d) && d[0];
  if (!entry) return `No dictionary entry for "${w}".`;
  const out = [entry.word + (entry.phonetic ? `  ${entry.phonetic}` : '')];
  for (const m of (entry.meanings || []).slice(0, 3)) {
    out.push(`  ${m.partOfSpeech}`);
    for (const s of (m.definitions || []).slice(0, 2)) {
      out.push(`    ${s.definition}`);
      if (s.example) out.push(`      "${s.example}"`);
    }
  }
  return out.join('\n');
}

export async function convertMoney(env, { amount, from, to } = {}) {
  const amt = Number(amount);
  if (!isFinite(amt)) return 'How much?';
  const f = String(from || '').toUpperCase().slice(0, 3);
  const t = String(to || '').toUpperCase().slice(0, 3);
  if (f.length !== 3 || t.length !== 3) return 'Give me three-letter currency codes, like USD and EUR.';
  if (f === t) return `${amt} ${f} is ${amt} ${t}. Same currency.`;
  try {
    const d = await getJson(`https://api.frankfurter.app/latest?amount=${encodeURIComponent(amt)}&from=${f}&to=${t}`, 'Frankfurter');
    const v = d.rates && d.rates[t];
    if (v == null) return `No rate for ${f} to ${t}. These are European Central Bank reference rates — they cover the major currencies, not crypto.`;
    return `${amt.toLocaleString()} ${f} = ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t}  (ECB rate, ${d.date})`;
  } catch (err) { return `Currency lookup failed: ${err.message}`; }
}

export async function holidays(env, { country, year } = {}) {
  const c = String(country || 'US').toUpperCase().slice(0, 2);
  const y = Number(year) || new Date().getFullYear();
  let d;
  try { d = await getJson(`https://date.nager.at/api/v3/PublicHolidays/${y}/${c}`, 'Holidays'); }
  catch (err) { return `Could not get holidays for ${c}: ${err.message}`; }
  if (!Array.isArray(d) || !d.length) return `No holiday data for ${c} in ${y}.`;
  const today = new Date().toISOString().slice(0, 10);
  const ahead = d.filter(h => h.date >= today).slice(0, 12);
  const list = (ahead.length ? ahead : d.slice(0, 12));
  return `${ahead.length ? 'Coming up' : `All of ${y}`} in ${c}:\n` + list.map(h => {
    const days = Math.round((new Date(h.date) - new Date(today)) / 864e5);
    return `  ${h.date} — ${h.localName}${h.localName !== h.name ? ` (${h.name})` : ''}${days > 0 ? `, in ${days} day${days === 1 ? '' : 's'}` : ''}`;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// TIMERS — the cron fires them
// ---------------------------------------------------------------------------
function parseDuration(s) {
  const str = String(s || '').toLowerCase().trim();
  const asNumber = Number(str);
  if (isFinite(asNumber) && asNumber > 0) return asNumber * 60000;   // bare number means minutes
  let ms = 0, found = false;
  const re = /(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?|d(?:ays?)?)/g;
  let m;
  while ((m = re.exec(str))) {
    const n = parseFloat(m[1]); const u = m[2][0];
    ms += n * (u === 'h' ? 3600000 : u === 'm' ? 60000 : u === 'd' ? 86400000 : 1000);
    found = true;
  }
  return found ? ms : 0;
}

export async function setTimer(env, { duration, label } = {}) {
  const ms = parseDuration(duration);
  if (!ms) return 'How long? Say something like "25 minutes", "1h30m", or just a number of minutes.';
  if (ms < 60000) return 'The cron only wakes every five minutes, so anything under a minute would be a lie. Use a phone timer for those.';
  if (ms > 30 * 86400000) return 'Thirty days is the ceiling for a timer. Put it in the calendar instead.';

  const timers = await readJson(env, KV.timers, []);
  if (timers.length >= 30) return 'Thirty timers is plenty. Cancel some first.';
  const id = Math.abs(hashString(`${Date.now()}:${label || ''}:${ms}`)).toString(36).slice(0, 6);
  const dueAt = Date.now() + ms;
  timers.push({ id, label: String(label || 'Timer').slice(0, 120), dueAt, setAt: Date.now() });
  await writeJson(env, KV.timers, timers);
  return `Timer set — "${label || 'Timer'}" in ${humanMs(ms)}, at ${new Date(dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Reference ${id}.\nI check every five minutes, so it may land up to five minutes late — that is the resolution of the whole system, not a bug in this.`;
}

export async function listTimers(env) {
  const timers = await readJson(env, KV.timers, []);
  if (!timers.length) return 'No timers running.';
  const now = Date.now();
  return timers.sort((a, b) => a.dueAt - b.dueAt).map(t =>
    `  ${t.id} — "${t.label}" in ${humanMs(Math.max(0, t.dueAt - now))}`).join('\n');
}

export async function cancelTimer(env, { id, label } = {}) {
  const timers = await readJson(env, KV.timers, []);
  const before = timers.length;
  const kept = timers.filter(t =>
    !(id && t.id === String(id).toLowerCase()) &&
    !(label && t.label.toLowerCase().includes(String(label).toLowerCase())));
  if (kept.length === before) return 'Nothing matched that.';
  await writeJson(env, KV.timers, kept);
  return `Cancelled ${before - kept.length}. ${kept.length} still running.`;
}

export async function runTimersIfDue(env) {
  const timers = await readJson(env, KV.timers, []);
  if (!timers.length) return null;
  const now = Date.now();
  const due = timers.filter(t => t.dueAt <= now);
  if (!due.length) return null;
  await writeJson(env, KV.timers, timers.filter(t => t.dueAt > now));
  for (const t of due) {
    await notify(env, {
      source: 'timer', priority: 'high',
      title: t.label,
      body: `${t.label} — that is your ${humanMs(t.dueAt - t.setAt)} timer.`,
      dedupeKey: `timer:${t.id}`, cooldownMinutes: 0
    });
  }
  return `Fired ${due.length} timer(s).`;
}

// ---------------------------------------------------------------------------
// LOCAL — maths, time, chance
// ---------------------------------------------------------------------------
// A real parser rather than eval. Workers block eval outright, and even where
// they do not, handing arbitrary text to it in a process holding every one of
// Rayan's API keys is not a trade worth making for a calculator.
const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor,
  ceil: Math.ceil, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin,
  acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, log2: Math.log2,
  exp: Math.exp, sign: Math.sign
};

function evaluate(src) {
  const s = String(src).replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**');
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const eat = (tok) => { ws(); if (s.startsWith(tok, i)) { i += tok.length; return true; } return false; };

  function primary() {
    ws();
    if (eat('(')) { const v = expr(); if (!eat(')')) throw new Error('missing a closing bracket'); return v; }
    if (eat('-')) return -primary();
    if (eat('+')) return primary();
    const word = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i));
    if (word) {
      const name = word[0].toLowerCase();
      i += word[0].length;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      if (!FUNCS[name]) throw new Error(`I do not know "${word[0]}"`);
      if (!eat('(')) throw new Error(`${name} needs brackets`);
      const v = expr();
      if (!eat(')')) throw new Error('missing a closing bracket');
      return FUNCS[name](v);
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!num) throw new Error(`cannot read "${s.slice(i, i + 12) || 'the end'}"`);
    i += num[0].length;
    return parseFloat(num[0]);
  }
  function power() {
    const base = primary();
    ws();
    if (eat('**')) return Math.pow(base, power());   // right-associative
    return base;
  }
  function term() {
    let v = power();
    for (;;) {
      ws();
      if (eat('*')) v *= power();
      else if (eat('/')) { const d = power(); if (d === 0) throw new Error('division by zero'); v /= d; }
      else if (eat('%')) { const d = power(); if (d === 0) throw new Error('modulo by zero'); v %= d; }
      else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      ws();
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  const out = expr();
  ws();
  if (i < s.length) throw new Error(`did not understand "${s.slice(i, i + 12)}"`);
  return out;
}

export function calculate(env, { expression } = {}) {
  const e = String(expression || '').trim();
  if (!e) return 'Give me something to work out.';
  if (e.length > 400) return 'That is too long for a calculator.';
  let v;
  try { v = evaluate(e); }
  catch (err) { return `Cannot work that out — ${err.message}.`; }
  if (!isFinite(v)) return 'That does not come out to a finite number.';
  const rounded = Math.abs(v) < 1e15 ? Number(v.toPrecision(12)) : v;
  return `${e} = ${rounded.toLocaleString(undefined, { maximumFractionDigits: 10 })}`;
}

export function roll(env, { what, options } = {}) {
  const spec = String(what || 'coin').toLowerCase().trim();
  if (Array.isArray(options) && options.length) {
    return `${options[(Math.random() * options.length) | 0]}`;
  }
  if (/^coin|flip/.test(spec)) return Math.random() < 0.5 ? 'Heads.' : 'Tails.';
  const dice = /^(\d*)d(\d+)$/.exec(spec.replace(/\s/g, ''));
  if (dice) {
    const n = Math.min(Number(dice[1] || 1), 50);
    const sides = Math.min(Number(dice[2]), 1000);
    if (!n || !sides) return 'That is not a die I can roll.';
    const rolls = Array.from({ length: n }, () => 1 + ((Math.random() * sides) | 0));
    const total = rolls.reduce((a, b) => a + b, 0);
    return n === 1 ? `${total}` : `${rolls.join(' + ')} = ${total}`;
  }
  const range = /^(-?\d+)\s*(?:to|-|through)\s*(-?\d+)$/.exec(spec);
  if (range) {
    const lo = Math.min(+range[1], +range[2]), hi = Math.max(+range[1], +range[2]);
    return `${lo + ((Math.random() * (hi - lo + 1)) | 0)}`;
  }
  return 'Say "coin", "2d6", "1 to 100", or give me a list to pick from.';
}

export function worldTime(env, { zone } = {}) {
  const z = String(zone || '').trim();
  const zones = z ? [z] : ['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Tokyo'];
  const now = new Date();
  const out = [];
  for (const tz of zones) {
    try {
      out.push(`  ${tz.split('/').pop().replace(/_/g, ' ')} — ${now.toLocaleString('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' })}`);
    } catch { out.push(`  ${tz} — not a time zone I recognise`); }
  }
  return out.join('\n');
}

export function daysUntil(env, { date, what } = {}) {
  const d = new Date(String(date || '').trim());
  if (isNaN(d.getTime())) return 'Give me a date I can read, like 2026-12-25.';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 864e5);
  const name = what ? `${what} ` : `${target.toDateString()} `;
  if (days === 0) return `${name}is today.`;
  if (days < 0) return `${name}was ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`;
  const weeks = Math.floor(days / 7);
  return `${days} day${days === 1 ? '' : 's'} until ${what || target.toDateString()}${weeks >= 2 ? ` — about ${weeks} weeks` : ''}.`;
}

// ---------------------------------------------------------------------------
function humanMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return `${h}h${rm ? ` ${rm}m` : ''}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'}${h % 24 ? ` ${h % 24}h` : ''}`;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return h;
}
