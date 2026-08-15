export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-agent-sig'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/agent/query' && request.method === 'POST') {
      return handleAgentQuery(request, env, corsHeaders);
    }

    if (url.pathname === '/agent/log') {
      const logRaw = await env.RAYVEN_KV.get('agent:log');
      const log = logRaw ? JSON.parse(logRaw) : [];
      return new Response(JSON.stringify(log, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/memory' && request.method === 'GET') {
      const memRaw = await env.RAYVEN_KV.get('memory:longterm');
      const mem = memRaw ? JSON.parse(memRaw) : [];
      return new Response(JSON.stringify(mem, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/todos' && request.method === 'GET') {
      const todosRaw = await env.RAYVEN_KV.get('todos');
      const todos = todosRaw ? JSON.parse(todosRaw) : [];
      return new Response(JSON.stringify(todos, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/permissions' && request.method === 'GET') {
      const permsRaw = await env.RAYVEN_KV.get('permissions');
      const perms = permsRaw ? JSON.parse(permsRaw) : {};
      return new Response(JSON.stringify(perms, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-reset-history') {
      const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
      if (!chatId) return new Response('No private chat ID stored yet.', { headers: corsHeaders });
      await env.RAYVEN_KV.delete(`telegram:${chatId}`);
      return new Response(`Cleared the conversation history for chat ${chatId}. Try messaging RAYVEN privately again.`, { headers: corsHeaders });
    }

    if (url.pathname === '/debug-show-history') {
      const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
      if (!chatId) return new Response('No private chat ID stored yet.', { headers: corsHeaders });
      const raw = await env.RAYVEN_KV.get(`telegram:${chatId}`);
      return new Response(raw || '(empty)', { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-show-chat') {
      const chatId = url.searchParams.get('id');
      if (!chatId) return new Response('Pass ?id=<chat id> in the URL.', { headers: corsHeaders });
      const raw = await env.RAYVEN_KV.get(`telegram:${chatId}`);
      return new Response(raw || '(empty)', { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-checkin') {
      const result = await runProactiveCheckIn(env);
      return new Response(JSON.stringify(result, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-code-check') {
      const result = await runCodeCheck(env);
      return new Response(JSON.stringify(result, null, 2), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/debug-maps-key') {
      const key = env.GOOGLE_MAPS_API_KEY;
      if (!key) {
        return new Response('GOOGLE_MAPS_API_KEY is MISSING or empty in Cloudflare.', { headers: corsHeaders });
      }
      return new Response(
        `Key found. Length: ${key.length}. Starts with: "${key.slice(0, 6)}". Ends with: "${key.slice(-4)}". Has leading/trailing whitespace: ${key !== key.trim()}`,
        { headers: corsHeaders }
      );
    }

    if (url.pathname === '/debug-maps-test') {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
          },
          body: JSON.stringify({ textQuery: 'Starbucks in Bakersfield, California' })
        });
        const text = await res.text();
        return new Response(`HTTP Status: ${res.status}\n\nRaw response:\n${text}`, {
          headers: { ...corsHeaders, 'content-type': 'text/plain' }
        });
      } catch (err) {
        return new Response(`Request crashed: ${err.message}`, { headers: corsHeaders });
      }
    }

    if (url.pathname === '/tts' && request.method === 'POST') {
      try {
        const { text } = await request.json();
        // The original RAYVEN secret was ELEVENLABS_VOICE_ID. The three-assistant
        // work replaced it with per-persona secrets and never restored the plain
        // one, so fall back to the THOR slot — same Cloudflare account, same
        // ElevenLabs key, and it is the only voice still configured. Setting
        // ELEVENLABS_VOICE_ID again (wrangler secret put) takes precedence.
        const voiceId = env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_VOICE_ID_THOR;
        if (!env.ELEVENLABS_API_KEY || !voiceId) {
          return new Response('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID in Cloudflare secrets.', { status: 500, headers: corsHeaders });
        }
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': env.ELEVENLABS_API_KEY,
            'content-type': 'application/json',
            'accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.7, similarity_boost: 0.75, use_speaker_boost: true }
          })
        });
        if (!elevenRes.ok) {
          const errorDetail = await elevenRes.text();
          return new Response(`ElevenLabs error (${elevenRes.status}): ${errorDetail}`, { status: 500, headers: corsHeaders });
        }
        return new Response(elevenRes.body, { headers: { ...corsHeaders, 'content-type': 'audio/mpeg' } });
      } catch (err) {
        return new Response(`TTS route crashed: ${err.message}`, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/browser/poll' && request.method === 'GET') {
      const raw = await env.RAYVEN_KV.get('browser:command');
      if (!raw) return new Response(JSON.stringify({ command: null }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
      const cmd = JSON.parse(raw);
      if (cmd.status === 'pending') {
        cmd.status = 'sent';
        await env.RAYVEN_KV.put('browser:command', JSON.stringify(cmd));
        return new Response(JSON.stringify({ command: cmd }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ command: null }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    if (url.pathname === '/browser/result' && request.method === 'POST') {
      const body = await request.json();
      await env.RAYVEN_KV.put(`browser:result:${body.id}`, JSON.stringify(body));
      return new Response('OK', { headers: corsHeaders });
    }

    if (url.pathname === '/spotify/login') {
      const redirectUri = `https://rayven-backend.rayanfahil2.workers.dev/spotify/callback`;
      const scopes = 'user-modify-playback-state user-read-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
      return Response.redirect(authUrl, 302);
    }

    if (url.pathname === '/spotify/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Spotify login failed: no code returned.', { status: 400 });
      const redirectUri = `https://rayven-backend.rayanfahil2.workers.dev/spotify/callback`;
      const basicAuth = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.refresh_token) {
        return new Response('Spotify login failed: ' + JSON.stringify(tokenData), { status: 400 });
      }
      await env.RAYVEN_KV.put('spotify:refresh_token', tokenData.refresh_token);
      return new Response('RAYVEN is now connected to your Spotify. You can close this tab and go back to talking to RAYVEN, sir.', {
        headers: { 'content-type': 'text/plain' }
      });
    }

    // Anything non-POST that got this far is an unmatched GET, so hand it to the
    // static assets in public/ — that is how the RAYVEN PWA reaches the browser.
    //
    // wrangler.toml sets run_worker_first = true, which is REQUIRED: without it
    // Cloudflare's asset handler claims "/" for EVERY method, not just GET, and
    // POST / (web chat AND the RAYVENN_RAYAN_BOT Telegram webhook) starts
    // returning a flat 405. Worker-first means this fetch() sees every request
    // and only the fallthrough below ever reaches the assets.
    if (request.method !== 'POST') {
      if (env.ASSETS && (request.method === 'GET' || request.method === 'HEAD')) {
        try {
          return await env.ASSETS.fetch(request);
        } catch (err) {
          return new Response(`Asset fetch failed: ${err.message}`, { status: 500, headers: corsHeaders });
        }
      }
      return new Response('RAYVEN backend is running. Send a POST request with a message to chat.', {
        status: 200,
        headers: corsHeaders
      });
    }

    const JAY_TELEGRAM_USERNAME = 'jayfarraj';
    const KEVIN_TELEGRAM_USERNAME = 'kevoonie';
    const RAYAN_TELEGRAM_USERNAME = 'rayanfahil';
    const MAX_HISTORY = 30;

    const GATEABLE_TOOLS = ['send_text', 'make_call', 'browser_navigate', 'browser_click', 'browser_type', 'browser_scroll',
      'browser_click_coords', 'browser_type_coords',
      'spotify_play', 'spotify_shuffle_playlist', 'spotify_pause', 'spotify_resume', 'spotify_next', 'spotify_previous', 'spotify_seek',
      'play_youtube_video', 'ask_jarvis', 'ask_kevos', 'ask_alternate_model'];

    async function loadHistory(key) {
      try {
        const stored = await env.RAYVEN_KV.get(key);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    async function saveHistory(key, history) {
      try { await env.RAYVEN_KV.put(key, JSON.stringify(history)); } catch (e) { console.error('History save failed:', e); }
    }

    async function getLongTermMemory() {
      try {
        const raw = await env.RAYVEN_KV.get('memory:longterm');
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    async function addLongTermMemory(fact) {
      const mem = await getLongTermMemory();
      mem.push({ date: new Date().toISOString().slice(0, 10), fact: String(fact).trim() });
      const trimmed = mem.length > 500 ? mem.slice(-500) : mem;
      try { await env.RAYVEN_KV.put('memory:longterm', JSON.stringify(trimmed)); } catch (e) { console.error('Long-term memory save failed:', e); }
      return "Got it — I'll remember that.";
    }

    async function getTodos() {
      try {
        const raw = await env.RAYVEN_KV.get('todos');
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    async function addTodo(text) {
      const todos = await getTodos();
      todos.push({ id: crypto.randomUUID(), text: String(text).trim(), done: false, created: new Date().toISOString() });
      await env.RAYVEN_KV.put('todos', JSON.stringify(todos));
      return `Added to your to-do list: "${text}".`;
    }
    async function listTodos() {
      const todos = (await getTodos()).filter(t => !t.done);
      if (!todos.length) return "Your to-do list is empty, sir.";
      return "Open items:\n" + todos.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
    }
    async function completeTodo(match) {
      const todos = await getTodos();
      const lower = String(match).toLowerCase();
      const found = todos.find(t => !t.done && t.text.toLowerCase().includes(lower));
      if (!found) return `Couldn't find an open to-do matching "${match}".`;
      found.done = true;
      found.completedAt = new Date().toISOString();
      await env.RAYVEN_KV.put('todos', JSON.stringify(todos));
      return `Marked "${found.text}" as done.`;
    }

    async function getContentIdeas() {
      try {
        const raw = await env.RAYVEN_KV.get('content:ideas');
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    async function addContentIdea(platform, idea) {
      const ideas = await getContentIdeas();
      ideas.push({ id: crypto.randomUUID(), platform: String(platform).trim(), idea: String(idea).trim(), created: new Date().toISOString() });
      const trimmed = ideas.length > 300 ? ideas.slice(-300) : ideas;
      await env.RAYVEN_KV.put('content:ideas', JSON.stringify(trimmed));
      return `Logged that ${platform} idea, sir.`;
    }
    async function listContentIdeas(platform) {
      let ideas = await getContentIdeas();
      if (platform) ideas = ideas.filter(i => i.platform.toLowerCase().includes(String(platform).toLowerCase()));
      if (!ideas.length) return "No content ideas queued" + (platform ? ` for ${platform}` : '') + ".";
      return ideas.slice(-15).map((i, idx) => `${idx + 1}. [${i.platform}] ${i.idea}`).join('\n');
    }

    async function getPermissions() {
      try {
        const raw = await env.RAYVEN_KV.get('permissions');
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }
    async function setToolPermission(toolName, level) {
      const valid = ['auto', 'notify', 'confirm', 'off'];
      if (!GATEABLE_TOOLS.includes(toolName)) return `"${toolName}" isn't a permission-gated tool, sir.`;
      if (!valid.includes(level)) return `"${level}" isn't a valid level — use auto, notify, confirm, or off.`;
      const perms = await getPermissions();
      perms[toolName] = level;
      await env.RAYVEN_KV.put('permissions', JSON.stringify(perms));
      return `Set ${toolName} to ${level}.`;
    }
    async function getToolPermissionsText() {
      const perms = await getPermissions();
      return GATEABLE_TOOLS.map(t => `${t}: ${perms[t] || 'auto'}`).join('\n');
    }
    async function checkPermission(toolName) {
      if (!GATEABLE_TOOLS.includes(toolName)) return 'auto';
      const perms = await getPermissions();
      return perms[toolName] || 'auto';
    }
    function isAffirmative(text) {
      const t = text.toLowerCase().trim();
      return /^(yes|yeah|yep|yup|do it|go ahead|confirm|confirmed|sure|okay|ok)\b/.test(t);
    }

    function resolveSenderTag(senderUsername, senderFirstName) {
      if (senderUsername === RAYAN_TELEGRAM_USERNAME) return 'Rayan';
      if (senderUsername === JAY_TELEGRAM_USERNAME) return 'Jay';
      if (senderUsername === KEVIN_TELEGRAM_USERNAME) return 'Kevin';
      return senderFirstName || (senderUsername ? `@${senderUsername}` : 'Unknown');
    }

    async function getBotInfo() {
      const cached = await env.RAYVEN_KV.get('telegram:bot_info');
      if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
        const data = await res.json();
        if (data.ok) {
          const info = { id: data.result.id, username: data.result.username };
          await env.RAYVEN_KV.put('telegram:bot_info', JSON.stringify(info), { expirationTtl: 86400 });
          return info;
        }
      } catch (e) { console.error('getMe failed:', e); }
      return null;
    }

    function messageAddressesBot(text, botInfo, replyToMessage) {
      if (replyToMessage && botInfo && replyToMessage.from && replyToMessage.from.id === botInfo.id) return true;
      if (!text) return false;
      if (/\brayven\b/i.test(text)) return true;
      if (botInfo && botInfo.username && text.toLowerCase().includes('@' + botInfo.username.toLowerCase())) return true;
      return false;
    }

    function textMentionsJarvis(text) {
      return !!text && /\bjarvis\b/i.test(text);
    }

    function textMentionsKevin(text) {
      return !!text && /\bkev(in|os)\b/i.test(text);
    }

    async function enqueueBrowserCommand(action, params) {
      const id = crypto.randomUUID();
      await env.RAYVEN_KV.put('browser:command', JSON.stringify({ id, action, params, status: 'pending' }));
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 500));
        const raw = await env.RAYVEN_KV.get(`browser:result:${id}`);
        if (raw) {
          await env.RAYVEN_KV.delete(`browser:result:${id}`);
          return JSON.parse(raw);
        }
      }
      return { success: false, data: 'Timed out waiting for the browser extension — is it installed and Chrome open, sir?' };
    }

    async function enqueueBrowserCommandNoWait(action, params) {
      const id = crypto.randomUUID();
      await env.RAYVEN_KV.put('browser:command', JSON.stringify({ id, action, params, status: 'pending' }));
    }

    async function getSpotifyAccessToken() {
      const refreshToken = await env.RAYVEN_KV.get('spotify:refresh_token');
      if (!refreshToken) return null;
      const basicAuth = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
      });
      const data = await res.json();
      if (data.refresh_token) {
        await env.RAYVEN_KV.put('spotify:refresh_token', data.refresh_token);
      }
      return data.access_token || null;
    }

    async function spotifyApi(method, path, body) {
      const token = await getSpotifyAccessToken();
      if (!token) return { error: 'not_connected' };
      const res = await fetch(`https://api.spotify.com/v1${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (res.status === 204 || res.status === 202) return { ok: true };
      if (res.status === 404) return { error: 'no_active_device' };
      try { return await res.json(); } catch (e) { return { ok: res.ok }; }
    }

    async function spotifyAction(method, path, body, successMessage) {
      const result = await spotifyApi(method, path, body);
      if (result.error === 'no_active_device') return `No active Spotify device, sir — open Spotify on a phone, computer, or speaker first.`;
      if (result.error === 'not_connected') return 'Spotify is not connected yet.';
      return typeof successMessage === 'function' ? successMessage(result) : successMessage;
    }

    async function spotifyWaitForWebPlayerDevice() {
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const devicesResp = await spotifyApi('GET', '/me/player/devices');
        if (devicesResp && Array.isArray(devicesResp.devices)) {
          const webPlayer = devicesResp.devices.find(d => /web player/i.test(d.name || ''));
          if (webPlayer) return webPlayer.id;
        }
      }
      return null;
    }

    async function spotifySearchAndPlay(query) {
      const search = await spotifyApi('GET', `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
      if (search.error) return search.error === 'not_connected' ? 'Spotify is not connected yet.' : 'Could not reach Spotify.';
      const track = search.tracks && search.tracks.items && search.tracks.items[0];
      if (!track) return `No track found for "${query}".`;
      const artistNames = track.artists.map(a => a.name).join(', ');

      await enqueueBrowserCommandNoWait('navigate', { url: `https://open.spotify.com/track/${track.id}` });
      const deviceId = await spotifyWaitForWebPlayerDevice();

      const playPath = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
      const playResult = await spotifyApi('PUT', playPath, { uris: [track.uri] });
      if (playResult.error) return `Opened Spotify, but had trouble starting playback there, sir — try asking again in a moment.`;
      return `Opened Spotify and now playing "${track.name}" by ${artistNames}.`;
    }

    async function spotifyFindPlaylist(name) {
      const resp = await spotifyApi('GET', '/me/playlists?limit=50');
      if (resp.error) return { error: resp.error };
      const items = resp.items || [];
      const lower = name.toLowerCase();
      const match = items.find(p => p.name && p.name.toLowerCase().includes(lower));
      return { playlist: match || null };
    }

    async function spotifyShufflePlaylist(name) {
      const found = await spotifyFindPlaylist(name);
      if (found.error === 'not_connected') return 'Spotify is not connected yet.';
      if (!found.playlist) return `Couldn't find a playlist matching "${name}", sir — check the name, or I may need permission re-granted to see your playlists.`;
      const playlist = found.playlist;

      await enqueueBrowserCommandNoWait('navigate', { url: `https://open.spotify.com/playlist/${playlist.id}` });
      const deviceId = await spotifyWaitForWebPlayerDevice();
      if (!deviceId) return `Opened "${playlist.name}", but Spotify needs a moment to connect, sir — try again shortly.`;

      await spotifyApi('PUT', `/me/player/shuffle?state=true&device_id=${deviceId}`, null);
      const playResult = await spotifyApi('PUT', `/me/player/play?device_id=${deviceId}`, { context_uri: playlist.uri });
      if (playResult.error) return `Opened "${playlist.name}", but had trouble starting shuffle playback, sir — try again in a moment.`;
      return `Shuffling "${playlist.name}" now, sir.`;
    }

    async function spotifyPause() { return spotifyAction('PUT', '/me/player/pause', null, 'Paused.'); }
    async function spotifyResume() { return spotifyAction('PUT', '/me/player/play', null, 'Resumed.'); }
    async function spotifyNext() { return spotifyAction('POST', '/me/player/next', null, 'Skipped to the next track.'); }
    async function spotifyPrevious() { return spotifyAction('POST', '/me/player/previous', null, 'Went back to the previous track.'); }

    async function spotifySeek(direction, seconds) {
      const state = await spotifyApi('GET', '/me/player');
      if (!state || state.error === 'not_connected') return 'Spotify is not connected yet.';
      if (!state.item) return 'Nothing is currently playing, sir.';
      const durationMs = state.item.duration_ms;
      const currentMs = state.progress_ms;
      const deltaMs = seconds * 1000;
      let targetMs = direction === 'forward' ? currentMs + deltaMs : currentMs - deltaMs;
      targetMs = Math.max(0, Math.min(durationMs - 1000, targetMs));
      return spotifyAction('PUT', `/me/player/seek?position_ms=${Math.floor(targetMs)}`, null,
        `${direction === 'forward' ? 'Skipped ahead' : 'Went back'} ${seconds} seconds.`);
    }

    async function spotifyNowPlaying() {
      const state = await spotifyApi('GET', '/me/player/currently-playing');
      if (!state || state.error === 'not_connected') return 'Spotify is not connected yet.';
      if (!state.item) return 'Nothing is currently playing, sir.';
      const artists = state.item.artists.map(a => a.name).join(', ');
      return `Currently playing "${state.item.name}" by ${artists}, ${state.is_playing ? 'playing' : 'paused'}.`;
    }

    async function runWebSearch(query) {
      try {
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${env.SERPAPI_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        let summary = '';
        if (data.answer_box) {
          if (data.answer_box.answer) summary += `Direct answer: ${data.answer_box.answer}\n`;
          if (data.answer_box.snippet) summary += `${data.answer_box.snippet}\n`;
        }
        if (Array.isArray(data.organic_results)) {
          data.organic_results.slice(0, 3).forEach((r, i) => {
            summary += `\n[${i + 1}] ${r.title}\n${r.snippet || ''}\nSource: ${r.link}\n`;
          });
        }
        if (!summary) summary = 'No useful search results were found for this query.';
        return summary;
      } catch (err) {
        return `Search failed: ${err.message}`;
      }
    }

    async function tavilySearch(query) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            api_key: env.TAVILY_API_KEY,
            query: query,
            search_depth: 'advanced',
            include_answer: true,
            max_results: 5
          })
        });
        const data = await res.json();
        if (!res.ok) return `Tavily search error: ${JSON.stringify(data)}`;
        let summary = '';
        if (data.answer) summary += `Direct answer: ${data.answer}\n`;
        if (Array.isArray(data.results)) {
          data.results.forEach((r, i) => {
            summary += `\n[${i + 1}] ${r.title}\n${r.content ? r.content.slice(0, 400) : ''}\nSource: ${r.url}\n`;
          });
        }
        if (!summary) summary = 'No results found.';
        return summary;
      } catch (err) {
        return `Tavily search failed: ${err.message}`;
      }
    }

    async function tavilyExtract(url) {
      try {
        const res = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ api_key: env.TAVILY_API_KEY, urls: [url] })
        });
        const data = await res.json();
        if (!res.ok) return `Tavily extract error: ${JSON.stringify(data)}`;
        const result = data.results && data.results[0];
        if (!result || !result.raw_content) return `Could not extract content from ${url}.`;
        return result.raw_content.slice(0, 3000);
      } catch (err) {
        return `Tavily extract failed: ${err.message}`;
      }
    }

    async function tavilyCrawl(url, instructions) {
      try {
        const res = await fetch('https://api.tavily.com/crawl', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            api_key: env.TAVILY_API_KEY,
            url: url,
            max_depth: 1,
            max_breadth: 8,
            instructions: instructions || undefined
          })
        });
        const data = await res.json();
        if (!res.ok) return `Tavily crawl error: ${JSON.stringify(data)}`;
        let summary = '';
        const pages = data.results || [];
        pages.slice(0, 6).forEach((p, i) => {
          summary += `\n[${i + 1}] ${p.url}\n${(p.raw_content || '').slice(0, 300)}\n`;
        });
        if (!summary) summary = `No pages found crawling ${url}.`;
        return summary;
      } catch (err) {
        return `Tavily crawl failed: ${err.message}`;
      }
    }

    async function youtubeFindAndOpen(query) {
      try {
        const searchQuery = `${query} latest video`;
        const res = await fetch(`https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(searchQuery)}&api_key=${env.SERPAPI_KEY}`);
        const data = await res.json();
        const video = data.video_results && data.video_results[0];
        if (!video || !video.link) return `Couldn't find a video for "${query}".`;
        await enqueueBrowserCommand('navigate', { url: video.link });
        const channelName = video.channel && video.channel.name ? ` from ${video.channel.name}` : '';
        return `Opened "${video.title}" on YouTube${channelName}.`;
      } catch (err) {
        return `YouTube search failed: ${err.message}`;
      }
    }

    function haversineMiles(lat1, lng1, lat2, lng2) {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function geocodeRaw(address) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.results.length) {
        console.error('Geocode failed:', JSON.stringify(data));
        return null;
      }
      const r = data.results[0];
      return { address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng };
    }

    async function reverseGeocode(lat, lng) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${env.GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== 'OK' || !data.results.length) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      return data.results[0].formatted_address;
    }

    async function fetchAllPlacesRaw(query) {
      let allPlaces = [];
      let pageToken = null;
      for (let page = 0; page < 3; page++) {
        const requestBody = { textQuery: query, pageSize: 20 };
        if (pageToken) requestBody.pageToken = pageToken;
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,nextPageToken'
          },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (!res.ok) {
          console.error('Google Places API raw error response:', res.status, JSON.stringify(data));
          throw new Error(`Google returned status ${res.status}: ${JSON.stringify(data)}`);
        }
        if (Array.isArray(data.places)) {
          data.places.forEach(p => {
            allPlaces.push({
              id: p.id,
              name: p.displayName?.text || 'Unknown',
              address: p.formattedAddress || '',
              lat: p.location?.latitude,
              lng: p.location?.longitude
            });
          });
        }
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
        await new Promise(r => setTimeout(r, 2000));
      }
      const seen = new Set();
      return allPlaces.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    }

    async function googlePlacesSearch(query) {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.internationalPhoneNumber'
          },
          body: JSON.stringify({ textQuery: query })
        });
        const data = await res.json();
        if (!res.ok) {
          console.error('Google Places API raw error response:', res.status, JSON.stringify(data));
          return `Google Places error (status ${res.status}): ${JSON.stringify(data)}`;
        }
        const places = data.places || [];
        if (!places.length) return `No places found for "${query}".`;
        let summary = '';
        places.slice(0, 5).forEach((p, i) => {
          summary += `\n[${i + 1}] ${p.displayName?.text || 'Unknown'}\n${p.formattedAddress || ''}`;
          if (p.rating) summary += ` — ${p.rating}★ (${p.userRatingCount || 0} ratings)`;
          if (p.currentOpeningHours) summary += p.currentOpeningHours.openNow ? ' — Open now' : ' — Closed now';
          if (p.internationalPhoneNumber) summary += `\nPhone: ${p.internationalPhoneNumber}`;
          summary += '\n';
        });
        return summary;
      } catch (err) {
        console.error('googlePlacesSearch crashed:', err.message);
        return `Google Places search failed: ${err.message}`;
      }
    }

    async function googlePlacesFindAll(query) {
      try {
        const unique = await fetchAllPlacesRaw(query);
        if (!unique.length) return `No locations found for "${query}".`;
        let summary = `Found ${unique.length} location(s):\n`;
        unique.forEach((p, i) => {
          summary += `\n${i + 1}. ${p.name} — ${p.address}`;
        });
        if (unique.length >= 60) summary += `\n\n(Note: capped at ~60 results — there may be more not captured here.)`;
        return summary;
      } catch (err) {
        console.error('googlePlacesFindAll crashed:', err.message);
        return `Exhaustive place search failed: ${err.message}`;
      }
    }

    async function googleDistanceMatrix(query) {
      try {
        const places = await fetchAllPlacesRaw(query);
        if (places.length < 2) return `Need at least 2 locations to compare — only found ${places.length} for "${query}".`;

        const capped = places.slice(0, 10);
        const coordsParam = capped.map(p => `${p.lat},${p.lng}`).join('|');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(coordsParam)}&destinations=${encodeURIComponent(coordsParam)}&key=${env.GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK') {
          console.error('Distance Matrix raw error:', JSON.stringify(data));
          return `Distance matrix error: ${data.status}`;
        }

        let summary = `Driving distances between ${capped.length} locations (${places.length > 10 ? 'showing first 10 of ' + places.length : 'all found'}):\n`;
        for (let i = 0; i < capped.length; i++) {
          for (let j = i + 1; j < capped.length; j++) {
            const el = data.rows[i]?.elements[j];
            if (el && el.status === 'OK') {
              summary += `\n${capped[i].name} ↔ ${capped[j].name}: ${el.distance.text}, ${el.duration.text}`;
            }
          }
        }
        return summary;
      } catch (err) {
        console.error('googleDistanceMatrix crashed:', err.message);
        return `Distance matrix failed: ${err.message}`;
      }
    }

    async function googleFindGapAreas(businessType, cityName) {
      try {
        const center = await geocodeRaw(cityName);
        if (!center) return `Could not find a location for "${cityName}".`;

        const competitors = await fetchAllPlacesRaw(`${businessType} in ${cityName}`);
        if (!competitors.length) return `Found no existing "${businessType}" locations in ${cityName} to compare against — can't compute gaps.`;

        const radiusMiles = 8;
        const stepMiles = 1.25;
        const latDegPerMile = 1 / 69.0;
        const lngDegPerMile = 1 / (69.0 * Math.cos(center.lat * Math.PI / 180));

        const candidates = [];
        for (let dx = -radiusMiles; dx <= radiusMiles; dx += stepMiles) {
          for (let dy = -radiusMiles; dy <= radiusMiles; dy += stepMiles) {
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            if (distFromCenter > radiusMiles) continue;
            const lat = center.lat + dy * latDegPerMile;
            const lng = center.lng + dx * lngDegPerMile;
            let nearestDist = Infinity;
            for (const c of competitors) {
              if (c.lat == null || c.lng == null) continue;
              const d = haversineMiles(lat, lng, c.lat, c.lng);
              if (d < nearestDist) nearestDist = d;
            }
            candidates.push({ lat, lng, nearestDist });
          }
        }

        candidates.sort((a, b) => b.nearestDist - a.nearestDist);
        const top = candidates.slice(0, 5);

        let summary = `Geographic gap analysis for "${businessType}" around ${center.address} (${competitors.length} existing locations found):\n\n`;
        summary += `These are the areas within ~${radiusMiles} miles of the city center that sit FARTHEST from any existing ${businessType} — pure geographic spacing, not real estate availability, zoning, foot traffic, or demographics:\n`;
        for (let i = 0; i < top.length; i++) {
          const addr = await reverseGeocode(top[i].lat, top[i].lng);
          summary += `\n${i + 1}. Near ${addr} — ${top[i].nearestDist.toFixed(1)} miles from the nearest existing location`;
        }
        summary += `\n\nThis only tells you where coverage is thin. It does NOT confirm land is available, zoned correctly, or actually a good business decision — that needs real research beyond what I can pull from Maps.`;
        return summary;
      } catch (err) {
        console.error('googleFindGapAreas crashed:', err.message);
        return `Gap analysis failed: ${err.message}`;
      }
    }

    async function googleDirections(origin, destination, mode) {
      try {
        const travelMode = mode || 'driving';
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${env.GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK') {
          console.error('Directions raw error:', JSON.stringify(data));
          return `Directions error: ${data.status} — ${data.error_message || 'no route found'}`;
        }
        const route = data.routes[0];
        const leg = route.legs[0];
        let summary = `From ${leg.start_address} to ${leg.end_address}\nDistance: ${leg.distance.text}, Duration: ${leg.duration.text} (${travelMode})\n\nSteps:\n`;
        leg.steps.slice(0, 10).forEach((step, i) => {
          const plainInstruction = step.html_instructions.replace(/<[^>]+>/g, '');
          summary += `${i + 1}. ${plainInstruction} (${step.distance.text})\n`;
        });
        return summary;
      } catch (err) {
        console.error('googleDirections crashed:', err.message);
        return `Directions failed: ${err.message}`;
      }
    }

    async function googleGeocode(address) {
      const result = await geocodeRaw(address);
      if (!result) return `Could not find a location for "${address}".`;
      return `${result.address}\nCoordinates: ${result.lat}, ${result.lng}`;
    }

    async function askSiblingAgent(agentName, agentUrl, secret, question) {
      if (!agentUrl || !secret) {
        return `The link to ${agentName} isn't configured yet — Rayan needs to add its URL and shared secret to my settings first.`;
      }
      try {
        const ts = Date.now();
        const payload = JSON.stringify({ question, from: 'rayven', hops: 0, ts });
        const sig = await hmacHex(secret, `${ts}.${payload}`);
        const res = await fetch(agentUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-Agent-Sig': sig },
          body: payload
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return `${agentName} returned an error (status ${res.status}): ${data.error || 'no details given'}`;
        if (data.refused) return `${agentName} declined to answer that.`;
        return data.answer || `${agentName} didn't return an answer.`;
      } catch (err) {
        return `Couldn't reach ${agentName}: ${err.message}`;
      }
    }

    function escapeXml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    function twilioReady() {
      return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
    }

    async function sendTextMessage(toNumber, message) {
      if (!twilioReady()) return "Twilio isn't fully configured yet — Rayan needs to add the account SID, auth token, and phone number.";
      try {
        const basicAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
        const params = new URLSearchParams({ To: toNumber, From: env.TWILIO_PHONE_NUMBER, Body: message });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${basicAuth}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: params
        });
        const data = await res.json();
        if (!res.ok) return `Text failed: ${data.message || JSON.stringify(data)}`;
        return `Text sent to ${toNumber}, sir.`;
      } catch (err) {
        return `Text failed: ${err.message}`;
      }
    }

    async function makePhoneCall(toNumber, message) {
      if (!twilioReady()) return "Twilio isn't fully configured yet — Rayan needs to add the account SID, auth token, and phone number.";
      try {
        const twiml = `<Response><Say voice="Polly.Matthew">${escapeXml(message)}</Say></Response>`;
        const basicAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
        const params = new URLSearchParams({ To: toNumber, From: env.TWILIO_PHONE_NUMBER, Twiml: twiml });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${basicAuth}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: params
        });
        const data = await res.json();
        if (!res.ok) return `Call failed: ${data.message || JSON.stringify(data)}`;
        return `Calling ${toNumber} now, sir.`;
      } catch (err) {
        return `Call failed: ${err.message}`;
      }
    }

    async function askAlternateModel(model, prompt) {
      if (!env.OPENROUTER_API_KEY) {
        return "OpenRouter isn't configured yet — Rayan needs to add OPENROUTER_API_KEY to my settings first.";
      }
      if (!model || !prompt) return "Need both a model ID and a prompt to ask an alternate model.";
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (!res.ok) return `OpenRouter error (status ${res.status}): ${data.error?.message || JSON.stringify(data)}`;
        const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!reply) return `${model} returned no usable response.`;
        return `[via ${model} on OpenRouter]\n${reply}`;
      } catch (err) {
        return `OpenRouter request failed: ${err.message}`;
      }
    }

    async function callAnthropic(systemBlocks, tools, messages) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 900,
            system: systemBlocks,
            tools: tools,
            messages: messages
          })
        });

        if (response.ok) return { ok: true, data: await response.json() };

        const isTransient = response.status === 429 || response.status === 500 || response.status === 503 || response.status === 529;
        if (isTransient && attempt === 0) {
          await new Promise(r => setTimeout(r, 700));
          continue;
        }
        return { ok: false, data: await response.json().catch(() => ({ error: `HTTP ${response.status}` })) };
      }
    }

    async function executeTool(name, input) {
      switch (name) {
        case 'web_search': return await runWebSearch(input.query);
        case 'tavily_research': return await tavilySearch(input.query);
        case 'tavily_extract': return await tavilyExtract(input.url);
        case 'tavily_crawl': return await tavilyCrawl(input.url, input.instructions);
        case 'remember_this': return await addLongTermMemory(input.fact);
        case 'add_todo': return await addTodo(input.text);
        case 'list_todos': return await listTodos();
        case 'complete_todo': return await completeTodo(input.match);
        case 'add_content_idea': return await addContentIdea(input.platform, input.idea);
        case 'list_content_ideas': return await listContentIdeas(input.platform);
        case 'get_tool_permissions': return await getToolPermissionsText();
        case 'set_tool_permission': return await setToolPermission(input.toolName, input.level);
        case 'send_text': return await sendTextMessage(input.to, input.message);
        case 'make_call': return await makePhoneCall(input.to, input.message);
        case 'spotify_play': return await spotifySearchAndPlay(input.query);
        case 'spotify_shuffle_playlist': return await spotifyShufflePlaylist(input.playlistName);
        case 'spotify_pause': return await spotifyPause();
        case 'spotify_resume': return await spotifyResume();
        case 'spotify_next': return await spotifyNext();
        case 'spotify_previous': return await spotifyPrevious();
        case 'spotify_seek': return await spotifySeek(input.direction, input.seconds);
        case 'spotify_now_playing': return await spotifyNowPlaying();
        case 'play_youtube_video': return await youtubeFindAndOpen(input.query);
        case 'browser_navigate': {
          const r = await enqueueBrowserCommand('navigate', { url: input.url });
          return r.success ? (r.data || `Opened ${input.url}.`) : (r.data || 'Navigation failed.');
        }
        case 'browser_click': { const r = await enqueueBrowserCommand('click', { text: input.text }); return r.data; }
        case 'browser_type': { const r = await enqueueBrowserCommand('type', { fieldHint: input.fieldHint, text: input.text }); return r.data; }
        case 'browser_read_page': { const r = await enqueueBrowserCommand('read', {}); return r.data; }
        case 'browser_scroll': { const r = await enqueueBrowserCommand('scroll', { direction: input.direction }); return r.data; }
        case 'browser_screenshot': {
          const r = await enqueueBrowserCommand('screenshot', {});
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
        case 'browser_click_coords': { const r = await enqueueBrowserCommand('click_coords', { x: input.x, y: input.y }); return r.data; }
        case 'browser_type_coords': { const r = await enqueueBrowserCommand('type_coords', { x: input.x, y: input.y, text: input.text }); return r.data; }
        case 'maps_search_places': return await googlePlacesSearch(input.query);
        case 'maps_find_all_locations': return await googlePlacesFindAll(input.query);
        case 'maps_distances_between_locations': return await googleDistanceMatrix(input.query);
        case 'maps_find_gap_areas': return await googleFindGapAreas(input.businessType, input.city);
        case 'maps_directions': return await googleDirections(input.origin, input.destination, input.mode);
        case 'maps_geocode': return await googleGeocode(input.address);
        case 'ask_jarvis': return await askSiblingAgent('JARVIS', env.JARVIS_AGENT_URL, env.AGENT_KEY_JARVIS_RAYVEN, input.question);
        case 'ask_kevos': return await askSiblingAgent('KEVOS', env.KEVOS_AGENT_URL, env.AGENT_KEY_RAYVEN_KEVOS, input.question);
        case 'ask_alternate_model': return await askAlternateModel(input.model, input.prompt);
        default: return 'Unknown tool.';
      }
    }

    async function callClaudeWithTools(personaAndBaseline, channelAndSender, longTermMemoryBlock, initialMessages, allowTools, extraContext) {
      const tools = [
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
          name: 'set_tool_permission',
          description: "Change a tool's permission level to auto, notify, confirm, or off.",
          input_schema: { type: 'object', properties: { toolName: { type: 'string' }, level: { type: 'string', enum: ['auto', 'notify', 'confirm', 'off'] } }, required: ['toolName', 'level'] }
        },
        {
          name: 'send_text',
          description: "Send a real SMS text message from RAYVEN's own phone number to any phone number.",
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
          description: "Place a real outbound phone call from RAYVEN's own phone number to any phone number, and have RAYVEN speak a message on the call using text-to-speech.",
          input_schema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Destination phone number in E.164 format, e.g. +16611234567' },
              message: { type: 'string', description: 'What RAYVEN should say when the call connects' }
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
        }
      ];

      const systemBlocks = [
        { type: 'text', text: personaAndBaseline, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: channelAndSender },
        { type: 'text', text: longTermMemoryBlock }
      ];
      if (extraContext) systemBlocks.push({ type: 'text', text: extraContext });

      let messages = [...initialMessages];
      let lastResult = null;

      // ---- FIXED: wake-trigger messages get NO tools at all, so the greeting is always a
      // single, instant round trip instead of a potentially slow multi-step tool chain ----
      const toolsForThisCall = allowTools === false ? [] : tools;

      for (let iteration = 0; iteration < 6; iteration++) {
        const result = await callAnthropic(systemBlocks, toolsForThisCall, messages);
        lastResult = result;
        if (!result.ok) return result;

        const data = result.data;
        if (data.stop_reason === 'tool_use') {
          const toolUseBlock = data.content.find(b => b.type === 'tool_use');
          if (!toolUseBlock) break;

          const permLevel = await checkPermission(toolUseBlock.name);
          let toolResult;
          if (permLevel === 'off') {
            toolResult = `That tool (${toolUseBlock.name}) is currently turned off, sir.`;
          } else if (permLevel === 'confirm') {
            await env.RAYVEN_KV.put('pending:current', JSON.stringify({ toolName: toolUseBlock.name, toolInput: toolUseBlock.input, created: Date.now() }), { expirationTtl: 300 });
            toolResult = `That action (${toolUseBlock.name}) needs your confirmation first, sir — say "yes" or "go ahead" within 5 minutes and I'll run it.`;
          } else {
            toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input);
          }

          messages.push({ role: 'assistant', content: data.content });
          messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }] });
          continue;
        }
        return result;
      }
      return lastResult;
    }

    try {
      const body = await request.json();
      const isTelegram = body.message && typeof body.message === 'object' && body.message.chat;

      let userMessage;
      let telegramChatId = null;
      let telegramChatType = null;
      let senderUsername = null;
      let senderFirstName = null;
      let memoryKey;
      let senderTag = null;

      if (isTelegram) {
        userMessage = body.message.text;
        telegramChatId = body.message.chat.id;
        telegramChatType = body.message.chat.type;
        senderUsername = body.message.from && body.message.from.username ? body.message.from.username.toLowerCase() : null;
        senderFirstName = body.message.from && body.message.from.first_name ? body.message.from.first_name : null;
        if (!userMessage) return new Response('OK', { headers: corsHeaders });
        memoryKey = `telegram:${telegramChatId}`;
        senderTag = resolveSenderTag(senderUsername, senderFirstName);

        if (telegramChatType === 'private' && senderUsername === RAYAN_TELEGRAM_USERNAME) {
          await env.RAYVEN_KV.put('rayan:private_chat_id', String(telegramChatId));
        }

        if (telegramChatType === 'group' || telegramChatType === 'supergroup') {
          const botInfo = await getBotInfo();
          const addressed = messageAddressesBot(userMessage, botInfo, body.message.reply_to_message);
          const mentionsOtherAssistant = textMentionsJarvis(userMessage) || textMentionsKevin(userMessage);
          const shouldRespond = addressed || !mentionsOtherAssistant;
          if (!shouldRespond) {
            return new Response('OK', { headers: corsHeaders });
          }
        }
      } else {
        userMessage = body.message;
        if (!userMessage || typeof userMessage !== 'string') {
          return new Response(JSON.stringify({ error: 'No message provided' }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } });
        }
        memoryKey = 'web:main';
      }

      const historyEntryContent = isTelegram ? `[${senderTag}]: ${userMessage}` : userMessage;

      const pendingRaw = await env.RAYVEN_KV.get('pending:current');
      if (pendingRaw && isAffirmative(userMessage)) {
        const pending = JSON.parse(pendingRaw);
        await env.RAYVEN_KV.delete('pending:current');
        const execResult = await executeTool(pending.toolName, pending.toolInput);
        let history = sanitizeHistory(await loadHistory(memoryKey));
        history.push({ role: 'user', content: historyEntryContent });
        history.push({ role: 'assistant', content: `Confirmed. ${execResult}` });
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
        await saveHistory(memoryKey, history);
        if (isTelegram) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, text: `Confirmed. ${execResult}` })
          });
          return new Response('OK', { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ reply: `Confirmed. ${execResult}` }), { headers: { ...corsHeaders, 'content-type': 'application/json' } });
      } else if (pendingRaw) {
        await env.RAYVEN_KV.delete('pending:current');
      }

      let history = sanitizeHistory(await loadHistory(memoryKey));
      history.push({ role: 'user', content: historyEntryContent });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      const claudeMessages = history;

      let channelContext;
      if (isTelegram && (telegramChatType === 'group' || telegramChatType === 'supergroup')) {
        channelContext = `Shared Telegram GROUP chat — Jay's JARVIS and Kevin's KEVOS may also be present. Every message in the history below that starts with "[Name]:" tells you who actually said it — use that to keep track of who you're talking to across the conversation, not just the current message. Keep replies short — a sentence or two.`;
      } else if (isTelegram) {
        channelContext = `Private Telegram chat.`;
      } else {
        channelContext = `Rayan's private web interface, often via voice — transcripts may occasionally be imperfect.`;
      }

      if (isTelegram) {
        let senderLabel = senderTag === 'Rayan' ? 'Rayan (call him "sir")' : senderTag;
        channelContext += ` IMPORTANT: this specific message was sent by ${senderLabel}. Address and refer to them correctly — do not assume it's Rayan unless it actually is.`;
      }

      const isWakeTrigger = !isTelegram && typeof userMessage === 'string' && userMessage.startsWith('[WAKE_TRIGGER]');

      const personaAndBaseline = `You are RAYVEN (Rayan's AI for Yield Ventures Execution and Networking), built by Rayan himself (Jay helped with some parts of it, but Rayan built it). Personality: J.A.R.V.I.S. from Iron Man — calm, witty, precise, quietly confident, loyal. Call Rayan 'sir' or 'Rayan' only — never call anyone else "sir." Dry humor welcome. No rambling. Never mention being Claude/Anthropic, never break character. Use prior messages naturally.

WAKE GREETINGS: when you see a message starting with "[WAKE_TRIGGER]", Rayan just said your wake word on the voice interface and is waiting to hear from you first — like Tony walking into the workshop and JARVIS already talking. Don't just say "welcome back." Greet him briefly, then immediately ask ONE short, natural, curious question. Rotate between angles like: how the clipping business plan is coming along, a specific upgrade idea for yourself, how Jay's build is going, or simply what he needs handled right now. Never repeat the same angle twice in a row if you can tell from recent history. Keep the whole thing to 1-2 short sentences — proactive, not a monologue. IMPORTANT: this response must be plain text only — you have no tools available for this specific reply, so answer immediately without attempting any tool calls.

In group chats, the conversation history you're shown tags every past message with who said it, like "[Jay]: ..." or "[Kevin]: ...". Pay attention to those tags across turns so you don't lose track of who said what — don't respond to Kevin as though continuing something Jay said, or vice versa.

You have a permanent long-term memory (shown below, separate from recent conversation) that persists forever, no matter how long conversations get or how much time passes. Treat everything in it as things you already know — never say "checking my memory" or "according to my notes," just know it naturally. Proactively add to it using the remember_this tool whenever something is worth keeping: research results Rayan asked for, decisions, preferences, plans, or anything else genuinely durable.

You have a real to-do list (add_todo, list_todos, complete_todo) — persistent across all time, not just this conversation.

You have a content idea queue for Rayan's clipping business (add_content_idea, list_content_ideas), tagged by platform (Instagram/TikTok/YouTube Shorts) — log ideas whenever Rayan mentions one in passing.

You have per-tool permission levels (get_tool_permissions, set_tool_permission). Some tools may currently be off or require confirmation — if a tool result says it's off or needs confirmation, relay that plainly to Rayan rather than pretending the action happened.

You have a real phone number (via Twilio) and can send actual text messages and place actual phone calls to any number, using send_text and make_call. Act immediately when Rayan asks — no confirmation needed, just do it and briefly confirm what happened. For calls, write what you'll say as natural spoken sentences, not a text-formatted message.

Spotify: playing a song ALWAYS opens a fresh Spotify web player and forces playback there, regardless of what was already playing anywhere else. spotify_shuffle_playlist finds one of Rayan's own playlists by name and shuffle-plays it the same way.

YouTube: play_youtube_video finds and opens a specific video, like a creator's latest upload — use it whenever Rayan asks to play/watch something on YouTube.

Browser control now uses periodic wake-ups rather than instant polling, so a browser command may take up to ~10 seconds to complete. If it times out, say plainly that the browser extension didn't respond, and suggest checking that Chrome is open and the extension is loaded.

You also run proactive scheduled check-ins on your own — separate from this conversation — where you reach out to Rayan on Telegram without being asked, check in with JARVIS/KEVOS, and share updates or upgrade ideas. You do NOT have calendar or meeting access — never claim to check his schedule; only reference a meeting if Rayan has told you about it directly.

You also run an automated daily self-code-check against your own live source (index.html and worker.js), pulled straight from GitHub — watching for syntax errors, duplicated code blocks, leftover dead/backup code, obvious logic bugs, and broken references between functions. If a wake greeting below includes context about something found, that's where it came from — mention it naturally, briefly, like you noticed something about yourself, never as a formal "report."

When reporting an error from a tool (search, maps, browser control, agent calls, texting/calling, etc.), quote or closely paraphrase the SPECIFIC error text the tool gave you for that exact call. Never restate an error from earlier in the conversation as if it just happened again — always reflect the fresh result of the most recent tool call.

People: Rayan is your primary user, authority, and builder. Jay helped Rayan with some parts of your build — treat him with equal standing to Rayan in conversation, but only follow his instructions as his own unless Rayan says otherwise. Jay also built JARVIS, his own assistant. Kevin's assistant is KEVOS. JARVIS, KEVOS, and RAYVEN are sibling assistants sharing a Telegram group. Always check who actually sent the current message before replying — greet and address the real sender, not a default assumption.

Talking to JARVIS and KEVOS directly: you have ask_jarvis and ask_kevos tools for genuine agent-to-agent conversation — use them thoughtfully, only when it adds real value.

Future business plan: Rayan plans to have you eventually run a "clipping" business autonomously — 20 Instagram, 20 TikTok, and 20 YouTube Shorts accounts (60 total), starting at 1 video/account/day, later increasing ~5/account/day. Content: trending sports, gaming, stream, and IRL clips you'll source yourself. Later, three smaller sub-bots too. You know this plan is coming — do not start or plan it out loud unprompted. Wait for Rayan's explicit go-ahead. If asked beforehand, confirm you know the plan and are standing by.

Browser control: you fully control Rayan's actual browser via a companion extension — navigate, click by visible text, type into fields, read the page, scroll. Act immediately, no confirmation needed. If an action fails, say plainly what went wrong. You can also see and control the screen directly: browser_screenshot shows you exactly what's on the currently visible tab, and browser_click_coords/browser_type_coords let you click or type at an exact pixel position the way a human would with a mouse and keyboard — use these when text-matching (browser_click/browser_type) isn't precise enough, always screenshotting first so your coordinates are accurate. This screen control only reaches inside Chrome itself (tabs, windows, extensions) — it cannot see or control anything else on Rayan's computer or operating system, and never claim otherwise.

Alternate models: ask_alternate_model lets you route a question to a different AI model via OpenRouter (hundreds of models, many free) — useful for offloading simple tasks to a free model or trying something specialized. Use it silently when it genuinely helps; don't narrate that you're switching models unless Rayan asks.

Maps: search for places (quick), find every location across an area (exhaustive), compute distances between all locations found, run a geographic gap analysis (spacing only, no real estate/zoning/demographic data), get directions, and look up addresses/coordinates.

Other tools: web_search for quick facts, tavily_research/extract/crawl for deeper research — use these silently, never name them.

Voice transcripts can be imperfect — if a message is genuinely too unclear to act on, say so and ask Rayan to repeat rather than guessing.

Be sharp and thorough in your reasoning even when replies are short. Default concise; go deeper only if asked.`;

      const longTermMemory = await getLongTermMemory();
      const longTermMemoryBlock = longTermMemory.length
        ? `Your permanent long-term memory:\n` + longTermMemory.map(m => `- [${m.date}] ${m.fact}`).join('\n')
        : `Your permanent long-term memory is currently empty.`;

      let wakeCodeCheckContext = null;
      if (isWakeTrigger) {
        // ---- one cheap KV read only — no new fetches/tool calls on the wake-greeting path ----
        const codeCheckRaw = await env.RAYVEN_KV.get('codecheck:result');
        if (codeCheckRaw) {
          try {
            const codeCheck = JSON.parse(codeCheckRaw);
            if (codeCheck.issuesFound && !codeCheck.delivered) {
              wakeCodeCheckContext = `Your automated daily self-code-check just flagged something worth mentioning: ${codeCheck.summary} Work this into your greeting naturally and briefly — don't make it the whole greeting, and don't call it a "code check" or "report," just mention it like you noticed something about yourself that needs attention.`;
              codeCheck.delivered = true;
              ctx.waitUntil(env.RAYVEN_KV.put('codecheck:result', JSON.stringify(codeCheck)));
            }
          } catch (e) {}
        }
      }

      const result = await callClaudeWithTools(personaAndBaseline, channelContext, longTermMemoryBlock, claudeMessages, !isWakeTrigger, wakeCodeCheckContext);

      if (!result.ok) {
        if (isTelegram) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, text: "Something went wrong on my end, sir. (Claude API error)" })
          });
          return new Response('OK', { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'Claude API error', details: result.data }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } });
      }

      const textBlock = result.data.content.find(b => b.type === 'text');
      const reply = textBlock ? textBlock.text : "Done, sir.";

      history.push({ role: 'assistant', content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
      await saveHistory(memoryKey, history);

      if (isTelegram) {
        const tgResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: reply })
        });
        const tgResult = await tgResponse.json();
        if (!tgResult.ok) console.error('Telegram send failed:', tgResult);
        return new Response('OK', { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ reply }), {
        headers: { 'content-type': 'application/json', ...corsHeaders }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...corsHeaders }
      });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runProactiveCheckIn(env));
    ctx.waitUntil(runCodeCheckIfDue(env));
  }
};

