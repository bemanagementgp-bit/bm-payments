/** Shared helpers for Vercel Node functions: CORS, JSON, errors. */
function allowedOrigin(origin) {
  if (!origin) return '*';
  const list = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes(origin)) return origin;
  try {
    const h = new URL(origin).hostname;
    if (h.endsWith('.vercel.app') || h === 'localhost' || h === '127.0.0.1') return origin;
    if (list.some(d => d.startsWith('*.') && h.endsWith(d.slice(1)))) return origin;
  } catch (e) {}
  return null;
}
function cors(req, res) {
  const o = allowedOrigin(req.headers.origin);
  if (o) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
function json(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
/** wraps a handler: CORS + error → JSON */
function handler(fn) {
  return async (req, res) => {
    if (cors(req, res)) return;
    try { await fn(req, res); }
    catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      json(res, status, { error: e.message || 'Internal error', details: e.details || undefined });
    }
  };
}
const serviceOrigin = () => (process.env.PAYMENTS_ORIGIN || '').replace(/\/$/, '');

module.exports = { cors, json, body, handler, serviceOrigin };
