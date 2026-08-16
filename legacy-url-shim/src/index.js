// LEGACY URL SHIM — rayven-backend -> asgrard-backend
//
// The real backend was renamed from "rayven-backend" to "asgrard-backend" on
// 2026-08-15, which killed the old workers.dev hostname. Anything holding the
// old URL broke instantly and silently:
//
//   - the Chrome extension (background.js), whose BACKEND_URL is a hardcoded
//     const baked in at load time — it keeps polling the dead host until the
//     extension is manually reloaded, which cannot be done remotely;
//   - any installed/cached PWA, bookmark, or QR code pointing at the old host;
//   - Jay's JARVIS and Kevin's KEVOS, which federate against the old URL.
//
// This Worker exists only to reclaim the old name and forward every request,
// method, header, and body through to the real backend unchanged. It holds no
// secrets and no bindings besides the service binding — it is a redirector, not
// a second backend. Do not add logic here; if you find yourself wanting to, you
// want worker.js on asgrard-backend instead.
//
// It stays useful even after every client is updated: an old URL that forwards
// is strictly better than an old URL that black-holes.

const TARGET_HOST = 'asgrard-backend.rayanfahil2.workers.dev';

export default {
  async fetch(request, env) {
    // Preferred path. env.BACKEND is a service binding (see wrangler.toml), so
    // this dispatches straight to asgrard-backend in-process: no DNS, no second
    // trip through the edge, and no chance of the request looping back here.
    //
    // The request is passed through untouched, including its original
    // rayven-backend hostname. That is fine and deliberate — the backend routes
    // on pathname only, and its asset handler matches on path too.
    if (env && env.BACKEND) {
      try {
        return await env.BACKEND.fetch(request);
      } catch (err) {
        // Fall through to the public-hostname path rather than failing the
        // request outright, so a binding problem degrades instead of 500ing.
        console.error('service binding failed, falling back to fetch:', err.message);
      }
    }

    // Fallback for when the binding is missing (e.g. deployed from a config that
    // predates it). Re-using `request` as the init preserves method, headers,
    // and body — which matters because the chat endpoint, /tts and
    // /browser/result are POSTs, and a redirect would not carry their bodies.
    const url = new URL(request.url);
    url.hostname = TARGET_HOST;
    url.protocol = 'https:';
    url.port = '';
    return fetch(new Request(url.toString(), request));
  }
};
