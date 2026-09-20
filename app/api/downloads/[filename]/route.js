import { promises as fs } from 'fs';
import path from 'path';
import { downloadsDir } from '../../../../lib/storage';

export const runtime = 'nodejs';

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

// Only reached on a self-hosted / persistent-server deploy (Hostinger, a VPS,
// plain `next start`) - on Vercel, generate-file returns a Vercel Blob URL
// instead and this route is never hit.
export async function GET(req, { params }) {
  const filename = params.filename;
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return Response.json({ error: 'Invalid filename.' }, { status: 400 });
  }

  const filePath = path.join(downloadsDir(), filename);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return Response.json({ error: 'File not found or already expired.' }, { status: 404 });
  }

  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filename).toLowerCase();

  setTimeout(() => {
    fs.unlink(filePath).catch(() => {});
  }, 3 * 60 * 1000);

  return new Response(buffer, {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(stat.size),
    },
  });
}
