# Guaranteed QR exit kit

The code that builds the exit kit of [Guaranteed QR](https://guaranteedqr.com). An exit kit is a ready-to-host copy of a customer's QR code redirects: with it, codes printed on the customer's own domain keep working without us, whether we shut down or the customer leaves.

This is the generator the service runs. It builds the kit you download from your dashboard and the kit we email every month. You can read it, run it and check that a kit holds everything needed.

## What a kit contains

| File | What it is |
|---|---|
| `README.md` | Step-by-step instructions for moving your codes |
| `links.csv`, `links.json` | Every code: its address, path, destination and title |
| `sites/<your hostname>/_redirects` | Redirect rules for Netlify and Cloudflare Pages |
| `sites/<your hostname>/<path>/index.html` | One forwarding page per code, for any static host |
| `sites/<your hostname>/404.html` | Catches a path typed in another letter case |
| `sites/<your hostname>/worker.js`, `wrangler.toml` | A ready-to-deploy Cloudflare Worker |

Codes on the shared domain gtdqr.com are listed in `links.csv` and `links.json` but cannot move, because that domain is ours. Our [Terms of Service](https://guaranteedqr.com/terms) say what happens to them if we close.

[`example/`](example) is a kit built from sample data, exactly as a customer receives it.

## Using your kit

You need no programming. Unzip the kit and follow its `README.md`. In short: upload the folder of your domain to a free static host such as Netlify or Cloudflare Pages, then point your QR subdomain (for example `qr.yourbrand.com`) at that host with one DNS record. Scan a printed code to check.

## Running the code

With Node.js 24 or later:

```sh
npm install
npm test          # redirect rules, escaping, CSV safety, and a real run of the exported Worker
npm run check     # type check
npm run example   # rebuilds example/ from sample data
```

The generator is one file, [`src/index.ts`](src/index.ts), with one dependency, [fflate](https://github.com/101arrowz/fflate), which writes the zip.

## License

MIT, see [`LICENSE`](LICENSE). Copyright 2026 Orange Arc LLC (Guaranteed QR).
