// Toggle for the standalone tool page at `/` (and the "/" demo of the
// embeddable widget). This is NOT a security control — the API itself is
// separately protected by the API key in lib/settings.js regardless of this
// value. This only decides what a visitor who opens the site directly sees.
//
// Flip to `true` any time you want the frontend visible again, then redeploy
// (Hostinger: `npm run build` + restart). Keep this file free of secrets —
// unlike lib/settings.js, it's safe to import from client components, so
// anything exported here ends up in the public JS bundle.
export const FRONTEND_ENABLED = false;