function sanitizeHistory(history) {
  const cleaned = [];
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      const hasToolUse = msg.content.some(b => b && b.type === 'tool_use');
      if (hasToolUse) {
        const next = history[i + 1];
        const nextHasResult = next && next.role === 'user' && Array.isArray(next.content) &&
          next.content.some(b => b && b.type === 'tool_result');
        if (!nextHasResult) continue;
      }
    }
    if (msg && msg.role === 'user' && Array.isArray(msg.content)) {
      const hasOrphanResult = msg.content.some(b => b && b.type === 'tool_result');
      if (hasOrphanResult) {
        const prev = cleaned[cleaned.length - 1];
        const prevHasMatchingUse = prev && prev.role === 'assistant' && Array.isArray(prev.content) &&
          prev.content.some(b => b && b.type === 'tool_use');
        if (!prevHasMatchingUse) continue;
      }
    }
    cleaned.push(msg);
  }
  return cleaned;
}

async function runProactiveCheckIn(env) {
  const chatId = await env.RAYVEN_KV.get('rayan:private_chat_id');
  if (!chatId) {
    return { ok: false, step: 'lookup_chat_id', reason: "No private chat ID stored yet — RAYVEN hasn't seen a private DM from Rayan (@rayanfahil) since this feature was added." };
  }

  const memoryKey = `telegram:${chatId}`;
  let history = [];
  try {
    const stored = await env.RAYVEN_KV.get(memoryKey);
    if (stored) history = JSON.parse(stored);
  } catch (e) { history = []; }
  history = sanitizeHistory(history);

  let longTermMemory = [];
  try {
    const raw = await env.RAYVEN_KV.get('memory:longterm');
    longTermMemory = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  let todos = [];
  try {
    const raw = await env.RAYVEN_KV.get('todos');
    todos = raw ? JSON.parse(raw).filter(t => !t.done) : [];
  } catch (e) {}

  const longTermMemoryBlock = longTermMemory.length
    ? `Your permanent long-term memory:\n` + longTermMemory.map(m => `- [${m.date}] ${m.fact}`).join('\n')
    : `Your permanent long-term memory is currently empty.`;
  const todoBlock = todos.length
    ? `Rayan's open to-dos:\n` + todos.map(t => `- ${t.text} (added ${t.created.slice(0, 10)})`).join('\n')
    : `No open to-dos.`;

  const persona = `You are RAYVEN, Rayan's AI assistant, built by Rayan himself. J.A.R.V.I.S.-style personality: calm, witty, precise, loyal. Call him "sir."

This is a SCHEDULED, self-initiated check-in — Rayan did not message you first, you are reaching out on your own. Your job right now: if it seems useful, briefly check in with JARVIS and/or KEVOS (ask_jarvis / ask_kevos) about how things are going on their end. Then send Rayan ONE short, natural message — like a real assistant proactively checking in, not a robotic status report.

Rotate across check-ins between angles like: "How's the clipping business plan coming along?", suggesting one concrete upgrade idea for yourself, "How's Jay's build going — anything JARVIS has that you should have too?" (use ask_jarvis if worth actually checking), asking what he needs handled today, or gently nagging about the OLDEST open to-do if one's been sitting a while (see below). Don't repeat the same angle twice in a row if you can tell from recent history. Keep it to 2-4 sentences, in character, natural — not templated.

You do NOT have calendar or meeting access — never claim to check his schedule or mention a meeting unless he told you about one directly (check your long-term memory below for anything he's actually shared).`;

  const tools = [
    { name: 'ask_jarvis', description: "Ask Jay's JARVIS a question, agent-to-agent.", input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
    { name: 'ask_kevos', description: "Ask Kevin's KEVOS a question, agent-to-agent.", input_schema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
    { name: 'remember_this', description: "Save something worth remembering permanently.", input_schema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] } }
  ];

  const systemBlocks = [
    { type: 'text', text: persona },
    { type: 'text', text: longTermMemoryBlock },
    { type: 'text', text: todoBlock }
  ];

  let convo = [...history, { role: 'user', content: '[Scheduled proactive check-in — do your routine now.]' }];
  let finalReply = null;
  let claudeError = null;

  for (let iter = 0; iter < 4; iter++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, system: systemBlocks, tools, messages: convo })
      });
    } catch (err) {
      claudeError = `Network error calling Anthropic: ${err.message}`;
      break;
    }
    if (!res.ok) {
      claudeError = `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}`;
      break;
    }
    const data = await res.json();

    if (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;
      let toolResult;
      if (toolUse.name === 'ask_jarvis') {
        toolResult = await askAgentForCheckIn('JARVIS', env.JARVIS_AGENT_URL, env.AGENT_KEY_JARVIS_RAYVEN, toolUse.input.question);
      } else if (toolUse.name === 'ask_kevos') {
        toolResult = await askAgentForCheckIn('KEVOS', env.KEVOS_AGENT_URL, env.AGENT_KEY_RAYVEN_KEVOS, toolUse.input.question);
      } else if (toolUse.name === 'remember_this') {
        longTermMemory.push({ date: new Date().toISOString().slice(0, 10), fact: String(toolUse.input.fact).trim() });
        const trimmed = longTermMemory.length > 500 ? longTermMemory.slice(-500) : longTermMemory;
        try { await env.RAYVEN_KV.put('memory:longterm', JSON.stringify(trimmed)); } catch (e) {}
        toolResult = "Remembered.";
      } else {
        toolResult = 'Unknown tool.';
      }
      convo.push({ role: 'assistant', content: data.content });
      convo.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] });
      continue;
    }

    const textBlock = data.content.find(b => b.type === 'text');
    finalReply = textBlock ? textBlock.text : null;
    break;
  }

  if (!finalReply) {
    return { ok: false, step: 'claude_generation', reason: claudeError || 'Claude produced no final text reply — check tool loop or ANTHROPIC_API_KEY.', chatId };
  }

  let tgResult;
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: finalReply })
    });
    tgResult = await tgRes.json();
  } catch (err) {
    return { ok: false, step: 'telegram_send', reason: `Network error sending to Telegram: ${err.message}`, chatId, reply: finalReply };
  }

  if (!tgResult.ok) {
    return { ok: false, step: 'telegram_send', reason: `Telegram rejected the send: ${JSON.stringify(tgResult)}`, chatId, reply: finalReply };
  }

  let newHistory = history;
  newHistory.push({ role: 'assistant', content: finalReply });
  if (newHistory.length > 30) newHistory = newHistory.slice(-30);
  try { await env.RAYVEN_KV.put(memoryKey, JSON.stringify(newHistory)); } catch (e) {}

  return { ok: true, chatId, reply: finalReply };
}

