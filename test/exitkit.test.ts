import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildExitKitFiles, buildExitKitZip, linksCsv, redirectPage, type ExitLink } from '../src/index';

const META = { brandName: 'Evercode', accountEmail: 'owner@example.com', generatedAt: new Date('2026-09-27T12:00:00Z'), exitKitRepo: 'https://github.com/x/y' };

const LINKS: ExitLink[] = [
  { hostname: 'qr.brand.example', slug: 'menu', destination: 'https://brand.example/menu?table=4&lang=en', title: 'Menu', shared: false },
  { hostname: 'qr.brand.example', slug: 'k7m2p9x', destination: 'https://brand.example/a"b<c>', title: '=HYPERLINK("evil")', shared: false },
  { hostname: 'go.evercode.example', slug: 'abc2345', destination: 'https://elsewhere.example/', title: 'Shared', shared: true },
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
    expect(Object.keys(files).some((f) => f.includes('go.evercode.example'))).toBe(false);
    expect(files['README.md']).toContain('1 of your codes use our shared domain');
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
