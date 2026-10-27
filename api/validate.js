const { handler, json, body } = require('../lib/http');
const { APPS } = require('../catalog');
const mp = require('../lib/mp');
const { parseKey, covers } = require('../lib/license');

/**
 * POST /api/validate  { key: "BM-QRFORGE-P123-ABCDEFGHIJ", app: "qrforge" }
 * → { valid: true, meta: { app, kind, ref } }  or { valid: false, error }
 * Re-checks Mercado Pago so refunds / chargebacks / cancelled subscriptions revoke the key.
 */
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req);
  const app = String(b.app || '').toLowerCase();
  const parsed = parseKey(b.key);
  if (!parsed) return json(res, 200, { valid: false, error: 'Invalid license key' });
  if (!covers(parsed.app, app)) return json(res, 200, { valid: false, error: 'This key belongs to a different product' });

  try {
    if (parsed.kind === 'p') {
      const p = await mp.getPayment(parsed.ref);
      const refunded = (p.transaction_amount_refunded || 0) >= (p.transaction_amount || 0) && (p.transaction_amount || 0) > 0;
      if (p.status !== 'approved' || refunded || p.status === 'charged_back') return json(res, 200, { valid: false, error: 'Payment is no longer valid (' + p.status + ')' });
    } else {
      const s = await mp.getPreapproval(parsed.ref);
      if (s.status !== 'authorized') return json(res, 200, { valid: false, error: 'Subscription is ' + s.status });
    }
  } catch (e) {
    if (e.status === 404) return json(res, 200, { valid: false, error: 'Payment not found' });
    throw e;
  }
  json(res, 200, { valid: true, meta: { app: parsed.app, kind: parsed.kind, ref: parsed.ref, title: parsed.app === 'all' ? 'All apps' : (APPS[parsed.app] || {}).title } });
});