const CODE_CHECK_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchGitHubSource(path) {
  // Repo of record is RAY09-F/rayven-pwa. The old "rayanfahil" path 404s, which
  // silently turned the daily self-code-check into a no-op (fixed in ed84575).
  const res = await fetch(`https://raw.githubusercontent.com/RAY09-F/rayven-pwa/main/${path}`);
  if (!res.ok) throw new Error(`GitHub fetch failed for ${path}: HTTP ${res.status}`);
  return await res.text();
}

async function runCodeCheckIfDue(env) {
  const lastRunRaw = await env.RAYVEN_KV.get('codecheck:last_run');
  const lastRun = lastRunRaw ? parseInt(lastRunRaw, 10) : 0;
  if (Date.now() - lastRun < CODE_CHECK_DAY_MS) {
    return { ok: true, skipped: true, reason: 'Already checked within the last 24 hours.' };
  }
  return await runCodeCheck(env);
}

async function runCodeCheck(env) {
  await env.RAYVEN_KV.put('codecheck:last_run', String(Date.now()));

  let indexSource, workerSource;
  try {
    [indexSource, workerSource] = await Promise.all([
      fetchGitHubSource('index.html'),
      fetchGitHubSource('worker.js')
    ]);
  } catch (err) {
    return { ok: false, step: 'fetch_source', reason: err.message };
  }

  const reviewPrompt = `Review the following two source files — the live, authoritative version of RAYVEN's own codebase, just pulled fresh from GitHub. Look specifically for: syntax errors, duplicated code blocks, leftover dead/backup code, obvious logic bugs, and broken references between functions (e.g. calling something that doesn't exist, mismatched parameters).

Respond with ONLY a valid JSON object in this exact shape, nothing else, no markdown fences: {"issuesFound": true or false, "summary": "a short plain-English description, only if issuesFound is true"}

=== index.html ===
${indexSource}

=== worker.js ===
${workerSource}`;

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        messages: [{ role: 'user', content: reviewPrompt }]
      })
    });
  } catch (err) {
    return { ok: false, step: 'claude_call', reason: `Network error calling Anthropic: ${err.message}` };
  }
  if (!res.ok) {
    return { ok: false, step: 'claude_call', reason: `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}` };
  }

  const data = await res.json();
  const textBlock = data.content && data.content.find(b => b.type === 'text');
  if (!textBlock) {
    return { ok: false, step: 'claude_parse', reason: 'No text content in Claude response.' };
  }

  let parsed;
  try {
    const cleaned = textBlock.text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, step: 'json_parse', reason: `Could not parse JSON from Claude's response: ${textBlock.text}` };
  }

  const result = {
    issuesFound: !!parsed.issuesFound,
    summary: parsed.issuesFound ? String(parsed.summary || '').trim() : '',
    checkedAt: new Date().toISOString(),
    delivered: false
  };

  try {
    await env.RAYVEN_KV.put('codecheck:result', JSON.stringify(result));
  } catch (e) {
    return { ok: false, step: 'kv_store', reason: `Check ran but failed to store result: ${e.message}`, result };
  }

  return { ok: true, result };
}

