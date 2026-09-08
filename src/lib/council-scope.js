import {implementationToolName} from './tool-aliases.js';
// An execution capability travels with this turn, never in model-controlled input.
export function councilToolAllowed(scope,name) {
  if (!scope?.councillor) return true;
  const implementation=implementationToolName(name);
  return scope.tools.includes(implementation) && !['send_text','make_call','ask_jarvis','ask_kevos','discord_webhook','ntfy_push','publish_note','share_file'].includes(implementation);
}
