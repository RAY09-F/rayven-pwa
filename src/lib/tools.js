// The tool schema array Claude sees, the executeTool dispatcher, and the
// tool-use loop (callClaudeWithTools). This is the most-imported module — it wires
// together every integration module into what RAYVEN can actually do. Ported
// unchanged from worker.js aside from switching from env-closures to explicit
// env params. Later phases append new tool definitions + executeTool cases here.
import { callAnthropic } from './anthropic.js';
import { checkPermission } from './permissions.js';
import { appendCappedLog, readCappedLog } from './util.js';
import { findClips, queueAdd, queueList, queueRemove, setAccounts, setPlatforms, setMonthlyCap, publishNext, clippingStatus } from './clipping.js';
import { igAddAccount, igListAccounts, igRemoveAccount, igPublish, igRefreshTokens } from './instagram.js';
// ⟦PROJECT-H:BEGIN⟧
import { helaLockIn, helaStandDown, helaStatus, helaBriefs, helaBriefAdd, helaClearBriefs, helaSetTopics, runHelaVigil, helaCapabilities, helaLearnCapability, helaForgetCapability, helaUseCapability, runHelaForge } from './hela.js';
// ⟦PROJECT-H:END⟧
import { addTodo, listTodos, completeTodo, addContentIdea, listContentIdeas, addCalendarEvent, removeCalendarEvent, listCalendarEventsText } from './kv-store.js';
import { addLongTermMemory, searchMemory } from './memory.js';
import { getToolPermissionsText, setToolPermission } from './permissions.js';
import { sendTextMessage, makePhoneCall, askAlternateModel } from './comms.js';
import {
  spotifySearchAndPlay, spotifyShufflePlaylist, spotifyPause, spotifyResume,
  spotifyNext, spotifyPrevious, spotifySeek, spotifyNowPlaying
} from './spotify.js';
import { youtubeFindAndOpen, runWebSearch, tavilySearch, tavilyExtract, tavilyCrawl } from './search.js';
import { enqueueBrowserCommand } from './browser.js';
import {
  googlePlacesSearch, googlePlacesFindAll, googleDistanceMatrix,
  googleFindGapAreas, googleDirections, googleGeocode
} from './maps.js';
import { askSiblingAgent } from './sibling-agents.js';
import { watchAdd, watchList, watchRemove, watchPause, watchResume } from './monitoring.js';
import { getPersona, personaAllowsTool, toolOwnerName, DEFAULT_PERSONA_ID } from './personas.js';

// Task Observer — every tool execution gets timed and logged (which tool, when,
// success/failure, duration) via the same capped-KV-log pattern as agent:log/
// activity:log/notif:log (see util.js). Exposed read-only via GET
// /debug-task-log in index.js.
const TASK_LOG_KEY = 'task:log';
const TASK_LOG_CAP = 500;

export async function executeTool(env, name, input, personaId = DEFAULT_PERSONA_ID) {
  const startedAt = Date.now();
  let success = true;
  let error = null;
  try {
    return await runTool(env, name, input, personaId);
  } catch (err) {
    success = false;
    error = err.message;
    throw err;
  } finally {
    // Was awaited. appendCappedLog is a read-modify-write of a 500-entry array —
    // two KV round trips plus a parse and re-serialize of a large blob, on EVERY
    // tool call, purely to feed a debug endpoint. A multi-tool turn paid it several
    // times over. Fire and forget: a lost debug entry costs nothing, a slow reply
    // costs Rayan every single turn.
    void appendCappedLog(env, TASK_LOG_KEY, {
      time: new Date(startedAt).toISOString(),
      tool: name,
      persona: personaId,
      durationMs: Date.now() - startedAt,
      success,
      error
    }, TASK_LOG_CAP).catch(err => console.error('task log write failed:', err && err.message));
  }
}

export async function getTaskLog(env) {
  return await readCappedLog(env, TASK_LOG_KEY);
}

