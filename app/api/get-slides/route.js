export const runtime = 'edge';

const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

export async function POST(req) {
  try {
    const { slideshareUrl } = await req.json();
    if (!slideshareUrl) {
      return Response.json({ error: 'No SlideShare URL provided.' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(slideshareUrl);
    } catch {
      return Response.json({ error: 'Invalid URL.' }, { status: 400 });
    }
    if (!/(^|\.)slideshare\.net$/i.test(parsed.hostname)) {
      return Response.json({ error: 'Only slideshare.net URLs are supported.' }, { status: 400 });
    }

    const pageRes = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SlideDownloader/1.0)' },
    });
    if (!pageRes.ok) {
      return Response.json({ error: `Failed to fetch page: HTTP ${pageRes.status}` }, { status: 502 });
    }
    const html = await pageRes.text();

    const match = html.match(NEXT_DATA_RE);
    if (!match) {
      return Response.json({ error: 'Could not find slide data on that page.' }, { status: 404 });
    }

    const jsonData = JSON.parse(match[1]);
    const props = jsonData?.props?.pageProps || {};
    const slideshow = props?.slideshow || {};
    const slides = slideshow?.slides || {};

    const totalSlides = slideshow.totalSlides || 0;
    const imageLocation = slides.imageLocation || '';
    const imageTitle = slides.title || '';
    const host = slides.host || '';

    if (!totalSlides || !host || !imageLocation || !imageTitle) {
      return Response.json({ error: 'Could not read slide info from that page.' }, { status: 404 });
    }

    const previewQuality = 85;
    const previewWidth = 320;
    const slideImagesPreview = [];
    for (let i = 1; i <= totalSlides; i++) {
      slideImagesPreview.push(`${host}/${imageLocation}/${previewQuality}/${imageTitle}-${i}-${previewWidth}.jpg`);
    }

    return Response.json({
      totalSlides,
      slideImagesPreview,
      slideshowInfo: { host, imageLocation, imageTitle },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
