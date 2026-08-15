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

export async function makePhoneCall(env, toNumber, message) {
  if (!twilioReady(env)) return "Twilio isn't fully configured yet — Rayan needs to add the account SID, auth token, and phone number.";
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
