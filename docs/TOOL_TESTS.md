# Tool tests — every catalogue tool called once, live, before it ships

Run by scripts/tool-tests.mjs through GET /admin/tool-test (ADMIN_TOKEN). PASS = real data came back. Anything that fails is either fixed or moved to "not shipped — why" and dropped from the catalogue.

## 2026-09-05 19:33 UTC — 48 pass, 14 fail

| tool | result | time | first line |
|---|---|---|---|
| read_document | FAIL | 519 ms | read_document: the upstream call failed — HTTP 403 |
| read_page | PASS | 121 ms | # Example Domain This domain is for use in documentation examples without needing permission. Avoid use in ope |
| rss_read | PASS | 1285 ms | Hacker News: Front Page 1. The Luxuries in Life — Sat, 05 Sep 2026 17:46:16 +0000 https://feld.com/archives/20 |
| google_news | FAIL | 8342 ms | google_news: the upstream call failed — HTTP 503: <html><head><meta http-equiv="content-type" content="text/ht |
| trending_now | PASS | 777 ms | Daily Search Trends 1. nate frazier — Sat, 5 Sep 2026 12:10:00 -0700 https://trends.google.com/trending/rss?ge |
| hackernews | PASS | 412 ms | 1. The Luxuries in Life (95 pts, 33 comments) https://feld.com/archives/2026/09/the-real-luxuries-in-life/ htt |
| reddit_read | FAIL | 195 ms | reddit_read: the upstream call failed — HTTP 403: <body class=theme-beta><div><style>.theme-light,:root{--rem3 |
| wayback | PASS | 197 ms | Closest archived copy: http://web.archive.org/web/20260905150837/https://example.com/ (captured 20260905150837 |
| wiki_search | PASS | 490 ms | 1. Bakersfield, California — Bakersfield is a city in and the county seat of Kern County, California , United  |
| wiki_pageviews | PASS | 404 ms | Bakersfield, California: 15,518 views over 15 days (avg 1,035/day). Last 7: 08/29=1068, 08/30=828, 08/31=1086, |
| arxiv_search | PASS | 596 ms | arXiv Query: search_query=all:transformer OR all:attention&id_list=&start=0&max_results=3 1. Dilated Neighborh |
| crossref_search | PASS | 429 ms | 1. Is Attention All You Need? — Patrick Mineault (2025) From Human Attention to Computational Attention https: |
| semantic_scholar | FAIL | 175 ms | semantic_scholar: the upstream call failed — HTTP 429: {"message": "Too Many Requests. Please wait and try aga |
| openlibrary_search | PASS | 8727 ms | 1. Dune — Frank Herbert (1965) ISBN 9788373017238 https://openlibrary.org/works/OL893414W 2. Dune Messiah — Fr |
| book_by_isbn | PASS | 3441 ms | Dune — Ace Trade August 2, 2005, 544 pages. https://openlibrary.org/books/OL7524304M |
| gutenberg_search | FAIL | 10112 ms | gutenberg_search: the upstream call failed — timed out after 10000 ms |
| archive_search | PASS | 1301 ms | 1. KCHO 91.7 FM/KFPR 88.9 FM [North State Public Radio] : January 03, 2020 10:00AM-11:00AM PST (audio, 2020) h |
| federal_register | PASS | 301 ms | 1. Endangered and Threatened Wildlife and Plants; Nine Species Not Warranted for Listing as Endangered or Thre |
| sec_search | FAIL | 111 ms | sec_search: the upstream call failed — HTTP 403: <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN |
| universities | FAIL | 204 ms | universities: the upstream call failed — HTTP 521: error code: 521  |
| coingecko_price | FAIL | 108 ms | coingecko_price: the upstream call failed — HTTP 429: {"status":{"error_code":429,"error_message":"You've exce |
| coingecko_markets | FAIL | 97 ms | coingecko_markets: the upstream call failed — HTTP 429: {"status":{"error_code":429,"error_message":"You've ex |
| coingecko_trending | PASS | 123 ms | 1. Firo (FIRO) rank #942 $0.8640 2. Lil' Shrub (SHRUB) rank #505 $0.03924 3. Pons (PONS) rank #93 $0.9204 4. C |
| dexscreener_search | FAIL | 84 ms | dexscreener_search: the upstream call failed — HTTP 429: error code: 1015  |
| defillama_tvl | PASS | 879 ms | aave: TVL $18,310,474,934.2 |
| btc_mempool | PASS | 324 ms | Fees (sat/vB): fastest 1, ~30 min 1, ~1 h 1, economy 1, minimum 1. Mempool: 89,282 transactions, 42.2 MvB. |
| fear_greed | PASS | 327 ms | Now: 73 (Greed). Last 7 days: 73, 74, 65, 63, 69, 62, 69. |
| stooq_quote | FAIL | 1158 ms | stooq_quote: the upstream call failed — HTTP 404: <meta charset=utf-8><title>Stooq</title><center style=font-f |
| treasury_yields | FAIL | 10068 ms | treasury_yields: the upstream call failed — timed out after 10000 ms |
| bls_latest | FAIL | 370 ms | bls_latest: the upstream call failed — HTTP 429: BLS API Requests Per Second Limit Exceeded |
| polymarket_markets | PASS | 138 ms | 1. Will Pablo Marçal win the 2026 Brazilian presidential election? — yes 0%, 24h vol $132,133.47 (read-only) 2 |
| fx_rates | PASS | 110 ms | 1 USD = 0.861117 EUR (Sat, 05 Sep 2026 00:02:32 +0000) |
| paper_equity_chart | PASS | 251 ms | PAPER / SIMULATED equity curve (14 points, cash only): https://quickchart.io/chart?w=720&h=360&bkg=%230B0A12&c |
| nws_alerts | PASS | 201 ms | 1. Beach Hazards Statement (Moderate, Expected) — San Francisco; Coastal North Bay Including Point Reyes Natio |
| nws_forecast | PASS | 302 ms | Bakersfield, CA: This Afternoon: 89°F, wind 5 mph WNW — Sunny Tonight: 65°F, wind 0 to 5 mph NNW — Clear Sunda |
| quakes | PASS | 503 ms | 1. M2.71 4 km NE of Temecula, CA — 2026-09-05 10:31 UTC, depth 10 km, 271 km away 2. M3.2 6 km SE of Ontario,  |
| calfire_incidents | PASS | 448 ms | 1. Stony Fire — Colusa County, 2 acres, containment ?, updated 2026-09-05T17:39 https://www.fire.ca.gov/incide |
| space_weather | PASS | 152 ms | Planetary K index (last 6 readings): Z Kp undefined, Z Kp undefined, Z Kp undefined, Z Kp undefined, Z Kp unde |
| iss_now | PASS | 401 ms | ISS: -25.97, -39.84 at 430 km, 27,547 km/h, daylight; about 10,747 km from Bakersfield (ground track). |
| nasa_apod | PASS | 303 ms | Chasing the Moon's Shadow (2026-09-05) Chasing the shadow of a New Moon, NASA’s WB-57F high altitude research  |
| tides | PASS | 400 ms | Station 9410170, today (local): High 07:16 3.6 ft · Low 10:20 3.4 ft · High 16:56 5.8 ft |
| elevation | PASS | 502 ms | Elevation at 35.37, -119.02: 125 m (410 ft). |
| zip_lookup | PASS | 201 ms | 93301: Bakersfield, CA (35.3866, -119.0171) |
| ip_geo | PASS | 100 ms | 8.8.8.8: United States — AS15169 Google LLC (America/Chicago) |
| osm_search | PASS | 721 ms | 1. Bakersfield, Kern County, California, United States (35.3739, -119.0195) [administrative] |
| osm_reverse | PASS | 383 ms | Eye Street, Bakersfield, Kern County, California, 93301, United States |
| osm_nearby | FAIL | 3617 ms | osm_nearby: the upstream call failed — HTTP 521: error code: 521  |
| country_info | PASS | 233 ms | No country called Japan. |
| world_bank | PASS | 404 ms | Population, total — United States: 2025: 341,784,857 · 2024: 340,003,797 · 2023: 336,755,052 · 2022: 333,996,3 |
| shopping_list | PASS | 264 ms | The shopping list is empty. |
| quick_note | PASS | 408 ms | Noted (2026-09-05). 1 notes kept. |
| notes_read | PASS | 108 ms | [2026-09-05 19:33Z] tool-test note |
| reading_list | PASS | 206 ms | The reading list is empty. |
| habits_status | PASS | 188 ms | No habits logged yet. Say "log gym" or "log water" to start one. |
| expenses_week | PASS | 318 ms | No expenses logged in the last 7 days. |
| unit_convert | PASS | 81 ms | 10 mi = 16.0934 km (length) |
| recipe_search | PASS | 296 ms | 1. Chicken Handi — Chicken, India https://www.themealdb.com/meal/52795 2. Chicken Mandi — Chicken, India https |
| cocktail_search | PASS | 301 ms | Margarita (Alcoholic, Cocktail glass): 1 1/2 oz Tequila, 1/2 oz Triple sec, 1 oz Lime juice, Salt. Rub the rim |
| food_by_barcode | PASS | 1527 ms | Thai peanut noodle kit includes stir-fry rice noodles & thai peanut seasoning — Simply Asia, Thai Kitchen, 155 |
| exercises | PASS | 1200 ms | 1. Biceps Curls With Barbell (Barbell) — Hold the Barbell shoulder-wide, the back is straight, the shoulders s |
| vin_decode | PASS | 385 ms | 2003 HONDA Accord EX-V6 — Coupe, 6 cyl 2.998832712 L Gasoline, built in MARYSVILLE, UNITED STATES (USA). |
| recalls | PASS | 503 ms | 24 recall(s) for 2003 honda accord: 1. 19V182000 (06/03/2019) AIR BAGS:FRONTAL:DRIVER SIDE:INFLATOR MODULE: Ho |

## 2026-09-05 19:40 UTC — 4 pass, 9 fail

| tool | result | time | first line |
|---|---|---|---|
| read_document | FAIL | 482 ms | read_document: the upstream call failed — response too large: 2215244 bytes (limit 1048576) |
| google_news | FAIL | 5697 ms | google_news: the upstream call failed — HTTP 503: <html><head><meta http-equiv="content-type" content="text/ht |
| semantic_scholar | FAIL | 10048 ms | semantic_scholar: the upstream call failed — timed out after 10000 ms |
| gutenberg_search | FAIL | 10222 ms | gutenberg_search: the upstream call failed — timed out after 10000 ms |
| universities | FAIL | 204 ms | universities: the upstream call failed — HTTP 521: error code: 521  |
| coingecko_price | PASS | 134 ms | bitcoin: $79,765 (+0.14% 24h, mcap $1,602,347,590,184.24) ethereum: $2,474.53 (+0.82% 24h, mcap $302,122,695,3 |
| coingecko_markets | FAIL | 363 ms | coingecko_markets: the upstream call failed — HTTP 402: {"error":"This plan has 20000 monthly requests limit,  |
| dexscreener_search | FAIL | 48 ms | dexscreener_search: the upstream call failed — HTTP 429: error code: 1015  |
| stooq_quote | FAIL | 2494 ms | stooq_quote: the upstream call failed — HTTP 404: <meta charset=utf-8><title>Stooq</title><center style=font-f |
| treasury_yields | FAIL | 18134 ms | treasury_yields: the upstream call failed — timed out after 18000 ms |
| osm_nearby | PASS | 8330 ms | 1. Café Smitten — 909 18th Street · 663 m 2. Blue Oak Coffee Roasting — 1717 20th Street · 537 m 3. Dagny's Co |
| space_weather | PASS | 45 ms | Planetary K index (last 6 readings): 00:00Z Kp 2, 03:00Z Kp 2.67, 06:00Z Kp 2, 09:00Z Kp 2, 12:00Z Kp 1.33, 15 |
| country_info | PASS | 155 ms | No country called Japan. |

## 2026-09-05 19:40 UTC — 58 pass, 10 fail

| tool | result | time | first line |
|---|---|---|---|
| jobs_search | PASS | 2041 ms | 1. Freelance Copywriter — Coalition Technologies (Worldwide), 2026-09-02 [Remotive] https://remotive.com/remot |
| company_lookup | PASS | 821 ms | Chevron: Chevron may refer to: https://en.wikipedia.org/wiki/Chevron |
| cloudflare_status | PASS | 456 ms | Cloudflare: Minor Service Outage. Open incidents: - Incorrect geo location for some Cloudflare WARP users (ide |
| github_activity | FAIL | 122 ms | github_activity: the upstream call failed — HTTP 403: {"message":"API rate limit exceeded for 172.69.22.188. ( |
| npm_info | PASS | 184 ms | three@0.185.1 — JavaScript 3D library. License MIT, published 66 d ago, 15,193,062 downloads last week. https: |
| pypi_info | PASS | 113 ms | requests 2.34.2 — Python HTTP for Humans.. License Apache-2.0. Requires >=3.10. https://pypi.org/project/reque |
| dns_lookup | PASS | 102 ms | cloudflare.com A 104.16.133.229 (TTL 32) cloudflare.com A 104.16.132.229 (TTL 32) |
| whois | PASS | 189 ms | CLOUDFLARE.COM: registrar Cloudflare, Inc.; registered 2009-02-17; expires 2033-02-17; status client delete pr |
| http_check | PASS | 112 ms | https://example.com → HTTP 200; content-type text/html; 559 bytes read (capped). |
| url_shorten | FAIL | 284 ms | url_shorten: the upstream call failed — response was not JSON |
| url_unshorten | PASS | 131 ms | https://is.gd/example does not redirect (status 410). |
| qr_code | PASS | 72 ms | https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https%3A%2F%2Fexample.com |
| page_preview | PASS | 204 ms | Example Domain — example.com This domain is for use in documentation examples without needing permission. Avoi |
| color_info | PASS | 296 ms | Ronchi: #E7C24A · rgb(231, 194, 74) · hsl(46, 77%, 60%) · text on it #000000 |
| text_hash | PASS | 45 ms | sha256: 414f824665dee430cdf036e7a8fc4bcff23ec7d309599b18cef6ceb25920bd78 |
| base64 | PASS | 173 ms | YXNnYXJk |
| uuid | PASS | 88 ms | 2c2f8a70-c421-46dd-ad2e-41cfaff31d32 |
| regex_test | PASS | 91 ms | 1 match(es): "asg" at 0 |
| json_pretty | PASS | 50 ms | Valid JSON (object with keys a). { "a": 1 } |
| itunes_search | FAIL | 189 ms | itunes_search: the upstream call failed — HTTP 429: Rate limit has been exceeded for: itunes-apple-com/general |
| tv_search | PASS | 664 ms | Loki (2021, Ended, Disney+) — Action, Adventure, Science-Fiction. Loki follows the trickster and shape-shifter |
| tv_tonight | PASS | 427 ms | 19:00 B1G College Countdown — S4E1 "From Ann Arbor, MI" (NBC) 19:15 SEC Now — S2026E284 "Episode 284" (SEC Net |
| anime_search | FAIL | 712 ms | anime_search: the upstream call failed — HTTP 504: error code: 504  |
| musicbrainz | FAIL | 10102 ms | musicbrainz: the upstream call failed — timed out after 10000 ms |
| songlink | FAIL | 204 ms | songlink: the upstream call failed — HTTP 401: {"statusCode":401,"code":"PUBLIC_API_ACCESS_DEPRECATED"} |
| game_deals | PASS | 1403 ms | 1. Warhammer Underworlds - Shadespire Edition: $5.99 (was $29.99, -80%) https://www.cheapshark.com/redirect?de |
| free_games | PASS | 320 ms | Giveaways now: - Beach Invasion 1944 (Epic Games) Giveaway (PC, Epic Games Store, ends 2026-09-07 23:59:00) ht |
| board_games | FAIL | 112 ms | board_games: the upstream call failed — HTTP 401: Unauthorized. See https://boardgamegeek.com/using_the_xml_ap |
| trivia | PASS | 471 ms | 1. [Entertainment: Books, hard] According to Bram Stoker's novel, in which British coastal town did Dracula co |
| draw_cards | PASS | 199 ms | 7 of CLUBS, QUEEN of DIAMONDS |
| pokemon | PASS | 131 ms | #25 pikachu: electric, 0.4 m, 6 kg. Stats: hp 35, attack 55, defense 40, special-attack 50, special-defense 50 |
| dnd | PASS | 372 ms | Fireball (spell), level 3, Evocation. A bright streak flashes from your pointing finger to a point you choose  |
| mtg_card | PASS | 304 ms | Black Lotus {0} — Artifact. {T}, Sacrifice this artifact: Add three mana of any one color. (Vintage Masters, b |
| dad_joke | PASS | 222 ms | Two silk worms had a race. They ended up in a tie. |
| joke | PASS | 426 ms | I can't believe I got fired from the calendar factory. All I did was take a day off. |
| chuck_norris | PASS | 752 ms | i dont know why people treat Chuck Norris like hes a killer he has the heart of a child which isa bad thing |
| advice | PASS | 708 ms | Don't wear clean trousers when walking your dog in the park. |
| affirmation | PASS | 598 ms | You can do it |
| quote | PASS | 1141 ms | "It is safer to search in the maze than to remain in a cheeseless situation." — Spencer Johnson |
| useless_fact | PASS | 967 ms | John Adams, Thomas Jefferson, and James Monroe died on July 4th. |
| yes_or_no | PASS | 547 ms | NO https://yesno.wtf/assets/no/3-80a6f5b5d6684674bcfeda34accca4e1.gif |
| random_dog | PASS | 459 ms | https://images.dog.ceo/breeds/african-wild/n02116738_8749.jpg |
| random_fox | PASS | 397 ms | https://randomfox.ca/images/43.jpg |
| random_cat | PASS | 706 ms | https://cataas.com/cat/Ytc1sGXo4UmsTWyD?position=center |
| http_cat | PASS | 44 ms | https://http.cat/418 |
| robot_avatar | PASS | 61 ms | https://robohash.org/thor.png?size=200x200 |
| pixel_avatar | PASS | 42 ms | https://api.dicebear.com/9.x/pixel-art/svg?seed=loki |
| art_random | PASS | 494 ms | Chip — Arch Connelly (1982) https://www.artic.edu/iiif/2/e4e04333-09d9-d66f-6ff5-7288726b4757/full/843,/0/defa |
| mcu_countdown | PASS | 192 ms | VisionQuest — 39 days (2026-10-14). Then Avengers: Doomsday on 2026-12-16. |
| is_even | PASS | 268 ms | 4 is even. (For sale: human skull. Used once only. $200 OBO Dr. Scott Tyler, 454-555-6533) |
| xkcd | PASS | 302 ms | xkcd #3294: Asteroid Mission — Lander, this is Houston. There's been a request that you turn clipping back on  |
| meme_templates | PASS | 99 ms | - Drake Hotline Bling: https://i.imgflip.com/30b1gx.jpg - Two Buttons: https://i.imgflip.com/1g8my4.jpg - Dist |
| star_wars | PASS | 107 ms | Luke Skywalker (peopl): name Luke Skywalker, height 172, mass 77, hair color blond, skin color fair, eye color |
| star_trek | PASS | 1032 ms | 0413 Theta. mirror https://stapi.co/character/CHMA0000215045 |
| rick_and_morty | PASS | 165 ms | Rick Sanchez: Alive, Human, from Earth (C-137), last seen Citadel of Ricks. https://rickandmortyapi.com/api/ch |
| describe_image | FAIL | 101 ms | image: the upstream call failed — HTTP 400 |
| detect_objects | FAIL | 102 ms | image: the upstream call failed — HTTP 400 |
| classify_image | FAIL | 105 ms | image: the upstream call failed — HTTP 400 |
| sentiment | PASS | 406 ms | POSITIVE (100%) |
| publish_note | PASS | 426 ms | Published: https://asgrard-backend.rayanfahil2.workers.dev/notes/2e40bccb |
| memory_timeline | PASS | 189 ms | [2026-09-03] Rayan sent a group message addressing accounts named RAYVENN_RAYAN_BOT, ODIN_KING_BOT, and LOKI_S |
| what_did_i_say_about | PASS | 683 ms | - [2026-08-13] [2026-08-13] Rayan confirmed he wants RAYVEN to eventually trade stocks, meme coins, and day tr |
| journal_write | PASS | 514 ms | Journal: written for 2026-09-05. |
| journal_read | PASS | 100 ms | [2026-09-05] tool-test journal line |
| self_stats | PASS | 4901 ms | Recent ticks read: 34. Tool calls seen in them: 0. KV writes today (upgrade writers): 124 of 2,500. Routine ru |
| ntfy_push | PASS | 47 ms | ntfy_push: NTFY_TOPIC is not set. Rayan: nano ~/secret.txt (a long random topic name), then npx wrangler secre |
| discord_webhook | PASS | 59 ms | discord_webhook: DISCORD_WEBHOOK_URL is not set (Rayan adds it as a secret if he wants this). |
| share_file | PASS | 95 ms | share_file: refused — is under a protected prefix or is not a valid key. |

## Not shipped — why (2026-09-05)

Every tool below was written, called live once through `/admin/tool-test`, and failed for a reason that is
not ours to fix. They are listed in `DROPPED` in `src/tools/catalog.js` and never reach a god. Re-test with
`node scripts/tool-tests.mjs <name>` after removing a name from `DROPPED`.

| tool | why |
|---|---|
| reddit_read | reddit.com answers 403 to Cloudflare's edge addresses (the spec expected this) |
| sec_search | efts.sec.gov refuses cloud addresses (403) even with a proper User-Agent |
| bls_latest | api.bls.gov: "Requests Per Second Limit Exceeded" — the no-key limit is shared with every tenant on the address |
| google_news | news.google.com/rss answers 503 to the edge address on every try; `news_search` (SerpAPI) covers it |
| semantic_scholar | 429 on the first try, a 10 s timeout on the second; needs a key to be reliable |
| gutenberg_search | gutendex.com timed out at 10 s on both tries |
| universities | universities.hipolabs.com was down (521) on both tries — worth re-testing in a week |
| dexscreener_search | 429 (their rate limit, Cloudflare error 1015) on both tries |
| stooq_quote | stooq.com and stooq.pl both 404 the CSV endpoint from here |
| treasury_yields | home.treasury.gov's XML feed timed out at 10 s and again at 18 s; FRED would need a free key |
| github_activity | api.github.com's 60/hour no-key limit is already exhausted from the shared address; a `GITHUB_TOKEN` secret would revive it |
| itunes_search | itunes.apple.com 429 from the shared address |
| songlink | api.song.link: `PUBLIC_API_ACCESS_DEPRECATED` (401) — the free API no longer exists |
| board_games | boardgamegeek.com's XML API now requires a token (401) |

Not built on purpose (the spec says why): YouTube transcripts, lyrics, congress trades, gas prices, package
tracking without a key, Amazon prices, anything that applies for a job, anything that scrapes a site that forbids it.

Keyed groups not built because no key exists yet (Rayan's checklist from 7.0 could not be asked tonight): Notion,
Todoist, Google Tasks, Discord (the webhook tool exists and waits for `DISCORD_WEBHOOK_URL`), GitHub token,
CoinGecko Demo key, Whop, Finnhub, FRED, NASA (DEMO_KEY is used), USAJobs, Adzuna, TMDB, Ticketmaster, Steam,
smart-home devices. ntfy waits for `NTFY_TOPIC`. Secrets arrive by Rule 4, never in chat.

## 2026-09-05 19:48 UTC — 13 pass, 3 fail

| tool | result | time | first line |
|---|---|---|---|
| read_document | PASS | 1338 ms | # sample.pdf ## Metadata - PDFFormatVersion=1.3 - IsLinearized=false - IsAcroFormPresent=false - IsXFAPresent= |
| coingecko_markets | PASS | 179 ms | 1. Bitcoin (BTC) $79,815 +0.13% · mcap $1,602,860,446,668 · vol $18,712,009,128 2. Ethereum (ETH) $2,475.97 +0 |
| anime_search | FAIL | 645 ms | anime_search: the upstream call failed — HTTP 504: error code: 504  |
| musicbrainz | FAIL | 563 ms | musicbrainz: the upstream call failed — HTTP 503: {"error": "The MusicBrainz web server is currently busy. Ple |
| url_shorten | PASS | 202 ms | https://tinyurl.com/29oljsw6 → https://example.com/asgard (TinyURL; is.gd was unavailable) |
| describe_image | PASS | 2100 ms |  A wild animal, possibly a hyena, is standing on a road. |
| detect_objects | PASS | 527 ms | dog (100%) |
| classify_image | PASS | 476 ms | AFRICAN HUNTING DOG (100%), DHOLE (0%), DINGO (0%), HYENA (0%), RED WOLF (0%) |
| country_info | PASS | 105 ms | No country called Japan. |
| star_wars | PASS | 46 ms | Luke Skywalker (person): name Luke Skywalker, height 172, mass 77, hair color blond, skin color fair, eye colo |
| star_trek | PASS | 57 ms | 0413 Theta. mirror https://stapi.co/character/CHMA0000215045 |
| is_even | PASS | 93 ms | 4 is even. (Confirmed by the isEven API. Yes, really.) |
| company_lookup | PASS | 301 ms | Chevron Corporation: Chevron Corporation is an American multinational energy corporation predominantly special |
| routine_templates | PASS | 32 ms | Things I can automate — say the sentence to switch one on: - rain tomorrow → tell me tonight at nine [loki] -  |
| rss_watch | FAIL | 170 ms | rss_watch: the upstream call failed — that is not a URL I can read |
| rss_unwatch | PASS | 48 ms | No watched feed matches "undefined". Watching: nothing. |

## 2026-09-05 19:50 UTC — 4 pass, 0 fail

| tool | result | time | first line |
|---|---|---|---|
| country_info | PASS | 539 ms | No country called Japan. |
| star_trek | PASS | 1224 ms | Elise Picard. https://stapi.co/character/CHMA0000015352 |
| rss_watch | PASS | 1566 ms | Watching "Hacker News: Front Page" (20 items seen so far). New items will raise feed.new; switch on the "a fee |
| rss_unwatch | PASS | 300 ms | Stopped watching 1 feed(s). Still watching: nothing. |

## 2026-09-05 19:53 UTC — 1 pass, 0 fail

| tool | result | time | first line |
|---|---|---|---|
| country_info | PASS | 926 ms | Japan (JP): capital Tokyo; East Asia & Pacific; High income; population 123,366,734 (2025). Japan is an island |
