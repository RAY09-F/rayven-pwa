# Capability status — deterministic inventory audit

Evidence date: 2026-09-08. Source revision: `6bd0737d716ed9ff24db025a83a25aa1c1316956`; locally observed origin/main: `6bd0737d716ed9ff24db025a83a25aa1c1316956`. Full per-entry matrix: [CAPABILITY-STATUS.json](CAPABILITY-STATUS.json). Source ranges refer to [MASTER-REFERENCE.md](MASTER-REFERENCE.md).

**All 485 entries are retained:** 223 public backend definitions + 36 local utilities + 186 proposals = 445 catalogue entries; the additional 24 automation briefs and 16 missions are workflow/request records, not installed tools. Backend registry has 277 total registrations; 54 non-public registrations are counted only; their identities and private hints are intentionally omitted. 16 historically dropped catalogue IDs remain recorded as excluded, without implying a fresh live failure test.

| Family | Count | Source implementation | Verification | Connection |
| --- | ---: | --- | --- | --- |
| B | 223 | implemented | untested | unknown |
| L | 36 | implemented | fixture pass | not required |
| P | 186 | absent | untested | unknown |
| A | 24 | partial | untested | unknown |
| M | 16 | partial | untested | unknown |

Every entry has independent source, repository delivery, deployment, connection, verification and conservative user-availability dimensions; exact schema, persona policy, handler/source references and blockers are preserved. **Released source is present:** Worker version 6d6c87d5-bf48-4914-9b98-d38fb94b07d1, release bifrost-9a1c6b9c4db0, pushed source 6bd0737d716ed9ff24db025a83a25aa1c1316956. 19 frontend asset hashes match that source. B/L source presence is recorded; P adapters remain absent and A/M surfaces remain preparation only. See [release-proof.json](evidence/release-proof.json). Backend connection and execution stay unknown/untested. 0 local browser calculation case(s) have specific live evidence; other local tools retain fixture status. Source “implemented” means a registered source handler exists, not that credentials, provider behavior, tenant scope or output validation are complete. Local-only changes are detected against HEAD per referenced file. Unchanged files use pushed only when HEAD equals the locally observed origin/main; no fresh remote fetch is implied.

## Verification

`node scripts/index-backlog.mjs` parses all five appendix families, rejects missing/duplicate inventory IDs, compares all 223 public schemas and persona lists to runtime definitions, checks every public dispatcher/handler, and runs existing local fixture tests.

`node --test scripts/local-tools.test.mjs`: 5 tests, 5 passed, 0 failed. The first test exercises all 36 local implementations with representative inputs; remaining tests cover selected numerical boundaries, content escaping and inventory counts. These are fixture tests, not browser or provider tests.

`node scripts/index-backlog.mjs --check` verifies report bytes after regenerating in memory. Only the script and these two reports are owned by CATALOG-D. This generator makes no app/backend/config change, provider invocation, schedule activation, secret inspection or deployment. When present, it consumes the lead’s checked-in release evidence and verifies asset hashes against the released Git revision.

## Correspondences and limitations

There are 0 duplicate runtime IDs. JSON records 35 exact runtime-ID mentions in automation/mission briefs and 31 explicit conceptual overlaps. Examples: P018 → L23 (local_weighted_score), P091 → A01 (morning brief), P110 → L20 (local_retry), P120 → existing routine_pause, P147 → L35 (local_redact), P186 → existing routine_history. These relationships identify reuse opportunities; they do not fulfill the proposal contracts. Generic words such as “calendar” and “research” are retained as unresolved capability hints rather than fabricated runtime IDs.

Handler/provider mapping is static: case dispatch plus imported implementation symbols, or registered catalogue run functions. Dependency hostname/binding hints explicitly distinguish entry-level from whole-module scope; they can overapproximate dependencies used by a particular tool and are not connection checks. No common output schema has been established. Backend behavior tests are untested in this pass; historical documentation does not promote that status. Automation/mission preparation UIs exist, but activation and completed artifacts are unverified.

## Missing foundations for the next integrated slice

1. The index release is evidenced. Keep deployment presence separate from provider health and tool execution; next verify the chosen capability end to end against this release.
2. Complete one research path using existing web_search/tavily_research and source-reading tools: validate input, preflight provider/permission context, retain source URL/retrieval time, and return a structured receipt with partial/failure state. Arsenal currently prepares chat text; that is not direct execution proof.
3. Establish authoritative per-user/tenant auth context before customer offers or a generic execution endpoint. Reuse current persona, permissions, containment and approval checks; do not bypass them by calling executeTool directly from a new unauthenticated route.
4. Add bounded timeout/cancellation semantics, normalized provider errors, output validation and idempotency/reconciliation where consequential tools need them. Cover invalid schema, wrong persona, unavailable credential, provider timeout, cross-user request and duplicate submission using fixtures before live writes.
5. Reuse existing routines, cron, ledger and approvals for one chosen automation brief. Require persisted workflow/run IDs, supported timezone/timing, dry run, failure and duplicate-event evidence, budget, concurrency cap and visible pause/stop before activation. All 24 briefs remain preparation records.
6. Billing/checkout/entitlement and client delivery proposals remain proposals: select a concrete offer, isolate customer data and verify sandbox webhook signatures, idempotency, entitlement, failed payment/cancellation and actual delivery receipt before charging customers. No paid service or automation is enabled by this index.

