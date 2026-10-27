const crypto = require('crypto');
const { handler, json, body, serviceOrigin } = require('../lib/http');
const { APPS, BUNDLE, CURRENCY } = require('../catalog');
const mp = require('../lib/mp');

/**
 * POST /api/checkout  { app: "qrforge", plan: "pro" | "bundle", email?: "..." , return_url?: "https://..." }
 * Creates a Mercado Pago Checkout Pro preference and returns { id, init_point, sandbox_init_point }.
 * The buyer is sent back to the app with ?payment_id=…&status=approved&external_reference=… ; the app then calls /api/license.
 */
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req);
  const app = String(b.app || '').toLowerCase();
  const plan = b.plan === 'bundle' ? 'bundle' : 'pro';
  if (plan === 'pro' && !APPS[app]) return json(res, 400, { error: 'Unknown app: ' + app });

  const item = plan === 'bundle'
    ? { id: 'bundle', title: BUNDLE.title, unit_price: BUNDLE.ars }
    : { id: app, title: APPS[app].title, unit_price: APPS[app].ars };
  const licenseApp = plan === 'bundle' ? 'all' : app;

  // external_reference ties the payment to the app/plan: "<licenseApp>:<random>"
  const ref = `${licenseApp}:${crypto.randomBytes(6).toString('hex')}`;
  // where to send the buyer back: the app that started the checkout (must be one of ours)
  let back = (APPS[app] && APPS[app].url) || null;
  if (b.return_url) { try { const u = new URL(b.return_url); if (u.hostname.endsWith('.vercel.app') || (process.env.ALLOWED_ORIGINS || '').includes(u.origin)) back = u.origin + u.pathname; } catch (e) {} }
  if (!back) return json(res, 400, { error: 'No return URL for this app' });

  const pref = await mp.createPreference({
    items: [{ id: item.id, title: item.title, description: 'Lifetime Pro license · Be Management Tools', category_id: 'software', quantity: 1, currency_id: CURRENCY, unit_price: item.unit_price }],
    payer: b.email ? { email: String(b.email).slice(0, 120) } : undefined,
    external_reference: ref,
    metadata: { app: licenseApp, plan, source: app },
    back_urls: { success: back + '?mp=success', pending: back + '?mp=pending', failure: back + '?mp=failure' },
    auto_return: 'approved',
    notification_url: serviceOrigin() ? serviceOrigin() + '/api/webhook' : undefined,
    statement_descriptor: 'BE MANAGEMENT TOOLS',
    binary_mode: true,   // approved or rejected, no "in process" limbo for digital goods
    expires: false,
  });
  json(res, 200, { id: pref.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point, external_reference: ref });
});
