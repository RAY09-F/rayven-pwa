// Spotify OAuth + playback control. Ported unchanged from worker.js. The
// login/callback route handlers are exported as plain functions so index.js can
// call them directly from the router instead of inlining the logic there.
import { enqueueBrowserCommandNoWait } from './browser.js';

export async function handleSpotifyLogin(env) {
  const redirectUri = `https://asgrard-backend.rayanfahil2.workers.dev/spotify/callback`;
  const scopes = 'user-modify-playback-state user-read-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  return Response.redirect(authUrl, 302);
}

export async function handleSpotifyCallback(env, url) {
  const code = url.searchParams.get('code');
  if (!code) return new Response('Spotify login failed: no code returned.', { status: 400 });
  const redirectUri = `https://asgrard-backend.rayanfahil2.workers.dev/spotify/callback`;
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
  return new Response('THOR is now connected to your Spotify. You can close this tab and go back to talking to THOR, sir.', {
    headers: { 'content-type': 'text/plain' }
  });
}

async function getSpotifyAccessToken(env) {
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

async function spotifyApi(env, method, path, body) {
  const token = await getSpotifyAccessToken(env);
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

async function spotifyAction(env, method, path, body, successMessage) {
  const result = await spotifyApi(env, method, path, body);
  if (result.error === 'no_active_device') return `No active Spotify device, sir — open Spotify on a phone, computer, or speaker first.`;
  if (result.error === 'not_connected') return 'Spotify is not connected yet.';
  return typeof successMessage === 'function' ? successMessage(result) : successMessage;
}

async function spotifyWaitForWebPlayerDevice(env) {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const devicesResp = await spotifyApi(env, 'GET', '/me/player/devices');
    if (devicesResp && Array.isArray(devicesResp.devices)) {
      const webPlayer = devicesResp.devices.find(d => /web player/i.test(d.name || ''));
      if (webPlayer) return webPlayer.id;
    }
  }
  return null;
}

export async function spotifySearchAndPlay(env, query) {
  const search = await spotifyApi(env, 'GET', `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
  if (search.error) return search.error === 'not_connected' ? 'Spotify is not connected yet.' : 'Could not reach Spotify.';
  const track = search.tracks && search.tracks.items && search.tracks.items[0];
  if (!track) return `No track found for "${query}".`;
  const artistNames = track.artists.map(a => a.name).join(', ');

  await enqueueBrowserCommandNoWait(env, 'navigate', { url: `https://open.spotify.com/track/${track.id}` });
  const deviceId = await spotifyWaitForWebPlayerDevice(env);

  const playPath = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
  const playResult = await spotifyApi(env, 'PUT', playPath, { uris: [track.uri] });
  if (playResult.error) return `Opened Spotify, but had trouble starting playback there, sir — try asking again in a moment.`;
  return `Opened Spotify and now playing "${track.name}" by ${artistNames}.`;
}

async function spotifyFindPlaylist(env, name) {
  const resp = await spotifyApi(env, 'GET', '/me/playlists?limit=50');
  if (resp.error) return { error: resp.error };
  const items = resp.items || [];
  const lower = name.toLowerCase();
  const match = items.find(p => p.name && p.name.toLowerCase().includes(lower));
  return { playlist: match || null };
}

export async function spotifyShufflePlaylist(env, name) {
  const found = await spotifyFindPlaylist(env, name);
  if (found.error === 'not_connected') return 'Spotify is not connected yet.';
  if (!found.playlist) return `Couldn't find a playlist matching "${name}", sir — check the name, or I may need permission re-granted to see your playlists.`;
  const playlist = found.playlist;

  await enqueueBrowserCommandNoWait(env, 'navigate', { url: `https://open.spotify.com/playlist/${playlist.id}` });
  const deviceId = await spotifyWaitForWebPlayerDevice(env);
  if (!deviceId) return `Opened "${playlist.name}", but Spotify needs a moment to connect, sir — try again shortly.`;

  await spotifyApi(env, 'PUT', `/me/player/shuffle?state=true&device_id=${deviceId}`, null);
  const playResult = await spotifyApi(env, 'PUT', `/me/player/play?device_id=${deviceId}`, { context_uri: playlist.uri });
  if (playResult.error) return `Opened "${playlist.name}", but had trouble starting shuffle playback, sir — try again in a moment.`;
  return `Shuffling "${playlist.name}" now, sir.`;
}

export async function spotifyPause(env) { return spotifyAction(env, 'PUT', '/me/player/pause', null, 'Paused.'); }
export async function spotifyResume(env) { return spotifyAction(env, 'PUT', '/me/player/play', null, 'Resumed.'); }
export async function spotifyNext(env) { return spotifyAction(env, 'POST', '/me/player/next', null, 'Skipped to the next track.'); }
export async function spotifyPrevious(env) { return spotifyAction(env, 'POST', '/me/player/previous', null, 'Went back to the previous track.'); }

export async function spotifySeek(env, direction, seconds) {
  const state = await spotifyApi(env, 'GET', '/me/player');
  if (!state || state.error === 'not_connected') return 'Spotify is not connected yet.';
  if (!state.item) return 'Nothing is currently playing, sir.';
  const durationMs = state.item.duration_ms;
  const currentMs = state.progress_ms;
  const deltaMs = seconds * 1000;
  let targetMs = direction === 'forward' ? currentMs + deltaMs : currentMs - deltaMs;
  targetMs = Math.max(0, Math.min(durationMs - 1000, targetMs));
  return spotifyAction(env, 'PUT', `/me/player/seek?position_ms=${Math.floor(targetMs)}`, null,
    `${direction === 'forward' ? 'Skipped ahead' : 'Went back'} ${seconds} seconds.`);
}

export async function spotifyNowPlaying(env) {
  const state = await spotifyApi(env, 'GET', '/me/player/currently-playing');
  if (!state || state.error === 'not_connected') return 'Spotify is not connected yet.';
  if (!state.item) return 'Nothing is currently playing, sir.';
  const artists = state.item.artists.map(a => a.name).join(', ');
  return `Currently playing "${state.item.name}" by ${artists}, ${state.is_playing ? 'playing' : 'paused'}.`;
}

// Structured now-playing state for the frontend Spotify panel — real player
// data only; the panel shows an honest "not connected / nothing playing" state
// instead of placeholder content.
export async function spotifyNowPlayingData(env) {
  const state = await spotifyApi(env, 'GET', '/me/player/currently-playing');
  if (!state || state.error === 'not_connected') return { ok: false, reason: 'not_connected' };
  if (!state.item) return { ok: true, playing: false, track: null };
  return {
    ok: true,
    playing: !!state.is_playing,
    track: state.item.name,
    artists: state.item.artists.map(a => a.name).join(', '),
    album: state.item.album ? state.item.album.name : null,
    artUrl: state.item.album && state.item.album.images && state.item.album.images[1] ? state.item.album.images[1].url
      : (state.item.album && state.item.album.images && state.item.album.images[0] ? state.item.album.images[0].url : null),
    progressMs: state.progress_ms || 0,
    durationMs: state.item.duration_ms || 0
  };
}
