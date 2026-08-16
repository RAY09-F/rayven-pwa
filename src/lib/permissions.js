// Per-tool permission levels (auto/notify/confirm/off) plus the "say yes and I'll
// do it" pending-confirmation flow. Ported from worker.js unchanged, with one
// addition: DEFAULT_PERMISSION_LEVELS lets specific tools default to something
// other than 'auto' (e.g. email sends and calendar edits default to 'confirm')
// without requiring Rayan to run set_tool_permission first.

export const GATEABLE_TOOLS = [
  'send_text', 'make_call', 'browser_navigate', 'browser_click', 'browser_type', 'browser_scroll',
  'browser_click_coords', 'browser_type_coords',
  'spotify_play', 'spotify_shuffle_playlist', 'spotify_pause', 'spotify_resume', 'spotify_next', 'spotify_previous', 'spotify_seek',
  'play_youtube_video', 'ask_jarvis', 'ask_kevos', 'ask_alternate_model',
  'watch_add', 'watch_remove', 'watch_pause', 'watch_resume'
];

// Tools listed here default to this level instead of 'auto' when Rayan has never
// explicitly set a level for them. Reflects the safety posture he chose: email
// sends default to draft-only, calendar edits default to suggest-only. Populated
// as those tools are actually added (Phase 4/5) — each new tool name gets pushed
// into GATEABLE_TOOLS at the same time so get_tool_permissions doesn't list
// controls for features that don't exist yet.
export const DEFAULT_PERMISSION_LEVELS = {};

// Anything that spends money, sends a message to another human, or touches
// physical hardware is ALWAYS confirm — hardcoded, not policy-editable,
// regardless of what the assistant or the user says in the moment.
export const HARD_CONFIRM_TOOLS = ['send_text', 'make_call'];

export async function getPermissions(env) {
  try {
    const raw = await env.RAYVEN_KV.get('permissions');
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export async function setToolPermission(env, toolName, level) {
  const valid = ['auto', 'notify', 'confirm', 'off'];
  if (HARD_CONFIRM_TOOLS.includes(toolName) && level !== 'confirm' && level !== 'off') {
    return `${toolName} is hardwired to confirm — it sends real messages/calls, so that gate isn't policy-editable, sir.`;
  }
  if (!GATEABLE_TOOLS.includes(toolName)) return `"${toolName}" isn't a permission-gated tool, sir.`;
  if (!valid.includes(level)) return `"${level}" isn't a valid level — use auto, notify, confirm, or off.`;
  const perms = await getPermissions(env);
  perms[toolName] = level;
  await env.RAYVEN_KV.put('permissions', JSON.stringify(perms));
  return `Set ${toolName} to ${level}.`;
}

export async function getToolPermissionsText(env) {
  const perms = await getPermissions(env);
  return GATEABLE_TOOLS.map(t => `${t}: ${perms[t] || DEFAULT_PERMISSION_LEVELS[t] || 'auto'}`).join('\n');
}

export async function checkPermission(env, toolName) {
  if (HARD_CONFIRM_TOOLS.includes(toolName)) {
    const perms = await getPermissions(env);
    return perms[toolName] === 'off' ? 'off' : 'confirm'; // off is allowed; anything looser is not
  }
  if (!GATEABLE_TOOLS.includes(toolName)) return 'auto';
  const perms = await getPermissions(env);
  if (perms[toolName]) return perms[toolName];
  return DEFAULT_PERMISSION_LEVELS[toolName] || 'auto';
}

export function isAffirmative(text) {
  const t = text.toLowerCase().trim();
  return /^(yes|yeah|yep|yup|do it|go ahead|confirm|confirmed|sure|okay|ok)\b/.test(t);
}