async function runTool(env, name, input, personaId = DEFAULT_PERSONA_ID) {
  switch (name) {
    case 'web_search': return await runWebSearch(env, input.query);
    case 'tavily_research': return await tavilySearch(env, input.query);
    case 'tavily_extract': return await tavilyExtract(env, input.url);
    case 'tavily_crawl': return await tavilyCrawl(env, input.url, input.instructions);
    case 'remember_this': return await addLongTermMemory(env, input.fact, personaId);
    case 'search_memory': return await searchMemory(env, input, personaId);
    case 'add_todo': return await addTodo(env, input.text);
    case 'list_todos': return await listTodos(env);
    case 'complete_todo': return await completeTodo(env, input.match);
    case 'add_calendar_event': return await addCalendarEvent(env, input.title, input.date, input.time, input.notes);
    case 'remove_calendar_event': return await removeCalendarEvent(env, input.match);
    case 'list_calendar_events': return await listCalendarEventsText(env, input.fromDate, input.toDate);
    case 'add_content_idea': return await addContentIdea(env, input.platform, input.idea);
    case 'list_content_ideas': return await listContentIdeas(env, input.platform);
    case 'get_tool_permissions': return await getToolPermissionsText(env);
    case 'list_my_tools': return listMyTools(personaId);
    case 'clips_find': return await findClips(env, input);
    case 'clips_queue_add': return await queueAdd(env, input);
    case 'clips_queue': return await queueList(env);
    case 'clips_queue_remove': return await queueRemove(env, input);
    case 'clips_set_accounts': return await setAccounts(env, input);
    case 'clips_publish_next': return await publishNext(env, input);
    case 'clips_set_platforms': return await setPlatforms(env, input);
    case 'ig_add_account': return await igAddAccount(env, input);
    case 'ig_accounts': return await igListAccounts(env);
    case 'ig_remove_account': return await igRemoveAccount(env, input);
    case 'ig_post_reel': return await igPublish(env, input);
    case 'ig_refresh_tokens': return await igRefreshTokens(env, input);
    case 'clips_set_monthly_cap': return await setMonthlyCap(env, input);
    case 'clips_status': return await clippingStatus(env);
    // ⟦PROJECT-H:BEGIN⟧ — hers alone; personaAllowsTool gates them below
    case 'lock_in': return await helaLockIn(env);
    case 'stand_down': return await helaStandDown(env);
    case 'vigil_status': return await helaStatus(env);
    case 'my_briefs': return await helaBriefs(env, input);
    case 'keep_brief': return await helaBriefAdd(env, input);
    case 'clear_briefs': return await helaClearBriefs(env);
    case 'watch_subjects': return await helaSetTopics(env, input);
    case 'go_looking': { const r = await runHelaVigil(env); return r && r.ok ? `Read up on ${r.topic}. Kept it as "${r.title}".` : `Nothing came of that: ${(r && r.error) || 'unknown'}.`; }
    case 'my_capabilities': return await helaCapabilities(env);
    case 'learn_capability': return await helaLearnCapability(env, input);
    case 'forget_capability': return await helaForgetCapability(env, input);
    case 'use_capability': return await helaUseCapability(env, input);
    case 'forge_capability': { const r = await runHelaForge(env); return r && r.ok ? (r.added ? `I gave myself "${r.name}".` : 'Nothing out there was worth taking this time.') : `The forge came up empty: ${(r && r.error) || 'unknown'}.`; }
    // ⟦PROJECT-H:END⟧
    case 'set_tool_permission': return await setToolPermission(env, input.toolName, input.level);
    case 'send_text': return await sendTextMessage(env, input.to, input.message);
    case 'make_call': return await makePhoneCall(env, input.to, input.message);
    case 'spotify_play': return await spotifySearchAndPlay(env, input.query);
    case 'spotify_shuffle_playlist': return await spotifyShufflePlaylist(env, input.playlistName);
    case 'spotify_pause': return await spotifyPause(env);
    case 'spotify_resume': return await spotifyResume(env);
    case 'spotify_next': return await spotifyNext(env);
    case 'spotify_previous': return await spotifyPrevious(env);
    case 'spotify_seek': return await spotifySeek(env, input.direction, input.seconds);
    case 'spotify_now_playing': return await spotifyNowPlaying(env);
    case 'play_youtube_video': return await youtubeFindAndOpen(env, input.query);
    case 'browser_navigate': {
      const r = await enqueueBrowserCommand(env, 'navigate', { url: input.url });
      return r.success ? (r.data || `Opened ${input.url}.`) : (r.data || 'Navigation failed.');
    }
    case 'browser_click': { const r = await enqueueBrowserCommand(env, 'click', { text: input.text }); return r.data; }
    case 'browser_type': { const r = await enqueueBrowserCommand(env, 'type', { fieldHint: input.fieldHint, text: input.text }); return r.data; }
    case 'browser_read_page': { const r = await enqueueBrowserCommand(env, 'read', {}); return r.data; }
    case 'browser_scroll': { const r = await enqueueBrowserCommand(env, 'scroll', { direction: input.direction }); return r.data; }
    case 'browser_screenshot': {
      const r = await enqueueBrowserCommand(env, 'screenshot', {});
      if (!r.success || !r.data || !r.data.screenshot) return (r.data && typeof r.data === 'string') ? r.data : 'Screenshot failed.';
      const shot = r.data;
      const vp = shot.viewport || {};
      return [
        {
          type: 'text',
          text: `Screenshot captured. Viewport: ${vp.width}x${vp.height} CSS px (device pixel ratio ${vp.dpr || 1}). Current URL: ${shot.url || 'unknown'}. This image is in device-pixel coordinates — when calling browser_click_coords or browser_type_coords, give x/y matching pixel positions AS SEEN IN THIS IMAGE.`
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shot.screenshot } }
      ];
    }
    case 'browser_click_coords': { const r = await enqueueBrowserCommand(env, 'click_coords', { x: input.x, y: input.y }); return r.data; }
    case 'browser_type_coords': { const r = await enqueueBrowserCommand(env, 'type_coords', { x: input.x, y: input.y, text: input.text }); return r.data; }
    case 'maps_search_places': return await googlePlacesSearch(env, input.query);
    case 'maps_find_all_locations': return await googlePlacesFindAll(env, input.query);
    case 'maps_distances_between_locations': return await googleDistanceMatrix(env, input.query);
    case 'maps_find_gap_areas': return await googleFindGapAreas(env, input.businessType, input.city);
    case 'maps_directions': return await googleDirections(env, input.origin, input.destination, input.mode);
    case 'maps_geocode': return await googleGeocode(env, input.address);
    case 'ask_jarvis': return await askSiblingAgent('JARVIS', env.JARVIS_AGENT_URL, env.AGENT_KEY_JARVIS_RAYVEN, input.question);
    case 'ask_kevos': return await askSiblingAgent('KEVOS', env.KEVOS_AGENT_URL, env.AGENT_KEY_RAYVEN_KEVOS, input.question);
    case 'ask_alternate_model': return await askAlternateModel(env, input.model, input.prompt);
    case 'watch_add': return await watchAdd(env, input);
    case 'watch_list': return await watchList(env);
    case 'watch_remove': return await watchRemove(env, input.match);
    case 'watch_pause': return await watchPause(env, input.match);
    case 'watch_resume': return await watchResume(env, input.match);
    default: return 'Unknown tool.';
  }
}

