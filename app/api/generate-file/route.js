import { corsHeaders } from '../../../lib/cors';
import { isAuthorized } from '../../../lib/auth';
import { MAX_SELECTED_SLIDES } from '../../../lib/settings';
import { mapWithConcurrency, fetchImageBuffer, buildZip, buildPdf, buildPptx, toPngBuffer } from '../../../lib/generate-file';
import { saveGeneratedFile } from '../../../lib/storage';

// Node runtime (not Edge) - pdfkit/pptxgenjs need it, and it lets us run this
// serverless function for up to 60s on Vercel's free Hobby plan for large decks.
export const runtime = 'nodejs';
export const maxDuration = 60;

const RESOLUTIONS = {
  320: { width: 320, quality: 85 },
  638: { width: 638, quality: 85 },
  2048: { width: 2048, quality: 75 },
};

const ALLOWED_HOST_RE = /(^|\.)slidesharecdn\.com$/i;

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req) {
  const headers = corsHeaders(req);
  const json = (data, status = 200) => Response.json(data, { status, headers });

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  try {
    const body = await req.json();
    const { slideshowInfo, resolution, outputFormat, selectedIndices } = body || {};

    if (!slideshowInfo || !resolution || !outputFormat || !selectedIndices) {
      return json({ error: 'Missing required data.' }, 400);
    }
    if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
      return json({ error: 'No slides selected.' }, 400);
    }
    if (selectedIndices.length > MAX_SELECTED_SLIDES) {
      return json({ error: `Too many slides selected (max ${MAX_SELECTED_SLIDES}).` }, 400);
    }

    const { host, imageLocation, imageTitle } = slideshowInfo;
    if (!host || !imageLocation || !imageTitle) {
      return json({ error: 'Invalid slideshowInfo.' }, 400);
    }

    let hostUrl;
    try {
      hostUrl = new URL(host);
    } catch {
      return json({ error: 'Invalid host in slideshowInfo.' }, 400);
    }
    if (!ALLOWED_HOST_RE.test(hostUrl.hostname)) {
      return json({ error: 'Host not allowed.' }, 403);
    }

    const sizeEntry = RESOLUTIONS[resolution];
    if (!sizeEntry) {
      return json({ error: `Invalid resolution: ${resolution}` }, 400);
    }
    const { width, quality } = sizeEntry;

    const imageUrls = selectedIndices.map((idx) => {
      const realSlideNum = Number(idx) + 1;
      return `${host}/${imageLocation}/${quality}/${imageTitle}-${realSlideNum}-${width}.jpg`;
    });

    const buffers = await mapWithConcurrency(imageUrls, 10, (imgUrl) =>
      fetchImageBuffer(imgUrl, {
        userAgent: 'Mozilla/5.0 (compatible; SlideDownloader/1.0)',
        referer: 'https://www.slideshare.net/',
      })
    );

    const format = String(outputFormat).toLowerCase();
    let fileBuffer;
    let finalExt;
    let contentType;

    if (format === 'pdf') {
      fileBuffer = await buildPdf(buffers);
      finalExt = 'pdf';
      contentType = 'application/pdf';
    } else if (format === 'pptx') {
      fileBuffer = await buildPptx(buffers);
      finalExt = 'pptx';
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (format === 'png') {
      const pngBuffers = await mapWithConcurrency(buffers, 6, toPngBuffer);
      fileBuffer = await buildZip(pngBuffers, 'png');
      finalExt = 'zip';
      contentType = 'application/zip';
    } else if (format === 'zip' || format === 'jpg') {
      fileBuffer = await buildZip(buffers, 'jpg');
      finalExt = 'zip';
      contentType = 'application/zip';
    } else {
      return json({ error: `Invalid output format: ${outputFormat}` }, 400);
    }

    const filename = `slides_${Date.now()}.${finalExt}`;
    const downloadUrl = await saveGeneratedFile(fileBuffer, filename, contentType, req);

    return json({ downloadUrl });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
