const { handler, json } = require('../lib/http');
const { APPS, BUNDLE } = require('../catalog');
const mp = require('../lib/mp');
const { makeKey } = require('../lib/license');
const { sendLicenseEmail } = require('../lib/mail');

/**
 * GET /api/license?payment_id=123   (or ?external_reference=qrforge:abcd)
 * Verifies the payment with Mercado Pago and returns the license key for an approved payment.
 * Called by the app right after Mercado Pago redirects the buyer back (payment_id is in the query string).
 */
module.exports = handler(async (req, res) => {
  let payment = null;
  if (req.query.payment_id) payment = await mp.getPayment(String(req.query.payment_id));
  else if (req.query.external_reference) {
    const s = await mp.searchPaymentsByReference(String(req.query.external_reference));
    payment = (s.results || []).find(p => p.status === 'approved') || (s.results || [])[0] || null;
  }
  if (!payment) return json(res, 404, { error: 'Payment not found' });
  if (payment.status !== 'approved') return json(res, 402, { error: 'Payment not approved', status: payment.status, status_detail: payment.status_detail });

  const app = String((payment.metadata && payment.metadata.app) || String(payment.external_reference || '').split(':')[0] || '').toLowerCase();
  if (!app || (app !== 'all' && !APPS[app])) return json(res, 400, { error: 'Payment is not for a known app' });

  const key = makeKey(app, 'p', payment.id);
  const title = app === 'all' ? BUNDLE.title : APPS[app].title;
  const url = app === 'all' ? 'https://quickinvoice-tool.vercel.app' : APPS[app].url;
  const email = payment.payer && payment.payer.email;
  let emailed = false;
  try { emailed = await sendLicenseEmail(email, { key, title, app, url }); } catch (e) { emailed = false; }
  json(res, 200, { key, app, title, payment_id: payment.id, emailed, email: email ? email.replace(/(.{2}).+(@.+)/, '$1***$2') : null });
});
