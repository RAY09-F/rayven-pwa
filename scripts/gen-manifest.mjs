#!/usr/bin/env node
// scripts/gen-manifest.mjs — writes docs/ASGARD_MANIFEST.md from the code that
// exists right now. Tool rows, persona visibility, permission levels, secret
// names and routes are DERIVED (imports + source scan); the cron and KV-prefix
// notes are curated text kept next to the code they describe. Re-run whenever
// tools, routes, secrets or crons change. Plain Node, no deps.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const T = await import('../src/lib/tools.js');
const P = await import('../src/lib/personas.js');
const PERM = await import('../src/lib/permissions.js');
const C = await import('../src/lib/containment.js');
const { MODELS } = await import('../src/lib/models.js');
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const toolsSrc = src('src/lib/tools.js');
const indexSrc = src('src/index.js');

// ---- which module implements each tool: parse the dispatcher + import map ----
const importOf = {};
for (const m of toolsSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([\w-]+)\.js'/g)) {
  for (const name of m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) importOf[name] = 'src/lib/' + m[2] + '.js';
}
const implOf = {};
for (const m of toolsSrc.matchAll(/case '([\w]+)':\s*(.*)/g)) {
  const name = m[1], rest = m[2];
  const fn = (rest.match(/(?:await\s+)?([A-Za-z_]\w*)\(/) || [])[1];
  implOf[name] = fn && importOf[fn] ? importOf[fn] : (name.startsWith('browser_') ? 'src/lib/browser.js' : 'src/lib/tools.js (inline)');
}

// ---- permission level per tool ----
function level(name) {
  if (PERM.HARD_CONFIRM_TOOLS.includes(name)) return 'hard-confirm (live confirmation, not editable)';
  if (PERM.GATEABLE_TOOLS.includes(name)) return (PERM.DEFAULT_PERMISSION_LEVELS[name] || 'auto') + ' (gateable)';
  return 'auto';
}
const flags = (name) => [C.isConsequential(name) ? 'consequential → confirm while tainted' : '', C.marksTainted(name) ? 'untrusted source → taints session' : ''].filter(Boolean).join('; ');

// ---- persona visibility ----
const seen = {};
for (const id of P.ALL_PERSONA_IDS) for (const t of T.toolDefinitionsForPersona(id)) (seen[t.name] ||= []).push(P.PERSONAS[id].name);

// ---- secrets: every env.NAME read anywhere under src/ ----
const files = readdirSync(new URL('../src/lib', import.meta.url)).map(f => 'src/lib/' + f).concat(['src/index.js']);
const secretUse = {};
for (const f of files) for (const line of src(f).split('\n')) { if (/^\s*\/\//.test(line)) continue; for (const m of line.matchAll(/env\.([A-Z][A-Z0-9_]{3,})\b/g)) (secretUse[m[1]] ||= new Set()).add(f.replace('src/lib/', '')); }
const BINDINGS = new Set(['RAYVEN_KV', 'VECTORIZE', 'AI', 'CLIPS', 'ASSETS']);
const DIES = {
  ANTHROPIC_API_KEY: 'everything that thinks — every reply, brief, report, vigil', TELEGRAM_BOT_TOKEN: 'THOR\'s bot (legacy RAYVENN_RAYAN_BOT) + all notifications',
  TELEGRAM_BOT_TOKEN_THOR: 'optional dedicated THOR bot (falls back to TELEGRAM_BOT_TOKEN)', TELEGRAM_BOT_TOKEN_LOKI: 'LOKI on Telegram', TELEGRAM_BOT_TOKEN_ODIN: 'ODIN on Telegram (paper reports)', TELEGRAM_BOT_TOKEN_HELA: 'HELA\'s bot (webhook deliberately unregistered)',
  TELEGRAM_WEBHOOK_SECRET: 'every /telegram/<persona> delivery is dropped without it', ELEVENLABS_API_KEY: 'voice (/tts) and spoken phone calls', ELEVENLABS_VOICE_ID: 'legacy shared voice fallback',
  ELEVENLABS_VOICE_ID_THOR: 'THOR\'s voice', ELEVENLABS_VOICE_ID_LOKI: 'LOKI\'s voice', ELEVENLABS_VOICE_ID_ODIN: 'ODIN\'s voice', ELEVENLABS_VOICE_ID_HELA: 'HELA\'s voice',
  DEBUG_SECRET: 'every /debug-* route refuses (fails closed)', ADMIN_TOKEN: 'every /admin/* route refuses (fails closed); smoke test webhook check',
  SERPAPI_KEY: 'web_search, play_youtube_video, morning briefing research', TAVILY_API_KEY: 'tavily_*, watchlist checks, Hela\'s vigil and the forge',
  GOOGLE_MAPS_API_KEY: 'all maps_* tools', SPOTIFY_CLIENT_ID: 'Spotify', SPOTIFY_CLIENT_SECRET: 'Spotify', TWILIO_ACCOUNT_SID: 'send_text / make_call', TWILIO_AUTH_TOKEN: 'send_text / make_call', TWILIO_PHONE_NUMBER: 'send_text / make_call',
  OPENROUTER_API_KEY: 'ask_alternate_model', JARVIS_AGENT_URL: 'ask_jarvis', AGENT_KEY_JARVIS_RAYVEN: 'ask_jarvis + inbound /agent/query from JARVIS', KEVOS_AGENT_URL: 'ask_kevos', AGENT_KEY_RAYVEN_KEVOS: 'ask_kevos + inbound /agent/query from KEVOS',
  TWELVE_DATA_API_KEY: 'paper trading candles for SPY/QQQ/GLD/USO', AYRSHARE_API_KEY: 'clip publishing/history/analytics (retired business)', UPLOAD_POST_API_KEY: 'alternate clip publisher', VIZARD_API_KEY: 'Vizard clipping jobs', TWITCH_CLIENT_ID: 'clips_find', TWITCH_CLIENT_SECRET: 'clips_find',
  PUBLIC_BASE_URL: 'var: base URL for Twilio callbacks (defaults to the workers.dev URL)', R2_PUBLIC_BASE: 'var: public R2 base for generated images (defaults to the r2.dev URL)'
};
const LIVE_SECRETS = ['AGENT_KEY_JARVIS_RAYVEN', 'AGENT_KEY_RAYVEN_KEVOS', 'ANTHROPIC_API_KEY', 'AYRSHARE_API_KEY', 'DEBUG_SECRET', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID_HELA', 'ELEVENLABS_VOICE_ID_LOKI', 'ELEVENLABS_VOICE_ID_ODIN', 'ELEVENLABS_VOICE_ID_THOR', 'GOOGLE_MAPS_API_KEY', 'OPENROUTER_API_KEY', 'SERPAPI_KEY', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'TAVILY_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN_HELA', 'TELEGRAM_BOT_TOKEN_LOKI', 'TELEGRAM_BOT_TOKEN_ODIN', 'TELEGRAM_WEBHOOK_SECRET', 'TWELVE_DATA_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'VIZARD_API_KEY', 'ADMIN_TOKEN'];

// ---- routes: every url.pathname comparison in index.js ----
const routes = new Set();
for (const m of indexSrc.matchAll(/url\.pathname\s*(===|\.startsWith\()\s*'([^']+)'/g)) routes.add(m[2] + (m[1].startsWith('.startsWith') ? '*' : ''));
for (const m of indexSrc.matchAll(/'(\/[a-z-]+)':\s*'[a-z:]+'/g)) routes.add(m[1]);
const ROUTE_NOTES = {
  '/': 'POST: web chat {message, persona} AND the legacy THOR Telegram webhook (JARVIS federation contract — never move). GET: the hall (public/index.html)',
  '/ping': 'latency probe', '/agent/query': 'POST, HMAC-signed sibling-agent channel (JARVIS/KEVOS)', '/telegram/*': 'POST /telegram/<persona> per-bot webhooks, secret_token verified',
  '/agent/log': 'sibling query log', '/activity': 'activity log', '/notifications': 'notification log', '/monitors': 'watchlist', '/paper-trading/status': 'PAPER portfolio + trades', '/paper-trading/charts': 'PAPER candles + equity curve',
  '/status': 'per-persona status strip + autonomy log (hidden personas excluded)', '/roundtable': 'POST two-persona debate', '/memory': 'GET long-term memory by persona', '/memory/map': 'memory map (hidden excluded)', '/memory/share': 'POST copy a memory between personas', '/memory/update': 'POST edit', '/memory/delete': 'POST delete one fact',
  '/todos': 'GET/POST', '/calendar': 'GET/POST', '/history': 'web conversation turns by persona', '/permissions': 'GET/POST', '/permissions/all': 'structured view', '/kpi': 'GET/POST list', '/goals': 'GET/POST list', '/clipping': 'GET/POST list',
  '/loki/brief-latest': 'cached brief', '/loki/brief-now': 'POST run', '/odin/reports': 'cached reports', '/odin/report-now': 'POST run', '/assistant-config': 'GET/POST whitelisted config keys', '/spotify/now-playing': 'GET', '/spotify/control': 'POST', '/spotify/login': 'OAuth', '/spotify/callback': 'OAuth',
  '/browser/status': 'extension heartbeat (connected = stamped within 10 min)', '/browser/poll': 'extension polls every 6 s; heartbeat stamped at most every 5 min', '/browser/result': 'POST extension result', '/voice/audio/*': 'Twilio fetches spoken audio (one-time id, 15 min TTL)', '/voice/turn': 'POST Twilio conversation turn', '/voice/transcript': 'last call transcript', '/tts': 'POST ElevenLabs speech',
  '/debug-*': 'operator routes, gated by DEBUG_SECRET (x-debug-key header or ?key=)', '/admin/*': 'operator routes, gated by ADMIN_TOKEN (X-Asgard-Admin header)', '/admin/tools.json': 'GET every tool schema as sent to Anthropic + per-persona visibility', '/admin/webhooks': 'GET each bot\'s webhook URL and last Telegram error (never tokens)',
  '/hub': '301 → /', '/thor|/loki|/odin': '301 → /?persona=<id>', '(anything else GET)': 'static assets from public/'
};

const out = [];
out.push('# ASGARD MANIFEST — ground truth, generated from code', '', `Generated ${new Date().toISOString()} by scripts/gen-manifest.mjs. Do not hand-edit the derived tables; re-run the script.`, '');
out.push('## Personas', '', '| id | name | model | max_tokens | history depth | inline memories | tool iterations | tools visible | memory key | voice secret | bot token secret | hidden |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const id of P.ALL_PERSONA_IDS) { const p = P.PERSONAS[id]; out.push(`| ${id} | ${p.name} | ${MODELS.sonnet} | ${p.maxTokens || 1400} | ${p.historyTurns || 30} turns | ${p.memoryInline || 15} | ${p.toolIterations || 14} | ${T.toolDefinitionsForPersona(id).length} | ${p.memoryKey} | ${p.elevenVoiceEnv} (→ ELEVENLABS_VOICE_ID) | ${p.telegramTokenEnv}${id === 'thor' ? ' (→ TELEGRAM_BOT_TOKEN)' : ''} | ${p.hidden ? 'yes' : 'no'} |`); }
out.push('', `Model ids live in src/lib/models.js: sonnet=${MODELS.sonnet}, haiku=${MODELS.haiku}, workersAiFree=${MODELS.workersAiFree}, embedding=${MODELS.embedding}, reranker=${MODELS.reranker}.`, '');
out.push('## Telegram bots', '', '| persona | token secret | webhook route | notes |', '|---|---|---|---|',
  '| THOR | TELEGRAM_BOT_TOKEN (RAYVENN_RAYAN_BOT; TELEGRAM_BOT_TOKEN_THOR optional) | POST / | legacy path; shared by all three via "switch to loki" (tg:persona:<chat>) — JARVIS contract |',
  '| LOKI | TELEGRAM_BOT_TOKEN_LOKI | POST /telegram/loki | secret_token verified |', '| ODIN | TELEGRAM_BOT_TOKEN_ODIN | POST /telegram/odin | secret_token verified; sends the paper report |',
  '| HELA | TELEGRAM_BOT_TOKEN_HELA | POST /telegram/hela | token set, webhook DELIBERATELY unregistered — she does not exist off the device |', '');
out.push(`## Tools (${T.TOOL_DEFINITIONS.length})`, '', 'All dispatch through `runTool` in src/lib/tools.js; the "implemented in" column is the module the case calls. Permission: hard-confirm = live confirmation always; gateable = Rayan can set auto/notify/confirm/off; auto = runs. Every consequential tool escalates to confirm once the session has read untrusted content (src/lib/containment.js).', '', '| tool | purpose | implemented in | permission | containment | visible to |', '|---|---|---|---|---|---|');
for (const t of T.TOOL_DEFINITIONS) out.push(`| ${t.name} | ${String(t.description).replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 110)}${t.description.length > 110 ? '…' : ''} | ${implOf[t.name] || '?'} | ${level(t.name)} | ${flags(t.name) || '—'} | ${(seen[t.name] || []).join(', ') || 'nobody'} |`);
out.push('', '## Cron jobs (one trigger: `*/5 * * * *`, UTC; each job decides for itself whether it is due)', '', '| job (src) | cadence | what it does | worst-case KV writes per run | runs/day | writes/day |', '|---|---|---|---|---|---|');
const CRON = [
  ['runProactiveCheckInIfDue (checkin.js)', 'every 4 h', 'THOR reaches out on Telegram, may ask JARVIS/KEVOS', '4 (last_run, history, remember_this ×2)', '6', '24'],
  ['runMorningBriefingIfDue (checkin.js)', '08:00 Pacific daily', 'THOR researches and sends the morning briefing', '5 (last_date, history, memory)', '1', '5'],
  ['runCodeCheckIfDue (checkin.js)', 'daily', 'pulls index.html + worker.js from GitHub main, asks Claude for bugs', '2', '1', '2'],
  ['runPersonaAutonomyIfDue (autonomy.js)', '≤3/persona/day, ≥3.5 h apart, 09–21 Pacific', 'THOR self-check, LOKI nag sweep, ODIN strategy pulse', '~10 (state, status ×3, log, notify ×3, memory ×2)', '≤9', '≤90'],
  ['runLokiBriefIfDue (reports.js)', 'config:loki:brief:hour or OFF', 'LOKI daily brief to Telegram', '4', '0–1', '0–4'],
  ['runOdinReportIfDue (reports.js)', 'config:odin:report:day/hour or OFF', 'ODIN business report', '5', '0–1', '0–5'],
  ['runPaperTradingCycleIfDue (paperTrading.js)', 'every 5 min; acts only on a NEW candle per agent', '10 PAPER agents: signal, stop, enter/exit', '2 per new candle per agent (candles snapshot + lastCandle) + 3 on a trade (portfolio, trades, equity)', '~180 candle events', '~360 + trades'],
  ['runPaperTradingDailyReportIfDue (paperTrading.js)', 'config:paper:report:hour, default 17 Pacific', 'PAPER report to Telegram via ODIN\'s bot', '1–2', '1', '2'],
  ['runClipCycleIfDue (clipping.js)', 'hourly', 'publish one queued clip inside the ramp (retired business; queue empty)', '1 (last_run) + 3 on publish', '24', '24'],
  ['runVizardPollIfDue (vizard.js)', 'every 4 min WHILE jobs are in flight', 'poll Vizard jobs, queue results', '1 (last_poll) + per finished job', '0 when idle (fixed Phase 0)', '0'],
  ['runWhopSubmitIfDue (whop.js)', 'every 20 min only if whop:auto=1', 'drive the browser to submit a post', '2', '0', '0'],
  ['runTimersIfDue (kit.js)', 'every 5 min', 'fire due countdown timers', '1 + notify ×3 per due timer', '0 when none due', '0'],
  ['igRefreshIfDue (instagram.js)', 'weekly', 'refresh Instagram long-lived tokens', '2', '1/7', '<1'],
  ['runHelaVigilIfDue (hela.js)', 'every 3 h (1 h locked in)', 'HELA reads one subject, keeps a brief', '5 (vigil, seen, briefs, memory ×2)', '8 (24 locked)', '40 (120)'],
  ['runHelaDailyIfDue (hela.js)', 'every 22 h', 'HELA assembles the day\'s briefs', '5 (daily, briefs, notify ×3)', '1', '5'],
  ['runForgeRotation (hela.js)', 'one persona per tick by clock slot; each due on its own interval (HELA 30 min, trio 3 h)', 'the forge: find one new keyless capability', '3–4 (last, month, caps, briefs)', 'HELA ≤48, trio ≤8 each', '≤190 + 96'],
  ['runMonitoringSweep → flushNotificationDigestIfDue (monitoring.js, notifications.js)', 'every 5 min; each watch on its own interval (default 30 min)', 'page/search watch checks, then the digest', '1 (list) + 1 activity log + notify ×3 per due watch; digest flush 3', '48 per watch', '~100 per watch'],
  ['/browser/poll heartbeat (index.js, not cron)', 'extension polls every 6 s', 'stamp browser:lastpoll', '1 per 5 min (was 1 per minute = 1,440/day before Phase 0)', '288', '288']
];
for (const r of CRON) out.push('| ' + r.join(' | ') + ' |');
out.push('', 'Reply path (a message from Rayan): history 1, status stamps 2, audit trace + index 2, task log 1 per tool, Telegram dedupe 1, rayan:private_chat_id 1 (Telegram private), auto-memory extraction 2 per fact, pending confirmation 1. Roughly 8–14 writes per turn.', '');
out.push('## KV key prefixes (one namespace: RAYVEN_KV, id ee3cce96335249a9a4cc990cdfd8a2a5)', '', '| prefix / key | lives there |', '|---|---|');
const KV = [
  ['web:main, web:<persona>', 'web conversation history per persona (THOR keeps the legacy key)'], ['telegram:<chat>, <persona>:telegram:<chat>', 'Telegram history per chat per persona'], ['tg:persona:<chat>', 'which persona answers on the legacy bot'], ['tg:update:<persona>:<id>', 'webhook dedupe, 1 h TTL'], ['tg:hops:<chat>', 'bot-to-bot hop counter, 3 min TTL'], ['telegram:bot_info, telegram:bot_info:<persona>', 'getMe cache, 24 h'],
  ['rayan:private_chat_id', 'Rayan\'s private chat with THOR'], ['pending:<persona>', 'tool awaiting live confirmation, 5 min TTL'], ['permissions', 'per-tool levels'], ['memory:longterm, memory:longterm:<persona> (+ :ver)', 'long-term memory arrays — NEVER cleared or trimmed by code beyond the 500 cap in saveRawByKey'],
  ['todos, calendar:events, content:ideas', 'Rayan\'s lists'], ['odin:kpis, odin:goals, clipping:accounts', 'ODIN\'s data stores'], ['status:<persona>', 'live status strip, 6 h TTL'], ['autonomy:<persona>:state, agent:autonomy:log', 'autonomy scheduler + log (200)'], ['agent:log, activity:log, notif:log, task:log', 'capped logs (100/500/500/500)'], ['notif:digest_queue, notif:digest_last_flush, notif:cooldown:<hash>, notif:rate:<hour>', 'notification engine'],
  ['monitor:list', 'watchlist'], ['kit:timers', 'countdown timers'], ['audit:index, audit:<day>:<id>', 'audit trail (90-day TTL, index 400)'], ['egress:allowed_hosts', 'capability egress allowlist'], ['hela:locked, hela:briefs, hela:vigil_last, hela:daily_last, hela:topics, hela:seen', 'HELA\'s vigil'], ['hela:caps, hela:forge_*, forge:<persona>:*', 'the forge per persona (forge:turn is no longer written)'],
  ['paper:portfolio, paper:trades, paper:equity, paper:candles:<agent>, paper:lastCandle:<agent>, paper:report:*, config:paper:report:hour', 'PAPER trading — agent ids btc/spy/qqq/gld/uso/freya/tyr/baldr/heimdall/vidar are storage keys, never renamed'],
  ['checkin:last_run, briefing:last_date, codecheck:last_run, codecheck:result', 'THOR\'s scheduled jobs'], ['loki:brief:*, odin:report:last_date, odin:reports, config:loki:brief:hour, config:odin:report:*', 'LOKI/ODIN reports'],
  ['clips:*, vizard:*, whop:*, ig:*', 'the retired clipping pipeline (report-only)'], ['world:<url>', 'cached public API answers with TTL'], ['spotify:refresh_token', 'Spotify'], ['browser:command, browser:result:<id>, browser:lastpoll', 'extension command queue + heartbeat'], ['call:purpose, call:transcript, callaudio:<id>', 'phone calls (TTL)'], ['agent:<from>:count:<day>', 'sibling-agent daily rate limit']
];
for (const [k, v] of KV) out.push(`| ${k} | ${v} |`);
out.push('', '## Routes served by the Worker', '', '| route | what |', '|---|---|');
for (const r of [...routes].sort()) if (!r.startsWith('/debug-') || r === '/debug-*') out.push(`| ${r} | ${ROUTE_NOTES[r] || ''} |`);
for (const r of ['/debug-*', '/admin/*', '/hub', '/thor|/loki|/odin', '(anything else GET)']) if (!routes.has(r)) out.push(`| ${r} | ${ROUTE_NOTES[r]} |`);
const dbg = [...routes].filter(r => r.startsWith('/debug-') && r !== '/debug-*').sort();
out.push('', `Debug routes (${dbg.length}, all behind DEBUG_SECRET): ${dbg.join(', ')}`, '');
out.push('## Secrets and vars the code reads (names only)', '', '| name | read by | what dies without it | set on the live Worker? |', '|---|---|---|---|');
for (const name of Object.keys(secretUse).filter(n => !BINDINGS.has(n)).sort()) out.push(`| ${name} | ${[...secretUse[name]].join(', ')} | ${DIES[name] || ''} | ${LIVE_SECRETS.includes(name) ? 'yes' : (name === 'PUBLIC_BASE_URL' || name === 'R2_PUBLIC_BASE' ? 'no (has a default)' : 'NO')} |`);
out.push('', 'Bindings (wrangler.toml): RAYVEN_KV (KV), VECTORIZE (rayven-memory), AI (Workers AI), CLIPS (R2 bucket asgardclips), ASSETS (public/).', '', 'Extension (background.js): Manifest V3 service worker, polls /browser/poll every 6 s on rayven-backend (forwarder) then asgrard-backend, executes navigate/click/type/probe/read/scroll/screenshot/click_coords/type_coords, posts to /browser/result.', '');
writeFileSync(new URL('../docs/ASGARD_MANIFEST.md', import.meta.url), out.join('\n') + '\n');
console.log(`docs/ASGARD_MANIFEST.md written: ${T.TOOL_DEFINITIONS.length} tools, ${routes.size} routes, ${Object.keys(secretUse).length} env names`);
