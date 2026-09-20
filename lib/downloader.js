// All heavy lifting (fetching slide bytes, zipping, PDF/PPTX assembly) happens
// in the browser. The server only scrapes the slide list and proxies image
// bytes past CORS, so it stays cheap enough to run on a serverless free tier.

export const RESOLUTIONS = {
  320: { width: 320, quality: 85, label: 'Low (320px)' },
  638: { width: 638, quality: 85, label: 'Medium (638px)' },
  2048: { width: 2048, quality: 75, label: 'High (2048px)' },
};

export function buildImageUrl(slideshowInfo, resolution, slideNumber) {
  const { host, imageLocation, imageTitle } = slideshowInfo;
  const { width, quality } = RESOLUTIONS[resolution];
  return `${host}/${imageLocation}/${quality}/${imageTitle}-${slideNumber}-${width}.jpg`;
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

export async function fetchSlideBlob(imageUrl) {
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
  if (!res.ok) {
    throw new Error(`Failed to download slide (HTTP ${res.status})`);
  }
  return res.blob();
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function jpegBlobToPngBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function buildZip(blobs, ext) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  blobs.forEach((blob, i) => zip.file(`slide_${i + 1}.${ext}`, blob));
  return zip.generateAsync({ type: 'blob' });
}

export async function buildPdf(blobs) {
  const { jsPDF } = await import('jspdf');
  let doc;

  for (let i = 0; i < blobs.length; i++) {
    const bitmap = await createImageBitmap(blobs[i]);
    const dataUrl = await blobToDataURL(blobs[i]);
    if (i === 0) {
      doc = new jsPDF({ unit: 'px', format: [bitmap.width, bitmap.height] });
    } else {
      doc.addPage([bitmap.width, bitmap.height]);
    }
    doc.addImage(dataUrl, 'JPEG', 0, 0, bitmap.width, bitmap.height);
  }

  return doc.output('blob');
}

export async function buildPptx(blobs) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();

  for (const blob of blobs) {
    const dataUrl = await blobToDataURL(blob);
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
  }

  return pptx.write('blob');
}
