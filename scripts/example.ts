// Rebuilds example/ from sample data: the files a customer receives, without running the service.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExitKitFiles, type ExitLink } from '../src/index.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'example');

const links: ExitLink[] = [
  { hostname: 'qr.brand.example', slug: 'menu', destination: 'https://brand.example/menu', title: 'Table menu', shared: false },
  { hostname: 'qr.brand.example', slug: 'wifi-help', destination: 'https://brand.example/help/wifi', title: 'Wi-Fi help sign', shared: false },
  { hostname: 'qr.brand.example', slug: 'k7m2p9x', destination: 'https://brand.example/offers/autumn?src=flyer', title: 'Autumn flyer', shared: false },
  { hostname: 'gtdqr.com', slug: 'abc2345', destination: 'https://brand.example/reviews', title: 'Review card', shared: true },
];

const files = buildExitKitFiles(links, {
  brandName: 'Guaranteed QR',
  accountEmail: 'owner@brand.example',
  generatedAt: new Date('2026-10-06T12:00:00Z'),
  exitKitRepo: 'https://github.com/guaranteedqr/exit-kit',
});

rmSync(out, { recursive: true, force: true });
for (const [path, content] of Object.entries(files)) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
console.log(`Wrote ${Object.keys(files).length} files to example/`);
