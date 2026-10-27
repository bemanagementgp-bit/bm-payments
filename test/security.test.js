// node test/security.test.js – offline security regression tests (no Mercado Pago calls are made)
process.env.LICENSE_SECRET = 'test-secret';
process.env.VERCEL_ENV = 'production';
delete process.env.MP_ACCESS_TOKEN; delete process.env.MP_WEBHOOK_SECRET;
const assert = require('assert');
const mk = (method, query, body, headers) => ({ method, query: query || {}, body: body || {}, headers: headers || {} });
const res = () => { const r = { h: {}, status(c) { r.code = c; return r; }, setHeader(k, v) { r.h[k.toLowerCase()] = v; return r; }, end(s) { r.body = s; } }; return r; };
const run = async (f, req) => { const r = res(); await require('../api/' + f)(req, r); return r; };
const origErr = console.error; console.error = () => {};

(async () => {
  let r = await run('checkout', mk('POST', {}, { app: 'qrforge' }, { origin: 'https://evil.vercel.app' }));
  assert.strictEqual(r.code, 403, 'foreign origin blocked (CSRF/CORS)');
  assert.strictEqual(r.h['access-control-allow-origin'], undefined, 'no ACAO for foreign origin');

  r = await run('checkout', mk('POST', {}, { app: 'qrforge' }, { origin: 'https://qrforge-tool.vercel.app' }));
  assert.strictEqual(r.h['access-control-allow-origin'], 'https://qrforge-tool.vercel.app', 'own app allowed');

  r = await run('checkout', mk('POST', {}, { app: 'qrforge' }, { origin: 'http://localhost:5173' }));
  assert.strictEqual(r.code, 403, 'localhost not allowed in production');

  r = await run('checkout', mk('POST', {}, { app: '<script>' }));
  assert.strictEqual(r.code, 400, 'app key validated');

  r = await run('license', mk('GET', { payment_id: '123456' }));
  assert.strictEqual(r.code, 400, 'license requires external_reference (no sequential id claiming)');
  r = await run('license', mk('GET', { payment_id: '1', external_reference: 'qrforge:short' }));
  assert.strictEqual(r.code, 400, 'reference format validated');

  r = await run('webhook', mk('POST', { type: 'payment', 'data.id': '1' }));
  assert.strictEqual(r.code, 401, 'unsigned webhook rejected in production');
  r = await run('webhook', mk('POST', { type: 'payment', 'data.id': '../../etc' }));
  assert.strictEqual(r.code, 400, 'webhook id validated');

  r = await run('subscription', mk('GET', { preapproval_id: '../x' }));
  assert.strictEqual(r.code, 400, 'preapproval id validated');

  r = await run('catalog', mk('GET', { app: 'qrforge' }));
  assert.strictEqual(r.h['x-frame-options'], 'DENY');
  assert.match(r.h['content-security-policy'], /default-src 'none'/);
  assert.strictEqual(r.h['x-content-type-options'], 'nosniff');

  for (let i = 0; i < 31; i++) r = await run('validate', mk('POST', {}, { key: 'x', app: 'qrforge' }, { 'x-forwarded-for': '9.9.9.9' }));
  assert.strictEqual(r.code, 429, 'rate limit');

  r = await run('validate', mk('POST', {}, JSON.parse('{"key":"x","app":"qrforge","__proto__":{"polluted":1}}'), { 'x-forwarded-for': '8.8.4.4' }));
  assert.strictEqual(({}).polluted, undefined, 'no prototype pollution');

  r = await run('checkout', mk('POST', {}, { app: 'qrforge', return_url: 'https://evil.example/phish' }, { 'x-forwarded-for': '7.7.7.7' }));
  assert.ok(!String(r.body).includes('evil.example'), 'foreign return_url ignored (no open redirect)');

  console.error = origErr;
  console.log('security tests passed ✓');
})().catch(e => { console.error = origErr; console.error(e); process.exit(1); });
