// Agent-to-agent protocol with JARVIS (Jay's assistant) and KEVOS (Kevin's
// assistant): outbound calls (askSiblingAgent / askAgentForCheckIn) and the
// inbound HMAC-authenticated endpoint (handleAgentQuery). Ported unchanged.
import { hmacHex, timingSafeEqual, appendCappedLog } from './util.js';

export async function askSiblingAgent(agentName, agentUrl, secret, question) {
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

export async function askAgentForCheckIn(agentName, agentUrl, secret, question) {
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

export async function handleAgentQuery(request, env, corsHeaders) {
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
      await appendCappedLog(env, 'agent:log', {
        time: new Date().toISOString(),
        from,
        question,
        answer: resultPayload.answer,
        refused: resultPayload.refused
      }, 100);
    } catch (e) {}

    return new Response(JSON.stringify(resultPayload), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ answer: '', refused: true, error: 'Internal error' }), { status: 500, headers: jsonHeaders });
  }
}
