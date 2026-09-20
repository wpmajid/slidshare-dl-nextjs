// Simple settings you can tweak yourself later - just edit the values below
// and redeploy (Hostinger: `npm run build` + restart). No other code changes
// needed for either of these.

// Shared secret between this backend and the WordPress plugin. Every request
// to /api/get-slides and /api/generate-file must carry it as the `X-API-Key`
// header, or it's rejected with 401 - this is what stops anyone else from
// calling your backend directly (e.g. via curl/Postman) and running up your
// server's CPU/bandwidth for free.
//
// Change this to your own value any time, but you must then update the exact
// same value in the WordPress plugin (inc/admin.php -> SSDWP_API_KEY), or the
// plugin will start getting 401 errors.
export const API_KEY = process.env.SSDL_API_KEY || 'b13712da8cdd36bb2b4d91e352034de6dcacc7a124607282';

// Maximum number of slides a single /api/generate-file request may include,
// regardless of format or resolution. Stops one request (accidental or
// abusive) from tying up the server with an unreasonably large deck.
export const MAX_SELECTED_SLIDES = 300;
