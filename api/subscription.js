const { handler, json, body } = require('../lib/http');
const mp = require('../lib/mp');
const { makeKey, parseKey } = require('../lib/license');

/**
 * GET  /api/subscription?preapproval_id=…  → { status, key? }  (key only when authorized)
 * POST /api/subscription { key, action: "cancel" | "pause" | "resume" } → updates the subscription that key belongs to
 */
module.exports = handler(async (req, res) => {
  if (req.method === 'GET') {
    const id = String(req.query.preapproval_id || req.query.id || '');
    if (!id) return json(res, 400, { error: 'preapproval_id required' });
    const s = await mp.getPreapproval(id);
    const out = { id: s.id, status: s.status, next_payment_date: s.next_payment_date, reason: s.reason };
    if (s.status === 'authorized') out.key = makeKey('all', 's', s.id);
    return json(res, 200, out);
  }
  if (req.method === 'POST') {
    const b = body(req);
    const parsed = parseKey(b.key);
    if (!parsed || parsed.kind !== 's') return json(res, 400, { error: 'Not a subscription key' });
    const status = { cancel: 'cancelled', pause: 'paused', resume: 'authorized' }[b.action];
    if (!status) return json(res, 400, { error: 'action must be cancel, pause or resume' });
    const s = await mp.updatePreapproval(parsed.ref, { status });
    return json(res, 200, { id: s.id, status: s.status });
  }
  json(res, 405, { error: 'GET or POST' });
});
