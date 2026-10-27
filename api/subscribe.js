const crypto = require('crypto');
const { handler, json, body, serviceOrigin } = require('../lib/http');
const { SUBSCRIPTION, CURRENCY } = require('../catalog');
const mp = require('../lib/mp');

/**
 * POST /api/subscribe { email: "buyer@mail.com", return_url?: "https://..." }
 * Creates a Mercado Pago subscription (preapproval, no plan) for "Creative Pro – all apps".
 * Returns { id, init_point }. After authorization MP redirects to back_url with ?preapproval_id=…
 */
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req);
  const email = String(b.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'A valid e-mail is required for subscriptions' });
  let back = 'https://quickinvoice-tool.vercel.app';
  if (b.return_url) { try { const u = new URL(b.return_url); if (u.hostname.endsWith('.vercel.app') || (process.env.ALLOWED_ORIGINS || '').includes(u.origin)) back = u.origin + u.pathname; } catch (e) {} }

  const sub = await mp.createPreapproval({
    reason: SUBSCRIPTION.title,
    external_reference: 'all:' + crypto.randomBytes(6).toString('hex'),
    payer_email: email,
    auto_recurring: { frequency: SUBSCRIPTION.frequency, frequency_type: SUBSCRIPTION.frequency_type, transaction_amount: SUBSCRIPTION.ars, currency_id: CURRENCY },
    back_url: back + '?mp=subscription',
    status: 'pending',
    notification_url: serviceOrigin() ? serviceOrigin() + '/api/webhook' : undefined,
  });
  json(res, 200, { id: sub.id, init_point: sub.init_point, status: sub.status });
});