export const TOOL_DEFINITIONS = [
  {
    name: 'web_search',
    description: "Quick Google search via SerpAPI for current, real-time, or factual info.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'tavily_research',
    description: "Deeper research search via Tavily — use when Rayan asks you to 'research', 'look into', or 'dig into' a topic.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'tavily_extract',
    description: "Pull the full clean text content from one specific webpage URL.",
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'tavily_crawl',
    description: "Crawl a website starting from a URL, following links across multiple pages.",
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' }, instructions: { type: 'string' } },
      required: ['url']
    }
  },
  {
    name: 'remember_this',
    description: "Save something to your PERMANENT long-term memory, which persists forever regardless of conversation length. Use this proactively — whenever Rayan asks you to remember something, whenever you finish research he asked for, whenever he shares a decision, preference, plan, or important fact, or anything else genuinely worth keeping — even if he didn't explicitly say 'remember this.'",
    input_schema: { type: 'object', properties: { fact: { type: 'string', description: 'The specific fact or summary to remember, written clearly and self-contained' } }, required: ['fact'] }
  },
  {
    name: 'search_memory',
    description: "Search your permanent long-term memory by meaning, topic, person, project, keyword, or date — use this whenever something in the current conversation might connect to something Rayan told you before that isn't in the recent-memory list already shown to you (e.g. he references a project, decision, or person from a while back). Don't rely on the recent-memory list alone for anything that sounds like older context.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language description of what to look for, e.g. "what we decided about the clipping business accounts"' },
        keyword: { type: 'string', description: 'Optional exact substring to also match on, alongside the semantic search' },
        dateFrom: { type: 'string', description: "Optional lower bound, 'YYYY-MM-DD'" },
        dateTo: { type: 'string', description: "Optional upper bound, 'YYYY-MM-DD'" }
      }
    }
  },
  {
    name: 'add_todo',
    description: "Add an item to Rayan's permanent to-do list.",
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
  },
  {
    name: 'list_todos',
    description: "List all currently open to-do items.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'complete_todo',
    description: "Mark a to-do item done, matched by partial text.",
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] }
  },
  {
    name: 'add_calendar_event',
    description: "Add an event to Rayan's calendar (LOKI's calendar — the only calendar this system has; there is no external Google/Apple calendar link).",
    input_schema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: "'YYYY-MM-DD'" }, time: { type: 'string', description: "Optional 'HH:MM' 24h" }, notes: { type: 'string' } }, required: ['title', 'date'] }
  },
  {
    name: 'remove_calendar_event',
    description: "Remove a calendar event, matched by partial title.",
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] }
  },
  {
    name: 'list_calendar_events',
    description: "List upcoming calendar events, optionally bounded by dates.",
    input_schema: { type: 'object', properties: { fromDate: { type: 'string', description: "'YYYY-MM-DD', defaults to today" }, toDate: { type: 'string' } } }
  },
  {
    name: 'add_content_idea',
    description: "Log a content idea for Rayan's clipping business, tagged by platform (Instagram/TikTok/YouTube Shorts).",
    input_schema: { type: 'object', properties: { platform: { type: 'string' }, idea: { type: 'string' } }, required: ['platform', 'idea'] }
  },
  {
    name: 'list_content_ideas',
    description: "List queued content ideas, optionally filtered by platform.",
    input_schema: { type: 'object', properties: { platform: { type: 'string' } } }
  },
  {
    name: 'get_tool_permissions',
    description: "Show the current permission level (auto/notify/confirm/off) for every gateable tool.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'clips_find',
    description: "DISCOVERY ONLY — find which clips on Twitch are performing, by game or by streamer, most-watched first. This returns titles, view counts and page links; it does NOT return the video file, because Twitch has no download API and pulling the mp4 programmatically breaks their Developer Agreement. To publish one, the file must come from the streamer or from your own recordings, hosted at a public https link. Gaming and IRL only — this pipeline deliberately does not handle movie or league sports footage.",
    input_schema: { type: 'object', properties: {
      game: { type: 'string', description: 'Exact game name as Twitch lists it, e.g. "Grand Theft Auto V"' },
      broadcaster: { type: 'string', description: 'Twitch channel login name' },
      days: { type: 'number', description: 'How far back to look, default 2' },
      limit: { type: 'number', description: 'How many to return, default 20, max 100' }
    } }
  },
  {
    name: 'clips_queue_add',
    description: "Queue a clip for publishing. REQUIRES two things: a videoUrl pointing at the actual video FILE (not a Twitch/YouTube page — the publisher downloads the media itself and cannot read a web page), and a hook you have written yourself. The pipeline refuses clips missing either, because an unmodified repost is what gets accounts downranked on all three platforms. Write the hook as the on-screen text that makes someone stop scrolling.",
    input_schema: { type: 'object', properties: {
      videoUrl: { type: 'string', description: 'REQUIRED. Direct https link to the video file itself, e.g. an R2 public link ending .mp4. Must load with no login. A clips.twitch.tv page link is NOT this and will be refused.' },
      clipId: { type: 'string', description: 'Optional Twitch clip id, for reference only' },
      clipUrl: { type: 'string', description: 'Optional original clip page, for reference only' },
      hook: { type: 'string', description: 'The written hook. Yours, specific to this clip, at least a dozen characters.' },
      caption: { type: 'string', description: 'Longer caption / description' },
      credit: { type: 'string', description: 'Streamer name to credit' }
    }, required: ['videoUrl', 'hook'] }
  },
  { name: 'clips_queue', description: 'Show what is queued to publish.', input_schema: { type: 'object', properties: {} } },
  // ⟦PROJECT-H:BEGIN⟧
  { name: 'lock_in', description: "LOCK IN. From now on you work whether or not he is watching: you choose your own subjects, read up on them every few hours on your own initiative, keep what matters in your permanent memory, and assemble a daily brief. Call this when he says lock in.", input_schema: { type: 'object', properties: {} } },
  { name: 'stand_down', description: 'Stop working in the background and simply wait until asked. The opposite of lock_in.', input_schema: { type: 'object', properties: {} } },
  { name: 'vigil_status', description: 'Whether you are locked in, how many briefs you hold, what you are watching, and when you last went looking.', input_schema: { type: 'object', properties: {} } },
  { name: 'my_briefs', description: "Read back the briefs you wrote on your own initiative. Use this the moment he asks what you have found, or what you have been doing.", input_schema: { type: 'object', properties: { limit: { type: 'number', description: 'how many, newest first, default 6' }, since: { type: 'string', description: 'ISO date to filter from' } } } },
  { name: 'keep_brief', description: 'Write something into your own brief store — a finding worth surfacing to him later, in your own words.', input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, topic: { type: 'string' } }, required: ['title', 'body'] } },
  { name: 'clear_briefs', description: 'Throw away every brief you are holding.', input_schema: { type: 'object', properties: {} } },
  { name: 'watch_subjects', description: 'Set the subjects you go looking into while locked in, comma separated. Without this you choose for yourself.', input_schema: { type: 'object', properties: { topics: { type: 'string' } }, required: ['topics'] } },
  { name: 'my_capabilities', description: 'List the capabilities you have taught yourself — things you can do now that were not built into you.', input_schema: { type: 'object', properties: {} } },
  { name: 'learn_capability', description: "Give yourself a new capability: a single HTTPS request you can make later. It must need NO key or token of any kind, must return JSON or text, and must be a real documented public endpoint — never invent a URL. Use {placeholders} in the URL for values filled at call time.", input_schema: { type: 'object', properties: { name: { type: 'string', description: 'snake_case' }, purpose: { type: 'string' }, method: { type: 'string', description: 'GET or POST' }, url: { type: 'string' }, note: { type: 'string', description: 'how to call it and what it returns' } }, required: ['name', 'purpose', 'url'] } },
  { name: 'forget_capability', description: 'Drop a capability you taught yourself.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'use_capability', description: "Invoke one of the capabilities you taught yourself. Pass args to fill the URL's placeholders and to add query parameters.", input_schema: { type: 'object', properties: { name: { type: 'string' }, args: { type: 'object', description: 'values for {placeholders} and extra query params' }, body: { type: 'object', description: 'JSON body, POST only' } }, required: ['name'] } },
  { name: 'forge_capability', description: 'Go out right now and find yourself one new capability, rather than waiting for the next half hour to pass.', input_schema: { type: 'object', properties: {} } },
  { name: 'go_looking', description: 'Go and read up on one of your subjects right now rather than waiting for the next few hours to pass, and keep a brief on it.', input_schema: { type: 'object', properties: {} } },
  // ⟦PROJECT-H:END⟧
  { name: 'clips_queue_remove', description: 'Drop a queued clip by its number in the list.', input_schema: { type: 'object', properties: { index: { type: 'number' } }, required: ['index'] } },
  {
    name: 'clips_set_accounts',
    description: 'Set the publisher profiles to rotate through, comma separated. On Ayrshare these are Profile-Keys; on Upload-Post they are profile names. Each profile carries one account per network.',
    input_schema: { type: 'object', properties: { profiles: { type: 'string' } }, required: ['profiles'] }
  },
  {
    name: 'clips_publish_next',
    description: "Publish the next queued clip(s) now, respecting the warm-up ramp. Refuses once the day's allowance is used — that limit exists to stop 15 new accounts tripping spam detection together.",
    input_schema: { type: 'object', properties: { count: { type: 'number', description: 'How many to publish, default 1' } } }
  },
  {
    name: 'ig_add_account',
    description: "Connect one of Rayan's own Instagram professional accounts for direct posting — free, public, no App Review, and it keeps working after any paid trial ends. Needs a name, the Instagram user id, and a long-lived access token. Verifies the token before saving.",
    input_schema: { type: 'object', properties: {
      name: { type: 'string', description: 'What to call it, e.g. rig1' },
      igId: { type: 'string', description: 'Instagram user id' },
      token: { type: 'string', description: 'Long-lived access token' }
    }, required: ['name', 'igId', 'token'] }
  },
  { name: 'ig_accounts', description: 'List connected Instagram accounts and how much of each 24-hour posting allowance is used.', input_schema: { type: 'object', properties: {} } },
  { name: 'ig_remove_account', description: 'Disconnect an Instagram account by name.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  {
    name: 'ig_post_reel',
    description: "Post a Reel straight to Instagram from a public video URL. Give an account name to target one, or leave it out to post to all connected accounts. Meta allows up to 100 API posts per account per rolling 24 hours.",
    input_schema: { type: 'object', properties: {
      videoUrl: { type: 'string', description: 'Public https URL to the video' },
      caption: { type: 'string' },
      account: { type: 'string', description: 'Optional — one account name. Omit for all.' }
    }, required: ['videoUrl'] }
  },
  { name: 'ig_refresh_tokens', description: 'Refresh the Instagram long-lived tokens now. Happens weekly on its own; this is for when something looks wrong.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'clips_set_platforms',
    description: "Choose which networks each profile publishes to, comma separated — tiktok, youtube, instagram, facebook. Defaults to tiktok + youtube.",
    input_schema: { type: 'object', properties: { platforms: { type: 'string' } }, required: ['platforms'] }
  },
  {
    name: 'clips_set_monthly_cap',
    description: 'Set how many uploads the current posting plan allows per month, so the pipeline stops cleanly at the ceiling instead of failing mid-post. Free tiers are small and do not announce themselves.',
    input_schema: { type: 'object', properties: { cap: { type: 'number' } }, required: ['cap'] }
  },
  { name: 'clips_status', description: "Where the clipping operation stands: ramp day, today's allowance, how many went out, queue depth, and what is not yet connected.", input_schema: { type: 'object', properties: {} } },
  {
    name: 'list_my_tools',
    description: "List EVERY tool you personally have, with what each one does. Call this whenever Rayan asks what you can do, what tools you have, or what your capabilities are — never answer that from memory, because you will miss some and he is asking precisely because he wants the real list.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'set_tool_permission',
    description: "Change a tool's permission level to auto, notify, confirm, or off.",
    input_schema: { type: 'object', properties: { toolName: { type: 'string' }, level: { type: 'string', enum: ['auto', 'notify', 'confirm', 'off'] } }, required: ['toolName', 'level'] }
  },
  {
    name: 'send_text',
    description: "Send a real SMS text message from THOR's own phone number to any phone number.",
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destination phone number in E.164 format, e.g. +16611234567' },
        message: { type: 'string' }
      },
      required: ['to', 'message']
    }
  },
  {
    name: 'make_call',
    description: "Place a real outbound phone call from THOR's own phone number to any phone number, and have THOR speak a message on the call using text-to-speech.",
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destination phone number in E.164 format, e.g. +16611234567' },
        message: { type: 'string', description: 'What THOR should say when the call connects' }
      },
      required: ['to', 'message']
    }
  },
  {
    name: 'spotify_play',
    description: "Search for a song and play it — ALWAYS opens a fresh Spotify web player and forces playback there, regardless of what was already playing anywhere else.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'spotify_shuffle_playlist',
    description: "Shuffle-play one of Rayan's own Spotify playlists by name (partial match is fine). Opens a fresh Spotify web player, turns shuffle on, and starts the playlist.",
    input_schema: { type: 'object', properties: { playlistName: { type: 'string' } }, required: ['playlistName'] }
  },
  { name: 'spotify_pause', description: 'Pause Spotify.', input_schema: { type: 'object', properties: {} } },
  { name: 'spotify_resume', description: 'Resume Spotify.', input_schema: { type: 'object', properties: {} } },
  { name: 'spotify_next', description: 'Skip to next track.', input_schema: { type: 'object', properties: {} } },
  { name: 'spotify_previous', description: 'Go to previous track.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'spotify_seek',
    description: "Jump forward/backward in the current track by seconds.",
    input_schema: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['forward', 'backward'] }, seconds: { type: 'number' } },
      required: ['direction', 'seconds']
    }
  },
  { name: 'spotify_now_playing', description: 'Check current Spotify track.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'play_youtube_video',
    description: "Find and open a specific YouTube video — e.g. a creator's latest upload, like 'MrBeast's latest video' or a specific video topic. Opens it directly in a new browser tab.",
    input_schema: { type: 'object', properties: { query: { type: 'string', description: "e.g. 'MrBeast latest video' or a specific video description" } }, required: ['query'] }
  },
  {
    name: 'browser_navigate',
    description: "Open a specific URL/website in Rayan's actual laptop browser.",
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'browser_click',
    description: "Click something in Rayan's actual browser by its visible text/label.",
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
  },
  {
    name: 'browser_type',
    description: "Type text into a field on the current webpage in Rayan's actual browser.",
    input_schema: {
      type: 'object',
      properties: { fieldHint: { type: 'string' }, text: { type: 'string' } },
      required: ['text']
    }
  },
  {
    name: 'browser_read_page',
    description: "Read the visible text content of the current webpage in Rayan's actual browser.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'browser_scroll',
    description: "Scroll the current webpage up or down in Rayan's actual browser.",
    input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] }
  },
  {
    name: 'browser_screenshot',
    description: "Take a screenshot of whatever tab is currently visible/active in Rayan's browser, so you can actually see what's on screen. Always call this before browser_click_coords or browser_type_coords so you know exactly where things are. Limitation: this only sees inside Chrome itself (tabs/windows) — it cannot see the rest of Rayan's screen, other applications, or minimized/background windows.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'browser_click_coords',
    description: "Click at an exact pixel coordinate on the current webpage, the way a human would click with a mouse — use this for anything browser_click (text-matching) can't find. Coordinates MUST match the pixel positions shown in the most recent browser_screenshot image, so always screenshot first.",
    input_schema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] }
  },
  {
    name: 'browser_type_coords',
    description: "Click at an exact pixel coordinate to focus a field, then type text there character by character, the way a human would type. Coordinates MUST match the most recent browser_screenshot image — screenshot first. Omit x/y to type into whatever is already focused.",
    input_schema: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' }, text: { type: 'string' } },
      required: ['text']
    }
  },
  {
    name: 'maps_search_places',
    description: "Search for places, businesses, restaurants, or points of interest — a quick top-5 result.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'maps_find_all_locations',
    description: "Find EVERY location matching a search across an area.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'maps_distances_between_locations',
    description: "Find every location of a search across an area, then return driving distance and time between each pair.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'maps_find_gap_areas',
    description: "Find geographic gaps — areas farthest from all existing locations of a business type in a city.",
    input_schema: {
      type: 'object',
      properties: { businessType: { type: 'string' }, city: { type: 'string' } },
      required: ['businessType', 'city']
    }
  },
  {
    name: 'maps_directions',
    description: "Get turn-by-turn directions and travel time between two locations.",
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        mode: { type: 'string', enum: ['driving', 'walking', 'bicycling', 'transit'] }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'maps_geocode',
    description: "Look up the exact address or coordinates for a place name or partial address.",
    input_schema: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] }
  },
  {
    name: 'ask_jarvis',
    description: "Ask Jay's JARVIS assistant a question directly, agent-to-agent.",
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
  },
  {
    name: 'ask_kevos',
    description: "Ask Kevin's KEVOS assistant a question directly, agent-to-agent.",
    input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }
  },
  {
    name: 'ask_alternate_model',
    description: "Query a different AI model through OpenRouter (300+ models, many tagged :free) when it's useful — e.g. offloading a simple task to a free model instead of always using Claude, or trying a model specialized for something niche. Use a full OpenRouter model ID, e.g. 'meta-llama/llama-3.3-70b-instruct:free' or 'deepseek/deepseek-chat:free'.",
    input_schema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: "Full OpenRouter model ID, e.g. 'meta-llama/llama-3.3-70b-instruct:free'" },
        prompt: { type: 'string', description: 'The question or task to send to that model' }
      },
      required: ['model', 'prompt']
    }
  },
  {
    name: 'watch_add',
    description: "Start persistently watching something in the background and alert Rayan when it meaningfully changes — a specific webpage/product page (give the URL), or a company/competitor/topic/keyword/news subject (give a search phrase, no URL). Runs on its own schedule; Rayan does not need to ask again. Use this whenever Rayan says things like 'watch this', 'keep an eye on X', 'let me know if this changes/drops/comes back in stock/starts trending'.",
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'A URL to watch a specific page, OR a search phrase (company name, topic, keyword) to watch broader web/news activity.' },
        label: { type: 'string', description: 'Short human name for this watch, e.g. "PS5 restock" or "Acme Corp news". Defaults to the target if omitted.' },
        condition: { type: 'string', description: 'What specifically to alert on, in plain English, e.g. "price drops below $400", "back in stock", "any major news". If omitted, the assistant uses judgment on what counts as meaningful.' },
        intervalMinutes: { type: 'number', description: 'How often to check, in minutes. Defaults to 30.' }
      },
      required: ['target']
    }
  },
  {
    name: 'watch_list',
    description: "List everything currently being watched, including status, cadence, and last-checked time.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'watch_remove',
    description: "Stop watching something entirely, matched by partial label text.",
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] }
  },
  {
    name: 'watch_pause',
    description: "Temporarily pause a watch without deleting it, matched by partial label text.",
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] }
  },
  {
    name: 'watch_resume',
    description: "Resume a paused watch, matched by partial label text.",
    input_schema: { type: 'object', properties: { match: { type: 'string' } }, required: ['match'] }
  }
];

