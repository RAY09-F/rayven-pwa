// Command queue for the Chrome extension (background.js), which polls
// GET /browser/poll and reports results to POST /browser/result. Ported unchanged.

export async function enqueueBrowserCommand(env, action, params) {
  const id = crypto.randomUUID();
  await env.RAYVEN_KV.put('browser:command', JSON.stringify({ id, action, params, status: 'pending' }));
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    const raw = await env.RAYVEN_KV.get(`browser:result:${id}`);
    if (raw) {
      await env.RAYVEN_KV.delete(`browser:result:${id}`);
      return JSON.parse(raw);
    }
  }
  return { success: false, data: 'Timed out waiting for the browser extension — is it installed and Chrome open, sir?' };
}

export async function enqueueBrowserCommandNoWait(env, action, params) {
  const id = crypto.randomUUID();
  await env.RAYVEN_KV.put('browser:command', JSON.stringify({ id, action, params, status: 'pending' }));
}
