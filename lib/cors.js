// Cross-origin access for the embeddable widget (e.g. a WordPress site calling
// this API from the browser). Restricted to an allowlist instead of '*' so a
// random third-party site can't ride your Vercel free-tier quota.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://slidessdownloader.com',
  'https://www.slidessdownloader.com',
];

function getAllowedOrigins() {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeaders(req) {
  const origin = req.headers.get('origin');
  const allowed = getAllowedOrigins();
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
