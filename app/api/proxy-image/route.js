import { corsHeaders } from '../../../lib/cors';

export const runtime = 'edge';

// Only ever relays bytes from SlideShare's own CDN - kept to an allowlist so this
// endpoint can't be used as an open proxy for arbitrary URLs.
const ALLOWED_HOST_RE = /(^|\.)slidesharecdn\.com$/i;

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req) {
  const cors = corsHeaders(req);
  const json = (data, status) => Response.json(data, { status, headers: cors });

  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  if (!imageUrl) {
    return json({ error: 'Missing url parameter.' }, 400);
  }

  let target;
  try {
    target = new URL(imageUrl);
  } catch {
    return json({ error: 'Invalid url.' }, 400);
  }

  if (!ALLOWED_HOST_RE.test(target.hostname)) {
    return json({ error: 'Host not allowed.' }, 403);
  }

  const imgRes = await fetch(target.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SlideDownloader/1.0)' },
  });
  if (!imgRes.ok || !imgRes.body) {
    return json({ error: `Failed to fetch image: HTTP ${imgRes.status}` }, 502);
  }

  return new Response(imgRes.body, {
    headers: {
      ...cors,
      'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
