/**
 * The exit kit: everything a customer needs to keep printed codes working without us.
 * Pure functions returning a file map, zipped with fflate (runs in Workers and browsers).
 * The same generator produces the dashboard download and the monthly exit kit email.
 */
import { strToU8, zipSync } from 'fflate';

export interface ExitLink {
  hostname: string;
  slug: string;
  destination: string;
  title: string;
  /** True for codes on our shared short domain; those cannot move to another host. */
  shared: boolean;
}

export interface ExitKitMeta {
  brandName: string;
  accountEmail: string;
  generatedAt: Date;
  exitKitRepo: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** JSON that is safe inside a <script> element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function csvCell(value: string): string {
  // Leading = + - @ would be read as formulas by spreadsheet apps.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function linksCsv(links: ExitLink[]): string {
  const rows = [['short_url', 'hostname', 'path', 'destination', 'title', 'portable']];
  for (const l of links) {
    rows.push([`https://${l.hostname}/${l.slug}`, l.hostname, l.slug, l.destination, l.title, l.shared ? 'no' : 'yes']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function redirectPage(destination: string): string {
  const href = escapeHtml(destination);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${href}">
<link rel="canonical" href="${href}">
<title>Redirecting…</title>
<script>location.replace(${scriptJson(destination)});</script>
</head>
<body><p>Redirecting to <a href="${href}">${href}</a>…</p></body>
</html>
`;
}

function notFoundPage(map: Record<string, string>, brandName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Not found</title>
<script>
  // Fallback for hosts without redirect rules: match the path case-insensitively.
  var links = ${scriptJson(map)};
  var path = location.pathname.replace(/^\\/+|\\/+$/g, '').toLowerCase();
  if (links[path]) location.replace(links[path]);
</script>
</head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1>This code is not set up</h1>
<p>There is no destination for this address. It was exported from ${escapeHtml(brandName)}.</p>
</body>
</html>
`;
}

function workerSource(map: Record<string, string>): string {
  return `// Minimal Cloudflare Worker that serves your QR code redirects.
// Deploy: npx wrangler deploy   (then add your hostname under the worker's Custom Domains)
const LINKS = ${JSON.stringify(map, null, 2)};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/^\\/+|\\/+$/g, '').toLowerCase();
    const to = LINKS[path];
    return to
      ? new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })
      : new Response('This code is not set up.', { status: 404 });
  },
};
`;
}

function readme(links: ExitLink[], meta: ExitKitMeta, hostnames: string[]): string {
  const shared = links.filter((l) => l.shared);
  const date = meta.generatedAt.toISOString().slice(0, 10);
  const lines: string[] = [
    `# Your ${meta.brandName} exit kit`,
    '',
    `Generated ${date} for ${meta.accountEmail}.`,
    '',
    `This kit keeps your printed QR codes working if ${meta.brandName} ever shuts down, or if you want to leave.`,
    'You do not need us, an account or any programming to use it.',
    '',
    '## What is inside',
    '',
    '- `links.csv` and `links.json`: every code, its address and where it points.',
    '- `sites/<your hostname>/`: a ready-to-host copy of the redirects for each of your own domains.',
    '',
  ];
  if (hostnames.length) {
    lines.push(
      '## Codes on your own domain move with you',
      '',
      `Your domains: ${hostnames.map((h) => `\`${h}\``).join(', ')}.`,
      'A code on your own domain keeps working as long as you control that domain. To move it:',
      '',
      '### Option A: Netlify (free, no programming, about 5 minutes)',
      '',
      '1. Create a free account at https://www.netlify.com.',
      '2. Open https://app.netlify.com/drop and drag the folder `sites/<your hostname>` onto the page.',
      '3. In the new site, open **Domain management → Add a domain** and enter your hostname.',
      '4. At your DNS provider, change the CNAME record of that hostname to the address Netlify shows (it ends in `.netlify.app`).',
      '5. Scan one of your printed codes to confirm it still opens the right page.',
      '',
      '### Option B: Cloudflare Pages',
      '',
      '1. In the Cloudflare dashboard open **Workers & Pages → Create → Pages → Upload assets**.',
      '2. Upload the folder `sites/<your hostname>`.',
      '3. Under **Custom domains**, add your hostname and follow the DNS instructions.',
      '',
      '### Option C: any static host (GitHub Pages, Amazon S3, your own server)',
      '',
      'Upload the folder as it is. Every code has its own small page that forwards visitors, and `404.html` catches',
      'paths typed in a different letter case. Make sure your host serves `404.html` for unknown paths.',
      '',
      '### Option D: a Cloudflare Worker',
      '',
      'Each site folder also contains `worker.js`. Deploy it with `npx wrangler deploy` and attach your hostname as a custom domain.',
      '',
      '### Changing a destination later',
      '',
      'Edit the line for that code in `_redirects`, and the matching `<path>/index.html`, then upload the folder again.',
      '',
    );
  } else {
    lines.push(
      '## You have no codes on your own domain yet',
      '',
      `Codes on your own domain (for example qr.yourbrand.com) are the ones that can outlive ${meta.brandName}.`,
      'Add a domain in your dashboard (Pro and Business packs) and create codes on it.',
      '',
    );
  }
  if (shared.length) {
    lines.push(
      `## Codes on the shared ${meta.brandName} domain`,
      '',
      `${shared.length} of your codes use our shared domain. They cannot be moved, because the domain is ours. If`,
      `${meta.brandName} closes, they keep forwarding to their last destination for the period our Terms of Service`,
      'promise, but nobody can change them after the closing date. Their destinations are in `links.csv`; recreate',
      'them on your own domain before you reprint.',
      '',
    );
  }
  lines.push('## Open source', '', `The generator of this kit is open source: ${meta.exitKitRepo}`, '');
  return lines.join('\n');
}

export function buildExitKitFiles(links: ExitLink[], meta: ExitKitMeta): Record<string, string> {
  const files: Record<string, string> = {};
  const byHost = new Map<string, ExitLink[]>();
  for (const l of links) {
    if (l.shared) continue;
    const list = byHost.get(l.hostname) ?? [];
    list.push(l);
    byHost.set(l.hostname, list);
  }
  const hostnames = [...byHost.keys()].sort();
  files['README.md'] = readme(links, meta, hostnames);
  files['links.csv'] = linksCsv(links);
  files['links.json'] = JSON.stringify(
    {
      generatedAt: meta.generatedAt.toISOString(),
      account: meta.accountEmail,
      links: links.map((l) => ({ url: `https://${l.hostname}/${l.slug}`, ...l })),
    },
    null,
    2,
  );
  for (const host of hostnames) {
    const hostLinks = byHost.get(host)!;
    const map: Record<string, string> = {};
    for (const l of hostLinks) map[l.slug.toLowerCase()] = l.destination;
    const base = `sites/${host}`;
    files[`${base}/_redirects`] =
      `# Redirects for ${host}, exported from ${meta.brandName} on ${meta.generatedAt.toISOString().slice(0, 10)}.\n` +
      `# Format: /path  destination  status. Works on Netlify and Cloudflare Pages.\n` +
      hostLinks.map((l) => `/${l.slug}  ${l.destination}  302`).join('\n') +
      '\n';
    for (const l of hostLinks) files[`${base}/${l.slug}/index.html`] = redirectPage(l.destination);
    files[`${base}/404.html`] = notFoundPage(map, meta.brandName);
    files[`${base}/index.html`] =
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${escapeHtml(host)}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><p>This address serves QR code links.</p></body></html>\n`;
    files[`${base}/worker.js`] = workerSource(map);
    files[`${base}/wrangler.toml`] = `name = "qr-${host.replace(/[^a-z0-9]+/g, '-')}"\nmain = "worker.js"\ncompatibility_date = "2026-09-01"\n`;
  }
  return files;
}

export function zipFiles(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content);
  // fflate allocates a plain ArrayBuffer; its typings just predate the generic.
  return zipSync(entries, { level: 6 }) as Uint8Array<ArrayBuffer>;
}

export function buildExitKitZip(links: ExitLink[], meta: ExitKitMeta): Uint8Array<ArrayBuffer> {
  return zipFiles(buildExitKitFiles(links, meta));
}
