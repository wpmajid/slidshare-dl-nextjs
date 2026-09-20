import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Vercel's serverless functions have a read-only filesystem (except /tmp,
// which isn't shared between invocations), so there we upload to Vercel Blob.
// On a persistent Node host (Hostinger, a VPS, plain `next start`), there's a
// real always-on filesystem, so we just write the file to disk and serve it
// back ourselves - exactly like the original Express backend did.

const DOWNLOADS_DIR = path.join(os.tmpdir(), 'slidshare-dl-downloads');

export function downloadsDir() {
  return DOWNLOADS_DIR;
}

export async function saveGeneratedFile(buffer, filename, contentType, requestUrl) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(filename, buffer, { access: 'public', contentType, addRandomSuffix: true });
    return blob.url;
  }

  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(DOWNLOADS_DIR, filename), buffer);

  const origin = new URL(requestUrl).origin;
  return `${origin}/api/downloads/${filename}`;
}
