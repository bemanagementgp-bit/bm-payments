const { handler, json } = require('../lib/http');

/**
 * GET /api/geo                 → country of the visitor's connection (Vercel IP geolocation header)
 * GET /api/geo?lat=-34.9&lon=-57.9 → country for device coordinates (only sent when the visitor allowed location)
 * Response: { country: "AR", source: "ip" | "coords" | null }
 * Nothing is stored or logged. Coordinates are resolved offline with country-coder (ISC) – no third-party API.
 */
let coder = null;
function countryFromCoords(lat, lon) {
  if (!coder) coder = require('@rapideditor/country-coder');
  const iso = coder.iso1A2Code([lon, lat]);
  return iso || null;
}

module.exports = handler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const c = countryFromCoords(lat, lon);
    return json(res, 200, { country: c, source: c ? 'coords' : null });
  }
  const c = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  json(res, 200, { country: /^[A-Z]{2}$/.test(c) ? c : null, source: c ? 'ip' : null });
});
