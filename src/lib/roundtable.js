// Roundtable — call two personas at once; they see each other's turns and
// genuinely debate, then each gives a standing. The exchange is saved to every
// participant's memory so it's real shared history, not theater. Invoked by the
// frontend via POST /roundtable {personas:['loki','odin'], topic:'...'}.
import { PERSONAS, getPersona } from './personas.js';
import { callAnthropic } from './anthropic.js';
import { addLongTermMemory } from './memory.js';
import { setPersonaStatus } from './autonomy.js';

const ROUNDS = 2; // debate rounds before standings

// Build the message history from one participant's point of view: their own
// turns are 'assistant', the other's are 'user' tagged with the speaker name so
// the register instructions in each prompt keep working.
function messagesFor(personaId, transcript, topic, kickoff) {
  const messages = [{ role: 'user', content: kickoff }];
  for (const turn of transcript) {
    if (turn.persona === personaId) {
      messages.push({ role: 'assistant', content: turn.text });
    } else {
      messages.push({ role: 'user', content: `[${PERSONAS[turn.persona].name}]: ${turn.text}` });
    }
  }
  return messages;
}

async function speakTurn(env, personaId, otherId, transcript, topic, phase) {
  const persona = getPersona(personaId);
  const other = getPersona(otherId);
  const phaseNote = phase === 'standing'
    ? `This is the FINAL round: give your standing — your settled position on the question, 1-3 sentences, no new arguments.`
    : `Debate round: respond to what ${other.name} actually said (or open the argument if you're first), 2-4 sentences, in your own register. Disagree where you genuinely disagree.`;
  const system = [
    { type: 'text', text: persona.systemPrompt, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `ROUNDTABLE MODE: Rayan has called you and ${other.name} to the table together on: "${topic}". You both see every turn. ${phaseNote} Never speak for ${other.name}, never pad, never do assistant pleasantries — this is a working argument between siblings.` }
  ];
  const kickoff = `The table is open. Topic: ${topic}`;
  const result = await callAnthropic(env, system, [], messagesFor(personaId, transcript, topic, kickoff), 400);
  if (!result.ok) throw new Error(`Roundtable call failed for ${persona.name}: ${JSON.stringify(result.data).slice(0, 200)}`);
  const textBlock = result.data.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : '(silence)';
}

export async function runRoundtable(env, personaIds, topic) {
  const ids = Array.isArray(personaIds) ? personaIds.filter(id => PERSONAS[id]) : [];
  if (ids.length !== 2 || ids[0] === ids[1]) {
    return { ok: false, error: 'Roundtable needs exactly two distinct personas from the registry.' };
  }
  const cleanTopic = String(topic || '').trim();
  if (!cleanTopic) return { ok: false, error: 'Roundtable needs a topic.' };

  const [a, b] = ids;
  const transcript = [];
  try {
    for (const id of ids) await setPersonaStatus(env, id, `at the roundtable: ${cleanTopic.slice(0, 60)}`, 0.1, '~2 min');

    for (let round = 0; round < ROUNDS; round++) {
      transcript.push({ persona: a, text: await speakTurn(env, a, b, transcript, cleanTopic, 'debate') });
      transcript.push({ persona: b, text: await speakTurn(env, b, a, transcript, cleanTopic, 'debate') });
    }
    const standingA = await speakTurn(env, a, b, transcript, cleanTopic, 'standing');
    transcript.push({ persona: a, text: standingA, standing: true });
    const standingB = await speakTurn(env, b, a, transcript, cleanTopic, 'standing');
    transcript.push({ persona: b, text: standingB, standing: true });

    // Save the exchange to every participant's memory, from their own side.
    const date = new Date().toISOString().slice(0, 10);
    await addLongTermMemory(env,
      `Roundtable with ${PERSONAS[b].name} on "${cleanTopic}" (${date}). My standing: ${standingA} ${PERSONAS[b].name}'s standing: ${standingB}`, a);
    await addLongTermMemory(env,
      `Roundtable with ${PERSONAS[a].name} on "${cleanTopic}" (${date}). My standing: ${standingB} ${PERSONAS[a].name}'s standing: ${standingA}`, b);

    return { ok: true, topic: cleanTopic, transcript };
  } catch (err) {
    return { ok: false, error: err.message, transcript };
  } finally {
    for (const id of ids) await setPersonaStatus(env, id, 'idle');
  }
}
