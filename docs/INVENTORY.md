# Source inventory — 2026-09-14

Baseline: 212c067, current release lineage; pre-existing companion and extension edits preserved. The older rayven-pwa checkout and origin/main are not deployment baselines.

## Deployment

Worker `asgrard-backend`, entry `src/index.js`, static assets `public/`, run_worker_first=true. Frontend is deployed with the Worker, not independently via Pages. One five-minute cron. KV RAYVEN_KV, Vectorize VECTORIZE, Workers AI AI, R2 CLIPS, Durable Objects LEDGER and PAPER_LEDGER. Keep both existing DO migrations.

Cloudflare currently reports version b4370f11-1354-4457-81fe-ceae6446f9b7 at 100%. This is a baseline observation, not a new deployment.

## Existing subsystems

ALWAYS-ON companion: YES, asgard-companion/{asgard,wake,obs}.py. Installed at C:/Asgard/companion. HIGH SEAT: PARTIAL. PaperBroker and throwing LiveBroker, paper ledger, analytics and research exist; complete forty-strategy Forge/tournament is not established. Do not mark the entire brief complete. Test baseline: 187/187 Node tests passed.

## Registered tools and persona allow-lists

Derived by importing the real registry (no tool execution). Availability is not proof each external integration works.

| Tool | Allowed personas |
|---|---|
| notify_owner | thor, loki, odin, hela |
| web_search | thor, loki, odin, hela |
| tavily_research | thor, loki, odin, hela |
| tavily_extract | thor, loki, odin, hela |
| tavily_crawl | thor, loki, odin, hela |
| remember_this | thor, loki, odin, hela |
| search_memory | thor, loki, odin, hela |
| add_todo | thor, loki, odin, hela |
| list_todos | thor, loki, odin, hela |
| complete_todo | thor, loki, odin, hela |
| add_calendar_event | thor, loki, odin, hela |
| remove_calendar_event | thor, loki, odin, hela |
| list_calendar_events | thor, loki, odin, hela |
| add_content_idea | loki, odin, hela |
| list_content_ideas | loki, odin, hela |
| get_tool_permissions | thor, loki, odin, hela |
| clips_find | hela |
| clips_queue_add | hela |
| clips_queue | hela |
| lock_in | hela |
| stand_down | hela |
| vigil_status | hela |
| my_briefs | hela |
| keep_brief | hela |
| clear_briefs | hela |
| watch_subjects | hela |
| forge_every | hela |
| forge_budget | hela |
| my_capabilities | hela |
| learn_capability | hela |
| forget_capability | hela |
| use_capability | hela |
| forge_capability | hela |
| go_looking | hela |
| clips_queue_remove | hela |
| clips_set_accounts | hela |
| clips_publish_next | hela |
| ig_add_account | hela |
| ig_accounts | hela |
| ig_remove_account | hela |
| ig_post_reel | hela |
| ig_refresh_tokens | hela |
| clips_set_platforms | hela |
| clips_set_monthly_cap | hela |
| clips_status | hela |
| make_image | thor, loki, odin, hela |
| transcribe | thor, loki, odin, hela |
| translate | thor, loki, odin, hela |
| condense | thor, loki, odin, hela |
| weather | thor, loki, odin, hela |
| look_up | thor, loki, odin, hela |
| define | thor, loki, odin, hela |
| convert_money | thor, loki, odin, hela |
| holidays | thor, loki, odin, hela |
| set_timer | thor, loki, odin, hela |
| timers | thor, loki, odin, hela |
| cancel_timer | thor, loki, odin, hela |
| calculate | thor, loki, odin, hela |
| roll | thor, loki, odin, hela |
| world_time | thor, loki, odin, hela |
| days_until | thor, loki, odin, hela |
| vizard_clip | hela |
| clips_whop_set_campaign | hela |
| clips_whop_status | hela |
| clips_whop_inspect | hela |
| clips_whop_submit | hela |
| clips_whop_submit_pending | hela |
| clips_whop_auto | hela |
| browser_probe | thor, loki, odin, hela |
| vizard_jobs | hela |
| vizard_held | hela |
| vizard_approve | hela |
| vizard_cancel | hela |
| clips_set_campaign | hela |
| clips_analytics | hela |
| video_stats | odin, hela |
| video_segments | odin, hela |
| social_trends | odin, hela |
| news_search | thor, loki, odin, hela |
| crypto_price | odin, hela |
| stock_price | odin, hela |
| paper_trading_status | odin, hela |
| company_filings | odin, hela |
| token_search | odin, hela |
| golden_hour | thor, hela |
| air_quality | thor, loki, odin, hela |
| earthquakes | thor, hela |
| word_ideas | thor, loki, odin, hela |
| short_link | thor, loki, odin, hela |
| page_history | thor, loki, odin, hela |
| social_profile | odin, hela |
| audit_recent | hela |
| audit_turn | hela |
| audit_why | hela |
| list_allowed_hosts | thor, loki, odin, hela |
| allow_host | thor, loki, odin, hela |
| clips_standing_tags | hela |
| clips_clear_standing_tags | hela |
| clips_standing_tag_status | hela |
| clips_account_stats | hela |
| clips_campaign | hela |
| clips_clear_campaign | hela |
| clips_verify_accounts | hela |
| clips_history | hela |
| list_my_tools | thor, loki, odin, hela |
| set_tool_permission | thor, loki, odin, hela |
| send_text | thor, loki, odin, hela |
| make_call | thor, loki, odin, hela |
| spotify_play | thor, hela |
| spotify_shuffle_playlist | thor, hela |
| spotify_pause | thor, hela |
| spotify_resume | thor, hela |
| spotify_next | thor, hela |
| spotify_previous | thor, hela |
| spotify_seek | thor, hela |
| spotify_now_playing | thor, hela |
| play_youtube_video | thor, hela |
| browser_navigate | thor, loki, odin, hela |
| browser_click | thor, loki, odin, hela |
| browser_type | thor, loki, odin, hela |
| browser_read_page | thor, loki, odin, hela |
| browser_scroll | thor, loki, odin, hela |
| browser_screenshot | thor, loki, odin, hela |
| browser_click_coords | thor, loki, odin, hela |
| browser_type_coords | thor, loki, odin, hela |
| maps_search_places | thor, hela |
| maps_find_all_locations | thor, hela |
| maps_distances_between_locations | thor, hela |
| maps_find_gap_areas | thor, hela |
| maps_directions | thor, hela |
| maps_geocode | thor, hela |
| ask_jarvis | thor, hela |
| ask_kevos | thor, hela |
| ask_alternate_model | thor, loki, odin, hela |
| watch_add | thor, loki, odin, hela |
| watch_list | thor, loki, odin, hela |
| watch_remove | thor, loki, odin, hela |
| watch_pause | thor, loki, odin, hela |
| watch_resume | thor, loki, odin, hela |
| approvals_list | thor, loki, odin, hela |
| approve | thor, loki, odin, hela |
| reject | thor, loki, odin, hela |
| routine_create | thor, loki, odin, hela |
| routine_list | thor, loki, odin, hela |
| routine_pause | thor, loki, odin, hela |
| routine_resume | thor, loki, odin, hela |
| routine_delete | thor, loki, odin, hela |
| routine_run_now | thor, loki, odin, hela |
| routine_history | thor, loki, odin, hela |
| flag_capability | hela |
| delegate | thor, loki, odin, hela |
| trading_halt | odin, hela |
| trading_resume | odin, hela |
| trading_status | thor, odin, hela |
| trading_readiness | thor, odin, hela |
| paper_backtest | odin, hela |
| cost_report | thor, odin, hela |
| find_tools | thor, loki, odin, hela |
| routine_templates | thor, loki, odin, hela |
| routine_enable_template | thor, loki, odin, hela |
| read_document | thor, loki, odin, hela |
| read_page | thor, loki, odin, hela |
| rss_read | thor, loki, odin, hela |
| rss_watch | thor, loki, odin, hela |
| rss_unwatch | thor, loki, odin, hela |
| trending_now | thor, loki, odin, hela |
| hackernews | thor, loki, odin, hela |
| wayback | thor, loki, odin, hela |
| wiki_search | thor, loki, odin, hela |
| wiki_pageviews | thor, loki, odin, hela |
| arxiv_search | thor, loki, odin, hela |
| crossref_search | thor, loki, odin, hela |
| openlibrary_search | thor, loki, odin, hela |
| book_by_isbn | thor, loki, odin, hela |
| archive_search | thor, loki, odin, hela |
| federal_register | thor, loki, odin, hela |
| coingecko_price | thor, loki, odin, hela |
| coingecko_markets | thor, loki, odin, hela |
| coingecko_trending | thor, loki, odin, hela |
| defillama_tvl | thor, loki, odin, hela |
| btc_mempool | thor, loki, odin, hela |
| fear_greed | thor, loki, odin, hela |
| polymarket_markets | thor, loki, odin, hela |
| fx_rates | thor, loki, odin, hela |
| paper_equity_chart | thor, loki, odin, hela |
| nws_alerts | thor, loki, odin, hela |
| nws_forecast | thor, loki, odin, hela |
| quakes | thor, loki, odin, hela |
| calfire_incidents | thor, loki, odin, hela |
| space_weather | thor, loki, odin, hela |
| iss_now | thor, loki, odin, hela |
| nasa_apod | thor, loki, odin, hela |
| tides | thor, loki, odin, hela |
| elevation | thor, loki, odin, hela |
| zip_lookup | thor, loki, odin, hela |
| ip_geo | thor, loki, odin, hela |
| osm_search | thor, loki, odin, hela |
| osm_reverse | thor, loki, odin, hela |
| osm_nearby | thor, loki, odin, hela |
| country_info | thor, loki, odin, hela |
| world_bank | thor, loki, odin, hela |
| shopping_list | thor, loki, odin, hela |
| quick_note | thor, loki, odin, hela |
| notes_read | thor, loki, odin, hela |
| reading_list | thor, loki, odin, hela |
| habit_log | thor, loki, odin, hela |
| habits_status | thor, loki, odin, hela |
| expense_log | thor, loki, odin, hela |
| expenses_week | thor, loki, odin, hela |
| unit_convert | thor, loki, odin, hela |
| recipe_search | thor, loki, odin, hela |
| cocktail_search | thor, loki, odin, hela |
| food_by_barcode | thor, loki, odin, hela |
| exercises | thor, loki, odin, hela |
| vin_decode | thor, loki, odin, hela |
| recalls | thor, loki, odin, hela |
| cloudflare_status | thor, loki, odin, hela |
| npm_info | thor, loki, odin, hela |
| pypi_info | thor, loki, odin, hela |
| dns_lookup | thor, loki, odin, hela |
| whois | thor, loki, odin, hela |
| http_check | thor, loki, odin, hela |
| url_shorten | thor, loki, odin, hela |
| url_unshorten | thor, loki, odin, hela |
| qr_code | thor, loki, odin, hela |
| page_preview | thor, loki, odin, hela |
| color_info | thor, loki, odin, hela |
| text_hash | thor, loki, odin, hela |
| base64 | thor, loki, odin, hela |
| uuid | thor, loki, odin, hela |
| regex_test | thor, loki, odin, hela |
| json_pretty | thor, loki, odin, hela |
| tv_search | thor, loki, odin, hela |
| tv_tonight | thor, loki, odin, hela |
| game_deals | thor, loki, odin, hela |
| free_games | thor, loki, odin, hela |
| trivia | thor, loki, odin, hela |
| draw_cards | thor, loki, odin, hela |
| pokemon | thor, loki, odin, hela |
| dnd | thor, loki, odin, hela |
| mtg_card | thor, loki, odin, hela |
| dad_joke | thor, loki, odin, hela |
| joke | thor, loki, odin, hela |
| chuck_norris | thor, loki, odin, hela |
| advice | thor, loki, odin, hela |
| affirmation | thor, loki, odin, hela |
| quote | thor, loki, odin, hela |
| useless_fact | thor, loki, odin, hela |
| yes_or_no | thor, loki, odin, hela |
| random_dog | thor, loki, odin, hela |
| random_fox | thor, loki, odin, hela |
| random_cat | thor, loki, odin, hela |
| http_cat | thor, loki, odin, hela |
| robot_avatar | thor, loki, odin, hela |
| pixel_avatar | thor, loki, odin, hela |
| art_random | thor, loki, odin, hela |
| mcu_countdown | thor, loki, odin, hela |
| is_even | thor, loki, odin, hela |
| xkcd | thor, loki, odin, hela |
| meme_templates | thor, loki, odin, hela |
| star_wars | thor, loki, odin, hela |
| star_trek | thor, loki, odin, hela |
| rick_and_morty | thor, loki, odin, hela |
| describe_image | thor, loki, odin, hela |
| detect_objects | thor, loki, odin, hela |
| classify_image | thor, loki, odin, hela |
| sentiment | thor, loki, odin, hela |
| publish_note | thor, loki, odin, hela |
| memory_timeline | thor, loki, odin, hela |
| what_did_i_say_about | thor, loki, odin, hela |
| journal_write | thor, loki, odin, hela |
| journal_read | thor, loki, odin, hela |
| self_stats | thor, loki, odin, hela |
| ntfy_push | thor, loki, odin, hela |
| discord_webhook | thor, loki, odin, hela |
| share_file | thor, loki, odin, hela |
| jobs_search | thor, loki, odin, hela |
| company_lookup | thor, loki, odin, hela |
| github_project_review | thor, loki, odin, hela |
| frame_time_report | thor, loki, odin, hela |
| paper_account_health | thor, loki, odin, hela |
| paper_research_replay | thor, loki, odin, hela |
| paper_category_report | thor, loki, odin, hela |
| paper_risk_snapshot | thor, loki, odin, hela |
| paper_agent_review | thor, loki, odin, hela |
| paper_cost_sensitivity | thor, loki, odin, hela |
| paper_feed_health | thor, loki, odin, hela |
| crypto_orderbook_snapshot | thor, loki, odin, hela |
| market_session_clock | thor, loki, odin, hela |
| business_unit_economics | thor, loki, odin, hela |
| benchmark_compare | thor, loki, odin, hela |
| trade_expectancy_calculator | thor, loki, odin, hela |

