const { handler, json } = require('../lib/http');
const { APPS, BUNDLE } = require('../catalog');
const mp = require('../lib/mp');
const { makeKey } = require('../lib/license');

/**
 * GET /api/license?payment_id=123&external_reference=qrforge:<32 hex>
 * Verifies the payment with Mercado Pago and returns the license key for an approved payment.
 *
 * Security (business logic): BOTH values are required and must match. Mercado Pago payment ids are sequential,
 * so a payment_id alone would let anyone claim other buyers' licenses; the external_reference is a 128-bit random
 * token that only the buyer's browser receives (Mercado Pago appends it to the return URL).
 * The license e-mail is sent by the webhook, never from here (no e-mail bombing through this endpoint).
 */
module.exports = handler(async (req, res) => {
  const pid = String(req.query.payment_id || '');
  const ref = String(req.query.external_reference || '');
  if (!/^\d{1,20}$/.test(pid) || !/^[a-z0-9]{1,40}:[a-f0-9]{12,64}$/.test(ref)) return json(res, 400, { error: 'payment_id and external_reference are required' });

  const payment = await mp.getPayment(pid).catch(e => { if (e.status === 404) return null; throw e; });
  if (!payment || payment.external_reference !== ref) return json(res, 404, { error: 'Payment not found' });
  if (payment.status !== 'approved') return json(res, 402, { error: 'Payment not approved', status: payment.status });

  const app = String((payment.metadata && payment.metadata.app) || ref.split(':')[0]).toLowerCase();
  if (app !== 'all' && !APPS[app]) return json(res, 400, { error: 'Payment is not for a known app' });

  const key = makeKey(app, 'p', payment.id);
  const title = app === 'all' ? BUNDLE.title : APPS[app].title;
  const email = payment.payer && payment.payer.email;
  json(res, 200, { key, app, title, payment_id: payment.id, emailed: !!process.env.RESEND_API_KEY, email: email ? email.replace(/^(.{2}).*(@.+)$/, '$1***$2') : null });
}, { rate: { limit: 20 } });
