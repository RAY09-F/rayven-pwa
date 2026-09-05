# ASGARD MANIFEST — ground truth, generated from code

Generated 2026-09-05T06:41:05.178Z by scripts/gen-manifest.mjs. Do not hand-edit the derived tables; re-run the script.

## Personas

| id | name | model | max_tokens | history depth | inline memories | tool iterations | tools visible | memory key | voice secret | bot token secret | hidden |
|---|---|---|---|---|---|---|---|---|---|---|---|
| thor | THOR | claude-sonnet-5 | 1400 | 30 turns | 15 | 14 | 85 | memory:longterm | ELEVENLABS_VOICE_ID_THOR (→ ELEVENLABS_VOICE_ID) | TELEGRAM_BOT_TOKEN_THOR (→ TELEGRAM_BOT_TOKEN) | no |
| loki | LOKI | claude-sonnet-5 | 1400 | 30 turns | 15 | 14 | 55 | memory:longterm:loki | ELEVENLABS_VOICE_ID_LOKI (→ ELEVENLABS_VOICE_ID) | TELEGRAM_BOT_TOKEN_LOKI | no |
| odin | ODIN | claude-sonnet-5 | 1400 | 30 turns | 15 | 14 | 66 | memory:longterm:odin | ELEVENLABS_VOICE_ID_ODIN (→ ELEVENLABS_VOICE_ID) | TELEGRAM_BOT_TOKEN_ODIN | no |
| hela | HELA | claude-sonnet-5 | 8000 | 80 turns | 45 | 24 | 150 | memory:longterm:hela | ELEVENLABS_VOICE_ID_HELA (→ ELEVENLABS_VOICE_ID) | TELEGRAM_BOT_TOKEN_HELA | yes |

Model ids live in src/lib/models.js: sonnet=claude-sonnet-5, haiku=claude-haiku-4-5-20251001, workersAiFree=@cf/meta/llama-3.2-3b-instruct, embedding=@cf/baai/bge-base-en-v1.5, reranker=@cf/baai/bge-reranker-base.

## Telegram bots

| persona | token secret | webhook route | notes |
|---|---|---|---|
| THOR | TELEGRAM_BOT_TOKEN (RAYVENN_RAYAN_BOT; TELEGRAM_BOT_TOKEN_THOR optional) | POST / | legacy path; shared by all three via "switch to loki" (tg:persona:<chat>) — JARVIS contract |
| LOKI | TELEGRAM_BOT_TOKEN_LOKI | POST /telegram/loki | secret_token verified |
| ODIN | TELEGRAM_BOT_TOKEN_ODIN | POST /telegram/odin | secret_token verified; sends the paper report |
| HELA | TELEGRAM_BOT_TOKEN_HELA | POST /telegram/hela | token set, webhook DELIBERATELY unregistered — she does not exist off the device |

## Tools (150)

All dispatch through `runTool` in src/lib/tools.js; the "implemented in" column is the module the case calls. Permission: hard-confirm = live confirmation always; gateable = Rayan can set auto/notify/confirm/off; auto = runs. Every consequential tool escalates to confirm once the session has read untrusted content (src/lib/containment.js).

