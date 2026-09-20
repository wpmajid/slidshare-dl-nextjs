export const runtime = 'edge';

// Only ever relays bytes from SlideShare's own CDN - kept to an allowlist so this
// endpoint can't be used as an open proxy for arbitrary URLs.
const ALLOWED_HOST_RE = /(^|\.)slidesharecdn\.com$/i;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  if (!imageUrl) {
    return Response.json({ error: 'Missing url parameter.' }, { status: 400 });
  }

  let target;
  try {
    target = new URL(imageUrl);
  } catch {
    return Response.json({ error: 'Invalid url.' }, { status: 400 });
  }

  if (!ALLOWED_HOST_RE.test(target.hostname)) {
    return Response.json({ error: 'Host not allowed.' }, { status: 403 });
  }

  const imgRes = await fetch(target.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SlideDownloader/1.0)' },
  });
  if (!imgRes.ok || !imgRes.body) {
    return Response.json({ error: `Failed to fetch image: HTTP ${imgRes.status}` }, { status: 502 });
  }

  return new Response(imgRes.body, {
    headers: {
      'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
