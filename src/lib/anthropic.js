// Thin wrapper around the Anthropic Messages API with one retry on transient
// errors. Ported unchanged from worker.js. Used by the main chat loop and by
// every background subsystem that needs a Claude call (code check, monitoring
// relevance filter, email classification, day-planning briefing).
import { MODELS } from './models.js';
import { collectMessage, providerError } from './anthropic-stream.js';

export async function callAnthropic(env, systemBlocks, tools, messages, maxTokens, model, opts = {}) {
  const selectedModel = model || MODELS.sonnet;
  const body = { model: selectedModel, max_tokens: maxTokens || 1400, system: systemBlocks, tools, messages };
  if (/^claude-(sonnet-5|opus-5)$/.test(selectedModel)) { body.output_config = { effort: opts.effort || 'low' }; body.thinking = { type: 'adaptive' }; }
  if (opts.onText) body.stream = true;
  const sleep = opts.sleep || (ms => new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(opts.signal.reason || new Error('Reply cancelled.')); };
    const timer = setTimeout(() => { opts.signal?.removeEventListener('abort', abort); resolve(); }, ms);
    opts.signal?.addEventListener('abort', abort, { once: true });
    if (opts.signal?.aborted) abort();
  }));
  for (let attempt = 0; attempt < 3; attempt++) {
    opts.signal?.throwIfAborted();
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: opts.signal,
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        // Never replay an interrupted successful stream: tools or text may already have escaped.
        const data = opts.onText ? await collectMessage(response.body, opts.onText) : await response.json();
        return { ok: true, data };
      }
      const data = await response.json().catch(() => ({}));
      const spendCap = (data.error?.details?.error_code || data.details?.error_code) === 'enforced_spend_limit_reached';
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter == null ? 1000 * 2 ** attempt : /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
      if (!spendCap && [429, 500, 503, 529].includes(response.status) && attempt < 2 && Number.isFinite(delay) && delay <= 30000) {
        await sleep(Math.max(0, delay)); continue;
      }
      console.warn('ANTHROPIC_FAILURE', { status: response.status, type: data.error?.type || 'unknown' });
      return { ok: false, status: response.status, data: { error: { message: providerError(response.status, data) } } };
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      return { ok: false, status: error.status || 502, data: { error: { message: error.status ? error.message : 'The assistant connection ended before completion. Please try again.' } } };
    }
  }
}

// Single-shot, no-tools text call — used by background jobs that just need one
// classification/judgement result (monitoring relevance filter, email importance
// classification). No retry loop: these run on a 5-min cron tick, so a transient
// failure just gets picked up again next tick rather than retried in-request.
export async function callAnthropicSimple(env, systemPrompt, userText, maxTokens, model, schema) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: model || MODELS.sonnet,
        max_tokens: maxTokens || 400,
        ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }]
      })
    });
    if (!res.ok) return { ok: false, error: providerError(res.status, await res.json().catch(() => ({}))) };
    const data = await res.json();
    const textBlock = data.content && data.content.find(b => b.type === 'text');
    if (!textBlock) return { ok: false, error: 'No text content in Claude response.' };
    return { ok: true, text: textBlock.text, usage: data.usage || null, model: model || MODELS.sonnet };
  } catch (err) {
    return { ok: false, error: `Network error calling Anthropic: ${err.message}` };
  }
}
