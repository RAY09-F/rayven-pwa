// THE TOOLBOX (asgard-upgrade Phase 7.0).
//
// Tool METADATA lives here, in a registry parallel to the schemas: group,
// taint (returns outside content), source, timeout. Never inside the schema
// object sent to Anthropic. From it: each god's CORE (at most 40 tools, always
// sent, in the master order), the groups a conversation has OPEN (state rides
// in the conversation object, Rule 5a), the first-message keyword rules that
// open groups without a model call, the 20-idle-turn close, and find_tools.
export const MAX_CORE = 40;
export const CLOSE_AFTER_IDLE_TURNS = 20;

// Explicit metadata for tools that do not fit a name pattern; catalogue
// modules register their own with registerMeta(). Shape: { group, taint, source }.
const META = new Map();
export function registerMeta(name, meta) { META.set(name, { ...(META.get(name) || {}), ...meta }); }
export function metaOf(name) { return META.get(name) || { group: groupByPattern(name), taint: false }; }

// Groups for the pre-existing tools, by name pattern. A group is a human word
// Rayan could say; names and schemas are untouched (Rule 2 is about renaming).
const PATTERNS = [
  [/^browser_/, 'browser'], [/^spotify_|^play_youtube_video$/, 'music'], [/^maps_/, 'maps'],
  [/^(send_text|make_call|ask_jarvis|ask_kevos|translate|condense)$/, 'comms'],
  [/^(remember_this|search_memory|memory_)/, 'memory'],
  [/^(add_calendar_event|list_calendar_events|remove_calendar_event|set_timer|timers|cancel_timer|days_until|world_time)$/, 'calendar'],
  [/^(add_todo|list_todos|complete_todo|add_content_idea|list_content_ideas)$/, 'todos'],
  [/^(web_search|tavily_|look_up|define|page_history|news_search)/, 'search'],
  [/^(weather|air_quality|earthquakes|golden_hour|holidays)$/, 'weather'],
  [/^(stock_price|crypto_price|token_search|company_filings|convert_money|calculate|roll)$/, 'markets'],
  [/^(paper_|trading_)/, 'paper'], [/^watch_/, 'watchlist'],
  [/^(social_|video_|ig_|clips_|vizard_|whop_|short_link$|word_ideas$)/, 'social'],
  [/^routine_/, 'routines'], [/^(approvals_list|approve|reject)$/, 'approvals'], [/^delegate$/, 'council'],
  [/^(make_image|transcribe)$/, 'media'],
  [/^(get_tool_permissions|set_tool_permission|list_allowed_hosts|allow_host|list_my_tools|audit_|cost_report|my_capabilities|use_capability|learn_capability|forge_capability|forget_capability|flag_capability)/, 'system'],
  [/^(lock_in|stand_down|vigil_status|my_briefs|keep_brief|clear_briefs|watch_subjects|go_looking)$/, 'hidden']
];
export function groupByPattern(name) { for (const [re, g] of PATTERNS) if (re.test(name)) return g; return 'misc'; }
export function groupOf(name) { const m = META.get(name); return (m && m.group) || groupByPattern(name); }

// CORE per god: exact names, master order applied at build time; only names
// that exist and that the god is allowed. Kept under MAX_CORE.
export const CORE_NAMES = {
  thor: ['remember_this', 'search_memory', 'add_todo', 'list_todos', 'complete_todo', 'add_calendar_event', 'list_calendar_events', 'remove_calendar_event', 'set_timer', 'timers', 'cancel_timer',
    'web_search', 'tavily_research', 'weather', 'world_time', 'maps_search_places', 'maps_directions',
    'spotify_play', 'spotify_pause', 'spotify_resume', 'spotify_next', 'spotify_now_playing', 'play_youtube_video',
    'browser_navigate', 'browser_read_page', 'browser_click', 'browser_type', 'browser_screenshot',
    'send_text', 'make_call', 'delegate', 'routine_create', 'routine_list', 'routine_run_now', 'approvals_list', 'approve', 'reject', 'list_my_tools', 'find_tools'],
  loki: ['add_calendar_event', 'list_calendar_events', 'remove_calendar_event', 'set_timer', 'timers', 'cancel_timer', 'days_until', 'world_time',
    'add_todo', 'list_todos', 'complete_todo', 'add_content_idea', 'list_content_ideas', 'remember_this', 'search_memory',
    'weather', 'air_quality', 'web_search', 'tavily_research', 'look_up', 'news_search',
    'watch_add', 'watch_list', 'watch_remove', 'watch_pause', 'watch_resume', 'delegate',
    'routine_create', 'routine_list', 'routine_pause', 'routine_resume', 'routine_run_now', 'routine_history', 'approvals_list', 'approve', 'reject', 'list_my_tools', 'find_tools'],
  odin: ['paper_trading_status', 'trading_status', 'trading_readiness', 'trading_halt', 'trading_resume', 'paper_backtest',
    'stock_price', 'crypto_price', 'token_search', 'company_filings', 'news_search', 'web_search', 'calculate', 'convert_money',
    'remember_this', 'search_memory', 'add_todo', 'list_todos', 'delegate', 'routine_create', 'routine_list', 'routine_run_now',
    'approvals_list', 'approve', 'reject', 'cost_report', 'list_my_tools', 'find_tools']
};

