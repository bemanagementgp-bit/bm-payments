/**
 * Stateless license keys. No database: a key is an HMAC-signed token bound to
 *   kind  = "p" (one-time payment)  | "s" (subscription / preapproval)
 *   app   = catalog app key or "all"
 *   ref   = Mercado Pago payment id or preapproval id
 * Format: BM-<APP>-<KIND><REF>-<SIG8>   e.g. BM-QRFORGE-P123456789-A1B2C3D4
 * Validation re-checks the payment/subscription status with Mercado Pago, so refunds and cancelled subscriptions revoke access.
 */
const crypto = require('crypto');

function secret() {
  const s = process.env.LICENSE_SECRET;
  if (!s) { const e = new Error('LICENSE_SECRET is not configured'); e.status = 503; throw e; }
  return s;
}
function sig(app, kind, ref) {
  return crypto.createHmac('sha256', secret()).update(`${app}|${kind}|${ref}`).digest('base64url').slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}
function makeKey(app, kind, ref) {
  app = String(app).toLowerCase(); kind = kind === 's' ? 's' : 'p'; ref = String(ref);
  return `BM-${app.toUpperCase()}-${kind.toUpperCase()}${ref}-${sig(app, kind, ref)}`;
}
function parseKey(key) {
  const m = /^BM-([A-Za-z0-9]+)-([PpSs])([A-Za-z0-9]+)-([A-Za-z0-9]{10})$/i.exec(String(key || '').replace(/\s+/g, ''));
  if (!m) return null;
  const app = m[1].toLowerCase(), kind = m[2].toLowerCase(), s = m[4].toUpperCase();
  // Payment ids are numeric; preapproval ids are lowercase hex. Users may type the key in any case, so try as-is then lowercase.
  for (const ref of [m[3], m[3].toLowerCase()]) {
    const expected = sig(app, kind, ref);
    let ok = false; try { ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s)); } catch (e) { ok = false; }
    if (ok) return { app, kind, ref };
  }
  return null;
}
/** app a key for `app` may unlock: the same app, or "all" (bundle / subscription) */
function covers(keyApp, requestedApp) { return keyApp === 'all' || keyApp === String(requestedApp || '').toLowerCase(); }

module.exports = { makeKey, parseKey, covers };
