const { handler, json } = require('../lib/http');
/** GET /api/health → which env vars are set (never their values) */
module.exports = handler(async (req, res) => {
  json(res, 200, {
    ok: true,
    mp_access_token: !!process.env.MP_ACCESS_TOKEN,
    mp_webhook_secret: !!process.env.MP_WEBHOOK_SECRET,
    license_secret: !!process.env.LICENSE_SECRET,
    payments_origin: process.env.PAYMENTS_ORIGIN || null,
    email: !!process.env.RESEND_API_KEY,
    node: process.version,
  });
});