// First-message keyword rules: no model call, groups open before the first
// reply so today's requests keep working in one turn.
export const KEYWORD_RULES = [
  [/\b(play|pause|skip|next song|song|music|spotify|playlist|volume|now playing)\b/i, ['music']],
  [/\b(youtube|browse|browser|click|type into|website|web ?page|screenshot|scroll|open\s+\S+\.(com|org|net|io|gov|edu|app|co|tv))\b/i, ['browser', 'music']],
  [/\b(text|sms|call|phone|dial|message (?:jay|kevin)|jarvis|kevos|translate)\b/i, ['comms']],
  [/\b(map|maps|directions|drive|driving|route|near me|nearby|address|where is|how far)\b/i, ['maps']],
  [/\b(stock|stocks|crypto|bitcoin|btc|eth|ethereum|market|markets|price of|ticker|earnings|paper (?:book|trading|trade)|portfolio|p&l|pnl|trading)\b/i, ['markets', 'paper']],
  [/\b(watch(?:list)?|monitor|keep an eye)\b/i, ['watchlist']],
  [/\b(weather|forecast|rain|snow|wind|air quality|smoke|earthquake|quake|fire|wildfire|tide|storm|alert)\b/i, ['weather', 'world']],
  [/\b(remind|reminder|timer|alarm|calendar|schedule|appointment|tomorrow|next week|at \d)\b/i, ['calendar']],
  [/\b(to-?do|todos?|task|tasks|chore)\b/i, ['todos']],
  [/\b(remember|memory|memories|what did i say|journal|note to self)\b/i, ['memory', 'self']],
  [/\b(joke|dad joke|fun fact|useless fact|quote|advice|affirmation|cat|dog|fox|meme|xkcd|trivia|cards|pokemon|star wars|star trek|rick and morty|d&d|magic card|yes or no|avatar)\b/i, ['fun']],
  [/\b(read|article|pdf|document|feed|rss|subscribe|arxiv|paper on|study|wikipedia|wiki|book|isbn|archive|wayback|federal register|sec filing|hacker news|reddit|trending|university)\b/i, ['research']],
  [/\b(job|jobs|hiring|opening|position|resume|apply|career|company)\b/i, ['jobs']],
  [/\b(recipe|cook|cocktail|meal|calorie|nutrition|barcode|exercise|workout|shopping|grocery|habit|streak|expense|spent|budget|convert|units?|vin|recall)\b/i, ['life']],
  [/\b(dns|whois|domain|github|repo|npm|pypi|package|http|url|link|shorten|unshorten|qr|hash|base64|uuid|json|regex|color|colour|cloudflare status|preview)\b/i, ['dev']],
  [/\b(movie|film|tv|show|episode|anime|game|games|deal|podcast|band|album|artist|itunes|board game|tonight on)\b/i, ['media']],
  [/\b(image|picture|photo|describe|caption|classify|detect|what is in|read this|sentiment|publish|share (?:a )?file|note page)\b/i, ['ai', 'sharing']],
  [/\b(cost|spend|spent|bill|usage|self stats|how much (?:do|did) you)\b/i, ['self']],
  [/\b(automate|routine|template|every (?:day|morning|week)|when .* happens|whenever)\b/i, ['routines', 'automation']]
];
export function groupsByKeywords(text) {
  const out = new Set(); const t = String(text || '');
  for (const [re, groups] of KEYWORD_RULES) if (re.test(t)) for (const g of groups) out.add(g);
  return [...out];
}

