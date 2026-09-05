#!/usr/bin/env node
// scripts/tool-tests.mjs [names...]  — live-tests catalogue tools through GET /admin/tool-test on the deployed
// Worker (ADMIN_TOKEN from ~/.asgard-admin-token), prints PASS/FAIL per tool, and appends a dated section to
// docs/TOOL_TESTS.md. A tool PASSES when it returns real data (no upstream error text) within the time limit.
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs'; import { homedir } from 'node:os';
const BASE = 'https://asgrard-backend.rayanfahil2.workers.dev';
const token = readFileSync(`${homedir()}/.asgard-admin-token`, 'utf8').trim();
export const SAMPLES = {
  read_document: { url: 'https://pdfobject.com/pdf/sample.pdf' }, read_page: { url: 'https://example.com/' }, rss_read: { url: 'https://hnrss.org/frontpage', n: 3 },
  google_news: { q: 'Bakersfield', n: 3 }, trending_now: { geo: 'US', n: 5 }, hackernews: { mode: 'top', n: 3 }, reddit_read: { sub: 'news', sort: 'hot', n: 3 }, wayback: { url: 'https://example.com' },
  wiki_search: { q: 'Bakersfield California', n: 3 }, wiki_pageviews: { title: 'Bakersfield, California' }, arxiv_search: { q: 'transformer attention', n: 3 }, crossref_search: { q: 'attention is all you need', n: 3 },
  semantic_scholar: { q: 'large language models', n: 3 }, openlibrary_search: { q: 'dune herbert', n: 3 }, book_by_isbn: { isbn: '9780441013593' }, gutenberg_search: { q: 'frankenstein', n: 3 },
  archive_search: { q: 'apollo 11', n: 3 }, federal_register: { q: 'wildfire', n: 3 }, sec_search: { q: 'Tesla', n: 3 }, universities: { q: 'Bakersfield', n: 5 },
  coingecko_price: { ids: 'bitcoin,ethereum' }, coingecko_markets: { n: 5 }, coingecko_trending: {}, dexscreener_search: { q: 'PEPE', n: 3 }, defillama_tvl: { protocol: 'aave' }, btc_mempool: {}, fear_greed: {},
  stooq_quote: { symbol: 'SPY' }, treasury_yields: {}, bls_latest: { series: 'LNS14000000' }, polymarket_markets: { q: 'election', n: 3 }, fx_rates: { base: 'USD', to: 'EUR' }, paper_equity_chart: {},
  nws_alerts: { area: 'CA' }, nws_forecast: { lat: 35.37, lon: -119.02 }, quakes: { minMag: 2.5, days: 7, near: 'Bakersfield' }, calfire_incidents: {}, space_weather: {}, iss_now: {}, nasa_apod: {}, tides: { station: '9410170' }, elevation: { lat: 35.37, lon: -119.02 },
  zip_lookup: { zip: '93301' }, ip_geo: { ip: '8.8.8.8' }, osm_search: { q: 'Bakersfield, CA' }, osm_reverse: { lat: 35.37, lon: -119.02 }, osm_nearby: { what: 'cafe', lat: 35.373, lon: -119.019, r: 800 }, country_info: { name: 'Japan' }, world_bank: { indicator: 'SP.POP.TOTL', country: 'US' },
  shopping_list: { action: 'read' }, quick_note: { text: 'tool-test note' }, notes_read: {}, reading_list: { action: 'read' }, habits_status: {}, expenses_week: {}, unit_convert: { value: 10, from: 'mi', to: 'km' }, recipe_search: { q: 'chicken', n: 3 }, cocktail_search: { q: 'margarita' }, food_by_barcode: { code: '737628064502' }, exercises: { muscle: 'biceps', n: 3 }, vin_decode: { vin: '1HGCM82633A004352' }, recalls: { make: 'honda', model: 'accord', year: 2003 },
  jobs_search: { q: 'customer service', location: 'Bakersfield', n: 5 }, company_lookup: { name: 'Chevron' },
  cloudflare_status: {}, github_activity: { repo: 'RAY09-F/rayven-pwa' }, npm_info: { pkg: 'three' }, pypi_info: { pkg: 'requests' }, dns_lookup: { name: 'cloudflare.com', type: 'A' }, whois: { domain: 'cloudflare.com' }, http_check: { url: 'https://example.com' }, url_shorten: { url: 'https://example.com/asgard' }, url_unshorten: { url: 'https://is.gd/example' }, qr_code: { text: 'https://example.com' }, page_preview: { url: 'https://example.com' }, color_info: { color: 'E7C24A' },
  text_hash: { text: 'asgard', algorithm: 'sha256' }, base64: { text: 'asgard', mode: 'encode' }, uuid: {}, regex_test: { pattern: 'a.g', text: 'asgard' }, json_pretty: { json: '{"a":1}' },
  itunes_search: { term: 'Daft Punk', media: 'music', n: 3 }, tv_search: { show: 'Loki' }, tv_tonight: { country: 'US', n: 5 }, anime_search: { q: 'Cowboy Bebop', n: 3 }, musicbrainz: { artist: 'Radiohead' }, songlink: { url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' }, game_deals: { q: 'hades', n: 3 }, free_games: {}, board_games: { q: 'catan' }, trivia: { n: 2 }, draw_cards: { n: 2 }, pokemon: { name: 'pikachu' }, dnd: { q: 'fireball' }, mtg_card: { q: 'black lotus' },
  dad_joke: {}, joke: {}, chuck_norris: {}, advice: {}, affirmation: {}, quote: {}, useless_fact: {}, yes_or_no: {}, random_dog: {}, random_fox: {}, random_cat: {}, http_cat: { code: 418 }, robot_avatar: { text: 'thor' }, pixel_avatar: { seed: 'loki' }, art_random: {}, mcu_countdown: {}, is_even: { n: 4 }, xkcd: {}, meme_templates: { n: 3 }, star_wars: { q: 'luke' }, star_trek: { q: 'Picard' }, rick_and_morty: { q: 'rick' },
  describe_image: { url: 'https://images.dog.ceo/breeds/african-wild/n02116738_8749.jpg' }, detect_objects: { url: 'https://images.dog.ceo/breeds/african-wild/n02116738_8749.jpg' }, classify_image: { url: 'https://images.dog.ceo/breeds/african-wild/n02116738_8749.jpg' }, sentiment: { text: 'This is wonderful' }, publish_note: { title: 'tool-test', md: 'hello from the test' },
  rss_watch: { url: 'https://hnrss.org/frontpage' }, rss_unwatch: { match: 'hacker' }, memory_timeline: { from: '2026-08-01', to: '2026-09-30', n: 5 }, what_did_i_say_about: { topic: 'trading' }, journal_write: { text: 'tool-test journal line' }, journal_read: {}, self_stats: {}, routine_templates: {}
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SAMPLES);
const rows = []; let pass = 0, fail = 0;
for (const name of names) {
  const args = SAMPLES[name] || {}; const t0 = Date.now();
  let status = 'FAIL', note = '';
  try {
    const r = await fetch(`${BASE}/admin/tool-test?name=${encodeURIComponent(name)}&args=${encodeURIComponent(JSON.stringify(args))}&persona=thor`, { headers: { 'X-Asgard-Admin': token }, signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    const text = String(j.result == null ? (j.error || '') : j.result);
    const bad = j.error || /^Unknown tool\.$|the upstream call failed|HTTP 4\d\d|HTTP 5\d\d|timed out|is not a public host|not JSON|Workers AI could not|^\s*$/.test(text.slice(0, 400));
    if (!bad) { status = 'PASS'; pass++; } else fail++;
    note = text.replace(/\s+/g, ' ').slice(0, 110);
  } catch (e) { fail++; note = e.message; }
  console.log(`${status}  ${name.padEnd(20)} ${String(Date.now() - t0).padStart(5)} ms  ${note}`);
  rows.push(`| ${name} | ${status} | ${Date.now() - t0} ms | ${note.replace(/\|/g, '/')} |`);
}
const day = new Date().toISOString().slice(0, 16).replace('T', ' ');
if (!existsSync('docs/TOOL_TESTS.md')) writeFileSync('docs/TOOL_TESTS.md', '# Tool tests — every catalogue tool called once, live, before it ships\n\nRun by scripts/tool-tests.mjs through GET /admin/tool-test (ADMIN_TOKEN). PASS = real data came back. Anything that fails is either fixed or moved to "not shipped — why" and dropped from the catalogue.\n');
appendFileSync('docs/TOOL_TESTS.md', `\n## ${day} UTC — ${pass} pass, ${fail} fail\n\n| tool | result | time | first line |\n|---|---|---|---|\n${rows.join('\n')}\n`);
console.log(`\n${pass} PASS, ${fail} FAIL — appended to docs/TOOL_TESTS.md`);