## HTTP route declarations

Static source extraction includes conditional/dynamic patterns; delegated routers also appear below. Inspect source for authentication and methods.

- src/index.js:546: `if (url.pathname === '/mcp') {`
- src/index.js:550: `if (url.pathname.startsWith('/notes/') && request.method === 'GET') {`
- src/index.js:558: `if (url.pathname.startsWith('/share/') && request.method === 'GET') {`
- src/index.js:571: `if (url.pathname === '/admin/ledger-test' && request.method === 'GET') {`
- src/index.js:584: `if ((url.pathname === '/admin/tool-test' || url.pathname === '/admin/toolbox' || url.pathname === '/admin/core-tokens') && request.method === 'GET') {`
- src/index.js:588: `if (url.pathname === '/admin/tool-test') {`
- src/index.js:596: `if (url.pathname === '/admin/toolbox') {`
- src/index.js:616: `if (url.pathname === '/admin/vault.json' && request.method === 'GET') {`
- src/index.js:640: `if (url.pathname.startsWith('/debug-')) {`
- src/index.js:650: `if (url.pathname.startsWith('/phone-api/')) {`
- src/index.js:662: `if (url.pathname.startsWith('/admin/')) {`
- src/index.js:672: `if (url.pathname === '/admin/tools.json' && request.method === 'GET') {`
- src/index.js:681: `if (url.pathname === '/admin/webhooks' && request.method === 'GET') {`
- src/index.js:708: `if (url.pathname === '/ping') {`
- src/index.js:712: `if (url.pathname === '/agent/query' && request.method === 'POST') {`
- src/index.js:718: `if (url.pathname.startsWith('/telegram/') && request.method === 'POST') {`
- src/index.js:748: `if (url.pathname === '/agent/log') {`
- src/index.js:753: `if (url.pathname === '/debug-task-log') {`
- src/index.js:757: `if (url.pathname === '/activity') {`
- src/index.js:761: `if (url.pathname === '/notifications') {`
- src/index.js:765: `if (url.pathname === '/debug-flush-notifications') {`
- src/index.js:769: `if (url.pathname === '/monitors') {`
- src/index.js:779: `if (url.pathname === '/workspace/snapshot' && request.method === 'GET') {`
- src/index.js:782: `if (url.pathname === '/hud/summary') {`
- src/index.js:786: `if (url.pathname === '/paper-trading/status') {`
- src/index.js:793: `if(url.pathname==='/paper-trading/research')return json(await getPaperResearch(env),corsHeaders);`
- src/index.js:794: `if (url.pathname === '/paper-trading/charts') {`
- src/index.js:800: `if (url.pathname === '/debug-paper-force-trade') {`
- src/index.js:808: `if (url.pathname === '/debug-paper-run') {`
- src/index.js:812: `if (url.pathname === '/debug-paper-report-now') {`
- src/index.js:821: `if (url.pathname === '/debug-market-fetch') {`
- src/index.js:832: `if (url.pathname === '/debug-memory-migrate') {`
- src/index.js:836: `if (url.pathname === '/debug-monitor-sweep') {`
- src/index.js:848: `if (url.pathname === '/debug-telegram-webhook') {`
- src/index.js:912: `if (url.pathname === '/debug-telegram-diag') {`
- src/index.js:933: `if (url.pathname === '/debug-persona-test') {`
- src/index.js:960: `if (url.pathname === '/admin/approval-test') {`
- src/index.js:967: `if (url.pathname === '/admin/tick') {`
- src/index.js:975: `if (url.pathname === '/debug-autonomy') {`
- src/index.js:987: `if (url.pathname === '/debug-discard-held') {`
- src/index.js:992: `if (url.pathname === '/debug-whop-inspect') {`
- src/index.js:996: `if (url.pathname === '/debug-whop-status') {`
- src/index.js:1000: `if (url.pathname === '/debug-whop-submit') {`
- src/index.js:1004: `if (url.pathname === '/debug-pipeline') {`
- src/index.js:1008: `if (url.pathname === '/debug-approve-clips') {`
- src/index.js:1012: `if (url.pathname === '/debug-vizard-submit') {`
- src/index.js:1016: `if (url.pathname === '/debug-vizard-accounts') {`
- src/index.js:1022: `if (url.pathname === '/debug-account-stats') {`
- src/index.js:1026: `if (url.pathname === '/debug-clips-analytics') {`
- src/index.js:1032: `if (url.pathname === '/debug-clips-verify') {`
- src/index.js:1038: `if (url.pathname === '/debug-selfcheck') {`
- src/index.js:1045: `if (url.pathname === '/healthz' && request.method === 'GET') {`
- src/index.js:1054: `if (url.pathname === '/council/status' && request.method === 'GET') {`
- src/index.js:1060: `if (url.pathname === '/status' && request.method === 'GET') {`
- src/index.js:1070: `if (url.pathname === '/roundtable' && request.method === 'POST') {`
- src/index.js:1076: `if (url.pathname === '/debug-test-notify' && request.method === 'POST') {`
- src/index.js:1090: `if (url.pathname === '/memory' && request.method === 'GET') {`
- src/index.js:1096: `if (url.pathname === '/memory/map' && request.method === 'GET') {`
- src/index.js:1101: `if (url.pathname === '/memory/share' && request.method === 'POST') {`
- src/index.js:1108: `if (url.pathname === '/memory/update' && request.method === 'POST') {`
- src/index.js:1115: `if (url.pathname === '/memory/delete' && request.method === 'POST') {`
- src/index.js:1121: `if (url.pathname === '/todos' && request.method === 'GET') {`
- src/index.js:1126: `if (url.pathname === '/todos' && request.method === 'POST') {`
- src/index.js:1147: `if (url.pathname === '/calendar' && request.method === 'GET') {`
- src/index.js:1151: `if (url.pathname === '/calendar' && request.method === 'POST') {`
- src/index.js:1165: `if (url.pathname === '/history' && request.method === 'GET') {`
- src/index.js:1175: `if (url.pathname === '/permissions' && request.method === 'GET') {`
- src/index.js:1183: `if (url.pathname === '/permissions/all' && request.method === 'GET') {`
- src/index.js:1195: `if (url.pathname === '/permissions' && request.method === 'POST') {`
- src/index.js:1205: `if (kvListRoutes[url.pathname]) {`
- src/index.js:1231: `if (url.pathname === '/loki/brief-latest' && request.method === 'GET') {`
- src/index.js:1236: `if (url.pathname === '/loki/brief-now' && request.method === 'POST') {`
- src/index.js:1240: `if (url.pathname === '/odin/reports' && request.method === 'GET') {`
- src/index.js:1244: `if (url.pathname === '/odin/report-now' && request.method === 'POST') {`
- src/index.js:1251: `if (url.pathname === '/assistant-config' && request.method === 'GET') {`
- src/index.js:1257: `if (url.pathname === '/assistant-config' && request.method === 'POST') {`
- src/index.js:1265: `if (url.pathname === '/spotify/now-playing' && request.method === 'GET') {`
- src/index.js:1269: `if (url.pathname === '/spotify/control' && request.method === 'POST') {`
- src/index.js:1279: `if (url.pathname === '/browser/status' && request.method === 'GET') {`
- src/index.js:1286: `if (url.pathname === '/debug-reset-history') {`
- src/index.js:1293: `if (url.pathname === '/debug-show-history') {`
- src/index.js:1300: `if (url.pathname === '/debug-show-chat') {`
- src/index.js:1307: `if (url.pathname === '/debug-checkin') {`
- src/index.js:1311: `if (url.pathname === '/debug-morning-briefing') {`
- src/index.js:1315: `if (url.pathname === '/debug-code-check') {`
- src/index.js:1323: `if (url.pathname === '/debug-maps-test') {`
- src/index.js:1347: `if (url.pathname.startsWith('/voice/audio/') && request.method === 'GET') {`
- src/index.js:1361: `if (url.pathname === '/voice/turn' && request.method === 'POST') {`
- src/index.js:1415: `if (url.pathname === '/voice/transcript' && request.method === 'GET') {`
- src/index.js:1420: `if (url.pathname === '/tts' && request.method === 'POST') {`
- src/index.js:1461: `if (url.pathname === '/browser/poll' && request.method === 'GET') {`
- src/index.js:1485: `if (url.pathname === '/browser/result' && request.method === 'POST') {`
- src/index.js:1491: `if (url.pathname === '/spotify/login') {`
- src/index.js:1495: `if (url.pathname === '/spotify/callback') {`
- src/index.js:1508: `const legacy = url.pathname.match(/^\/(thor|loki|odin)\/?$/);`
- src/index.js:1514: `const oldWorkspace = url.pathname.match(/^\/(hall|hud|hub)(?:\/index\.html|\/)?$/);`
- src/index.js:1519: `if (url.pathname === '/odinhud.html') target.searchParams.set('persona','odin');`
- src/index.js:1520: `if (url.pathname === '/team.html') target.searchParams.set('panel','council');`
- src/lib/world.js:57: `if (u.hostname.replace(/^www\./, '') === 'youtu.be') return u.pathname.slice(1, 12);`
- src/lib/world.js:60: `const m = u.pathname.match(/\/(shorts|embed|v)\/([A-Za-z0-9_-]{11})/);`
- src/tools/catalog-research.js:19: `async run(env, { url }) { const r = await httpFetch(env, url, { binary: true, accept: '*/*', maxBytes: 1024 * 1024 }); if (!r.ok) return errorText('read_document', r); const name = (() => { try { return new URL(url).pathname.split('/').pop() || 'document'; } catch (e) { return 'document'; } })(); const md = await toMarkdown(env, name, r.bytes, r.contentType.split(';')[0]); if (md) return docClip(md); if (/text\/|json|xml/i.test(r.contentType)) return docClip(stripTags(new TextDecoder().decode(r.bytes))); return \`read_document: Workers AI could not convert ${r.contentType || 'that file type'} (${r.bytes.byteLength} bytes).\`; } },`

