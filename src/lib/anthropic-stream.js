import { readEvents } from '../../public/ui/event-stream.js';

export function providerError(status, data) {
  const err = data?.error || data || {};
  const code = err.details?.error_code || data?.details?.error_code;
  if (code === 'enforced_spend_limit_reached') return 'Your Anthropic spending limit has been reached.';
  if (/credit balance|insufficient.*credit/i.test(String(err.message))) return 'Your Anthropic account needs credits before I can reply.';
  if (status === 429) return 'Anthropic is receiving requests too quickly. Please try again shortly.';
  if (status === 529 || err.type === 'overloaded_error') return 'Anthropic is temporarily overloaded. Please try again shortly.';
  if (status === 401 || status === 403) return 'Anthropic could not authorize this request. The account connection needs checking.';
  return 'The assistant service could not complete this reply. Please try again.';
}

export async function collectMessage(body, onText = () => {}) {
  let message, stopped = false;
  const json = new Map(), open = new Set();
  for await (const { data } of readEvents(body)) {
    switch (data.type) {
      case 'error': { const error = new Error(providerError(data.error?.type === 'overloaded_error' ? 529 : 500, data)); error.status = data.error?.type === 'overloaded_error' ? 529 : 500; throw error; }
      case 'message_start': message = { ...data.message, content: [], usage: { ...data.message.usage } }; break;
      case 'content_block_start':
        if (!message) throw new Error('The assistant stream started incorrectly.');
        message.content[data.index] = { ...data.content_block }; open.add(data.index); break;
      case 'content_block_delta': {
        const block = message?.content[data.index], delta = data.delta;
        if (!block || !open.has(data.index)) throw new Error('The assistant stream contained an incomplete block.');
        if (delta.type === 'text_delta') { block.text = (block.text || '') + delta.text; await onText(delta.text); }
        else if (delta.type === 'input_json_delta') json.set(data.index, (json.get(data.index) || '') + delta.partial_json);
        else if (delta.type === 'thinking_delta') block.thinking = (block.thinking || '') + delta.thinking;
        else if (delta.type === 'signature_delta') block.signature = (block.signature || '') + delta.signature;
        break;
      }
      case 'content_block_stop':
        if (json.has(data.index)) message.content[data.index].input = JSON.parse(json.get(data.index));
        open.delete(data.index); break;
      case 'message_delta':
        if (!message) throw new Error('The assistant stream is incomplete.');
        Object.assign(message, data.delta); Object.assign(message.usage, data.usage); if(data.context_management)message.context_management=data.context_management; break;
      case 'message_stop': stopped = true; break;
      // ping and future event types do not terminate the response.
    }
  }
  if (!message || !stopped || open.size) throw new Error('The assistant connection ended before completion.');
  return message;
}
