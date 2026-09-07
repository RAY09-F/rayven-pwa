// Twilio SMS/calls and OpenRouter alternate-model routing. Ported unchanged.
import { escapeXml } from './util.js';

function twilioReady(env) {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
}

export async function sendTextMessage(env, toNumber, message) {
  if (!twilioReady(env)) return "Twilio isn't fully configured yet — Rayan needs to add the account SID, auth token, and phone number.";
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

// ---------------------------------------------------------------------------
// OUTBOUND CALLS, IN HIS OWN VOICE.
//
// Twilio's built-in <Say> is a robot, and a robot cannot book a table. So the
// line is spoken by ElevenLabs instead: synthesise the audio here, park it in
// KV under a one-time id, and hand Twilio a <Play> pointing at a public
// endpoint that streams it back. Twilio fetches it once, plays it, done.
//
// KV holds the mp3 as base64 with a short TTL — a call script is a few hundred
// kilobytes, well inside the 25MB value limit, and it expires on its own so
// nothing accumulates.
//
// It is also a CONVERSATION, not an announcement. After speaking, the call
// gathers whatever the other person says, sends it back to /voice/turn, and
// Thor answers in his own voice. That loop is what lets him actually make a
// booking rather than leave a message.
// ---------------------------------------------------------------------------
const CALL_AUDIO_TTL = 900;   // seconds; Twilio fetches within moments

export async function synthCallAudio(env, text, personaId = 'thor') {
  const { getPersonaVoiceId, getPersonaVoiceSettings } = await import('./personas.js');
  const voiceId = getPersonaVoiceId(env, personaId);
  if (!env.ELEVENLABS_API_KEY || !voiceId) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: getPersonaVoiceSettings(personaId)
    })
  });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.RAYVEN_KV.put(`callaudio:${id}`, btoa(bin), { expirationTtl: CALL_AUDIO_TTL });
  return id;
}

export async function makePhoneCall(env, toNumber, message, opts = {}) {
  if (!twilioReady(env)) return "Twilio isn't fully configured yet — Rayan needs to add the account SID, auth token, and phone number.";
  try {
    const personaId = opts.personaId || 'thor';
    const base = env.PUBLIC_BASE_URL || 'https://asgrard-backend.rayanfahil2.workers.dev';

    // his voice if we can get it; Twilio's robot only as a fallback, because a
    // failed call is worse than a robotic one
    let twiml;
    const id = await synthCallAudio(env, message, personaId).catch(() => null);
    if (id) {
      const gather = opts.conversational === false ? '' :
        `<Gather input="speech" action="${base}/voice/turn?p=${personaId}" method="POST" speechTimeout="auto" language="en-US"></Gather>` +
        `<Redirect>${base}/voice/turn?p=${personaId}&amp;silent=1</Redirect>`;
      twiml = `<Response><Play>${base}/voice/audio/${id}</Play>${gather}</Response>`;
    } else {
      twiml = `<Response><Say voice="Polly.Matthew">${escapeXml(message)}</Say></Response>`;
    }

    // the purpose of the call rides along so the model knows what it is doing
    // when the other person answers
    if (opts.purpose) {
      await env.RAYVEN_KV.put('call:purpose', JSON.stringify({
        purpose: opts.purpose, to: toNumber, opened: message, at: Date.now(), persona: personaId
      }), { expirationTtl: 3600 });
      await env.RAYVEN_KV.delete('call:transcript');
    }

    const basicAuth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const params = new URLSearchParams({ To: toNumber, From: env.TWILIO_PHONE_NUMBER, Twiml: twiml });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basicAuth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = await res.json();
    if (!res.ok) return `Call failed: ${data.message || JSON.stringify(data)}`;
    return id
      ? `Calling ${toNumber} now, sir — in my own voice, and I'll hold the conversation.`
      : `Calling ${toNumber} now, sir. (My voice didn't synthesise, so it's the fallback one.)`;
  } catch (err) {
    return `Call failed: ${err.message}`;
  }
}

export async function askAlternateModel(env, model, prompt) {
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
