// Thin wrapper around the Anthropic Messages API with one retry on transient
// errors. Ported unchanged from worker.js. Used by the main chat loop and by
// every background subsystem that needs a Claude call (code check, monitoring
// relevance filter, email classification, day-planning briefing).

export async function callAnthropic(env, systemBlocks, tools, messages, maxTokens) {
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
        max_tokens: maxTokens || 900,
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

// Single-shot, no-tools text call — used by background jobs that just need one
// classification/judgement result (monitoring relevance filter, email importance
// classification). No retry loop: these run on a 5-min cron tick, so a transient
// failure just gets picked up again next tick rather than retried in-request.
export async function callAnthropicSimple(env, systemPrompt, userText, maxTokens) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens || 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }]
      })
    });
    if (!res.ok) return { ok: false, error: `Anthropic API returned status ${res.status}: ${await res.text().catch(() => '(no body)')}` };
    const data = await res.json();
    const textBlock = data.content && data.content.find(b => b.type === 'text');
    if (!textBlock) return { ok: false, error: 'No text content in Claude response.' };
    return { ok: true, text: textBlock.text };
  } catch (err) {
    return { ok: false, error: `Network error calling Anthropic: ${err.message}` };
  }
}