## Environment names

Includes bindings and configuration variables as well as secrets; absent from secret list does not imply missing binding. Presence is not validity.

| Name | Wrangler secret list |
|---|---|
| ADMIN_TOKEN | set |
| AGENT_KEY_JARVIS_RAYVEN | set |
| AGENT_KEY_RAYVEN_KEVOS | set |
| AI | not listed (binding/var/optional/missing) |
| ANTHROPIC_API_KEY | set |
| ASGARD_COMPANION_TOKEN | set |
| ASGARD_CONTACT | not listed (binding/var/optional/missing) |
| ASSETS | not listed (binding/var/optional/missing) |
| AYRSHARE_API_KEY | set |
| CF_ACCOUNT_ID | not listed (binding/var/optional/missing) |
| CF_ANALYTICS_TOKEN | not listed (binding/var/optional/missing) |
| CLIPS | not listed (binding/var/optional/missing) |
| DEBUG_SECRET | set |
| DISCORD_WEBHOOK_URL | not listed (binding/var/optional/missing) |
| ELEVENLABS_API_KEY | set |
| ELEVENLABS_VOICE_ID | not listed (binding/var/optional/missing) |
| GOOGLE_MAPS_API_KEY | set |
| GROQ_API_KEY | not listed (binding/var/optional/missing) |
| JARVIS_AGENT_URL | not listed (binding/var/optional/missing) |
| KEVOS_AGENT_URL | not listed (binding/var/optional/missing) |
| KEY | not listed (binding/var/optional/missing) |
| LEDGER | not listed (binding/var/optional/missing) |
| LEDGER_BACKEND | not listed (binding/var/optional/missing) |
| LIVE_BROKER_KEY | not listed (binding/var/optional/missing) |
| NASA_API_KEY | not listed (binding/var/optional/missing) |
| NTFY_TOPIC | not listed (binding/var/optional/missing) |
| OPENROUTER_API_KEY | set |
| PAPER_LEDGER | not listed (binding/var/optional/missing) |
| PHONE_SETUP_TOKEN | set |
| PUBLIC_BASE_URL | not listed (binding/var/optional/missing) |
| R2_PUBLIC_BASE | not listed (binding/var/optional/missing) |
| RAYVEN_KV | not listed (binding/var/optional/missing) |
| SERPAPI_KEY | set |
| SPOTIFY_CLIENT_ID | set |
| SPOTIFY_CLIENT_SECRET | set |
| TAVILY_API_KEY | set |
| TELEGRAM_BOT_TOKEN | set |
| TELEGRAM_WEBHOOK_HOST | not listed (binding/var/optional/missing) |
| TELEGRAM_WEBHOOK_SECRET | set |
| TWELVE_DATA_API_KEY | set |
| TWILIO_ACCOUNT_SID | set |
| TWILIO_AUTH_TOKEN | set |
| TWILIO_PHONE_NUMBER | set |
| TWITCH_CLIENT_ID | set |
| TWITCH_CLIENT_SECRET | set |
| UPLOAD_POST_API_KEY | not listed (binding/var/optional/missing) |
| VECTORIZE | not listed (binding/var/optional/missing) |
| VIZARD_API_KEY | set |

## KV and ledger key declarations

Static candidate extraction; dynamic keys require source inspection. Existing names are preserved.

- `activity:`
- `activity:log`
- `addr:housenumber`
- `addr:street`
- `agent:`
- `agent:${from}:count:${new Date().toISOString().slice(0, 10)}`
- `agent:autonomy:log`
- `agent:log`
- `approval:`
- `approve:${id}`
- `arbeitnow:${j.slug}`
- `arr:${v.length}`
- `audit:index`
- `autonomy:${personaId}:state`
- `base64: ${e.message}`
- `bls_latest: ${(r.json && r.json.message || []).join(`
- `briefing:last_date`
- `browser:command`
- `browser:lastpoll`
- `browser:result:${body.id}`
- `browser:result:${id}`
- `calendar:events`
- `call:purpose`
- `call:transcript`
- `callaudio:${id}`
- `checkin:last_run`
- `classify_image: Workers AI said — ${e.message}`
- `clipping:accounts`
- `clips:accounts`
- `clips:campaign`
- `clips:last_run`
- `clips:monthly`
- `clips:monthly_cap`
- `clips:platforms`
- `clips:posted`
- `clips:queue`
- `clips:social_snapshot`
- `clips:standing_tags`
- `clips:started_at`
- `clips:twitch_token`
- `cloudflare:workers`
- `codecheck:last_run`
- `codecheck:result`
- `config:loki:brief:hour`
- `config:odin:report:day`
- `config:odin:report:hour`
- `config:paper:report:hour`
- `config:trading:halt`
- `config:trading:live_ack`
- `config:trading:live_ack holds a phrase Rayan typed through a go-live tool`
- `config:trading:mode`
- `config:trading:risk`
- `config:yield:level`
- `content:ideas`
- `cost:${last.day}`
- `cost:${new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)}`
- `council:${COUNCIL[id].owner}:${id}`
- `council:loki:kang`
- `daily:`
- `dc:date`
- `default: 0.05% slippage, no commission`
- `deferred:`
- `defillama_tvl: unexpected answer `
- `describe_image: Workers AI said — ${e.message}`
- `detect_objects: Workers AI said — ${e.message}`
- `discord_webhook: ${e.message}`
- `discord_webhook: DISCORD_WEBHOOK_URL is not set (Rayan adds it as a secret if he wants this).`
- `discord_webhook: Discord answered HTTP ${r.status}`
- `discord_webhook: the configured URL is not a Discord webhook.`
- `dropped: still ${st.status} after 26 h`
- `egress:allowed_hosts`
- `elevation: no value for that point`
- `error: ${err.message}`
- `event:`
- `exercises: pick one of ${Object.keys(MAP).join(`
- `extension: ${h.extension.online ? `
- `fear_greed: no data`
- `forge:${id}:cap`
- `forge:${id}:caps`
- `forge:${id}:last`
- `forge:${id}:month`
- `forge:${id}:ms`
- `forge:turn`
- `github_activity: give the repo as owner/name.`
- `giveaways: ${g.error}`
- `halted: ${halt.reason || `
- `hela:`
- `hela:briefs`
- `hela:caps`
- `hela:daily:`
- `hela:daily_last`
- `hela:forge_cap`
- `hela:forge_last`
- `hela:forge_month`
- `hela:forge_ms`
- `hela:locked`
- `hela:seen`
- `hela:topics`
- `hela:vigil_last`
- `https:`
- `ig:accounts`
- `ig:last_refresh`
- `job-error:`
- `jobicy:${j.id}`
- `journal:entries`
- `kit:timers`
- `life:expenses`
- `life:habits`
- `life:notes`
- `life:reading`
- `life:shopping`
- `loki:brief:last_date`
- `loki:brief:latest`
- `loki:nag:${todo.id}:level${level}`
- `memory:longterm`
- `memory:longterm:hela`
- `memory:longterm:loki`
- `memory:longterm:odin`
- `mode: paper. No live path exists.`
- `monitor:${watch.id}:${newHash}`
- `monitor:${watch.id}:${newResults.map(r => r.url).sort().join(`
- `monitor:list`
- `muse:${j.id}`
- `network: ${e && e.message}`
- `network: ${e.message}`
- `notif:cooldown:${await sha256Hex(effectiveDedupeKey)}`
- `notif:digest_last_flush`
- `notif:digest_queue`
- `notif:log`
- `notif:rate:${currentHourBucket()}`
- `ntfy_push: ${e.message}`
- `ntfy_push: ntfy answered HTTP ${r.status} ${(await r.text()).slice(0, 200)}`
- `nws_forecast: no forecast office for that point (US only).`
- `odin:goals`
- `odin:kpis`
- `odin:pulse:${todayStamp()}`
- `odin:report:last_date`
- `odin:reports`
- `optional: what to look for`
- `page_preview: ${(r.json || {}).message || `
- `paper:`
- `paper: unavailable`
- `paper:archive:`
- `paper:candles:`
- `paper:candles:${a.id}`
- `paper:candles:${agentId}`
- `paper:candles:${id}`
- `paper:close:last_date`
- `paper:decisions`
- `paper:equity`
- `paper:heartbeat`
- `paper:journal:${id}`
- `paper:lastCandle:${agentId}`
- `paper:migration`
- `paper:portfolio`
- `paper:report:failures`
- `paper:report:last_date`
- `paper:stats:${id}`
- `paper:trades`
- `pending:${assistant}`
- `pending:${personaId}`
- `pending:<id>`
- `phone:inbound-backup`
- `phone:state`
- `problems: ${h.problems.join(`
- `publish_note: no R2 bucket is bound.`
- `rayan:private_chat_id`
- `read_document: Workers AI could not convert ${r.contentType || `
- `refused: ${failed.join(`
- `regex_test: ${e.message}`
- `reject:${id}`
- `remotive:${j.id}`
- `routine-batch:${r.id}`
- `routine:${routine.id}`
- `routine:${routine.id}:${Date.now()}`
- `routines:${id}`
- `routines:index`
- `search: ${w.target}`
- `sentiment: Workers AI said — ${e.message}`
- `share_file: ADMIN_TOKEN is not set, so links cannot be signed.`
- `share_file: no R2 bucket is bound.`
- `share_file: no object at ${k}.`
- `share_file: refused — ${k} is under a protected prefix or is not a valid key.`
- `shared:${item.prov.source}`
- `spotify:refresh_token`
- `status:${id}`
- `status:${personaId}`
- `stooq_quote: no data for ${symbol}`
- `str:${v.length}`
- `system:batches`
- `system:health`
- `system:vault_backup_last`
- `task:log`
- `telegram: no chat/bot`
- `telegram:${chatId}`
- `telegram:bot_info`
- `telegram:bot_info:${personaId}`
- `template:${id}`
- `test:`
- `tg:hops:${telegramChatId}`
- `tg:persona:${chatId}`
- `tg:update:${personaId}:${updateId}`
- `thor:selfcheck:${failures.map(f => f.name).join(`
- `tick: R2 audit copy failed:`
- `tick:${b.day}:%`
- `tick:${d.toISOString().slice(0, 10)}:${String(d.getUTCHours()).padStart(2, `
- `tick:${target}:`
- `tick:YYYY-MM-DD:HHMM`
- `tick:last`
- `tides: no predictions for station ${station} (${(r.json && r.json.error && r.json.error.message) || `
- `timer:${t.id}`
- `treasury_yields: the feed had no entries yet this month.`
- `unauthorized: Bearer token required`
- `unit_convert: I can`
- `unit_convert: the value must be a number.`
- `uptrend: 8-bar avg ${fast.toFixed(2)} > 21-bar avg ${slow.toFixed(2)}${adx !== null ? `
- `url_shorten: ${g.why}`
- `vin_decode: ${v.ErrorText || `
- `vizard:`
- `vizard:${job.projectId}:${c.videoId}`
- `vizard:auto`
- `vizard:done:${job.projectId}`
- `vizard:held`
- `vizard:held:${job.projectId}`
- `vizard:jobs`
- `vizard:last_poll`
- `web:${personaId}`
- `web:<id>`
- `web:main`
- `what_did_i_say_about: ${e.message}`
- `whop:auto`
- `whop:campaign_url`
- `whop:last_attempt`
- `whop:last_run`
- `whop:submitted`
- `world:${url}`
- `world_bank: no data for ${indicator} / ${country}.`

