// LEGACY URL SHIM — rayven-backend -> asgrard-backend
//
// The real backend was renamed from "rayven-backend" to "asgrard-backend" on
// 2026-08-15, which killed the old workers.dev hostname (Cloudflare error 1042).
// Anything holding the old URL broke instantly and silently:
//
//   - the Chrome extension (background.js), whose BACKEND_URL is a hardcoded
//     const baked in at load time — it keeps polling the dead host until the
//     extension is manually reloaded, which cannot be done remotely;
//   - any installed/cached PWA, bookmark, or QR code pointing at the old host.
//
// This Worker exists only to reclaim the old name and forward every request,
// method, header, and body through to the real backend unchanged. It holds no
// secrets and no bindings — it is a redirector, not a second backend. Do not add
// logic here; if you find yourself wanting to, you want src/ on asgrard-backend.
//
// It stays useful even after every client is updated: an old URL that forwards
// is strictly better than an old URL that black-holes.

const TARGET_HOST = 'asgrard-backend.rayanfahil2.workers.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = TARGET_HOST;
    url.protocol = 'https:';
    url.port = '';
    // Re-using `request` as the init preserves method, headers, and body — which
    // matters because /browser/result and the chat endpoint are POSTs, and a
    // redirect would not carry their bodies reliably.
    return fetch(new Request(url.toString(), request));
  }
};
