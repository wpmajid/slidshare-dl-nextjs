// Server-side file assembly for the WordPress-plugin-compatible /api/generate-file
// endpoint. This is the one place that still needs Node (not Edge), since
// pdfkit and pptxgenjs read their own bundled assets via `fs`.

function isValidImageBuffer(buf) {
  if (!buf || buf.length < 2) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  return isJpeg || isPng;
}

// SlideShare's CDN occasionally rejects a burst of concurrent requests with a
// 200 response that isn't actually image bytes (rate limiting). Retrying with
// a short backoff - same as the original Express backend did - clears this up
// almost always; without it, PDF (which validates JPEG/PNG signatures) is the
// only format that visibly fails, while ZIP/PPTX would silently embed the bad
// response as a "slide".
export async function fetchImageBuffer(imageUrl, { retries = 3, userAgent } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(imageUrl, {
        headers: userAgent ? { 'User-Agent': userAgent } : undefined,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isValidImageBuffer(buf)) {
        throw new Error('Received a non-image response (likely rate-limited)');
      }
      return buf;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw new Error(`Failed to download slide image after ${retries} attempts: ${lastError.message}`);
}

export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function buildZip(buffers, ext) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  buffers.forEach((buf, i) => zip.file(`slide_${i + 1}.${ext}`, buf));
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function buildPdf(buffers) {
  const { default: PDFDocument } = await import('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      for (const buf of buffers) {
        const image = doc.openImage(buf);
        doc.addPage({ size: [image.width, image.height] });
        doc.image(image, 0, 0);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function buildPptx(buffers) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  for (const buf of buffers) {
    const slide = pptx.addSlide();
    slide.addImage({ data: `data:image/jpeg;base64,${buf.toString('base64')}`, x: 0, y: 0, w: '100%', h: '100%' });
  }
  return pptx.write({ outputType: 'nodebuffer' });
}

export async function toPngBuffer(jpegBuffer) {
  const { default: Jimp } = await import('jimp');
  const img = await Jimp.read(jpegBuffer);
  return img.getBufferAsync(Jimp.MIME_PNG);
}
