# SlideShare Downloader (Next.js, serverless)

Downloads SlideShare presentations as PDF, PPTX, or a ZIP of JPG/PNG images.

## Why this is different from the old Node/Express version

The old backend ran `sharp`, `pdfkit`, `pptxgenjs`, and `adm-zip` on the server,
which needs a persistent Node process (hence a VPS). Here:

- The server only has two tiny endpoints:
  - `POST /api/get-slides` — scrapes the SlideShare page for the slide list.
  - `GET /api/proxy-image` — relays one image's bytes past the browser's CORS
    restriction (nothing else; it's allowlisted to `*.slidesharecdn.com`).
- Everything else — downloading the selected slides, and assembling the
  ZIP/PDF/PPTX — runs in the visitor's own browser via `jszip`, `jspdf`, and
  `pptxgenjs` (its browser build).

Both API routes run on the Edge runtime, so they deploy as normal Vercel
serverless functions with no native binaries and no always-on process.

The `/` page is a standalone demo. For embedding on another site (e.g. a
WordPress page), use the widget described below instead.

## Embed on your own site (e.g. WordPress)

You don't need the Next.js page at all to use this on `slidessdownloader.com`.
Deploy this project once (see "Deploy" below), then paste this into a
WordPress "Custom HTML" block (or your theme's page builder's HTML widget):

```html
<div id="ssdl-app"></div>

<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
<script
  src="https://YOUR-PROJECT.vercel.app/embed.js"
  data-api-base="https://YOUR-PROJECT.vercel.app"
></script>
```

Replace `YOUR-PROJECT.vercel.app` (both places) with your actual Vercel
deployment URL once you have it. That's the whole integration — the same
input box → fetch slides → pick slides → download flow as the old tool, just
calling this project's API instead of a VPS-hosted Express server.

By default the API only accepts cross-origin requests from
`https://slidessdownloader.com` (see `lib/cors.js`). If you use a different
domain, or want to add a staging domain, set an `ALLOWED_ORIGINS` environment
variable in the Vercel project (comma-separated list of full origins, e.g.
`https://slidessdownloader.com,https://staging.slidessdownloader.com`).

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy (free)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Go to https://vercel.com, sign up with your GitHub account (free "Hobby" plan).
3. "Add New Project" → import this repo → Deploy. No environment variables needed.

## Can this run on regular PHP/cPanel shared hosting instead?

Not as-is — the two API routes are plain Node/Edge functions, and most
shared hosting plans don't run Node.js reliably. Two options if you want to
avoid Vercel entirely:

- Rewrite just the two small endpoints (`get-slides`, `proxy-image`) in PHP
  with `cURL` — this is a small amount of code since all the heavy lifting
  already lives in the browser, so a cheap shared hosting plan is enough.
- Or use any other serverless platform that supports Next.js Edge functions
  (Cloudflare Pages, Netlify) — same idea as Vercel, also free-tier friendly.