// ---- conversation state (rides in meta) ---------------------------------------
function box(meta) { if (!meta || typeof meta !== 'object') return null; if (!meta.toolbox || typeof meta.toolbox !== 'object') meta.toolbox = { open: {}, turns: 0 }; if (!meta.toolbox.open) meta.toolbox.open = {}; return meta.toolbox; }
export function openGroups(meta, groups, why) { const b = box(meta); if (!b) return; for (const g of groups || []) { if (!g || g === 'hidden') continue; b.open[g] = { idle: 0, why: why || 'keyword', at: Date.now() }; } }
// once per turn: idle counters up, stale groups closed
export function tickToolbox(meta) {
  const b = box(meta); if (!b) return [];
  b.turns = (b.turns || 0) + 1; const closed = [];
  for (const [g, st] of Object.entries(b.open)) { st.idle = (st.idle || 0) + 1; if (st.idle >= CLOSE_AFTER_IDLE_TURNS) { delete b.open[g]; closed.push(g); } }
  return closed;
}
export function noteToolUse(meta, name) { const b = box(meta); if (!b) return; const g = groupOf(name); if (b.open[g]) b.open[g].idle = 0; }
export function openGroupNames(meta) { const b = meta && meta.toolbox; return b && b.open ? Object.keys(b.open) : []; }
export function closeAllGroups(meta) { const b = box(meta); if (b) b.open = {}; }

// The schemas a god sees on this call: CORE first (master order), then the
// open groups' tools (master order, minus CORE). `defs` is the master list
// already filtered to what the god is allowed.
const isCatalogue = name => (META.get(name) || {}).source === 'catalogue';
export function coreFor(personaId, defs) {
  const want = CORE_NAMES[personaId];
  if (!want) return defs.filter(d => !isCatalogue(d.name) || d.name === 'find_tools');   // no CORE list (the concealed fourth): her tools as today plus find_tools; the catalogue opens by group
  const set = new Set(want); const out = defs.filter(d => set.has(d.name));
  return out.slice(0, MAX_CORE);
}
export function toolsForConversation(personaId, defs, meta) {
  const core = coreFor(personaId, defs);
  const inCore = new Set(core.map(d => d.name)); const open = new Set(openGroupNames(meta));
  const extra = open.size ? defs.filter(d => !inCore.has(d.name) && open.has(groupOf(d.name))) : [];
  return [...core, ...extra];
}

// find_tools: the ten best matches across everything the god is allowed, one
// line each, and their groups open for the rest of the conversation.
export function findTools(query, defs, meta, personaId) {
  const q = String(query || '').toLowerCase().trim(); const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const scored = defs.map(d => {
    const g = groupOf(d.name); if (g === 'hidden') return null;
    const hay = `${d.name.replace(/_/g, ' ')} ${g} ${d.description || ''}`.toLowerCase();
    let s = 0; for (const w of words) { if (d.name.includes(w)) s += 5; if (g.includes(w)) s += 3; if (hay.includes(w)) s += 1; }
    if (q && d.name.replace(/_/g, ' ').includes(q)) s += 6;
    return s > 0 ? { d, g, s } : null;
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 10);
  if (!scored.length) return `Nothing in the toolbox matches "${query}". The groups are: ${[...new Set(defs.map(d => groupOf(d.name)).filter(g => g !== 'hidden'))].sort().join(', ')}. Try one of those words.`;
  const groups = [...new Set(scored.map(x => x.g))];
  openGroups(meta, groups, `find_tools "${q.slice(0, 40)}"`);
  const core = new Set(coreFor(personaId, defs).map(d => d.name));
  return `Best matches for "${query}" (their groups — ${groups.join(', ')} — are now open for this conversation; call them directly next):\n` + scored.map(x => `- ${x.d.name} [${x.g}${core.has(x.d.name) ? ', core' : ''}]: ${String(x.d.description || '').slice(0, 140)}`).join('\n');
}
