// Minimal Cloudflare Worker that serves your QR code redirects.
// Deploy: npx wrangler deploy   (then add your hostname under the worker's Custom Domains)
const LINKS = {
  "menu": "https://brand.example/menu",
  "wifi-help": "https://brand.example/help/wifi",
  "k7m2p9x": "https://brand.example/offers/autumn?src=flyer"
};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const to = LINKS[path];
    return to
      ? new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })
      : new Response('This code is not set up.', { status: 404 });
  },
};
