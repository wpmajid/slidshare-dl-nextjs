// Server-side file assembly for the WordPress-plugin-compatible /api/generate-file
// endpoint. This is the one place that still needs Node (not Edge), since
// pdfkit and pptxgenjs read their own bundled assets via `fs`.

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
