// Minimal Cloudflare Worker that serves your QR code redirects.
// Deploy: npx wrangler deploy   (then add your hostname under the worker's Custom Domains)
const LINKS = {};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const to = LINKS[path];
    return to
      ? new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })
      : new Response('This code is not set up.', { status: 404 });
  },
};