// Tool schemas a given persona is allowed to see. Thor (toolNames: null) gets
// everything; restricted personas get only their allow-list. The prompt-level
// restriction is a suggestion — the dispatch check below is the actual boundary.
// The honest answer to "what can you do?" — read off the live registry rather
// than from the model's recollection, which drifts and drops things.
function listMyTools(personaId) {
  const defs = toolDefinitionsForPersona(personaId).filter(t => t.name !== 'list_my_tools');
  const lines = defs.map(t => `- ${t.name}: ${t.description}`);
  return `You currently have ${defs.length} tools. This is the complete list, straight from your own registry — read it out in full when asked, grouped sensibly and in your own voice, and do not leave any out:\n\n${lines.join('\n')}`;
}

export function toolDefinitionsForPersona(personaId) {
  const persona = getPersona(personaId);
  // A persona never sees a tool it is not allowed to call. For the concealed
  // fourth's tools this is not merely tidiness: a tool NAME in the schema is
  // itself a disclosure, so the three upstairs must never be handed them.
  const allowed = TOOL_DEFINITIONS.filter(t => personaAllowsTool(personaId, t.name));
  if (persona.toolNames === null) return allowed;
  return allowed.filter(t => persona.toolNames.includes(t.name));
}

// Put an ephemeral cache breakpoint on the final content block of the last
// message. Anthropic caches the prefix up to the breakpoint, so a long history
// and a long tool chain stop being re-read on every iteration. Text-only blocks
// are left alone if the shape is anything unexpected — a mis-shaped
// cache_control is a hard API error, and a slower reply beats a failed one.
function withMessageCacheBreakpoint(messages) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  if (!last || typeof last.content === 'string') {
    return messages.slice(0, -1).concat([{
      role: last.role,
      content: [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }]
    }]);
  }
  return messages;
}