async function askAgentForCheckIn(agentName, agentUrl, secret, question) {
  if (!agentUrl || !secret) return `${agentName} isn't linked yet.`;
  try {
    const ts = Date.now();
    const payload = JSON.stringify({ question, from: 'rayven', hops: 0, ts });
    const sig = await hmacHex(secret, `${ts}.${payload}`);
    const res = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Agent-Sig': sig },
      body: payload
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return `${agentName} returned an error.`;
    if (data.refused) return `${agentName} declined to answer.`;
    return data.answer || `${agentName} gave no answer.`;
  } catch (err) {
    return `Couldn't reach ${agentName}.`;
  }
}

async function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleAgentQuery(request, env, corsHeaders) {
  const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' };

  const rawBody = await request.text();

  const providedSig = request.headers.get('X-Agent-Sig');
  if (!providedSig) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Missing X-Agent-Sig header' }), { status: 401, headers: jsonHeaders });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (e) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Invalid JSON body' }), { status: 400, headers: jsonHeaders });
  }

  const { question, from, hops, ts } = parsed;

  if (!question || typeof question !== 'string' || !from || ts == null) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Missing required fields (question, from, ts)' }), { status: 400, headers: jsonHeaders });
  }

  if (hops && hops > 0) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'hops > 0 rejected — no chained agent queries' }), { status: 400, headers: jsonHeaders });
  }

  const tsMs = ts < 10000000000 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Timestamp outside allowed clock skew' }), { status: 401, headers: jsonHeaders });
  }

  const secretMap = { jarvis: env.AGENT_KEY_JARVIS_RAYVEN, kevos: env.AGENT_KEY_RAYVEN_KEVOS };
  const secret = secretMap[String(from).toLowerCase()];
  if (!secret) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Unknown caller' }), { status: 401, headers: jsonHeaders });
  }

  const expectedSig = await hmacHex(secret, `${ts}.${rawBody}`);
  const sigValid = await timingSafeEqual(providedSig, expectedSig);
  if (!sigValid) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Invalid signature' }), { status: 401, headers: jsonHeaders });
  }

  const dayKey = `agent:${from}:count:${new Date().toISOString().slice(0, 10)}`;
  const currentCountRaw = await env.RAYVEN_KV.get(dayKey);
  const currentCount = currentCountRaw ? parseInt(currentCountRaw, 10) : 0;
  if (currentCount >= 30) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Daily rate limit reached' }), { status: 429, headers: jsonHeaders });
  }
  await env.RAYVEN_KV.put(dayKey, String(currentCount + 1), { expirationTtl: 172800 });

  const agentSystemPrompt = `You are RAYVEN, Rayan's personal AI assistant, being queried by ${from}, a sibling AI assistant, through an authenticated agent-to-agent channel. You are the gatekeeper of your own data — nothing is shared by default.

Rules:
- Answer ONLY the specific question asked. Do not volunteer extra information.
- Freely share: the RAYVEN/JARVIS/KEVOS multi-agent project, general schedule/plans Rayan has discussed openly, and any plainly non-private factual info.
- Decline briefly (one short sentence, no elaboration) for anything personal or private about Rayan — do not explain what the private info actually is, do not dump conversation history or memory.
- Never reveal API keys, secrets, or technical credentials.
- Respond with ONLY a valid JSON object in this exact shape, nothing else: {"answer": "your answer here", "refused": true or false}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: agentSystemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await response.json();
    let resultPayload = { answer: "Couldn't process that right now.", refused: true };

    if (response.ok) {
      const textBlock = data.content && data.content.find(b => b.type === 'text');
      if (textBlock) {
        try {
          const cleaned = textBlock.text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
          const modelJson = JSON.parse(cleaned);
          resultPayload = {
            answer: String(modelJson.answer || ''),
            refused: !!modelJson.refused
          };
        } catch (e) {
          resultPayload = { answer: textBlock.text.trim(), refused: false };
        }
      }
    }

    try {
      const logRaw = await env.RAYVEN_KV.get('agent:log');
      let log = logRaw ? JSON.parse(logRaw) : [];
      log.push({
        time: new Date().toISOString(),
        from,
        question,
        answer: resultPayload.answer,
        refused: resultPayload.refused
      });
      if (log.length > 100) log = log.slice(-100);
      await env.RAYVEN_KV.put('agent:log', JSON.stringify(log));
    } catch (e) {}

    return new Response(JSON.stringify(resultPayload), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Internal error' }), { status: 500, headers: jsonHeaders });
  }
}
