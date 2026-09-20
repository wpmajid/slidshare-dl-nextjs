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

export async function saveGeneratedFile(buffer, filename, contentType, req) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(filename, buffer, { access: 'public', contentType, addRandomSuffix: true });
    return blob.url;
  }

  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(DOWNLOADS_DIR, filename), buffer);

  return `${publicOrigin(req)}/api/downloads/${filename}`;
}

// Behind a reverse proxy (Hostinger, most VPS setups), the Node process is
// usually bound to an internal address like 0.0.0.0 or 127.0.0.1, so `req.url`
// itself is useless for building a public link. Prefer the headers a proxy is
// expected to forward; only trust req.url's own protocol for local dev, where
// there's no proxy and the Host header is just localhost/127.0.0.1.
function publicOrigin(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const explicitProto = req.headers.get('x-forwarded-proto');
  if (explicitProto && host) return `${explicitProto}://${host}`;
  if (host && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host)) {
    return `https://${host}`;
  }
  return new URL(req.url).origin;
}
