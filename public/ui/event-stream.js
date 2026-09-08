// Shared framing for browser and Worker. UTF-8 and SSE frames may cross any chunk.
export async function* readEvents(body) {
  if (!body) throw new Error('The response stream is missing.');
  const reader = body.getReader(), decoder = new TextDecoder();
  let pending = '';
  function parse(frame) {
    let event = 'message'; const data = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    return data.length ? { event, data: JSON.parse(data.join('\n')) } : null;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (pending.length > 4 * 1024 * 1024) throw new Error('The response frame is too large.');
      let match;
      while ((match = /\r?\n\r?\n/.exec(pending))) {
        const frame = parse(pending.slice(0, match.index));
        pending = pending.slice(match.index + match[0].length);
        if (frame) yield frame;
      }
      if (done) { if (pending.trim()) { const frame = parse(pending); if (frame) yield frame; } break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function readChatReply(response, onText) {
  let result;
  for await (const {event, data} of readEvents(response.body)) {
    if (event === 'error') throw new Error(data.message || 'The reply was interrupted.');
    if (event === 'text') onText(data.text || '');
    if (event === 'reset') onText('', true);
    if (event === 'done') result = data;
  }
  if (!result) throw new Error('The reply connection ended before completion.');
  return result;
}