## Entry index

| ID | Runtime ID / preparation type | Title | Master lines |
| --- | --- | --- | --- |
| B001 | `web_search` | web search | 803–810 |
| B002 | `tavily_research` | tavily research | 812–819 |
| B003 | `tavily_extract` | tavily extract | 821–828 |
| B004 | `tavily_crawl` | tavily crawl | 830–837 |
| B005 | `remember_this` | remember this | 839–846 |
| B006 | `search_memory` | search memory | 848–855 |
| B007 | `add_todo` | add todo | 857–864 |
| B008 | `list_todos` | list todos | 866–873 |
| B009 | `complete_todo` | complete todo | 875–882 |
| B010 | `add_calendar_event` | add calendar event | 884–891 |
| B011 | `remove_calendar_event` | remove calendar event | 893–900 |
| B012 | `list_calendar_events` | list calendar events | 902–909 |
| B013 | `add_content_idea` | add content idea | 911–918 |
| B014 | `list_content_ideas` | list content ideas | 920–927 |
| B015 | `get_tool_permissions` | get tool permissions | 929–936 |
| B016 | `make_image` | make image | 938–945 |
| B017 | `transcribe` | transcribe | 947–954 |
| B018 | `translate` | translate | 956–963 |
| B019 | `condense` | condense | 965–972 |
| B020 | `weather` | weather | 974–981 |
| B021 | `look_up` | look up | 983–990 |
| B022 | `define` | define | 992–999 |
| B023 | `convert_money` | convert money | 1001–1008 |
| B024 | `holidays` | holidays | 1010–1017 |
| B025 | `set_timer` | set timer | 1019–1026 |
| B026 | `timers` | timers | 1028–1035 |
| B027 | `cancel_timer` | cancel timer | 1037–1044 |
| B028 | `calculate` | calculate | 1046–1053 |
| B029 | `roll` | roll | 1055–1062 |
| B030 | `world_time` | world time | 1064–1071 |
| B031 | `days_until` | days until | 1073–1080 |
| B032 | `browser_probe` | browser probe | 1082–1089 |
| B033 | `video_stats` | video stats | 1091–1098 |
| B034 | `video_segments` | video segments | 1100–1107 |
| B035 | `social_trends` | social trends | 1109–1116 |
| B036 | `news_search` | news search | 1118–1125 |
| B037 | `crypto_price` | crypto price | 1127–1134 |
| B038 | `stock_price` | stock price | 1136–1143 |
| B039 | `paper_trading_status` | paper trading status | 1145–1152 |
| B040 | `company_filings` | company filings | 1154–1161 |
| B041 | `token_search` | token search | 1163–1170 |
| B042 | `golden_hour` | golden hour | 1172–1179 |
| B043 | `air_quality` | air quality | 1181–1188 |
| B044 | `earthquakes` | earthquakes | 1190–1197 |
| B045 | `word_ideas` | word ideas | 1199–1206 |
| B046 | `short_link` | short link | 1208–1215 |
| B047 | `page_history` | page history | 1217–1224 |
| B048 | `social_profile` | social profile | 1226–1233 |
| B049 | `list_allowed_hosts` | list allowed hosts | 1235–1242 |
| B050 | `allow_host` | allow host | 1244–1251 |
| B051 | `list_my_tools` | list my tools | 1253–1260 |
| B052 | `set_tool_permission` | set tool permission | 1262–1269 |
| B053 | `send_text` | send text | 1271–1278 |
| B054 | `make_call` | make call | 1280–1287 |
| B055 | `spotify_play` | spotify play | 1289–1296 |
| B056 | `spotify_shuffle_playlist` | spotify shuffle playlist | 1298–1305 |
| B057 | `spotify_pause` | spotify pause | 1307–1314 |
| B058 | `spotify_resume` | spotify resume | 1316–1323 |
| B059 | `spotify_next` | spotify next | 1325–1332 |
| B060 | `spotify_previous` | spotify previous | 1334–1341 |
| B061 | `spotify_seek` | spotify seek | 1343–1350 |
| B062 | `spotify_now_playing` | spotify now playing | 1352–1359 |
| B063 | `play_youtube_video` | play youtube video | 1361–1368 |
| B064 | `browser_navigate` | browser navigate | 1370–1377 |
| B065 | `browser_click` | browser click | 1379–1386 |
| B066 | `browser_type` | browser type | 1388–1395 |
| B067 | `browser_read_page` | browser read page | 1397–1404 |
| B068 | `browser_scroll` | browser scroll | 1406–1413 |
| B069 | `browser_screenshot` | browser screenshot | 1415–1422 |
| B070 | `browser_click_coords` | browser click coords | 1424–1431 |
| B071 | `browser_type_coords` | browser type coords | 1433–1440 |
| B072 | `maps_search_places` | maps search places | 1442–1449 |
| B073 | `maps_find_all_locations` | maps find all locations | 1451–1458 |
| B074 | `maps_distances_between_locations` | maps distances between locations | 1460–1467 |
| B075 | `maps_find_gap_areas` | maps find gap areas | 1469–1476 |
| B076 | `maps_directions` | maps directions | 1478–1485 |
| B077 | `maps_geocode` | maps geocode | 1487–1494 |
| B078 | `ask_jarvis` | ask jarvis | 1496–1503 |
| B079 | `ask_kevos` | ask kevos | 1505–1512 |
| B080 | `ask_alternate_model` | ask alternate model | 1514–1521 |
| B081 | `watch_add` | watch add | 1523–1530 |
| B082 | `watch_list` | watch list | 1532–1539 |
| B083 | `watch_remove` | watch remove | 1541–1548 |
| B084 | `watch_pause` | watch pause | 1550–1557 |
| B085 | `watch_resume` | watch resume | 1559–1566 |
| B086 | `approvals_list` | approvals list | 1568–1575 |
| B087 | `approve` | approve | 1577–1584 |
| B088 | `reject` | reject | 1586–1593 |
| B089 | `routine_create` | routine create | 1595–1602 |
| B090 | `routine_list` | routine list | 1604–1611 |
| B091 | `routine_pause` | routine pause | 1613–1620 |
| B092 | `routine_resume` | routine resume | 1622–1629 |
| B093 | `routine_delete` | routine delete | 1631–1638 |
| B094 | `routine_run_now` | routine run now | 1640–1647 |
| B095 | `routine_history` | routine history | 1649–1656 |
| B096 | `delegate` | delegate | 1658–1665 |
| B097 | `trading_halt` | trading halt | 1667–1674 |
| B098 | `trading_resume` | trading resume | 1676–1683 |
| B099 | `trading_status` | trading status | 1685–1692 |
| B100 | `trading_readiness` | trading readiness | 1694–1701 |
| B101 | `paper_backtest` | paper backtest | 1703–1710 |
| B102 | `cost_report` | cost report | 1712–1719 |
| B103 | `find_tools` | find tools | 1721–1728 |
| B104 | `routine_templates` | routine templates | 1730–1737 |
| B105 | `routine_enable_template` | routine enable template | 1739–1746 |
| B106 | `read_document` | read document | 1748–1755 |
| B107 | `read_page` | read page | 1757–1764 |
| B108 | `rss_read` | rss read | 1766–1773 |
| B109 | `rss_watch` | rss watch | 1775–1782 |
| B110 | `rss_unwatch` | rss unwatch | 1784–1791 |
| B111 | `trending_now` | trending now | 1793–1800 |
| B112 | `hackernews` | hackernews | 1802–1809 |
| B113 | `wayback` | wayback | 1811–1818 |
| B114 | `wiki_search` | wiki search | 1820–1827 |
| B115 | `wiki_pageviews` | wiki pageviews | 1829–1836 |
| B116 | `arxiv_search` | arxiv search | 1838–1845 |
| B117 | `crossref_search` | crossref search | 1847–1854 |
| B118 | `openlibrary_search` | openlibrary search | 1856–1863 |
| B119 | `book_by_isbn` | book by isbn | 1865–1872 |
| B120 | `archive_search` | archive search | 1874–1881 |
| B121 | `federal_register` | federal register | 1883–1890 |
| B122 | `coingecko_price` | coingecko price | 1892–1899 |
| B123 | `coingecko_markets` | coingecko markets | 1901–1908 |
| B124 | `coingecko_trending` | coingecko trending | 1910–1917 |
| B125 | `defillama_tvl` | defillama tvl | 1919–1926 |
| B126 | `btc_mempool` | btc mempool | 1928–1935 |
| B127 | `fear_greed` | fear greed | 1937–1944 |
| B128 | `polymarket_markets` | polymarket markets | 1946–1953 |
| B129 | `fx_rates` | fx rates | 1955–1962 |
| B130 | `paper_equity_chart` | paper equity chart | 1964–1971 |
| B131 | `nws_alerts` | nws alerts | 1973–1980 |
| B132 | `nws_forecast` | nws forecast | 1982–1989 |
| B133 | `quakes` | quakes | 1991–1998 |
| B134 | `calfire_incidents` | calfire incidents | 2000–2007 |
| B135 | `space_weather` | space weather | 2009–2016 |
| B136 | `iss_now` | iss now | 2018–2025 |
| B137 | `nasa_apod` | nasa apod | 2027–2034 |
| B138 | `tides` | tides | 2036–2043 |
| B139 | `elevation` | elevation | 2045–2052 |
| B140 | `zip_lookup` | zip lookup | 2054–2061 |
| B141 | `ip_geo` | ip geo | 2063–2070 |
| B142 | `osm_search` | osm search | 2072–2079 |
| B143 | `osm_reverse` | osm reverse | 2081–2088 |
| B144 | `osm_nearby` | osm nearby | 2090–2097 |
| B145 | `country_info` | country info | 2099–2106 |
| B146 | `world_bank` | world bank | 2108–2115 |
| B147 | `shopping_list` | shopping list | 2117–2124 |
| B148 | `quick_note` | quick note | 2126–2133 |
| B149 | `notes_read` | notes read | 2135–2142 |
| B150 | `reading_list` | reading list | 2144–2151 |
| B151 | `habit_log` | habit log | 2153–2160 |
| B152 | `habits_status` | habits status | 2162–2169 |
| B153 | `expense_log` | expense log | 2171–2178 |
| B154 | `expenses_week` | expenses week | 2180–2187 |
| B155 | `unit_convert` | unit convert | 2189–2196 |
| B156 | `recipe_search` | recipe search | 2198–2205 |
| B157 | `cocktail_search` | cocktail search | 2207–2214 |
| B158 | `food_by_barcode` | food by barcode | 2216–2223 |
| B159 | `exercises` | exercises | 2225–2232 |
| B160 | `vin_decode` | vin decode | 2234–2241 |
| B161 | `recalls` | recalls | 2243–2250 |
| B162 | `cloudflare_status` | cloudflare status | 2252–2259 |
| B163 | `npm_info` | npm info | 2261–2268 |
| B164 | `pypi_info` | pypi info | 2270–2277 |
| B165 | `dns_lookup` | dns lookup | 2279–2286 |
| B166 | `whois` | whois | 2288–2295 |
| B167 | `http_check` | http check | 2297–2304 |
| B168 | `url_shorten` | url shorten | 2306–2313 |
| B169 | `url_unshorten` | url unshorten | 2315–2322 |
| B170 | `qr_code` | qr code | 2324–2331 |
| B171 | `page_preview` | page preview | 2333–2340 |
| B172 | `color_info` | color info | 2342–2349 |
| B173 | `text_hash` | text hash | 2351–2358 |
| B174 | `base64` | base64 | 2360–2367 |
| B175 | `uuid` | uuid | 2369–2376 |
| B176 | `regex_test` | regex test | 2378–2385 |
| B177 | `json_pretty` | json pretty | 2387–2394 |
| B178 | `tv_search` | tv search | 2396–2403 |
| B179 | `tv_tonight` | tv tonight | 2405–2412 |
| B180 | `game_deals` | game deals | 2414–2421 |
| B181 | `free_games` | free games | 2423–2430 |
| B182 | `trivia` | trivia | 2432–2439 |
| B183 | `draw_cards` | draw cards | 2441–2448 |
| B184 | `pokemon` | pokemon | 2450–2457 |
| B185 | `dnd` | dnd | 2459–2466 |
| B186 | `mtg_card` | mtg card | 2468–2475 |
| B187 | `dad_joke` | dad joke | 2477–2484 |
| B188 | `joke` | joke | 2486–2493 |
| B189 | `chuck_norris` | chuck norris | 2495–2502 |
| B190 | `advice` | advice | 2504–2511 |
| B191 | `affirmation` | affirmation | 2513–2520 |
| B192 | `quote` | quote | 2522–2529 |
| B193 | `useless_fact` | useless fact | 2531–2538 |
| B194 | `yes_or_no` | yes or no | 2540–2547 |
| B195 | `random_dog` | random dog | 2549–2556 |
| B196 | `random_fox` | random fox | 2558–2565 |
| B197 | `random_cat` | random cat | 2567–2574 |
| B198 | `http_cat` | http cat | 2576–2583 |
| B199 | `robot_avatar` | robot avatar | 2585–2592 |
| B200 | `pixel_avatar` | pixel avatar | 2594–2601 |
| B201 | `art_random` | art random | 2603–2610 |
| B202 | `mcu_countdown` | mcu countdown | 2612–2619 |
| B203 | `is_even` | is even | 2621–2628 |
| B204 | `xkcd` | xkcd | 2630–2637 |
| B205 | `meme_templates` | meme templates | 2639–2646 |
| B206 | `star_wars` | star wars | 2648–2655 |
| B207 | `star_trek` | star trek | 2657–2664 |
| B208 | `rick_and_morty` | rick and morty | 2666–2673 |
| B209 | `describe_image` | describe image | 2675–2682 |
| B210 | `detect_objects` | detect objects | 2684–2691 |
| B211 | `classify_image` | classify image | 2693–2700 |
| B212 | `sentiment` | sentiment | 2702–2709 |
| B213 | `publish_note` | publish note | 2711–2718 |
| B214 | `memory_timeline` | memory timeline | 2720–2727 |
| B215 | `what_did_i_say_about` | what did i say about | 2729–2736 |
| B216 | `journal_write` | journal write | 2738–2745 |
| B217 | `journal_read` | journal read | 2747–2754 |
| B218 | `self_stats` | self stats | 2756–2763 |
| B219 | `ntfy_push` | ntfy push | 2765–2772 |
| B220 | `discord_webhook` | discord webhook | 2774–2781 |
| B221 | `share_file` | share file | 2783–2790 |
| B222 | `jobs_search` | jobs search | 2792–2799 |
| B223 | `company_lookup` | company lookup | 2801–2808 |
| L01 | `local_mrr` | Monthly recurring revenue | 2814–2820 |
| L02 | `local_net_mrr` | Recurring revenue bridge | 2822–2828 |
| L03 | `local_churn` | Customer churn rate | 2830–2836 |
| L04 | `local_nrr` | Net revenue retention | 2838–2844 |
| L05 | `local_cac` | Acquisition cost | 2846–2852 |
| L06 | `local_payback` | Acquisition payback | 2854–2860 |
| L07 | `local_cohort_value` | Simple customer value model | 2862–2868 |
| L08 | `local_margin` | Gross margin | 2870–2876 |
| L09 | `local_markup` | Cost-based price | 2878–2884 |
| L10 | `local_target_price` | Target margin price | 2886–2892 |
| L11 | `local_break_even` | Break-even volume | 2894–2900 |
| L12 | `local_runway` | Cash runway scenario | 2902–2908 |
| L13 | `local_funnel` | Acquisition funnel scenario | 2910–2916 |
| L14 | `local_discount` | Discount comparison | 2918–2924 |
| L15 | `local_fees` | Payment fee estimate | 2926–2932 |
| L16 | `local_usage` | AI usage cost scenario | 2934–2940 |
| L17 | `local_automation_roi` | Automation time savings | 2942–2948 |
| L18 | `local_capacity` | Service capacity | 2950–2956 |
| L19 | `local_sla` | Availability error budget | 2958–2964 |
| L20 | `local_retry` | Retry backoff schedule | 2966–2972 |
| L21 | `local_batch` | Batch workload planner | 2974–2980 |
| L22 | `local_rate_budget` | Rate-limit time floor | 2982–2988 |
| L23 | `local_weighted_score` | Weighted opportunity score | 2990–2996 |
| L24 | `local_percentiles` | Latency distribution | 2998–3004 |
| L25 | `local_storage` | Storage cost scenario | 3006–3012 |
| L26 | `local_reading` | Text reading budget | 3014–3020 |
| L27 | `local_utm` | Campaign link builder | 3022–3028 |
| L28 | `local_slug` | Publication slug | 3030–3036 |
| L29 | `local_dedupe` | Deduplicate a list | 3038–3044 |
| L30 | `local_outline` | Content distribution brief | 3046–3052 |
| L31 | `local_csv` | JSON rows to CSV | 3054–3060 |
| L32 | `local_json` | JSON validator and formatter | 3062–3068 |
| L33 | `local_url` | URL inspector | 3070–3076 |
| L34 | `local_headers` | Response header explainer | 3078–3084 |
| L35 | `local_redact` | Basic text redaction | 3086–3092 |
| L36 | `local_acceptance` | Automation acceptance checklist | 3094–3100 |
| P001 | `proposal_001` | Checkout session builder | 3108–3115 |
| P002 | `proposal_002` | Subscription state reader | 3117–3124 |
| P003 | `proposal_003` | Entitlement resolver | 3126–3133 |
| P004 | `proposal_004` | Usage meter publisher | 3135–3142 |
| P005 | `proposal_005` | Invoice reconciler | 3144–3151 |
| P006 | `proposal_006` | Payment recovery queue | 3153–3160 |
| P007 | `proposal_007` | Trial expiry planner | 3162–3169 |
| P008 | `proposal_008` | Cancellation reason intake | 3171–3178 |
| P009 | `proposal_009` | Plan migration preview | 3180–3187 |
| P010 | `proposal_010` | Proration estimator | 3189–3196 |
| P011 | `proposal_011` | Refund review packet | 3198–3205 |
| P012 | `proposal_012` | Seat license allocator | 3207–3214 |
| P013 | `proposal_013` | Coupon eligibility checker | 3216–3223 |
| P014 | `proposal_014` | Tax calculation adapter | 3225–3232 |
| P015 | `proposal_015` | Revenue event auditor | 3234–3241 |
| P016 | `proposal_016` | Qualified inquiry intake | 3243–3250 |
| P017 | `proposal_017` | Lead evidence dossier | 3252–3259 |
| P018 | `proposal_018` | Fit score rubric | 3261–3268 |
| P019 | `proposal_019` | Inbound response draft | 3270–3277 |
| P020 | `proposal_020` | Discovery call scheduler | 3279–3286 |
| P021 | `proposal_021` | Demo follow-up planner | 3288–3295 |
| P022 | `proposal_022` | Referral attribution ledger | 3297–3304 |
| P023 | `proposal_023` | Partner referral portal | 3306–3313 |
| P024 | `proposal_024` | Landing page experiment tracker | 3315–3322 |
| P025 | `proposal_025` | Campaign consent checker | 3324–3331 |
| P026 | `proposal_026` | Lead deduplication service | 3333–3340 |
| P027 | `proposal_027` | Waitlist priority queue | 3342–3349 |
| P028 | `proposal_028` | Case study permission manager | 3351–3358 |
| P029 | `proposal_029` | Offer comparison builder | 3360–3367 |
| P030 | `proposal_030` | Acquisition source reconciler | 3369–3376 |
| P031 | `proposal_031` | Proposal assembler | 3378–3385 |
| P032 | `proposal_032` | Statement of work builder | 3387–3394 |
| P033 | `proposal_033` | Quote version tracker | 3396–3403 |
| P034 | `proposal_034` | Deposit request preparer | 3405–3412 |
| P035 | `proposal_035` | Service capacity booking | 3414–3421 |
| P036 | `proposal_036` | Kickoff packet builder | 3423–3430 |
| P037 | `proposal_037` | Client asset checklist | 3432–3439 |
| P038 | `proposal_038` | Milestone approval ledger | 3441–3448 |
| P039 | `proposal_039` | Delivery acceptance portal | 3450–3457 |
| P040 | `proposal_040` | Renewal opportunity queue | 3459–3466 |
| P041 | `proposal_041` | Upsell suitability check | 3468–3475 |
| P042 | `proposal_042` | Scope change estimator | 3477–3484 |
| P043 | `proposal_043` | Client handover builder | 3486–3493 |
| P044 | `proposal_044` | Service warranty tracker | 3495–3502 |
| P045 | `proposal_045` | Account profitability reader | 3504–3511 |
| P046 | `proposal_046` | Editorial calendar synchronizer | 3513–3520 |
| P047 | `proposal_047` | Source citation ledger | 3522–3529 |
| P048 | `proposal_048` | Newsletter issue assembler | 3531–3538 |
| P049 | `proposal_049` | Paid research digest | 3540–3547 |
| P050 | `proposal_050` | Podcast repurposing queue | 3549–3556 |
| P051 | `proposal_051` | Video chapter mapper | 3558–3565 |
| P052 | `proposal_052` | Social variant generator | 3567–3574 |
| P053 | `proposal_053` | Publishing approval queue | 3576–3583 |
| P054 | `proposal_054` | Content performance importer | 3585–3592 |
| P055 | `proposal_055` | Content refresh detector | 3594–3601 |
| P056 | `proposal_056` | Asset license register | 3603–3610 |
| P057 | `proposal_057` | Sponsor placement planner | 3612–3619 |
| P058 | `proposal_058` | Sponsor fulfillment reporter | 3621–3628 |
| P059 | `proposal_059` | Digital product packager | 3630–3637 |
| P060 | `proposal_060` | Subscriber download entitlement | 3639–3646 |
| P061 | `proposal_061` | Support intake classifier | 3648–3655 |
| P062 | `proposal_062` | Account context summary | 3657–3664 |
| P063 | `proposal_063` | Suggested support reply | 3666–3673 |
| P064 | `proposal_064` | Knowledge article proposal | 3675–3682 |
| P065 | `proposal_065` | Customer issue timeline | 3684–3691 |
| P066 | `proposal_066` | Satisfaction survey dispatcher | 3693–3700 |
| P067 | `proposal_067` | Satisfaction trend reader | 3702–3709 |
| P068 | `proposal_068` | Churn concern queue | 3711–3718 |
| P069 | `proposal_069` | Onboarding checklist runner | 3720–3727 |
| P070 | `proposal_070` | Activation event reader | 3729–3736 |
| P071 | `proposal_071` | Account health evidence | 3738–3745 |
| P072 | `proposal_072` | Escalation packet builder | 3747–3754 |
| P073 | `proposal_073` | Service credit review | 3756–3763 |
| P074 | `proposal_074` | Customer export request | 3765–3772 |
| P075 | `proposal_075` | Account deletion workflow | 3774–3781 |
| P076 | `proposal_076` | Branded client realm | 3783–3790 |
| P077 | `proposal_077` | Agency workspace allocator | 3792–3799 |
| P078 | `proposal_078` | Research concierge product | 3801–3808 |
| P079 | `proposal_079` | Calendar concierge product | 3810–3817 |
| P080 | `proposal_080` | Content operations retainer | 3819–3826 |
| P081 | `proposal_081` | Website maintenance retainer | 3828–3835 |
| P082 | `proposal_082` | Executive council subscription | 3837–3844 |
| P083 | `proposal_083` | Local business intake assistant | 3846–3853 |
| P084 | `proposal_084` | Creator sponsor concierge | 3855–3862 |
| P085 | `proposal_085` | White-label usage statement | 3864–3871 |
| P086 | `proposal_086` | Template license manager | 3873–3880 |
| P087 | `proposal_087` | Consultant research room | 3882–3889 |
| P088 | `proposal_088` | Client approval inbox | 3891–3898 |
| P089 | `proposal_089` | Reseller settlement ledger | 3900–3907 |
| P090 | `proposal_090` | Service catalog publisher | 3909–3916 |
| P091 | `proposal_091` | Morning context brief | 3918–3925 |
| P092 | `proposal_092` | Meeting preparation packet | 3927–3934 |
| P093 | `proposal_093` | Meeting follow-through queue | 3936–3943 |
| P094 | `proposal_094` | Calendar collision resolver | 3945–3952 |
| P095 | `proposal_095` | Reminder escalation rules | 3954–3961 |
| P096 | `proposal_096` | Weekly commitment review | 3963–3970 |
| P097 | `proposal_097` | Travel departure planner | 3972–3979 |
| P098 | `proposal_098` | Weather-sensitive plan review | 3981–3988 |
| P099 | `proposal_099` | Document expiry reminders | 3990–3997 |
| P100 | `proposal_100` | Household renewal review | 3999–4006 |
| P101 | `proposal_101` | Reading inbox triage | 4008–4015 |
| P102 | `proposal_102` | Personal receipt index | 4017–4024 |
| P103 | `proposal_103` | Decision revisit schedule | 4026–4033 |
| P104 | `proposal_104` | Focus session coordinator | 4035–4042 |
| P105 | `proposal_105` | End-of-day handoff | 4044–4051 |
| P106 | `proposal_106` | Authenticated webhook intake | 4053–4060 |
| P107 | `proposal_107` | Event deduplication store | 4062–4069 |
| P108 | `proposal_108` | Workflow dependency planner | 4071–4078 |
| P109 | `proposal_109` | Approval suspension point | 4080–4087 |
| P110 | `proposal_110` | Durable retry scheduler | 4089–4096 |
| P111 | `proposal_111` | Dead-letter inbox | 4098–4105 |
| P112 | `proposal_112` | Run cancellation control | 4107–4114 |
| P113 | `proposal_113` | Compensation step planner | 4116–4123 |
| P114 | `proposal_114` | Workflow dry-run mode | 4125–4132 |
| P115 | `proposal_115` | Per-workflow spending cap | 4134–4141 |
| P116 | `proposal_116` | Rate-limit coordinator | 4143–4150 |
| P117 | `proposal_117` | Workflow version history | 4152–4159 |
| P118 | `proposal_118` | Schedule timezone resolver | 4161–4168 |
| P119 | `proposal_119` | Run evidence journal | 4170–4177 |
| P120 | `proposal_120` | Workflow pause switch | 4179–4186 |
| P121 | `proposal_121` | Visual regression capture | 4188–4195 |
| P122 | `proposal_122` | Screenshot difference review | 4197–4204 |
| P123 | `proposal_123` | Design token audit | 4206–4213 |
| P124 | `proposal_124` | WebGL device capability check | 4215–4222 |
| P125 | `proposal_125` | GPU frame-time sampler | 4224–4231 |
| P126 | `proposal_126` | 3D resource leak audit | 4233–4240 |
| P127 | `proposal_127` | Asset budget inspector | 4242–4249 |
| P128 | `proposal_128` | Accessibility interaction sweep | 4251–4258 |
| P129 | `proposal_129` | Cache version reconciler | 4260–4267 |
| P130 | `proposal_130` | Preview deployment reader | 4269–4276 |
| P131 | `proposal_131` | Release readiness dossier | 4278–4285 |
| P132 | `proposal_132` | Error signature grouper | 4287–4294 |
| P133 | `proposal_133` | Incident timeline assembler | 4296–4303 |
| P134 | `proposal_134` | Dependency provenance audit | 4305–4312 |
| P135 | `proposal_135` | Rollback proposal builder | 4314–4321 |
| P136 | `proposal_136` | Connector health reader | 4323–4330 |
| P137 | `proposal_137` | Schema drift detector | 4332–4339 |
| P138 | `proposal_138` | Freshness deadline monitor | 4341–4348 |
| P139 | `proposal_139` | Cross-source identity matcher | 4350–4357 |
| P140 | `proposal_140` | Import quarantine queue | 4359–4366 |
| P141 | `proposal_141` | Source provenance graph | 4368–4375 |
| P142 | `proposal_142` | Data retention scheduler | 4377–4384 |
| P143 | `proposal_143` | Backup verification runner | 4386–4393 |
| P144 | `proposal_144` | Restore rehearsal planner | 4395–4402 |
| P145 | `proposal_145` | Tenant boundary test | 4404–4411 |
| P146 | `proposal_146` | PII minimization transform | 4413–4420 |
| P147 | `proposal_147` | Redaction review queue | 4422–4429 |
| P148 | `proposal_148` | Duplicate billing event detector | 4431–4438 |
| P149 | `proposal_149` | Metric definition registry | 4440–4447 |
| P150 | `proposal_150` | Report snapshot freezer | 4449–4456 |
| P151 | `proposal_151` | Order status adapter | 4458–4465 |
| P152 | `proposal_152` | Inventory threshold monitor | 4467–4474 |
| P153 | `proposal_153` | Supplier reorder proposal | 4476–4483 |
| P154 | `proposal_154` | Shipment exception queue | 4485–4492 |
| P155 | `proposal_155` | Returns intake coordinator | 4494–4501 |
| P156 | `proposal_156` | Product description workflow | 4503–4510 |
| P157 | `proposal_157` | Catalog consistency audit | 4512–4519 |
| P158 | `proposal_158` | Promotion margin check | 4521–4528 |
| P159 | `proposal_159` | Abandoned checkout review | 4530–4537 |
| P160 | `proposal_160` | Digital delivery verification | 4539–4546 |
| P161 | `proposal_161` | Product feedback digest | 4548–4555 |
| P162 | `proposal_162` | Vendor invoice matcher | 4557–4564 |
| P163 | `proposal_163` | Marketplace listing synchronizer | 4566–4573 |
| P164 | `proposal_164` | Fulfillment capacity forecast | 4575–4582 |
| P165 | `proposal_165` | Storefront incident alert | 4584–4591 |
| P166 | `proposal_166` | Evidence challenge round | 4593–4600 |
| P167 | `proposal_167` | Assumption registry | 4602–4609 |
| P168 | `proposal_168` | Contradiction detector | 4611–4618 |
| P169 | `proposal_169` | Decision record builder | 4620–4627 |
| P170 | `proposal_170` | Delegation budget allocator | 4629–4636 |
| P171 | `proposal_171` | Council completion barrier | 4638–4645 |
| P172 | `proposal_172` | Source diversity review | 4647–4654 |
| P173 | `proposal_173` | Freshness-aware answer audit | 4656–4663 |
| P174 | `proposal_174` | Tool outcome verifier | 4665–4672 |
| P175 | `proposal_175` | Memory proposal review | 4674–4681 |
| P176 | `proposal_176` | Context boundary checker | 4683–4690 |
| P177 | `proposal_177` | Research stop condition | 4692–4699 |
| P178 | `proposal_178` | Open question tracker | 4701–4708 |
| P179 | `proposal_179` | Advisor role contract | 4710–4717 |
| P180 | `proposal_180` | Council disagreement display | 4719–4726 |
| P181 | `proposal_181` | Future boardroom simulator | 4728–4735 |
| P182 | `proposal_182` | Opportunity observatory | 4737–4744 |
| P183 | `proposal_183` | Reverse pitch council | 4746–4753 |
| P184 | `proposal_184` | Dormant asset finder | 4755–4762 |
| P185 | `proposal_185` | Revenue museum | 4764–4771 |
| P186 | `proposal_186` | Automation autopsy | 4773–4780 |
| A01 | Automation brief | Morning briefing | 4786–4791 |
| A02 | Automation brief | Weekly business review | 4793–4798 |
| A03 | Automation brief | Meeting preparation | 4800–4805 |
| A04 | Automation brief | Commitment follow-through | 4807–4812 |
| A05 | Automation brief | Research watch | 4814–4819 |
| A06 | Automation brief | Website availability watch | 4821–4826 |
| A07 | Automation brief | Domain review | 4828–4833 |
| A08 | Automation brief | Content planning session | 4835–4840 |
| A09 | Automation brief | Newsletter draft | 4842–4847 |
| A10 | Automation brief | Client research packet | 4849–4854 |
| A11 | Automation brief | Proposal preparation | 4856–4861 |
| A12 | Automation brief | Follow-up draft | 4863–4868 |
| A13 | Automation brief | Product idea evaluation | 4870–4875 |
| A14 | Automation brief | Customer question digest | 4877–4882 |
| A15 | Automation brief | Campaign link preparation | 4884–4889 |
| A16 | Automation brief | Usage spending review | 4891–4896 |
| A17 | Automation brief | Automation maintenance review | 4898–4903 |
| A18 | Automation brief | Opportunity scan | 4905–4910 |
| A19 | Automation brief | Travel preparation | 4912–4917 |
| A20 | Automation brief | Weather-dependent reminder | 4919–4924 |
| A21 | Automation brief | Paper council digest | 4926–4931 |
| A22 | Automation brief | Decision review | 4933–4938 |
| A23 | Automation brief | Weekly handoff | 4940–4945 |
| A24 | Automation brief | Research quality check | 4947–4952 |
| M01 | Mission template | Evidence brief | 4958–4963 |
| M02 | Mission template | Plan my day | 4965–4970 |
| M03 | Mission template | Inspect a website | 4972–4977 |
| M04 | Mission template | Recover context | 4979–4984 |
| M05 | Mission template | Plan a journey | 4986–4991 |
| M06 | Mission template | Paper council review | 4993–4998 |
| M07 | Mission template | Domain inspection | 5000–5005 |
| M08 | Mission template | Document digest | 5007–5012 |
| M09 | Mission template | Opportunity scan | 5014–5019 |
| M10 | Mission template | Outside briefing | 5021–5026 |
| M11 | Mission template | Usage review | 5028–5033 |
| M12 | Mission template | Routine architect | 5035–5040 |
| M13 | Mission template | Message workshop | 5042–5047 |
| M14 | Mission template | Company evidence | 5049–5054 |
| M15 | Mission template | Personal toolkit | 5056–5061 |
| M16 | Mission template | Council perspective | 5063–5068 |
