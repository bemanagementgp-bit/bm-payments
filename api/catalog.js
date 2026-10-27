const { handler, json } = require('../lib/http');
const { APPS, BUNDLE, SUBSCRIPTION, CURRENCY } = require('../catalog');

/** GET /api/catalog?app=qrforge → prices the apps show in their Pro modal */
module.exports = handler(async (req, res) => {
  const app = String(req.query.app || '').toLowerCase();
  const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).format(n);
  const out = {
    currency: CURRENCY,
    configured: !!process.env.MP_ACCESS_TOKEN,
    bundle: { title: BUNDLE.title, amount: BUNDLE.ars, display: fmt(BUNDLE.ars) },
    subscription: { title: SUBSCRIPTION.title, amount: SUBSCRIPTION.ars, display: fmt(SUBSCRIPTION.ars) + '/mes' },
  };
  if (app && APPS[app]) out.app = { key: app, title: APPS[app].title, amount: APPS[app].ars, display: fmt(APPS[app].ars) };
  else out.apps = Object.fromEntries(Object.entries(APPS).map(([k, v]) => [k, { title: v.title, amount: v.ars, display: fmt(v.ars) }]));
  res.setHeader('Cache-Control', 'public, max-age=300');
  json(res, 200, out);
});