## Extension permissions and backend endpoints

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "ASGARD Browser Control",
  "version": "1.4",
  "permissions": [
    "tabs",
    "scripting",
    "activeTab",
    "alarms",
    "debugger"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  }
}

```
### asgard-face/manifest.json

```json
{
  "manifest_version": 3,
  "name": "Asgard",
  "description": "Voice companion controls and your original Asgard website in a compact agent window.",
  "version": "1.1.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "background": {"service_worker": "background.js"},
  "action": {"default_popup": "popup.html", "default_icon": "icon.png"},
  "icons": {"128": "icon.png"},
  "options_page": "options.html",
  "content_security_policy": {"extension_pages": "script-src 'self'; object-src 'none'; connect-src ws://127.0.0.1:*"}
}

```

Backend URLs found in extension sources:
- https://asgrard-backend.rayanfahil2.workers.dev

## Public HTML pages

- public/command-center.html
- public/completion-checklist.html
- public/fx-lab.html
- public/hall/index.html
- public/halls-preview.html
- public/hub/index.html
- public/hud/index.html
- public/index.html
- public/odinhud.html
- public/performance-lab.html
- public/phone/index.html
- public/setup-guide.html
- public/team.html
- public/trading-lab.html

## File map

Classification by source location; not a claim of individual feature acceptance.

| Path | Purpose |
|---|---|
| .gitattributes | Repository support file (inspect before modifying) |
| .gitignore | Repository support file (inspect before modifying) |
| ASGARD-TRADING-AUDIT.md | Repository support file (inspect before modifying) |
| ASGARD-UPGRADE-ROADMAP.md | Repository support file (inspect before modifying) |
| CLAUDE.md | Repository support file (inspect before modifying) |
| PHONE-UPDATES.md | Repository support file (inspect before modifying) |
| README-ASGARD.md | Repository support file (inspect before modifying) |
| README.md | Repository support file (inspect before modifying) |
| RGB-SETUP.md | Repository support file (inspect before modifying) |
| WORK-SUMMARY-2026-09-11-12.md | Repository support file (inspect before modifying) |
| asgard-companion/INSTALL-ASGARD.bat | Windows voice companion |
| asgard-companion/NEXT-STEPS.txt | Windows voice companion |
| asgard-companion/README.md | Windows voice companion |
| asgard-companion/SETUP.html | Windows voice companion |
| asgard-companion/UNINSTALL-ASGARD.bat | Windows voice companion |
| asgard-companion/VERIFICATION.md | Windows voice companion |
| asgard-companion/actions.py | Windows voice companion |
| asgard-companion/asgard.py | Windows voice companion |
| asgard-companion/audio.py | Windows voice companion |
| asgard-companion/brain.py | Windows voice companion |
| asgard-companion/config.py | Windows voice companion |
| asgard-companion/fastpath.py | Windows voice companion |
| asgard-companion/obs.py | Windows voice companion |
| asgard-companion/requirements.txt | Windows voice companion |
| asgard-companion/routines.py | Windows voice companion |
| asgard-companion/server.py | Windows voice companion |
| asgard-companion/setup.ps1 | Windows voice companion |
| asgard-companion/speak.py | Windows voice companion |
| asgard-companion/stt.py | Windows voice companion |
| asgard-companion/tests/conftest.py | Windows voice companion |
| asgard-companion/tests/test_actions.py | Windows voice companion |
| asgard-companion/tests/test_fastpath.py | Windows voice companion |
| asgard-companion/tests/test_routines.py | Windows voice companion |
| asgard-companion/tools/configure-face.py | Windows voice companion |
| asgard-companion/tools/configure-scene.py | Windows voice companion |
| asgard-companion/tools/configure.py | Windows voice companion |
| asgard-companion/tools/deploy-worker.py | Windows voice companion |
| asgard-companion/tools/render-voices.py | Windows voice companion |
| asgard-companion/tools/self-test.py | Windows voice companion |
| asgard-companion/uninstall.ps1 | Windows voice companion |
| asgard-companion/wake.py | Windows voice companion |
| asgard-companion/watchdog.ps1 | Windows voice companion |
| asgard-face/README.md | Agent-face Chrome extension |
| asgard-face/background.js | Agent-face Chrome extension |
| asgard-face/icon.png | Agent-face Chrome extension |
| asgard-face/manifest.json | Agent-face Chrome extension |
| asgard-face/open-face.js | Agent-face Chrome extension |
| asgard-face/options.html | Agent-face Chrome extension |
| asgard-face/options.js | Agent-face Chrome extension |
| asgard-face/overlay.js | Agent-face Chrome extension |
| asgard-face/popup.html | Agent-face Chrome extension |
| asgard-face/popup.js | Agent-face Chrome extension |
| asgard-face/style.css | Agent-face Chrome extension |
| asgard-reference-build-pack/START-HERE.md | Repository support file (inspect before modifying) |
| asgard-reference-build-pack/references/loki.jpg | Media asset |
| asgard-reference-build-pack/references/odin.jpg | Media asset |
| asgard-reference-build-pack/references/thor.jpg | Media asset |
| background.js | Repository support file (inspect before modifying) |
| design_handoff_asgard_hud/Asgard HUD.dc.html | UI source / page |
| design_handoff_asgard_hud/README.md | Repository support file (inspect before modifying) |
| design_handoff_solar_throne/README.md | Repository support file (inspect before modifying) |
| design_handoff_solar_throne/solar-throne.html | UI source / page |
| design_handoff_solar_throne/three-d-stage.js | Repository support file (inspect before modifying) |
| docs/ALWAYS-ON.txt | Documentation / evidence |
| docs/ASGARD-MASTER.txt | Documentation / evidence |
| docs/ASGARD_MANIFEST.md | Documentation / evidence |
| docs/ASGARD_UPGRADE_REPORT.md | Documentation / evidence |
| docs/AURUM-RELEASE.md | Documentation / evidence |
| docs/BUILD-MANIFEST.txt | Documentation / evidence |
| docs/CODEX-EVERYTHING-ONE-FILE.txt | Documentation / evidence |
| docs/CODEX-JOBS-REPORT.md | Documentation / evidence |
| docs/CODEX-RUN-EVERYTHING.txt | Documentation / evidence |
| docs/COMMAND-IDENTITY-RELEASE.md | Documentation / evidence |
| docs/CONSTELLATION-RELEASE.md | Documentation / evidence |
| docs/CORE.md | Documentation / evidence |
| docs/CORE_MODULE_CONTRACT.md | Documentation / evidence |
| docs/EVERYTHING.txt | Documentation / evidence |
| docs/GOLD-VISOR-SURGE-RELEASE.md | Documentation / evidence |
| docs/HALLS_INSTALL.md | Documentation / evidence |
| docs/IMMERSIVE-GOLD-RELEASE.md | Documentation / evidence |
| docs/MIGRATION.md | Documentation / evidence |
| docs/NEXT-STEPS-HUMAN.md | Documentation / evidence |
| docs/ODIN-HIGH-SEAT.txt | Documentation / evidence |
| docs/ORBITAL-COUNCIL-RELEASE.md | Documentation / evidence |
| docs/PERSONA-TRANSITION-RELEASE.md | Documentation / evidence |
| docs/PHONE-HOME-RELEASE.md | Documentation / evidence |
| docs/PROGRESS.md | Documentation / evidence |
| docs/SECURITY-SCAN.md | Documentation / evidence |
| docs/SIBLINGS_PROTOCOL.md | Documentation / evidence |
| docs/STRIKE_ONE_ANCHORS.md | Documentation / evidence |
| docs/STRIKE_THREE_PROGRESS.md | Documentation / evidence |
| docs/TOOLS.json | Documentation / evidence |
| docs/TOOL_TESTS.md | Documentation / evidence |
| docs/UPGRADE_PROGRESS.md | Documentation / evidence |
| docs/WARDEN-MOTION.md | Documentation / evidence |
| docs/WARDEN-RELEASE.md | Documentation / evidence |
| docs/WARDEN-WORKSPACE.md | Documentation / evidence |
| docs/ZENITH-RELEASE.md | Documentation / evidence |
| docs/asgard-hud/IMPLEMENTATION.md | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/before-preload-canary.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/before-preload-promotion.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/before-preload-upload.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/final-release-tests.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/focused-tests.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/main-tests.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/monitor.mjs | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/original-version.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-assets.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-canary.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-observation-retry.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-observation.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-promotion.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-upload.txt | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/preload-version.json | Documentation / evidence |
| docs/asgard-hud/real-data-evidence/release-tests.txt | Documentation / evidence |
| docs/asgardupgrade.txt | Documentation / evidence |
| docs/astral-cartographer/DEPLOYMENT.md | Documentation / evidence |
| docs/astral-cartographer/IMPLEMENTATION.md | Documentation / evidence |
| docs/astral-cartographer/evidence/animated-desktop.png | Documentation / evidence |
| docs/astral-cartographer/evidence/animation-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/assets-canary.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/assets-live.json | Documentation / evidence |
| docs/astral-cartographer/evidence/assets-observation.json | Documentation / evidence |
| docs/astral-cartographer/evidence/assets-pinned.json | Documentation / evidence |
| docs/astral-cartographer/evidence/assets-promotion.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-assets-canary.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-assets-promotion.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-assets.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-index-canary.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-index-promotion.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/before-index.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/conversation-fixture.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/desktop-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/desktop.png | Documentation / evidence |
| docs/astral-cartographer/evidence/final-status.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/index-canary.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/index-observation.json | Documentation / evidence |
| docs/astral-cartographer/evidence/index-pinned.json | Documentation / evidence |
| docs/astral-cartographer/evidence/index-promotion.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/lifecycle-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/live-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/live-desktop.png | Documentation / evidence |
| docs/astral-cartographer/evidence/live-legacy.json | Documentation / evidence |
| docs/astral-cartographer/evidence/live-primary.json | Documentation / evidence |
| docs/astral-cartographer/evidence/mobile-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/mobile.png | Documentation / evidence |
| docs/astral-cartographer/evidence/reference.png | Documentation / evidence |
| docs/astral-cartographer/evidence/tests.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/unpinned-browser.txt | Documentation / evidence |
| docs/astral-cartographer/evidence/worker-errors.txt | Documentation / evidence |
| docs/bifrost/CAPABILITY-STATUS.json | Documentation / evidence |
| docs/bifrost/CAPABILITY-STATUS.md | Documentation / evidence |
| docs/bifrost/DEPLOYMENT.md | Documentation / evidence |
| docs/bifrost/DESIGN-DIRECTION.md | Documentation / evidence |
| docs/bifrost/FINAL-REPORT.md | Documentation / evidence |
| docs/bifrost/HANDOFF.md | Documentation / evidence |
| docs/bifrost/IMPROVEMENT-LEDGER.md | Documentation / evidence |
| docs/bifrost/INTERACTION-NOTES.md | Documentation / evidence |
| docs/bifrost/LIVE-ROUTE-DIAGNOSIS.md | Documentation / evidence |
| docs/bifrost/MASTER-REFERENCE.md | Documentation / evidence |
| docs/bifrost/RENDER-NOTES.md | Documentation / evidence |
| docs/bifrost/USER-GUIDE.md | Documentation / evidence |
| docs/bifrost/VERIFICATION.md | Documentation / evidence |
| docs/bifrost/evidence/active-deployment.json | Documentation / evidence |
| docs/bifrost/evidence/browser-interactions.txt | Documentation / evidence |
| docs/bifrost/evidence/browser-receipts.txt | Documentation / evidence |
| docs/bifrost/evidence/browser-visual.txt | Documentation / evidence |
| docs/bifrost/evidence/calculation-receipt.json | Documentation / evidence |
| docs/bifrost/evidence/catalogue.txt | Documentation / evidence |
| docs/bifrost/evidence/conversation-receipt.png | Documentation / evidence |
| docs/bifrost/evidence/deploy-dry-run.txt | Documentation / evidence |
| docs/bifrost/evidence/deploy.txt | Documentation / evidence |
| docs/bifrost/evidence/live-assets.json | Documentation / evidence |
| docs/bifrost/evidence/live-bifrost.webm | Documentation / evidence |
| docs/bifrost/evidence/live-browser.json | Documentation / evidence |
| docs/bifrost/evidence/live-chat.png | Documentation / evidence |
| docs/bifrost/evidence/live-loki-phone.png | Documentation / evidence |
| docs/bifrost/evidence/live-loki.png | Documentation / evidence |
| docs/bifrost/evidence/live-odin.png | Documentation / evidence |
| docs/bifrost/evidence/live-thor.png | Documentation / evidence |
| docs/bifrost/evidence/local-action-receipt.png | Documentation / evidence |
| docs/bifrost/evidence/loki-320x844.png | Documentation / evidence |
| docs/bifrost/evidence/loki-390x844.png | Documentation / evidence |
| docs/bifrost/evidence/loki-desktop.png | Documentation / evidence |
| docs/bifrost/evidence/long-conversation.png | Documentation / evidence |
| docs/bifrost/evidence/odin-desktop.png | Documentation / evidence |
| docs/bifrost/evidence/odin-grayscale.png | Documentation / evidence |
| docs/bifrost/evidence/odin-orbit.png | Documentation / evidence |
| docs/bifrost/evidence/performance.txt | Documentation / evidence |
| docs/bifrost/evidence/phone-keyboard-viewport.png | Documentation / evidence |
| docs/bifrost/evidence/recoverable-error.png | Documentation / evidence |
| docs/bifrost/evidence/release-proof.json | Documentation / evidence |
| docs/bifrost/evidence/render-unavailable.png | Documentation / evidence |
| docs/bifrost/evidence/route-checks.json | Documentation / evidence |
| docs/bifrost/evidence/smoke.txt | Documentation / evidence |
| docs/bifrost/evidence/software-thor.png | Documentation / evidence |
| docs/bifrost/evidence/tests.txt | Documentation / evidence |
| docs/bifrost/evidence/thor-desktop.png | Documentation / evidence |
| docs/completion-checklist-2026-09-12.md | Documentation / evidence |
| docs/floating-realms/DEPLOYMENT.md | Documentation / evidence |
| docs/floating-realms/HANDOFF.md | Documentation / evidence |
| docs/floating-realms/REPORT.md | Documentation / evidence |
| docs/floating-realms/VERIFICATION.md | Documentation / evidence |
| docs/floating-realms/evidence/active-deployment.json | Documentation / evidence |
| docs/floating-realms/evidence/browser-1440.json | Documentation / evidence |
| docs/floating-realms/evidence/browser-320.json | Documentation / evidence |
| docs/floating-realms/evidence/browser-390.json | Documentation / evidence |
| docs/floating-realms/evidence/conversation.json | Documentation / evidence |
| docs/floating-realms/evidence/deploy.txt | Documentation / evidence |
| docs/floating-realms/evidence/floating-live-chat.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-live-loki-phone.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-live-loki.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-live-odin.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-live-thor.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-loki-1440.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-loki-320.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-loki-390-opposite.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-loki-390.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-odin-1440-opposite.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-odin-1440.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-odin-320.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-odin-390.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-thor-1440.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-thor-320-opposite.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-thor-320.png | Documentation / evidence |
| docs/floating-realms/evidence/floating-thor-390.png | Documentation / evidence |
| docs/floating-realms/evidence/legacy-assets.json | Documentation / evidence |
| docs/floating-realms/evidence/live-assets.json | Documentation / evidence |
| docs/floating-realms/evidence/live-before-release.json | Documentation / evidence |
| docs/floating-realms/evidence/live-browser.json | Documentation / evidence |
| docs/floating-realms/evidence/motion.json | Documentation / evidence |
| docs/floating-realms/evidence/pointer.json | Documentation / evidence |
| docs/floating-realms/evidence/source-tests.txt | Documentation / evidence |
| docs/floating-realms/evidence/tests.txt | Documentation / evidence |
| docs/floating-realms/geometry-review.html | Documentation / evidence |
| docs/hologram-upgrade/DESIGN-DIRECTION.md | Documentation / evidence |
| docs/hologram-upgrade/FINAL-REPORT.md | Documentation / evidence |
| docs/hologram-upgrade/HANDOFF.md | Documentation / evidence |
| docs/hologram-upgrade/INSPIRATION.md | Documentation / evidence |
| docs/hologram-upgrade/USER-GUIDE.md | Documentation / evidence |
| docs/hologram-upgrade/VERIFICATION.md | Documentation / evidence |
| docs/hologram-upgrade/evidence/diff-check.txt | Documentation / evidence |
| docs/hologram-upgrade/evidence/loki-phone.jpg | Documentation / evidence |
| docs/hologram-upgrade/evidence/odin-desktop.jpg | Documentation / evidence |
| docs/hologram-upgrade/evidence/smoke.txt | Documentation / evidence |
| docs/hologram-upgrade/evidence/tests.txt | Documentation / evidence |
| docs/hologram-upgrade/evidence/thor-desktop.jpg | Documentation / evidence |
| docs/phone-release-2026-09-12.md | Documentation / evidence |
| docs/prism-foundry/DEPLOYMENT.md | Documentation / evidence |
| docs/prism-foundry/GREEN-UPDATE.md | Documentation / evidence |
| docs/prism-foundry/evidence/assets-canary-deploy.txt | Documentation / evidence |
| docs/prism-foundry/evidence/assets-live.json | Documentation / evidence |
| docs/prism-foundry/evidence/assets-observation.json | Documentation / evidence |
| docs/prism-foundry/evidence/assets-pinned.json | Documentation / evidence |
| docs/prism-foundry/evidence/assets-promotion.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-assets-canary.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-assets-promotion.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-assets.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-index-canary.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-index-promotion.txt | Documentation / evidence |
| docs/prism-foundry/evidence/before-index-upload.txt | Documentation / evidence |
| docs/prism-foundry/evidence/final-traffic.txt | Documentation / evidence |
| docs/prism-foundry/evidence/index-canary-deploy.txt | Documentation / evidence |
| docs/prism-foundry/evidence/index-live-browser.txt | Documentation / evidence |
| docs/prism-foundry/evidence/index-observation.json | Documentation / evidence |
| docs/prism-foundry/evidence/index-pinned.json | Documentation / evidence |
| docs/prism-foundry/evidence/index-promotion.txt | Documentation / evidence |
| docs/prism-foundry/evidence/live-desktop.png | Documentation / evidence |
| docs/prism-foundry/evidence/live-legacy.json | Documentation / evidence |
| docs/prism-foundry/evidence/live-mobile.png | Documentation / evidence |
| docs/prism-foundry/evidence/live-primary.json | Documentation / evidence |
| docs/prism-foundry/evidence/local-versioned-browser.txt | Documentation / evidence |
| docs/prism-foundry/evidence/unpinned-live-browser.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/before-canary.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/before-promotion.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/before-upload.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/canary-deploy.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/final-status.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/live-desktop.png | Documentation / evidence |
| docs/prism-foundry/green-evidence/live-legacy.json | Documentation / evidence |
| docs/prism-foundry/green-evidence/live-primary.json | Documentation / evidence |
| docs/prism-foundry/green-evidence/local-browser.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/local-desktop.png | Documentation / evidence |
| docs/prism-foundry/green-evidence/observation.json | Documentation / evidence |
| docs/prism-foundry/green-evidence/pinned-assets.json | Documentation / evidence |
| docs/prism-foundry/green-evidence/pinned-browser.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/promotion.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/tests.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/unpinned-browser.txt | Documentation / evidence |
| docs/prism-foundry/green-evidence/worker-errors.txt | Documentation / evidence |
| docs/reference-realms/CONTRACT.md | Documentation / evidence |
| docs/reference-realms/DEPLOYMENT.md | Documentation / evidence |
| docs/reference-realms/HANDOFF.md | Documentation / evidence |
| docs/reference-realms/LOKI.md | Documentation / evidence |
| docs/reference-realms/ODIN.md | Documentation / evidence |
| docs/reference-realms/REPORT.md | Documentation / evidence |
| docs/reference-realms/THOR.md | Documentation / evidence |
| docs/reference-realms/evidence/active-deployment.json | Documentation / evidence |
| docs/reference-realms/evidence/conversation-browser.json | Documentation / evidence |
| docs/reference-realms/evidence/deploy.txt | Documentation / evidence |
| docs/reference-realms/evidence/diagnostics.json | Documentation / evidence |
| docs/reference-realms/evidence/dry-run.txt | Documentation / evidence |
| docs/reference-realms/evidence/final-browser.json | Documentation / evidence |
| docs/reference-realms/evidence/final-loki-320.png | Documentation / evidence |
| docs/reference-realms/evidence/final-loki-390.png | Documentation / evidence |
| docs/reference-realms/evidence/final-loki.png | Documentation / evidence |
| docs/reference-realms/evidence/final-odin-390.png | Documentation / evidence |
| docs/reference-realms/evidence/final-odin.png | Documentation / evidence |
| docs/reference-realms/evidence/final-thor-390.png | Documentation / evidence |
| docs/reference-realms/evidence/final-thor.png | Documentation / evidence |
| docs/reference-realms/evidence/live-assets.json | Documentation / evidence |
| docs/reference-realms/evidence/live-browser.json | Documentation / evidence |
| docs/reference-realms/evidence/performance-intermediate.json | Documentation / evidence |
| docs/reference-realms/evidence/performance.json | Documentation / evidence |
| docs/reference-realms/evidence/proportions.json | Documentation / evidence |
| docs/reference-realms/evidence/realm-fallback.png | Documentation / evidence |
| docs/reference-realms/evidence/realm-keyboard.png | Documentation / evidence |
| docs/reference-realms/evidence/realm-loki-orbit.png | Documentation / evidence |
| docs/reference-realms/evidence/realm-odin-orbit.png | Documentation / evidence |
| docs/reference-realms/evidence/realm-thor-orbit.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-before.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live-chat.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live-loki-phone.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live-loki.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live-odin.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live-thor.png | Documentation / evidence |
| docs/reference-realms/evidence/reference-live.webm | Documentation / evidence |
| docs/reference-realms/evidence/release-captures.json | Documentation / evidence |
| docs/reference-realms/evidence/release-proof.json | Documentation / evidence |
| docs/reference-realms/evidence/route-checks.json | Documentation / evidence |
| docs/reference-realms/evidence/scene-browser.json | Documentation / evidence |
| docs/reference-realms/evidence/smoke.txt | Documentation / evidence |
| docs/reference-realms/evidence/tests.txt | Documentation / evidence |
| docs/rendered-realms/BASELINE.md | Documentation / evidence |
| docs/rendered-realms/CAPABILITY-INVENTORY.md | Documentation / evidence |
| docs/rendered-realms/DESIGN-DIRECTION.md | Documentation / evidence |
| docs/rendered-realms/FINAL-REPORT.md | Documentation / evidence |
| docs/rendered-realms/HANDOFF.md | Documentation / evidence |
| docs/rendered-realms/IMPROVEMENT-LEDGER.md | Documentation / evidence |
| docs/rendered-realms/MONETIZATION.md | Documentation / evidence |
| docs/rendered-realms/USER-GUIDE.md | Documentation / evidence |
| docs/rendered-realms/VERIFICATION.md | Documentation / evidence |
| docs/rendered-realms/evidence/arsenal.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/asset-checks.txt | Documentation / evidence |
| docs/rendered-realms/evidence/loki-phone.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/narrow-tools.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/node-tests.txt | Documentation / evidence |
| docs/rendered-realms/evidence/odin.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/prior-main-desktop.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/revenue.jpg | Documentation / evidence |
| docs/rendered-realms/evidence/thor.jpg | Documentation / evidence |
| docs/rgb-flow-2026-09-13.md | Documentation / evidence |
| docs/setup-research-2026-09-12.md | Documentation / evidence |
| docs/solar-throne/IMPLEMENTATION.md | Documentation / evidence |
| docs/strikeonehall.txt | Documentation / evidence |
| docs/striketwohubteam.txt | Documentation / evidence |
| docs/ui-upgrade/BASELINE.md | Documentation / evidence |
| docs/ui-upgrade/DESIGN-DIRECTION.md | Documentation / evidence |
| docs/ui-upgrade/FINAL-REPORT.md | Documentation / evidence |
| docs/ui-upgrade/HANDOFF.md | Documentation / evidence |
| docs/ui-upgrade/IMPROVEMENT-LEDGER.md | Documentation / evidence |
| docs/ui-upgrade/USER-GUIDE.md | Documentation / evidence |
| docs/ui-upgrade/VENDOR-MANIFEST.json | Documentation / evidence |
| docs/ui-upgrade/VERIFICATION.md | Documentation / evidence |
| docs/ui-upgrade/evidence/after-conversation.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/after-desktop.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/after-mobile.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/after-narrow.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/after-tablet.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/asset-checks.txt | Documentation / evidence |
| docs/ui-upgrade/evidence/before-desktop.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/before-mobile.jpg | Documentation / evidence |
| docs/ui-upgrade/evidence/node-tests.txt | Documentation / evidence |
| index.before-aurum.html | UI source / page |
| index.before-command.html | UI source / page |
| index.before-constellation.html | UI source / page |
| index.before-council.html | UI source / page |
| index.before-gold-eyes.html | UI source / page |
| index.before-immersive.html | UI source / page |
| index.before-orbital.html | UI source / page |
| index.before-persona-transition.html | UI source / page |
| index.before-zenith.html | UI source / page |
| index.html | UI source / page |
| legacy-url-shim/src/index.js | Repository support file (inspect before modifying) |
| legacy-url-shim/wrangler.toml | Repository support file (inspect before modifying) |
| manifest.json | Repository support file (inspect before modifying) |
| node_modules | Repository support file (inspect before modifying) |
| package-lock.json | Repository support file (inspect before modifying) |
| package.json | Repository support file (inspect before modifying) |
| public/brand/asgard-crown-16.png | Worker-served static asset |
| public/brand/asgard-crown-180.png | Worker-served static asset |
| public/brand/asgard-crown-192.png | Worker-served static asset |
| public/brand/asgard-crown-256.png | Worker-served static asset |
| public/brand/asgard-crown-32.png | Worker-served static asset |
| public/brand/asgard-crown-48.png | Worker-served static asset |
| public/brand/asgard-crown-512.png | Worker-served static asset |
| public/brand/asgard-crown-64.png | Worker-served static asset |
| public/brand/asgard-crown-maskable-512.png | Worker-served static asset |
| public/brand/asgard-crown-master.png | Worker-served static asset |
| public/brand/asgard-crown.ico | Worker-served static asset |
| public/command-center.html | Worker-served static asset |
| public/completion-checklist.html | Worker-served static asset |
| public/favicon.ico | Worker-served static asset |
| public/fx-lab.html | Worker-served static asset |
| public/fx/asgard-fx.js | Worker-served static asset |
| public/fx/cores/council.js | Worker-served static asset |
| public/fx/cores/loki.js | Worker-served static asset |
| public/fx/cores/odin.js | Worker-served static asset |
| public/fx/cores/thor.js | Worker-served static asset |
| public/fx/loki.js | Worker-served static asset |
| public/fx/odin.js | Worker-served static asset |
| public/fx/team.js | Worker-served static asset |
| public/fx/thor.js | Worker-served static asset |
| public/hall/index.html | Worker-served static asset |
| public/halls-preview.html | Worker-served static asset |
| public/hub/index.html | Worker-served static asset |
| public/hud/index.html | Worker-served static asset |
| public/img/loki.jpg | Worker-served static asset |
| public/img/odin.jpg | Worker-served static asset |
| public/img/thor.jpg | Worker-served static asset |
| public/index.html | Worker-served static asset |
| public/odinhud.html | Worker-served static asset |
| public/performance-lab.html | Worker-served static asset |
| public/phone/index.html | Worker-served static asset |
| public/setup-guide.html | Worker-served static asset |
| public/team.html | Worker-served static asset |
| public/trading-lab.html | Worker-served static asset |
| public/ui/app.js | Worker-served static asset |
| public/ui/arsenal.js | Worker-served static asset |
| public/ui/asgard-icon-192.png | Worker-served static asset |
| public/ui/asgard-icon-512.png | Worker-served static asset |
| public/ui/asgard.webmanifest | Worker-served static asset |
| public/ui/astral-cartographer-model.js | Worker-served static asset |
| public/ui/astral-cartographer.js | Worker-served static asset |
| public/ui/astral-v1/app.js | Worker-served static asset |
| public/ui/astral-v1/arsenal.js | Worker-served static asset |
| public/ui/astral-v1/astral-cartographer-model.js | Worker-served static asset |
| public/ui/astral-v1/astral-cartographer.js | Worker-served static asset |
| public/ui/astral-v1/council-data.js | Worker-served static asset |
| public/ui/astral-v1/council-scene.js | Worker-served static asset |
| public/ui/astral-v1/expansion-catalog.json | Worker-served static asset |
| public/ui/astral-v1/expansion.js | Worker-served static asset |
| public/ui/astral-v1/hologram-persona.js | Worker-served static asset |
| public/ui/astral-v1/hologram-projection.js | Worker-served static asset |
| public/ui/astral-v1/holographic-field.js | Worker-served static asset |
| public/ui/astral-v1/interface.css | Worker-served static asset |
| public/ui/astral-v1/local-tools.js | Worker-served static asset |
| public/ui/astral-v1/nameplate-layout.js | Worker-served static asset |
| public/ui/astral-v1/prism-foundry-model.js | Worker-served static asset |
| public/ui/astral-v1/prism-foundry.js | Worker-served static asset |
| public/ui/astral-v1/realm-architecture.js | Worker-served static asset |
| public/ui/astral-v1/realm-controls.js | Worker-served static asset |
| public/ui/astral-v1/realm-loki.js | Worker-served static asset |
| public/ui/astral-v1/realm-odin.js | Worker-served static asset |
| public/ui/astral-v1/realm-thor.js | Worker-served static asset |
| public/ui/astral-v1/scene.js | Worker-served static asset |
| public/ui/astral-v1/state.js | Worker-served static asset |
| public/ui/astral-v1/tool-catalog.json | Worker-served static asset |
| public/ui/astral-v1/vendor/OrbitControls.js | Worker-served static asset |
| public/ui/astral-v1/vendor/Projector.js | Worker-served static asset |
| public/ui/astral-v1/vendor/SVGRenderer.js | Worker-served static asset |
| public/ui/astral-v1/vendor/THREE-LICENSE.txt | Worker-served static asset |
| public/ui/astral-v1/vendor/three.core.min.js | Worker-served static asset |
| public/ui/astral-v1/vendor/three.module.min.js | Worker-served static asset |
| public/ui/aurum-immersive.css | Worker-served static asset |
| public/ui/aurum.css | Worker-served static asset |
| public/ui/aurum.js | Worker-served static asset |
| public/ui/command-center.js | Worker-served static asset |
| public/ui/command-identity.js | Worker-served static asset |
| public/ui/command-scene.css | Worker-served static asset |
| public/ui/constellation.css | Worker-served static asset |
| public/ui/council-data.js | Worker-served static asset |
| public/ui/council-orbit.css | Worker-served static asset |
| public/ui/council-orbit.js | Worker-served static asset |
| public/ui/council-roster.js | Worker-served static asset |
| public/ui/council-scene.js | Worker-served static asset |
| public/ui/desktop-suite.js | Worker-served static asset |
| public/ui/event-stream.js | Worker-served static asset |
| public/ui/expansion-catalog.json | Worker-served static asset |
| public/ui/expansion.js | Worker-served static asset |
| public/ui/hologram-persona.js | Worker-served static asset |
| public/ui/hologram-projection.js | Worker-served static asset |
| public/ui/holographic-field.js | Worker-served static asset |
| public/ui/hud-real-v1/app.js | Worker-served static asset |
| public/ui/hud-real-v1/arsenal.js | Worker-served static asset |
| public/ui/hud-real-v1/astral-cartographer-model.js | Worker-served static asset |
| public/ui/hud-real-v1/astral-cartographer.js | Worker-served static asset |
| public/ui/hud-real-v1/council-data.js | Worker-served static asset |
| public/ui/hud-real-v1/council-scene.js | Worker-served static asset |
| public/ui/hud-real-v1/event-stream.js | Worker-served static asset |
| public/ui/hud-real-v1/expansion-catalog.json | Worker-served static asset |
| public/ui/hud-real-v1/expansion.js | Worker-served static asset |
| public/ui/hud-real-v1/hologram-persona.js | Worker-served static asset |
| public/ui/hud-real-v1/hologram-projection.js | Worker-served static asset |
| public/ui/hud-real-v1/holographic-field.js | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts.css | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/Cinzel-OFL.txt | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/CormorantGaramond-OFL.txt | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/IBMPlexMono-OFL.txt | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-0.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-1.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-2.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-3.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-4.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-5.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-6.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/fonts/font-7.ttf | Worker-served static asset |
| public/ui/hud-real-v1/hud/hud-config.js | Worker-served static asset |
| public/ui/hud-real-v1/hud/hud-data.js | Worker-served static asset |
| public/ui/hud-real-v1/hud/hud-view.js | Worker-served static asset |
| public/ui/hud-real-v1/hud/hud.css | Worker-served static asset |
| public/ui/hud-real-v1/hud/hud.js | Worker-served static asset |
| public/ui/hud-real-v1/interface.css | Worker-served static asset |
| public/ui/hud-real-v1/local-tools.js | Worker-served static asset |
| public/ui/hud-real-v1/nameplate-layout.js | Worker-served static asset |
| public/ui/hud-real-v1/prism-foundry-model.js | Worker-served static asset |
| public/ui/hud-real-v1/prism-foundry.js | Worker-served static asset |
| public/ui/hud-real-v1/realm-architecture.js | Worker-served static asset |
| public/ui/hud-real-v1/realm-controls.js | Worker-served static asset |
| public/ui/hud-real-v1/realm-loki.js | Worker-served static asset |
| public/ui/hud-real-v1/realm-odin.js | Worker-served static asset |
| public/ui/hud-real-v1/realm-thor.js | Worker-served static asset |
| public/ui/hud-real-v1/scene.js | Worker-served static asset |
| public/ui/hud-real-v1/solar-throne-model.js | Worker-served static asset |
| public/ui/hud-real-v1/solar-throne.js | Worker-served static asset |
| public/ui/hud-real-v1/state.js | Worker-served static asset |
| public/ui/hud-real-v1/tool-catalog.json | Worker-served static asset |
| public/ui/hud-real-v1/vendor/OrbitControls.js | Worker-served static asset |
| public/ui/hud-real-v1/vendor/Projector.js | Worker-served static asset |
| public/ui/hud-real-v1/vendor/SVGRenderer.js | Worker-served static asset |
| public/ui/hud-real-v1/vendor/THREE-LICENSE.txt | Worker-served static asset |
| public/ui/hud-real-v1/vendor/three.core.min.js | Worker-served static asset |
| public/ui/hud-real-v1/vendor/three.module.min.js | Worker-served static asset |
| public/ui/hud-real-v1/voice-stream.js | Worker-served static asset |
| public/ui/hud/fonts.css | Worker-served static asset |
| public/ui/hud/fonts/Cinzel-OFL.txt | Worker-served static asset |
| public/ui/hud/fonts/CormorantGaramond-OFL.txt | Worker-served static asset |
| public/ui/hud/fonts/IBMPlexMono-OFL.txt | Worker-served static asset |
| public/ui/hud/fonts/font-0.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-1.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-2.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-3.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-4.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-5.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-6.ttf | Worker-served static asset |
| public/ui/hud/fonts/font-7.ttf | Worker-served static asset |
| public/ui/hud/hud-config.js | Worker-served static asset |
| public/ui/hud/hud-data.js | Worker-served static asset |
| public/ui/hud/hud-view.js | Worker-served static asset |
| public/ui/hud/hud.css | Worker-served static asset |
| public/ui/hud/hud.js | Worker-served static asset |
| public/ui/interface.css | Worker-served static asset |
| public/ui/local-tools.js | Worker-served static asset |
| public/ui/mobile-home.css | Worker-served static asset |
| public/ui/nameplate-layout.js | Worker-served static asset |
| public/ui/orbital-base.css | Worker-served static asset |
| public/ui/orbital-dashboard.js | Worker-served static asset |
| public/ui/orbital-data.js | Worker-served static asset |
| public/ui/orbital-live.css | Worker-served static asset |
| public/ui/pc-lights.js | Worker-served static asset |
| public/ui/performance-lab.js | Worker-served static asset |
| public/ui/performance-math.js | Worker-served static asset |
| public/ui/phone-control.js | Worker-served static asset |
| public/ui/prism-foundry-model.js | Worker-served static asset |
| public/ui/prism-foundry.js | Worker-served static asset |
| public/ui/prism-v1/app.js | Worker-served static asset |
| public/ui/prism-v1/arsenal.js | Worker-served static asset |
| public/ui/prism-v1/council-data.js | Worker-served static asset |
| public/ui/prism-v1/expansion-catalog.json | Worker-served static asset |
| public/ui/prism-v1/expansion.js | Worker-served static asset |
| public/ui/prism-v1/hologram-persona.js | Worker-served static asset |
| public/ui/prism-v1/hologram-projection.js | Worker-served static asset |
| public/ui/prism-v1/holographic-field.js | Worker-served static asset |
| public/ui/prism-v1/interface.css | Worker-served static asset |
| public/ui/prism-v1/local-tools.js | Worker-served static asset |
| public/ui/prism-v1/nameplate-layout.js | Worker-served static asset |
| public/ui/prism-v1/prism-foundry-model.js | Worker-served static asset |
| public/ui/prism-v1/prism-foundry.js | Worker-served static asset |
| public/ui/prism-v1/realm-architecture.js | Worker-served static asset |
| public/ui/prism-v1/realm-controls.js | Worker-served static asset |
| public/ui/prism-v1/realm-loki.js | Worker-served static asset |
| public/ui/prism-v1/realm-odin.js | Worker-served static asset |
| public/ui/prism-v1/realm-thor.js | Worker-served static asset |
| public/ui/prism-v1/scene.js | Worker-served static asset |
| public/ui/prism-v1/state.js | Worker-served static asset |
| public/ui/prism-v1/tool-catalog.json | Worker-served static asset |
| public/ui/prism-v1/vendor/OrbitControls.js | Worker-served static asset |
| public/ui/prism-v1/vendor/Projector.js | Worker-served static asset |
| public/ui/prism-v1/vendor/SVGRenderer.js | Worker-served static asset |
| public/ui/prism-v1/vendor/THREE-LICENSE.txt | Worker-served static asset |
| public/ui/prism-v1/vendor/three.core.min.js | Worker-served static asset |
| public/ui/prism-v1/vendor/three.module.min.js | Worker-served static asset |
| public/ui/realm-architecture.js | Worker-served static asset |
| public/ui/realm-controls.js | Worker-served static asset |
| public/ui/realm-loki.js | Worker-served static asset |
| public/ui/realm-odin.js | Worker-served static asset |
| public/ui/realm-thor.js | Worker-served static asset |
| public/ui/release.json | Worker-served static asset |
| public/ui/research-observatory.js | Worker-served static asset |
| public/ui/scene.js | Worker-served static asset |
| public/ui/solar-throne-model.js | Worker-served static asset |
| public/ui/solar-throne.js | Worker-served static asset |
| public/ui/state.js | Worker-served static asset |
| public/ui/tool-catalog.json | Worker-served static asset |
| public/ui/vendor/OrbitControls.js | Worker-served static asset |
| public/ui/vendor/Projector.js | Worker-served static asset |
| public/ui/vendor/SVGRenderer.js | Worker-served static asset |
| public/ui/vendor/THREE-LICENSE.txt | Worker-served static asset |
| public/ui/vendor/three.core.min.js | Worker-served static asset |
| public/ui/vendor/three.module.min.js | Worker-served static asset |
| public/ui/voice-stream.js | Worker-served static asset |
| public/ui/warden-workspace.css | Worker-served static asset |
| public/ui/warden-workspace.js | Worker-served static asset |
| public/ui/zenith.css | Worker-served static asset |
| public/vendor/papaparse-5.7.0/LICENSE | Worker-served static asset |
| public/vendor/papaparse-5.7.0/papaparse.min.js | Worker-served static asset |
| scripts/asgard-face.test.mjs | Check, build or maintenance script |
| scripts/asgard-hud.test.mjs | Check, build or maintenance script |
| scripts/astral-cartographer.test.mjs | Check, build or maintenance script |
| scripts/bifrost-browser-check.js | Check, build or maintenance script |
| scripts/bifrost-live-check.js | Check, build or maintenance script |
| scripts/bifrost-receipt-check.js | Check, build or maintenance script |
| scripts/bifrost-visual-check.js | Check, build or maintenance script |
| scripts/browser-extension.test.mjs | Check, build or maintenance script |
| scripts/build-brand-icons.ps1 | Check, build or maintenance script |
| scripts/build-release.mjs | Check, build or maintenance script |
| scripts/build-setup-guide.mjs | Check, build or maintenance script |
| scripts/build-ui-catalog.mjs | Check, build or maintenance script |
| scripts/call-approval.test.mjs | Check, build or maintenance script |
| scripts/capture-fortnite.ps1 | Check, build or maintenance script |
| scripts/check-scripts.mjs | Check, build or maintenance script |
| scripts/command-identity.test.mjs | Check, build or maintenance script |
| scripts/command-scene-qa.mjs | Check, build or maintenance script |
| scripts/companion-voice.test.mjs | Check, build or maintenance script |
| scripts/conversation.test.mjs | Check, build or maintenance script |
| scripts/cost-policy.test.mjs | Check, build or maintenance script |
| scripts/desktop-local.mjs | Check, build or maintenance script |
| scripts/desktop-theme.ps1 | Check, build or maintenance script |
| scripts/effects/ASGARD Flow.html | Check, build or maintenance script |
| scripts/export-vault.mjs | Check, build or maintenance script |
| scripts/floating-browser-check.js | Check, build or maintenance script |
| scripts/floating-live-check.js | Check, build or maintenance script |
| scripts/floating-motion-check.js | Check, build or maintenance script |
| scripts/floating-pointer-check.js | Check, build or maintenance script |
| scripts/floating-realms.test.mjs | Check, build or maintenance script |
| scripts/gen-core.mjs | Check, build or maintenance script |
| scripts/gen-manifest.mjs | Check, build or maintenance script |
| scripts/gen-tools-json.mjs | Check, build or maintenance script |
| scripts/hologram.test.mjs | Check, build or maintenance script |
| scripts/hud-browser-check.js | Check, build or maintenance script |
| scripts/index-backlog.mjs | Check, build or maintenance script |
| scripts/install-rgb.mjs | Check, build or maintenance script |
| scripts/inventory.mjs | Check, build or maintenance script |
| scripts/lab-smoke.mjs | Check, build or maintenance script |
| scripts/lab-tools.test.mjs | Check, build or maintenance script |
| scripts/local-tools.test.mjs | Check, build or maintenance script |
| scripts/lock-surge-qa.mjs | Check, build or maintenance script |
| scripts/mcp-smoke.mjs | Check, build or maintenance script |
| scripts/mobile-before.mjs | Check, build or maintenance script |
| scripts/mobile-home-qa.mjs | Check, build or maintenance script |
| scripts/nameplate-layout.test.mjs | Check, build or maintenance script |
| scripts/orbital-browser-qa.mjs | Check, build or maintenance script |
| scripts/orbital-data.test.mjs | Check, build or maintenance script |
| scripts/paper-analytics.test.mjs | Check, build or maintenance script |
| scripts/paper-research.test.mjs | Check, build or maintenance script |
| scripts/patch.mjs | Check, build or maintenance script |
| scripts/performance-math.test.mjs | Check, build or maintenance script |
| scripts/persona-transition-qa.mjs | Check, build or maintenance script |
| scripts/phone-audio.test.mjs | Check, build or maintenance script |
| scripts/phone-browser-qa.mjs | Check, build or maintenance script |
| scripts/phone-operator.mjs | Check, build or maintenance script |
| scripts/phone-updates.test.mjs | Check, build or maintenance script |
| scripts/prism-browser-check.js | Check, build or maintenance script |
| scripts/prism-foundry.test.mjs | Check, build or maintenance script |
| scripts/reference-browser-check.js | Check, build or maintenance script |
| scripts/reference-final-check.js | Check, build or maintenance script |
| scripts/reference-live-check.js | Check, build or maintenance script |
| scripts/reference-proportions.mjs | Check, build or maintenance script |
| scripts/reference-realms.test.mjs | Check, build or maintenance script |
| scripts/rendered-realms.test.mjs | Check, build or maintenance script |
| scripts/rgb-browser-qa.mjs | Check, build or maintenance script |
| scripts/rgb-companion.mjs | Check, build or maintenance script |
| scripts/rgb-companion.test.mjs | Check, build or maintenance script |
| scripts/rgb-flow.test.mjs | Check, build or maintenance script |
| scripts/security-scan.py | Check, build or maintenance script |
| scripts/shared-access.test.mjs | Check, build or maintenance script |
| scripts/smoke-fx.mjs | Check, build or maintenance script |
| scripts/smoke.mjs | Check, build or maintenance script |
| scripts/solar-browser-check.js | Check, build or maintenance script |
| scripts/solar-throne.test.mjs | Check, build or maintenance script |
| scripts/sync-lab-catalog.mjs | Check, build or maintenance script |
| scripts/sync-three-vendor.mjs | Check, build or maintenance script |
| scripts/tool-tests.mjs | Check, build or maintenance script |
| scripts/ui-preview.mjs | Check, build or maintenance script |
| scripts/ui-state.test.mjs | Check, build or maintenance script |
| scripts/verify-release.mjs | Check, build or maintenance script |
| scripts/warden-browser-qa.mjs | Check, build or maintenance script |
| scripts/warden-motion-qa.mjs | Check, build or maintenance script |
| scripts/warden-verify-live.mjs | Check, build or maintenance script |
| scripts/warden-voice-qa.mjs | Check, build or maintenance script |
| scripts/warden-workspace-qa.mjs | Check, build or maintenance script |
| src/index.js | Worker entrypoint / Durable Object |
| src/ledger-do.js | Worker entrypoint / Durable Object |
| src/lib/activity.js | Backend integration / domain module |
| src/lib/anthropic.js | Backend integration / domain module |
| src/lib/approvals.js | Backend integration / domain module |
| src/lib/audit.js | Backend integration / domain module |
| src/lib/autonomy.js | Backend integration / domain module |
| src/lib/batch.js | Backend integration / domain module |
| src/lib/broker.js | Backend integration / domain module |
| src/lib/browser.js | Backend integration / domain module |
| src/lib/chat-diagnostics.js | Backend integration / domain module |
| src/lib/checkin.js | Backend integration / domain module |
| src/lib/clipping.js | Backend integration / domain module |
| src/lib/comms.js | Backend integration / domain module |
| src/lib/companion-voice.js | Backend integration / domain module |
| src/lib/containment.js | Backend integration / domain module |
| src/lib/conversation.js | Backend integration / domain module |
| src/lib/cost-policy.js | Backend integration / domain module |
| src/lib/cost.js | Backend integration / domain module |
| src/lib/council.js | Backend integration / domain module |
| src/lib/events.js | Backend integration / domain module |
| src/lib/healthz.js | Backend integration / domain module |
| src/lib/hela.js | Backend integration / domain module |
| src/lib/history-summary.js | Backend integration / domain module |
| src/lib/http.js | Backend integration / domain module |
| src/lib/hud.js | Backend integration / domain module |
| src/lib/instagram.js | Backend integration / domain module |
| src/lib/kit.js | Backend integration / domain module |
| src/lib/kv-store.js | Backend integration / domain module |
| src/lib/ledger.js | Backend integration / domain module |
| src/lib/maps.js | Backend integration / domain module |
| src/lib/marketData.js | Backend integration / domain module |
| src/lib/mcp.js | Backend integration / domain module |
| src/lib/memory.js | Backend integration / domain module |
| src/lib/models.js | Backend integration / domain module |
| src/lib/monitoring.js | Backend integration / domain module |
| src/lib/notifications.js | Backend integration / domain module |
| src/lib/paper-store.js | Backend integration / domain module |
| src/lib/paperAnalytics.js | Backend integration / domain module |
| src/lib/paperResearch.js | Backend integration / domain module |
| src/lib/paperTrading.js | Backend integration / domain module |
| src/lib/permissions.js | Backend integration / domain module |
| src/lib/personas.js | Backend integration / domain module |
| src/lib/phone-agent.js | Backend integration / domain module |
| src/lib/phone-audio.js | Backend integration / domain module |
| src/lib/phone-state.js | Backend integration / domain module |
| src/lib/phone-updates.js | Backend integration / domain module |
| src/lib/pollers.js | Backend integration / domain module |
| src/lib/projectReview.js | Backend integration / domain module |
| src/lib/reports.js | Backend integration / domain module |
| src/lib/roundtable.js | Backend integration / domain module |
| src/lib/routineTools.js | Backend integration / domain module |
| src/lib/routines.js | Backend integration / domain module |
| src/lib/schedule.js | Backend integration / domain module |
| src/lib/search.js | Backend integration / domain module |
| src/lib/sibling-agents.js | Backend integration / domain module |
| src/lib/spotify.js | Backend integration / domain module |
| src/lib/telegram.js | Backend integration / domain module |
| src/lib/templates.js | Backend integration / domain module |
| src/lib/tick.js | Backend integration / domain module |
| src/lib/tools.js | Backend integration / domain module |
| src/lib/usage-log.js | Backend integration / domain module |
| src/lib/util.js | Backend integration / domain module |
| src/lib/vault.js | Backend integration / domain module |
| src/lib/vizard.js | Backend integration / domain module |
| src/lib/whop.js | Backend integration / domain module |
| src/lib/workspace-snapshot.js | Backend integration / domain module |
| src/lib/world.js | Backend integration / domain module |
| src/paper-ledger.js | Worker entrypoint / Durable Object |
| src/tools/catalog-ai.js | Tool catalog / discovery |
| src/tools/catalog-comms.js | Tool catalog / discovery |
| src/tools/catalog-dev.js | Tool catalog / discovery |
| src/tools/catalog-jobs.js | Tool catalog / discovery |
| src/tools/catalog-lab.js | Tool catalog / discovery |
| src/tools/catalog-life.js | Tool catalog / discovery |
| src/tools/catalog-markets.js | Tool catalog / discovery |
| src/tools/catalog-media.js | Tool catalog / discovery |
| src/tools/catalog-research.js | Tool catalog / discovery |
| src/tools/catalog-self.js | Tool catalog / discovery |
| src/tools/catalog-world.js | Tool catalog / discovery |
| src/tools/catalog.js | Tool catalog / discovery |
| src/tools/meta.js | Tool catalog / discovery |
| worker/worker.js | Repository support file (inspect before modifying) |
| wrangler.toml | Repository support file (inspect before modifying) |
