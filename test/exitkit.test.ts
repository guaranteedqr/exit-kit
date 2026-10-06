import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildExitKitFiles, buildExitKitZip, linksCsv, redirectPage, type ExitLink } from '../src/index';

const META = { brandName: 'Guaranteed QR', accountEmail: 'owner@example.com', generatedAt: new Date('2026-09-27T12:00:00Z'), exitKitRepo: 'https://github.com/guaranteedqr/exit-kit', sharedYearsAfterClosing: 5 };

const LINKS: ExitLink[] = [
  { hostname: 'qr.brand.example', slug: 'menu', destination: 'https://brand.example/menu?table=4&lang=en', title: 'Menu', shared: false },
  { hostname: 'qr.brand.example', slug: 'k7m2p9x', destination: 'https://brand.example/a"b<c>', title: '=HYPERLINK("evil")', shared: false },
  { hostname: 'gtdqr.com', slug: 'abc2345', destination: 'https://elsewhere.example/', title: 'Shared', shared: true },
];

describe('exit kit', () => {
  const files = buildExitKitFiles(LINKS, META);

  it('ships a site folder per own domain and none for the shared domain', () => {
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'README.md',
        'links.csv',
        'links.json',
        'sites/qr.brand.example/_redirects',
        'sites/qr.brand.example/menu/index.html',
        'sites/qr.brand.example/k7m2p9x/index.html',
        'sites/qr.brand.example/404.html',
        'sites/qr.brand.example/worker.js',
      ]),
    );
    expect(Object.keys(files).some((f) => f.includes('gtdqr.com'))).toBe(false);
    expect(files['README.md']).toContain('Your codes on our shared domain (1 in all) cannot be moved');
  });

  it('tells the truth about what the kit needs and keeps, and how to change it later', () => {
    const readme = files['README.md']!;
    expect(readme).toContain('This kit keeps your printed QR codes on your own domain working');
    expect(readme).toContain('a free account at a web host such as Netlify or Cloudflare is enough');
    expect(readme).not.toContain('an account or any programming');
    // Cloudflare's direct upload as its dashboard names it in 2026.
    expect(readme).toContain('**Workers & Pages → Create application → Get started → Drag and drop your files**');
    expect(readme).toContain('its entry in `404.html`');
    expect(readme).toContain('edit its line in `worker.js` and run `npx wrangler deploy` again');
    expect(readme).toContain('for at least 5 years');
    // A kit without a domain of its own lists no site folder.
    const sharedOnly = buildExitKitFiles(LINKS.filter((l) => l.shared), META)['README.md']!;
    expect(sharedOnly).not.toContain('sites/<your hostname>/');
  });

  it('writes Netlify / Cloudflare Pages redirect rules', () => {
    const rules = files['sites/qr.brand.example/_redirects']!.split('\n').filter((l) => l && !l.startsWith('#'));
    expect(rules).toEqual(['/menu  https://brand.example/menu?table=4&lang=en  302', '/k7m2p9x  https://brand.example/a"b<c>  302']);
  });

  it('escapes destinations inside HTML redirect pages', () => {
    const html = redirectPage('https://x.example/"><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('url=https://x.example/&quot;&gt;&lt;script&gt;');
  });

  it('neutralizes spreadsheet formulas in the CSV', () => {
    const csv = linksCsv(LINKS);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(csv.split('\r\n')[0]).toBe('short_url,hostname,path,destination,title,portable');
  });

  it('zips every file', () => {
    const unzipped = unzipSync(buildExitKitZip(LINKS, META));
    expect(Object.keys(unzipped).sort()).toEqual(Object.keys(files).sort());
    expect(strFromU8(unzipped['links.csv']!)).toBe(files['links.csv']);
  });

  it('the exported worker really redirects, case-insensitively', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exitkit-'));
    const file = join(dir, 'worker.mjs');
    writeFileSync(file, files['sites/qr.brand.example/worker.js']!);
    const worker = (await import(pathToFileURL(file).href)).default as { fetch(r: Request): Promise<Response> };
    const hit = await worker.fetch(new Request('https://qr.brand.example/MENU/'));
    expect(hit.status).toBe(302);
    expect(hit.headers.get('location')).toBe('https://brand.example/menu?table=4&lang=en');
    expect((await worker.fetch(new Request('https://qr.brand.example/nope'))).status).toBe(404);
  });
});
