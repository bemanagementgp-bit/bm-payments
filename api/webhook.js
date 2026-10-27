const { json, body, securityHeaders, rateLimit } = require('../lib/http');
const { APPS, BUNDLE } = require('../catalog');
const mp = require('../lib/mp');
const { makeKey } = require('../lib/license');
const { sendLicenseEmail } = require('../lib/mail');

/**
 * POST /api/webhook  – Mercado Pago notifications (configure this URL in your MP application → Webhooks).
 * Topics handled: payment (payment.created / payment.updated) and subscription_preapproval.
 * We don't store anything: on an approved payment we (optionally) e-mail the license key. Always answers 200 fast.
 */
module.exports = async (req, res) => {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (rateLimit(req, res, { limit: 120, bucket: 'webhook' })) return;
  const q = req.query || {};
  const b = body(req);
  const type = q.type || q.topic || b.type || b.action || '';
  const dataId = (q['data.id'] || (b.data && b.data.id) || q.id || b.id || '').toString();

  if (dataId && !/^[A-Za-z0-9-]{1,64}$/.test(dataId)) return json(res, 400, { error: 'Bad id' });
  if (!mp.verifyWebhookSignature(req, dataId)) return json(res, 401, { error: 'Invalid signature' });
  if (!dataId) return json(res, 200, { ok: true, ignored: 'no id' });

  try {
    if (/payment/.test(type)) {
      const p = await mp.getPayment(dataId);
      if (p.status === 'approved') {
        const app = String((p.metadata && p.metadata.app) || String(p.external_reference || '').split(':')[0] || '').toLowerCase();
        if (app === 'all' || APPS[app]) {
          const key = makeKey(app, 'p', p.id);
          const title = app === 'all' ? BUNDLE.title : APPS[app].title;
          const url = app === 'all' ? 'https://quickinvoice-tool.vercel.app' : APPS[app].url;
          await sendLicenseEmail(p.payer && p.payer.email, { key, title, app, url });
        }
      }
      return json(res, 200, { ok: true, payment: p.id, status: p.status });
    }
    if (/preapproval|subscription/.test(type)) {
      const s = await mp.getPreapproval(dataId);
      if (s.status === 'authorized') {
        const key = makeKey('all', 's', s.id);
        await sendLicenseEmail(s.payer_email, { key, title: 'Be Management Tools – Creative Pro', app: 'all', url: 'https://quickinvoice-tool.vercel.app' });
      }
      return json(res, 200, { ok: true, preapproval: s.id, status: s.status });
    }
    return json(res, 200, { ok: true, ignored: type });
  } catch (e) {
    // Always 200 so Mercado Pago doesn't retry forever on our own errors; log for inspection.
    console.error('webhook error', e.message, e.details || '');
    return json(res, 200, { ok: false, error: e.message });
  }
};
