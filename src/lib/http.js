// ONE HELPER FOR EVERY EXTERNAL CALL (asgard-upgrade Phase 7.0).
//
// Every catalogue tool fetches through here: a User-Agent with contact (several
// free APIs require one), a 10 s timeout, a 1 MB cap on the raw body (larger is
// an error, never a silent truncation), redirects followed BY HAND with every
// hop re-checked by the same guards (a shortener must not bounce us to a
// private address or to this Worker), JSON / text / RSS parsing, and the
// Workers Cache API for GETs that may be cached (never a module variable, never
// KV). Errors come back verbatim (Rule 7). Callers shape their results.
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_HOPS = 5;
const OWN_HOSTS = ['asgrard-backend.rayanfahil2.workers.dev', 'rayven-backend.rayanfahil2.workers.dev'];

export function userAgent(env) { return `Asgard/1.0 (+${(env && env.ASGARD_CONTACT) || 'https://github.com/RAY09-F/rayven-pwa'})`; }

// The public-host guard: https only, no localhost, no private or link-local
// ranges, no cloud metadata, never this Worker's own hosts.
export function publicHostCheck(urlString) {
  let u; try { u = new URL(urlString); } catch (e) { return { ok: false, why: 'that is not a URL I can read' }; }
  if (u.username || u.password || (u.port && u.port !== '443')) return {ok:false,why:'credentials and non-HTTPS ports are refused'};
  if (u.protocol !== 'https:') return { ok: false, why: 'https only' };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal') return { ok: false, why: `${host || '(empty)'} is not a public host` };
  if (OWN_HOSTS.includes(host)) return { ok: false, why: 'I do not call myself' };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return { ok: false, why: `${host} is a private or reserved address` };
  }
  if (host.includes(':')) { if (host === '::1' || host === '::' || /^::ffff:/i.test(host) || /^f[cd]/i.test(host) || /^fe[89ab]/i.test(host)) return { ok: false, why: `${host} is a private or reserved address` }; }
  return { ok: true, host, url: u };
}

