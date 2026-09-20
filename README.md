# SlideShare Downloader (Next.js, serverless)

Downloads SlideShare presentations as PDF, PPTX, or a ZIP of JPG/PNG images.
No VPS — everything runs as Vercel serverless functions.

## Two ways to use this

### A) Drop-in replacement for your existing WordPress plugin

If you already have the `slidesh-downloader-wp` plugin (the one that calls
`https://backend.slidessdownloader.com/api/get-slides` and `/api/generate-file`
from PHP via `wp_remote_post`), you don't need to change the plugin's logic at
all — just point it at this project's URL instead:

In `inc/admin.php`, change:

```php
$response = wp_remote_post('https://backend.slidessdownloader.com/api/get-slides/', ...
...
$response = wp_remote_post('https://backend.slidessdownloader.com/api/generate-file', ...
```

to your Vercel deployment's domain, e.g.:

```php
$response = wp_remote_post('https://YOUR-PROJECT.vercel.app/api/get-slides', ...
...
$response = wp_remote_post('https://YOUR-PROJECT.vercel.app/api/generate-file', ...
```

That's the entire change. These two calls happen **server-to-server** (PHP →
Vercel), so there's no CORS involved at all — the plugin's JS, templates, and
AJAX flow stay exactly as they are.

- `POST /api/get-slides` — same request/response shape as the old backend:
  `{ slideshareUrl }` in, `{ totalSlides, slideImagesPreview, slideshowInfo }`
  out.
- `POST /api/generate-file` — same shape too: `{ slideshowInfo, resolution,
  outputFormat, selectedIndices }` in, `{ downloadUrl }` out. It downloads the
  selected slide images, builds the ZIP/PDF/PPTX **in the function itself**
  (Node runtime, not Edge — pdfkit/pptxgenjs need Node), uploads the result to
  **Vercel Blob** storage, and returns its public URL. The browser then just
  navigates to that URL to download, exactly like before.

**Requires Vercel Blob** (needed for `generate-file` to have somewhere to put
the finished file): in your Vercel project → Storage tab → Create Database →
Blob → connect it to this project. Vercel then injects a
`BLOB_READ_WRITE_TOKEN` environment variable automatically — no code changes
needed. Blob has a free tier (1 GB storage / 10 GB bandwidth per month at the
time of writing), more than enough for this.

### B) Embed directly on a page (no PHP backend at all)

For a page that doesn't go through WordPress PHP — e.g. a static page, or
`slidessdownloader.com` itself without the plugin — paste this into a
"Custom HTML" block:

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

This path calls `/api/get-slides` and `/api/proxy-image` (not
`/api/generate-file`) directly from the visitor's browser, and builds the
ZIP/PDF/PPTX client-side. Because it's called from the browser, it needs CORS —
by default only `https://slidessdownloader.com` and
`https://www.slidessdownloader.com` are allowed (see `lib/cors.js`). Add more
origins via an `ALLOWED_ORIGINS` env var (comma-separated) in the Vercel
project settings.

The `/` page on this deployment is a standalone demo of this same path.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy (free)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Go to https://vercel.com, sign up with your GitHub account (free "Hobby" plan).
3. "Add New Project" → import this repo → Deploy.
4. If you're using path A (the WordPress plugin), also add a Blob store:
   Vercel project → Storage → Create Database → Blob → connect to this
   project (no manual env var needed, Vercel wires it up).

## Can this run on regular PHP/cPanel shared hosting instead?

The WordPress plugin (path A) already runs on your existing PHP hosting — it's
only calling out to this Next.js project over HTTPS, same as it called the old
`backend.slidessdownloader.com`. Only this Next.js part needs a Node-capable
host, and Vercel's free tier is exactly that, so there's nothing left to move
to PHP.