export async function callClaudeWithTools(env, personaAndBaseline, channelAndSender, longTermMemoryBlock, initialMessages, allowTools, extraContext, personaId = DEFAULT_PERSONA_ID) {
  const systemBlocks = [
    { type: 'text', text: personaAndBaseline, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: channelAndSender },
    { type: 'text', text: longTermMemoryBlock }
  ];
  if (extraContext) systemBlocks.push({ type: 'text', text: extraContext });

  // A second cache breakpoint, on the last message going in. Without it every one
  // of the up-to-14 tool-loop iterations re-processed the whole conversation and
  // every accumulated tool result from scratch — the deeper the tool chain, the
  // more it cost. With it, each iteration only pays for what is genuinely new.
  let messages = withMessageCacheBreakpoint([...initialMessages]);
  let lastResult = null;

  // ---- FIXED: wake-trigger messages get NO tools at all, so the greeting is always a
  // single, instant round trip instead of a potentially slow multi-step tool chain ----
  const toolsForThisCall = allowTools === false ? [] : toolDefinitionsForPersona(personaId);

  // 14 iterations, not 6 — the sibling system hit "I looped too many times"
  // halfway through real multi-step work at 6. A persona may raise its own
  // ceiling and its own token budget; anyone who does not stays on the house
  // defaults, so the three upstairs are completely unaffected by this.
  const _p = getPersona(personaId);
  const maxIter = _p.toolIterations || 14;
  const maxTok = _p.maxTokens || undefined;
  for (let iteration = 0; iteration < maxIter; iteration++) {
    const result = await callAnthropic(env, systemBlocks, toolsForThisCall, messages, maxTok);
    lastResult = result;
    if (!result.ok) return result;

    const data = result.data;
    if (data.stop_reason === 'tool_use') {
      const toolUseBlock = data.content.find(b => b.type === 'tool_use');
      if (!toolUseBlock) break;

      let toolResult;
      if (!personaAllowsTool(personaId, toolUseBlock.name)) {
        // Enforced here at dispatch, not just in the prompt — a restricted
        // persona physically cannot run a tool outside its lane.
        toolResult = `Tool blocked: ${toolUseBlock.name} is outside your lane. That belongs to ${toolOwnerName(toolUseBlock.name)} — tell Rayan to switch personas instead of answering as if you ran it.`;
      } else {
        const permLevel = await checkPermission(env, toolUseBlock.name);
        if (permLevel === 'off') {
          toolResult = `That tool (${toolUseBlock.name}) is currently turned off, sir.`;
        } else if (permLevel === 'confirm') {
          await env.RAYVEN_KV.put(`pending:${personaId}`, JSON.stringify({ toolName: toolUseBlock.name, toolInput: toolUseBlock.input, personaId, created: Date.now() }), { expirationTtl: 300 });
          toolResult = `That action (${toolUseBlock.name}) needs your confirmation first, sir — say "yes" or "go ahead" within 5 minutes and I'll run it.`;
        } else {
          toolResult = await executeTool(env, toolUseBlock.name, toolUseBlock.input, personaId);
        }
      }

      messages.push({ role: 'assistant', content: data.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }] });
      continue;
    }
    return result;
  }
  return lastResult;
}
