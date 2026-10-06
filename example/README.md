# Your Guaranteed QR exit kit

Generated 2026-10-06 for owner@brand.example.

This kit keeps your printed QR codes on your own domain working if Guaranteed QR ever shuts down, or if you want to leave.
You do not need us or any programming to use it: a free account at a web host such as Netlify or Cloudflare is enough.

## What is inside

- `links.csv` and `links.json`: every code, its address and where it points.
- `sites/<your hostname>/`: a ready-to-host copy of the redirects for each of your own domains.

## Codes on your own domain move with you

Your domains: `qr.brand.example`.
A code on your own domain keeps working as long as you control that domain. To move it:

### Option A: Netlify (free, no programming, about 5 minutes)

1. Create a free account at https://www.netlify.com.
2. Open https://app.netlify.com/drop and drag the folder `sites/<your hostname>` onto the page.
3. In the new site, open **Domain management → Add a domain** and enter your hostname.
4. At your DNS provider, change the CNAME record of that hostname to the address Netlify shows (it ends in `.netlify.app`).
5. Scan one of your printed codes to confirm it still opens the right page.

### Option B: Cloudflare Pages

1. In the Cloudflare dashboard open **Workers & Pages → Create application → Get started → Drag and drop your files**.
2. Name the project, drag in the folder `sites/<your hostname>` and select **Deploy site**.
3. Under **Custom domains**, add your hostname and follow the DNS instructions.

### Option C: any static host (GitHub Pages, Amazon S3, your own server)

Upload the folder as it is. Every code has its own small page that forwards visitors, and `404.html` catches
paths typed in a different letter case. Make sure your host serves `404.html` for unknown paths.

### Option D: a Cloudflare Worker

Each site folder also contains `worker.js`. Deploy it with `npx wrangler deploy` and attach your hostname as a custom domain.

### Changing a destination later

Edit the line for that code in `_redirects`, the matching `<path>/index.html` and its entry in `404.html`, then upload
the folder again. With the Worker (option D), edit its line in `worker.js` and run `npx wrangler deploy` again.

## Codes on the shared Guaranteed QR domain

Your codes on our shared domain (1 in all) cannot be moved, because the domain is ours. If
Guaranteed QR closes, they keep forwarding to their last destination for at least 5 years, as our
Terms of Service promise, but nobody can change them after the closing date. Their destinations are in
`links.csv`; recreate them on your own domain before you reprint.

## Open source

The generator of this kit is open source: https://github.com/guaranteedqr/exit-kit