async function readCapped(res, maxBytes) {
  const len = Number(res.headers.get('content-length'));
  if (len && len > maxBytes) throw new Error(`response too large: ${len} bytes (limit ${maxBytes})`);
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader(); const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch (e) {} throw new Error(`response too large: over ${maxBytes} bytes`); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

// httpGet(env, url, { accept, headers, timeoutMs, maxBytes, cacheSeconds, method, body })
// → { ok, status, url, text, json, contentType, hops, error }
export async function httpFetch(env, urlString, opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS, maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  const method = (opts.method || 'GET').toUpperCase();
  let g = publicHostCheck(urlString); if (!g.ok) return { ok: false, status: 0, url: urlString, error: g.why };
  const headers = { 'user-agent': userAgent(env), accept: opts.accept || 'application/json, text/plain, */*', ...(opts.headers || {}) };
  const cacheable = method === 'GET' && Number(opts.cacheSeconds) > 0 && typeof caches !== 'undefined' && caches.default;
  const cacheKey = cacheable ? new Request(g.url.toString(), { method: 'GET', headers: { accept: headers.accept } }) : null;
  if (cacheable) { try { const hit = await caches.default.match(cacheKey); if (hit) { const text = await hit.text(); return finish(hit, text, g.url.toString(), 0, true); } } catch (e) {} }
  let url = g.url.toString(), hops = 0, res;
  for (;;) {
    const signal = AbortSignal.timeout(timeoutMs);
    try { res = await fetch(url, { method, headers, body: opts.body, redirect: 'manual', signal }); }
    catch (e) { return { ok: false, status: 0, url, error: e && e.name === 'AbortError' ? `timed out after ${timeoutMs} ms` : `network: ${e && e.message}` }; }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (++hops > MAX_HOPS) return { ok: false, status: res.status, url, error: `too many redirects (${hops})` };
      let next; try { next = new URL(res.headers.get('location'), url).toString(); } catch (e) { return { ok: false, status: res.status, url, error: 'bad redirect location' }; }
      const g2 = publicHostCheck(next); if (!g2.ok) return { ok: false, status: res.status, url, error: `redirect refused: ${g2.why}` };
      if (new URL(url).origin !== g2.url.origin) for (const key of Object.keys(headers)) if (/authorization|api.?key|token|cookie/i.test(key)) delete headers[key];
      url = g2.url.toString(); continue;
    }
    break;
  }
  let bytes; try { bytes = await readCapped(res, maxBytes); } catch (e) { return { ok: false, status: res.status, url, error: e.message }; }
  if (opts.binary) { const okb = res.status >= 200 && res.status < 300; return { ok: okb, status: res.status, url, bytes, contentType: res.headers.get('content-type') || '', hops, error: okb ? null : `HTTP ${res.status}` }; }
  const text = new TextDecoder().decode(bytes);
  if (cacheable && res.ok) { try { await caches.default.put(cacheKey, new Response(text, { status: 200, headers: { 'content-type': res.headers.get('content-type') || 'text/plain', 'cache-control': `public, max-age=${Math.floor(opts.cacheSeconds)}` } })); } catch (e) {} }
  return finish(res, text, url, hops, false);
}
function finish(res, text, url, hops, cached) {
  const contentType = res.headers.get('content-type') || '';
  let json = null; if (/json/i.test(contentType) || /^\s*[\[{]/.test(text)) { try { json = JSON.parse(text); } catch (e) {} }
  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, url, text, json, contentType, hops, cached, error: ok ? null : `HTTP ${res.status}${text ? ': ' + text.slice(0, 200).replace(/\s+/g, ' ') : ''}` };
}
export const httpGet = (env, url, opts = {}) => httpFetch(env, url, { ...opts, method: 'GET' });
export const httpJson = async (env, url, opts = {}) => { const r = await httpGet(env, url, { accept: 'application/json', ...opts }); if (r.ok && r.json === null) return { ...r, ok: false, error: 'response was not JSON' }; return r; };

// ---- shaping ------------------------------------------------------------------
export const clip = (s, n = 6000) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const capN = (n, def = 10, max = 20) => Math.max(1, Math.min(max, Number(n) || def));
export function stripTags(html) { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }
export function errorText(tool, r) { return `${tool}: the upstream call failed — ${r && r.error ? r.error : 'unknown error'}`; }

// ---- a small RSS / Atom parser (no dependencies) ------------------------------
function tag(block, name) { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block); return m ? m[1].trim() : ''; }
function cdata(s) { return String(s || '').replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim(); }
export function parseFeed(xml, n = 20) {
  const items = [];
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const re = isAtom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m; while ((m = re.exec(xml)) && items.length < n) {
    const b = m[1];
    let link = '';
    if (isAtom) { const lm = /<link[^>]*href=["']([^"']+)["'][^>]*>/i.exec(b); link = lm ? lm[1] : ''; } else link = cdata(tag(b, 'link')) || (/<guid[^>]*>([^<]+)<\/guid>/i.exec(b) || [])[1] || '';
    const title = stripTags(cdata(tag(b, 'title')));
    const date = cdata(tag(b, 'pubDate')) || cdata(tag(b, 'published')) || cdata(tag(b, 'updated')) || cdata(tag(b, 'dc:date'));
    const summary = stripTags(cdata(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'))).slice(0, 280);
    items.push({ title, link, date, summary });
  }
  const feedTitle = stripTags(cdata(tag(xml.slice(0, 4000), 'title')));
  return { title: feedTitle, items };
}
export function formatFeed(feed, n = 20) {
  const lines = feed.items.slice(0, n).map((it, i) => `${i + 1}. ${it.title || '(untitled)'}${it.date ? ` — ${it.date}` : ''}${it.link ? `\n   ${it.link}` : ''}${it.summary ? `\n   ${it.summary}` : ''}`);
  return clip(`${feed.title ? feed.title + '\n' : ''}${lines.join('\n') || 'no items'}`);
}