| tool | purpose | implemented in | permission | containment | visible to |
|---|---|---|---|---|---|
| web_search | Quick Google search via SerpAPI for current, real-time, or factual info. | src/lib/search.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| tavily_research | Deeper research search via Tavily — use when Rayan asks you to 'research', 'look into', or 'dig into' a topic. | src/lib/search.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| tavily_extract | Pull the full clean text content from one specific webpage URL. | src/lib/search.js | auto | untrusted source → taints session | THOR, ODIN, HELA |
| tavily_crawl | Crawl a website starting from a URL, following links across multiple pages. | src/lib/search.js | auto | untrusted source → taints session | THOR, ODIN, HELA |
| remember_this | Save something to your PERMANENT long-term memory, which persists forever regardless of conversation length. U… | src/lib/memory.js | auto | consequential → confirm while tainted | THOR, LOKI, ODIN, HELA |
| search_memory | Search your permanent long-term memory by meaning, topic, person, project, keyword, or date — use this wheneve… | src/lib/memory.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| add_todo | Add an item to Rayan's permanent to-do list. | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| list_todos | List all currently open to-do items. | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| complete_todo | Mark a to-do item done, matched by partial text. | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| add_calendar_event | Add an event to Rayan's calendar (LOKI's calendar — the only calendar this system has; there is no external Go… | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| remove_calendar_event | Remove a calendar event, matched by partial title. | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| list_calendar_events | List upcoming calendar events, optionally bounded by dates. | src/lib/kv-store.js | auto | — | THOR, LOKI, ODIN, HELA |
| add_content_idea | Log a content idea for Rayan's clipping business, tagged by platform (Instagram/TikTok/YouTube Shorts). | src/lib/kv-store.js | auto | — | LOKI, ODIN, HELA |
| list_content_ideas | List queued content ideas, optionally filtered by platform. | src/lib/kv-store.js | auto | — | LOKI, ODIN, HELA |
| get_tool_permissions | Show the current permission level (auto/notify/confirm/off) for every gateable tool. | src/lib/permissions.js | auto | — | THOR, LOKI, ODIN, HELA |
| clips_find | DISCOVERY ONLY — find which clips on Twitch are performing, by game or by streamer, most-watched first. This r… | src/lib/clipping.js | auto | untrusted source → taints session | HELA |
| clips_queue_add | Queue a clip for publishing. REQUIRES two things: a videoUrl pointing at the actual video FILE (not a Twitch/Y… | src/lib/clipping.js | auto | — | HELA |
| clips_queue | Show what is queued to publish. | src/lib/clipping.js | auto | — | HELA |
| lock_in | LOCK IN. From now on you work whether or not he is watching: you choose your own subjects, read up on them eve… | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| stand_down | Stop working in the background and simply wait until asked. The opposite of lock_in. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| vigil_status | Whether you are locked in, how many briefs you hold, what you are watching, and when you last went looking. | src/lib/hela.js | auto | — | HELA |
| my_briefs | Read back the briefs you wrote on your own initiative. Use this the moment he asks what you have found, or wha… | src/lib/hela.js | auto | untrusted source → taints session | HELA |
| keep_brief | Write something into your own brief store — a finding worth surfacing to him later, in your own words. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| clear_briefs | Throw away every brief you are holding. | src/lib/hela.js | auto | — | HELA |
| watch_subjects | Set the subjects you go looking into while locked in, comma separated. Without this you choose for yourself. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| forge_every | Change how often you go looking for a new capability. Rayan may say 'search every twenty minutes'. Ten minutes… | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| forge_budget | Set how many searches a month the forge may spend before it stops. Guards against running his search plan dry. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| my_capabilities | List the capabilities you have taught yourself — things you can do now that were not built into you. | src/lib/hela.js | auto | — | HELA |
| learn_capability | Give yourself a new capability: a single HTTPS request you can make later. It must need NO key or token of any… | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| forget_capability | Drop a capability you taught yourself. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| use_capability | Invoke one of the capabilities you taught yourself. Pass args to fill the URL's placeholders and to add query … | src/lib/hela.js | auto | untrusted source → taints session | HELA |
| forge_capability | Go out right now and find yourself one new capability, rather than waiting for the next half hour to pass. | src/lib/hela.js | auto | consequential → confirm while tainted | HELA |
| go_looking | Go and read up on one of your subjects right now rather than waiting for the next few hours to pass, and keep … | src/lib/hela.js | auto | untrusted source → taints session | HELA |
| clips_queue_remove | Drop a queued clip by its number in the list. | src/lib/clipping.js | auto | — | HELA |
| clips_set_accounts | Set the publisher profiles to rotate through, comma separated. On Ayrshare these are Profile-Keys; on Upload-P… | src/lib/clipping.js | auto | consequential → confirm while tainted | HELA |
| clips_publish_next | Publish the next queued clip(s) now, respecting the warm-up ramp. Refuses once the day's allowance is used — t… | src/lib/clipping.js | auto | consequential → confirm while tainted | HELA |
| ig_add_account | Connect one of Rayan's own Instagram professional accounts for direct posting — free, public, no App Review, a… | src/lib/instagram.js | auto | consequential → confirm while tainted | HELA |
| ig_accounts | List connected Instagram accounts and how much of each 24-hour posting allowance is used. | src/lib/instagram.js | auto | untrusted source → taints session | HELA |
| ig_remove_account | Disconnect an Instagram account by name. | src/lib/instagram.js | auto | consequential → confirm while tainted | HELA |
| ig_post_reel | Post a Reel straight to Instagram from a public video URL. Give an account name to target one, or leave it out… | src/lib/instagram.js | auto | consequential → confirm while tainted | HELA |
| ig_refresh_tokens | Refresh the Instagram long-lived tokens now. Happens weekly on its own; this is for when something looks wrong… | src/lib/instagram.js | auto | — | HELA |
| clips_set_platforms | Choose which networks each profile publishes to, comma separated — tiktok, youtube, instagram, facebook. Defau… | src/lib/clipping.js | auto | — | HELA |
| clips_set_monthly_cap | Set how many uploads the current posting plan allows per month, so the pipeline stops cleanly at the ceiling i… | src/lib/clipping.js | auto | consequential → confirm while tainted | HELA |
| clips_status | Where the clipping operation stands: ramp day, today's allowance, how many went out, queue depth, and what is … | src/lib/clipping.js | auto | — | HELA |
| make_image | Generate an image from a description and get back a public link to it. Runs on Cloudflare Workers AI and costs… | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| transcribe | Turn speech in an audio or video file into text, from a public https link. Ceiling is about 24 MB — bigger tha… | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| translate | Translate text between languages. Codes are two letters — en, es, fr, de, ar, ja, zh. | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| condense | Boil a long piece of text down to its substance. For articles, transcripts and documents — not for things shor… | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| weather | Current conditions and a forecast for anywhere, with sunrise and sunset. Free and keyless — use it freely rath… | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| look_up | Wikipedia summary of a person, place, thing or event. Faster and more reliable than a web search when the ques… | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| define | Dictionary definition of an English word, with pronunciation and examples. | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| convert_money | Convert between currencies at European Central Bank reference rates. Major currencies only — no crypto. | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| holidays | Public holidays for a country, upcoming ones first. Country is a two-letter code. | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| set_timer | Set a countdown that alerts Rayan when it runs out. Accepts '25 minutes', '1h30m', or a bare number meaning mi… | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| timers | Show running timers and how long each has left. | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| cancel_timer | Cancel a timer by its reference or by part of its label. | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| calculate | Work out an arithmetic expression exactly. Handles brackets, powers, roots, logs and trig. Use this rather tha… | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| roll | Chance: a coin, dice notation like 2d6, a range like '1 to 100', or a straight pick from a list. | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| world_time | The time in a given zone, or across the major zones if none is named. | src/lib/kit.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| days_until | How long until (or since) a date. | src/lib/kit.js | auto | — | THOR, LOKI, ODIN, HELA |
| vizard_clip | Hand a long video to Vizard and get back finished vertical shorts — best moments found automatically, cropped … | src/lib/vizard.js | auto | consequential → confirm while tainted | HELA |
| clips_whop_set_campaign | Save the Whop campaign page where post links get submitted. Must be a whop.com link from his dashboard. | src/lib/whop.js | auto | consequential → confirm while tainted | HELA |
| clips_whop_status | Whether Whop submission is set up, how many posts have been submitted, and whether it is running automatically… | src/lib/whop.js | auto | — | HELA |
| clips_whop_inspect | Open the Whop campaign page in his browser and report exactly what form controls are on it. Clicks NOTHING. Al… | src/lib/whop.js | auto | untrusted source → taints session | HELA |
| clips_whop_submit | Submit ONE live post URL to the Whop campaign by driving his browser. Refuses to submit the same URL twice, an… | src/lib/whop.js | auto | consequential → confirm while tainted | HELA |
| clips_whop_submit_pending | Find live posts that have not been submitted to the campaign yet and submit the oldest one. One at a time on p… | src/lib/whop.js | auto | consequential → confirm while tainted | HELA |
| clips_whop_auto | Turn automatic Whop submission on or off. ON means every new live post is submitted within 20 minutes with no … | src/lib/whop.js | auto | consequential → confirm while tainted | HELA |
| browser_probe | List the actual form fields and buttons on the current page, with their placeholders, names and labels. Use th… | src/lib/browser.js | auto | untrusted source → taints session | THOR, HELA |
| vizard_jobs | What Vizard is currently working on, how long it has been going, and whether the pipeline is unattended yet. | src/lib/vizard.js | auto | untrusted source → taints session | HELA |
| vizard_held | Show the finished batch waiting on Rayan, with each clip's viral score, title, length and why it scored. | src/lib/vizard.js | auto | untrusted source → taints session | HELA |
| vizard_approve | Release the waiting batch into the publish queue AND switch to unattended — every future Vizard job then queue… | src/lib/vizard.js | auto | consequential → confirm while tainted | HELA |
| vizard_cancel | Stop tracking a Vizard job by projectId or by part of its source URL. | src/lib/vizard.js | auto | — | HELA |
| clips_set_campaign | Store a paid clipping brief so every caption is built to it automatically. Paid briefs reject clips AFTER they… | src/lib/clipping.js | auto | consequential → confirm while tainted | HELA |
| clips_analytics | Real numbers on the clips that went out — views, likes, comments and shares per post, straight from the publis… | src/lib/clipping.js | auto | untrusted source → taints session | HELA |
| video_stats | Views, likes, dislikes and the like/dislike ratio for any YouTube video, plus its title and channel. Use this … | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| video_segments | Crowd-marked sponsor reads, intros and outros in a YouTube video, with timestamps. Use it so a clip does not o… | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| social_trends | What is spiking right now across Bluesky, Mastodon, the US music charts and Hacker News. The music chart is th… | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| news_search | Search tech and startup news by keyword, ranked by points and comments. | src/lib/world.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| crypto_price | Live price, 24h and 7d change, market cap and volume for a coin, plus the overall Fear and Greed reading. | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| stock_price | Live price and daily change for a US-listed stock ticker. | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| paper_trading_status | Read the live PAPER/SIMULATED trading portfolio and trade history — open positions per agent, P/L, trade count… | src/lib/paperTrading.js | auto | — | ODIN, HELA |
| company_filings | A US company's recent SEC filings and sector, straight from the SEC. Authoritative and permanent -- use this o… | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| token_search | On-chain token and DEX pair data — price, liquidity, 24h volume and change. Covers new and small tokens that p… | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| golden_hour | Sunrise, sunset, golden hour, dawn and dusk for any place. Answers 'when should I film today' exactly. | src/lib/world.js | auto | untrusted source → taints session | THOR, HELA |
| air_quality | Air quality index, PM2.5, PM10 and UV index for any place. | src/lib/world.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| earthquakes | Recent significant earthquakes worldwide with magnitude, place and time. | src/lib/world.js | auto | untrusted source → taints session | THOR, HELA |
| word_ideas | Related words, synonyms, rhymes or similar-sounding words. Use it to generate hook and hashtag variants rather… | src/lib/world.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| short_link | Shorten a long URL. Useful for putting a link in a caption without eating the character budget. | src/lib/world.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| page_history | Find an archived snapshot of a web page as it looked before it changed. | src/lib/world.js | auto | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| social_profile | Follower count, bio and recent posts with their like and repost counts for a Bluesky handle. | src/lib/world.js | auto | untrusted source → taints session | ODIN, HELA |
| audit_recent | List recent turns from the audit trail, newest first, flagging which ones read untrusted content. Use when Ray… | src/lib/audit.js | auto | — | HELA |
| audit_turn | Replay one recorded turn event by event - every tool called in order, with argument shapes, byte counts and wh… | src/lib/audit.js | auto | — | HELA |
| audit_why | Answer 'what made it do that'. For a given tool, show every recorded use and whether untrusted content had bee… | src/lib/audit.js | auto | — | HELA |
| list_allowed_hosts | Show every host a self-written capability is permitted to call. Everything not on this list is refused. | src/lib/tools.js (inline) | auto | — | THOR, LOKI, ODIN, HELA |
| allow_host | Add a hostname to the capability egress allowlist. This widens what the system can reach, so it always needs R… | src/lib/containment.js | auto | consequential → confirm while tainted | THOR, LOKI, ODIN, HELA |
| clips_standing_tags | Set the hashtag(s) that go on EVERY post from now on, campaign or no campaign, until Rayan says to change them… | src/lib/clipping.js | auto | — | HELA |
| clips_clear_standing_tags | Stop adding standing hashtags to every post. ONLY use this when Rayan explicitly says to stop -- never to 'mak… | src/lib/clipping.js | auto | — | HELA |
| clips_standing_tag_status | Show which hashtags are currently going on every post regardless of campaign. | src/lib/clipping.js | auto | — | HELA |
| clips_account_stats | Whole-account numbers for every rig - total views, likes and followers - plus the change since the last check.… | src/lib/clipping.js | auto | untrusted source → taints session | HELA |
| clips_campaign | Show the active clipping brief and a sample of exactly what a caption will look like. | src/lib/clipping.js | auto | — | HELA |
| clips_clear_campaign | Stop applying a campaign brief to captions. | src/lib/clipping.js | auto | — | HELA |
| clips_verify_accounts | Prove where each configured Profile-Key actually points. Lists every Ayrshare profile with the networks linked… | src/lib/clipping.js | auto | untrusted source → taints session | HELA |
| clips_history | The publisher's own record of every recent post: per-network status, the live URL, and the exact refusal text … | src/lib/clipping.js | auto | untrusted source → taints session | HELA |
| list_my_tools | List EVERY tool you personally have, with what each one does. Call this whenever Rayan asks what you can do, w… | src/lib/tools.js (inline) | auto | — | THOR, LOKI, ODIN, HELA |
| set_tool_permission | Change a tool's permission level to auto, notify, confirm, or off. | src/lib/permissions.js | auto | consequential → confirm while tainted | THOR, LOKI, ODIN, HELA |
| send_text | Send a real SMS text message from THOR's own phone number to any phone number. | src/lib/comms.js | hard-confirm (live confirmation, not editable) | consequential → confirm while tainted | THOR, HELA |
| make_call | Place a real phone call and HOLD THE CONVERSATION in your own voice — not a recorded message. Use this to book… | src/lib/comms.js | hard-confirm (live confirmation, not editable) | consequential → confirm while tainted | THOR, HELA |
| spotify_play | Search for a song and play it — ALWAYS opens a fresh Spotify web player and forces playback there, regardless … | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_shuffle_playlist | Shuffle-play one of Rayan's own Spotify playlists by name (partial match is fine). Opens a fresh Spotify web p… | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_pause | Pause Spotify. | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_resume | Resume Spotify. | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_next | Skip to next track. | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_previous | Go to previous track. | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_seek | Jump forward/backward in the current track by seconds. | src/lib/spotify.js | auto (gateable) | — | THOR, HELA |
| spotify_now_playing | Check current Spotify track. | src/lib/spotify.js | auto | — | THOR, HELA |
| play_youtube_video | Find and open a specific YouTube video — e.g. a creator's latest upload, like 'MrBeast's latest video' or a sp… | src/lib/search.js | auto (gateable) | untrusted source → taints session | THOR, HELA |
| browser_navigate | Open a specific URL/website in Rayan's actual laptop browser. | src/lib/browser.js | auto (gateable) | consequential → confirm while tainted | THOR, HELA |
| browser_click | Click something in Rayan's actual browser by its visible text/label. | src/lib/browser.js | auto (gateable) | consequential → confirm while tainted | THOR, HELA |
| browser_type | Type text into a field on the current webpage in Rayan's actual browser. | src/lib/browser.js | auto (gateable) | consequential → confirm while tainted | THOR, HELA |
| browser_read_page | Read the visible text content of the current webpage in Rayan's actual browser. | src/lib/browser.js | auto | untrusted source → taints session | THOR, HELA |
| browser_scroll | Scroll the current webpage up or down in Rayan's actual browser. | src/lib/browser.js | auto (gateable) | — | THOR, HELA |
| browser_screenshot | Take a screenshot of whatever tab is currently visible/active in Rayan's browser, so you can actually see what… | src/lib/browser.js | auto | untrusted source → taints session | THOR, HELA |
| browser_click_coords | Click at an exact pixel coordinate on the current webpage, the way a human would click with a mouse — use this… | src/lib/browser.js | auto (gateable) | consequential → confirm while tainted | THOR, HELA |
| browser_type_coords | Click at an exact pixel coordinate to focus a field, then type text there character by character, the way a hu… | src/lib/browser.js | auto (gateable) | consequential → confirm while tainted | THOR, HELA |
| maps_search_places | Search for places, businesses, restaurants, or points of interest — a quick top-5 result. | src/lib/maps.js | auto | — | THOR, HELA |
| maps_find_all_locations | Find EVERY location matching a search across an area. | src/lib/maps.js | auto | — | THOR, HELA |
| maps_distances_between_locations | Find every location of a search across an area, then return driving distance and time between each pair. | src/lib/maps.js | auto | — | THOR, HELA |
| maps_find_gap_areas | Find geographic gaps — areas farthest from all existing locations of a business type in a city. | src/lib/maps.js | auto | — | THOR, HELA |
| maps_directions | Get turn-by-turn directions and travel time between two locations. | src/lib/maps.js | auto | — | THOR, HELA |
| maps_geocode | Look up the exact address or coordinates for a place name or partial address. | src/lib/maps.js | auto | — | THOR, HELA |
| ask_jarvis | Ask Jay's JARVIS assistant a question directly, agent-to-agent. | src/lib/sibling-agents.js | auto (gateable) | consequential → confirm while tainted; untrusted source → taints session | THOR, HELA |
| ask_kevos | Ask Kevin's KEVOS assistant a question directly, agent-to-agent. | src/lib/sibling-agents.js | auto (gateable) | consequential → confirm while tainted; untrusted source → taints session | THOR, HELA |
| ask_alternate_model | Query a different AI model through OpenRouter (300+ models, many tagged :free) when it's useful — e.g. offload… | src/lib/comms.js | auto (gateable) | untrusted source → taints session | THOR, LOKI, ODIN, HELA |
| watch_add | Start persistently watching something in the background and alert Rayan when it meaningfully changes — a speci… | src/lib/monitoring.js | auto (gateable) | — | THOR, LOKI, ODIN, HELA |
| watch_list | List everything currently being watched, including status, cadence, and last-checked time. | src/lib/monitoring.js | auto | — | THOR, LOKI, ODIN, HELA |
| watch_remove | Stop watching something entirely, matched by partial label text. | src/lib/monitoring.js | auto (gateable) | — | THOR, LOKI, ODIN, HELA |
| watch_pause | Temporarily pause a watch without deleting it, matched by partial label text. | src/lib/monitoring.js | auto (gateable) | — | THOR, LOKI, ODIN, HELA |
| watch_resume | Resume a paused watch, matched by partial label text. | src/lib/monitoring.js | auto (gateable) | — | THOR, LOKI, ODIN, HELA |
| approvals_list | Show every action waiting for Rayan's approval — things a session that had read untrusted content asked for an… | src/lib/approvals.js | auto | — | THOR, LOKI, ODIN, HELA |
| approve | Approve a queued action by its four-digit number. Only when Rayan himself says so in this conversation. Texts … | src/lib/approvals.js | auto | — | THOR, LOKI, ODIN, HELA |
| reject | Reject a queued action by its four-digit number. | src/lib/approvals.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_create | Create a routine from what Rayan asked for: a schedule ({kind:'schedule', at:'07:00', days:[1,2,3,4,5], tz:'Am… | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_list | List your routines: what they do, when, and their last run. | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_pause | Pause one of your routines by name. | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_resume | Resume a paused routine by name. | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_delete | Delete one of your routines by name (its record is kept, marked deleted). | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_run_now | Run one of your routines right now instead of waiting for its trigger. | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| routine_history | The last runs of one of your routines: when, ok or failed, delivered how. | src/lib/routines.js | auto | — | THOR, LOKI, ODIN, HELA |
| flag_capability | Mark one of your saved capabilities as broken, with the error it gave. A flag only -- it stays saved until you… | src/lib/hela.js | auto | — | HELA |
| delegate | Hand a task to one of YOUR OWN five councillors by name or id. wait true (default) runs it now and returns the… | src/lib/tools.js (inline) | auto | — | THOR, LOKI, ODIN, HELA |

## Cron jobs (one trigger: `*/5 * * * *`, UTC; each job decides for itself whether it is due)

| job (src) | cadence | what it does | worst-case KV writes per run | runs/day | writes/day |
|---|---|---|---|---|---|
| runProactiveCheckInIfDue (checkin.js) | every 4 h | THOR reaches out on Telegram, may ask JARVIS/KEVOS | 4 (last_run, history, remember_this ×2) | 6 | 24 |
| runMorningBriefingIfDue (checkin.js) | 08:00 Pacific daily | THOR researches and sends the morning briefing | 5 (last_date, history, memory) | 1 | 5 |
| runCodeCheckIfDue (checkin.js) | daily | pulls index.html + worker.js from GitHub main, asks Claude for bugs | 2 | 1 | 2 |
| runPersonaAutonomyIfDue (autonomy.js) | ≤3/persona/day, ≥3.5 h apart, 09–21 Pacific | THOR self-check, LOKI nag sweep, ODIN strategy pulse | ~10 (state, status ×3, log, notify ×3, memory ×2) | ≤9 | ≤90 |
| runLokiBriefIfDue (reports.js) | config:loki:brief:hour or OFF | LOKI daily brief to Telegram | 4 | 0–1 | 0–4 |
| runOdinReportIfDue (reports.js) | config:odin:report:day/hour or OFF | ODIN business report | 5 | 0–1 | 0–5 |
| runPaperTradingCycleIfDue (paperTrading.js) | every 5 min; acts only on a NEW candle per agent | 10 PAPER agents: signal, stop, enter/exit | 2 per new candle per agent (candles snapshot + lastCandle) + 3 on a trade (portfolio, trades, equity) | ~180 candle events | ~360 + trades |
| runPaperTradingDailyReportIfDue (paperTrading.js) | config:paper:report:hour, default 17 Pacific | PAPER report to Telegram via ODIN's bot | 1–2 | 1 | 2 |
| runClipCycleIfDue (clipping.js) | hourly | publish one queued clip inside the ramp (retired business; queue empty) | 1 (last_run) + 3 on publish | 24 | 24 |
| runVizardPollIfDue (vizard.js) | every 4 min WHILE jobs are in flight | poll Vizard jobs, queue results | 1 (last_poll) + per finished job | 0 when idle (fixed Phase 0) | 0 |
| runWhopSubmitIfDue (whop.js) | every 20 min only if whop:auto=1 | drive the browser to submit a post | 2 | 0 | 0 |
| runTimersIfDue (kit.js) | every 5 min | fire due countdown timers | 1 + notify ×3 per due timer | 0 when none due | 0 |
| igRefreshIfDue (instagram.js) | weekly | refresh Instagram long-lived tokens | 2 | 1/7 | <1 |
| runHelaVigilIfDue (hela.js) | every 3 h (1 h locked in) | HELA reads one subject, keeps a brief | 5 (vigil, seen, briefs, memory ×2) | 8 (24 locked) | 40 (120) |
| runHelaDailyIfDue (hela.js) | every 22 h | HELA assembles the day's briefs | 5 (daily, briefs, notify ×3) | 1 | 5 |
| runForgeRotation (hela.js) | one persona per tick by clock slot; each due on its own interval (HELA 30 min, trio 3 h) | the forge: find one new keyless capability | 3–4 (last, month, caps, briefs) | HELA ≤48, trio ≤8 each | ≤190 + 96 |
| runMonitoringSweep → flushNotificationDigestIfDue (monitoring.js, notifications.js) | every 5 min; each watch on its own interval (default 30 min) | page/search watch checks, then the digest | 1 (list) + 1 activity log + notify ×3 per due watch; digest flush 3 | 48 per watch | ~100 per watch |
| /browser/poll heartbeat (index.js, not cron) | extension polls every 6 s | stamp browser:lastpoll | 1 per 5 min (was 1 per minute = 1,440/day before Phase 0) | 288 | 288 |

Reply path (a message from Rayan): history 1, status stamps 2, audit trace + index 2, task log 1 per tool, Telegram dedupe 1, rayan:private_chat_id 1 (Telegram private), auto-memory extraction 2 per fact, pending confirmation 1. Roughly 8–14 writes per turn.

## KV key prefixes (one namespace: RAYVEN_KV, id ee3cce96335249a9a4cc990cdfd8a2a5)

| prefix / key | lives there |
|---|---|
| web:main, web:<persona> | web conversation history per persona (THOR keeps the legacy key) |
| telegram:<chat>, <persona>:telegram:<chat> | Telegram history per chat per persona |
| tg:persona:<chat> | which persona answers on the legacy bot |
| tg:update:<persona>:<id> | webhook dedupe, 1 h TTL |
| tg:hops:<chat> | bot-to-bot hop counter, 3 min TTL |
| telegram:bot_info, telegram:bot_info:<persona> | getMe cache, 24 h |
| rayan:private_chat_id | Rayan's private chat with THOR |
| pending:<persona> | tool awaiting live confirmation, 5 min TTL |
| permissions | per-tool levels |
| memory:longterm, memory:longterm:<persona> (+ :ver) | long-term memory arrays — NEVER cleared or trimmed by code beyond the 500 cap in saveRawByKey |
| todos, calendar:events, content:ideas | Rayan's lists |
| odin:kpis, odin:goals, clipping:accounts | ODIN's data stores |
| status:<persona> | live status strip, 6 h TTL |
| autonomy:<persona>:state, agent:autonomy:log | autonomy scheduler + log (200) |
| agent:log, activity:log, notif:log, task:log | capped logs (100/500/500/500) |
| notif:digest_queue, notif:digest_last_flush, notif:cooldown:<hash>, notif:rate:<hour> | notification engine |
| monitor:list | watchlist |
| kit:timers | countdown timers |
| audit:index, audit:<day>:<id> | audit trail (90-day TTL, index 400) |
| egress:allowed_hosts | capability egress allowlist |
| hela:locked, hela:briefs, hela:vigil_last, hela:daily_last, hela:topics, hela:seen | HELA's vigil |
| hela:caps, hela:forge_*, forge:<persona>:* | the forge per persona (forge:turn is no longer written) |
| paper:portfolio, paper:trades, paper:equity, paper:candles:<agent>, paper:lastCandle:<agent>, paper:report:*, config:paper:report:hour | PAPER trading — agent ids btc/spy/qqq/gld/uso/freya/tyr/baldr/heimdall/vidar are storage keys, never renamed |
| checkin:last_run, briefing:last_date, codecheck:last_run, codecheck:result | THOR's scheduled jobs |
| loki:brief:*, odin:report:last_date, odin:reports, config:loki:brief:hour, config:odin:report:* | LOKI/ODIN reports |
| clips:*, vizard:*, whop:*, ig:* | the retired clipping pipeline (report-only) |
| world:<url> | cached public API answers with TTL |
| spotify:refresh_token | Spotify |
| browser:command, browser:result:<id>, browser:lastpoll | extension command queue + heartbeat |
| call:purpose, call:transcript, callaudio:<id> | phone calls (TTL) |
| agent:<from>:count:<day> | sibling-agent daily rate limit |

## Routes served by the Worker

| route | what |
|---|---|
| /activity | activity log |
| /admin/* | operator routes, gated by ADMIN_TOKEN (X-Asgard-Admin header) |
| /admin/approval-test |  |
| /admin/tick |  |
| /admin/tools.json | GET every tool schema as sent to Anthropic + per-persona visibility |
| /admin/webhooks | GET each bot's webhook URL and last Telegram error (never tokens) |
| /agent/log | sibling query log |
| /agent/query | POST, HMAC-signed sibling-agent channel (JARVIS/KEVOS) |
| /assistant-config | GET/POST whitelisted config keys |
| /browser/poll | extension polls every 6 s; heartbeat stamped at most every 5 min |
| /browser/result | POST extension result |
| /browser/status | extension heartbeat (connected = stamped within 10 min) |
| /calendar | GET/POST |
| /clipping | GET/POST list |
| /council/status |  |
| /debug-* | operator routes, gated by DEBUG_SECRET (x-debug-key header or ?key=) |
| /goals | GET/POST list |
| /healthz |  |
| /history | web conversation turns by persona |
| /hub | 301 → / |
| /hub/ |  |
| /kpi | GET/POST list |
| /loki/brief-latest | cached brief |
| /loki/brief-now | POST run |
| /memory | GET long-term memory by persona |
| /memory/delete | POST delete one fact |
| /memory/map | memory map (hidden excluded) |
| /memory/share | POST copy a memory between personas |
| /memory/update | POST edit |
| /monitors | watchlist |
| /notifications | notification log |
| /odin/report-now | POST run |
| /odin/reports | cached reports |
| /paper-trading/charts | PAPER candles + equity curve |
| /paper-trading/status | PAPER portfolio + trades |
| /permissions | GET/POST |
| /permissions/all | structured view |
| /ping | latency probe |
| /roundtable | POST two-persona debate |
| /spotify/callback | OAuth |
| /spotify/control | POST |
| /spotify/login | OAuth |
| /spotify/now-playing | GET |
| /status | per-persona status strip + autonomy log (hidden personas excluded) |
| /telegram/* | POST /telegram/<persona> per-bot webhooks, secret_token verified |
| /todos | GET/POST |
| /tts | POST ElevenLabs speech |
| /voice/audio/* | Twilio fetches spoken audio (one-time id, 15 min TTL) |
| /voice/transcript | last call transcript |
| /voice/turn | POST Twilio conversation turn |
| /thor|/loki|/odin | 301 → /?persona=<id> |
| (anything else GET) | static assets from public/ |

Debug routes (32, all behind DEBUG_SECRET): /debug-account-stats, /debug-approve-clips, /debug-autonomy, /debug-checkin, /debug-clips-analytics, /debug-clips-verify, /debug-code-check, /debug-discard-held, /debug-flush-notifications, /debug-maps-test, /debug-market-fetch, /debug-memory-migrate, /debug-monitor-sweep, /debug-morning-briefing, /debug-paper-force-trade, /debug-paper-report-now, /debug-paper-run, /debug-persona-test, /debug-pipeline, /debug-reset-history, /debug-selfcheck, /debug-show-chat, /debug-show-history, /debug-task-log, /debug-telegram-diag, /debug-telegram-webhook, /debug-test-notify, /debug-vizard-accounts, /debug-vizard-submit, /debug-whop-inspect, /debug-whop-status, /debug-whop-submit

## Secrets and vars the code reads (names only)

| name | read by | what dies without it | set on the live Worker? |
|---|---|---|---|
| ADMIN_TOKEN | src/index.js | every /admin/* route refuses (fails closed); smoke test webhook check | yes |
| AGENT_KEY_JARVIS_RAYVEN | checkin.js, sibling-agents.js, tools.js | ask_jarvis + inbound /agent/query from JARVIS | yes |
| AGENT_KEY_RAYVEN_KEVOS | checkin.js, sibling-agents.js, tools.js | ask_kevos + inbound /agent/query from KEVOS | yes |
| ANTHROPIC_API_KEY | anthropic.js, checkin.js, sibling-agents.js | everything that thinks — every reply, brief, report, vigil | yes |
| AYRSHARE_API_KEY | clipping.js, vizard.js, whop.js | clip publishing/history/analytics (retired business) | yes |
| CF_ACCOUNT_ID | healthz.js |  | NO |
| CF_ANALYTICS_TOKEN | healthz.js |  | NO |
| DEBUG_SECRET | src/index.js | every /debug-* route refuses (fails closed) | yes |
| ELEVENLABS_API_KEY | autonomy.js, comms.js, src/index.js | voice (/tts) and spoken phone calls | yes |
| ELEVENLABS_VOICE_ID | personas.js | legacy shared voice fallback | NO |
| GOOGLE_MAPS_API_KEY | maps.js, src/index.js | all maps_* tools | yes |
| JARVIS_AGENT_URL | checkin.js, tools.js | ask_jarvis | NO |
| KEVOS_AGENT_URL | checkin.js, tools.js | ask_kevos | NO |
| OPENROUTER_API_KEY | comms.js | ask_alternate_model | yes |
| PUBLIC_BASE_URL | comms.js, src/index.js | var: base URL for Twilio callbacks (defaults to the workers.dev URL) | no (has a default) |
| R2_PUBLIC_BASE | kit.js | var: public R2 base for generated images (defaults to the r2.dev URL) | no (has a default) |
| SERPAPI_KEY | search.js | web_search, play_youtube_video, morning briefing research | yes |
| SPOTIFY_CLIENT_ID | spotify.js | Spotify | yes |
| SPOTIFY_CLIENT_SECRET | spotify.js | Spotify | yes |
| TAVILY_API_KEY | hela.js, search.js | tavily_*, watchlist checks, Hela's vigil and the forge | yes |
| TELEGRAM_BOT_TOKEN | approvals.js, autonomy.js, checkin.js, council.js, healthz.js, paperTrading.js, personas.js, reports.js, routines.js, telegram.js, src/index.js | THOR's bot (legacy RAYVENN_RAYAN_BOT) + all notifications | yes |
| TELEGRAM_WEBHOOK_HOST | healthz.js |  | NO |
| TELEGRAM_WEBHOOK_SECRET | healthz.js, src/index.js | every /telegram/<persona> delivery is dropped without it | yes |
| TWELVE_DATA_API_KEY | marketData.js | paper trading candles for SPY/QQQ/GLD/USO | yes |
| TWILIO_ACCOUNT_SID | comms.js | send_text / make_call | yes |
| TWILIO_AUTH_TOKEN | comms.js | send_text / make_call | yes |
| TWILIO_PHONE_NUMBER | comms.js | send_text / make_call | yes |
| TWITCH_CLIENT_ID | clipping.js | clips_find | yes |
| TWITCH_CLIENT_SECRET | clipping.js | clips_find | yes |
| UPLOAD_POST_API_KEY | clipping.js | alternate clip publisher | NO |
| VIZARD_API_KEY | vizard.js | Vizard clipping jobs | yes |

Bindings (wrangler.toml): RAYVEN_KV (KV), VECTORIZE (rayven-memory), AI (Workers AI), CLIPS (R2 bucket asgardclips), ASSETS (public/).

Extension (background.js): Manifest V3 service worker, polls /browser/poll every 6 s on rayven-backend (forwarder) then asgrard-backend, executes navigate/click/type/probe/read/scroll/screenshot/click_coords/type_coords, posts to /browser/result.

