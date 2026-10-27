/** Shared helpers for Vercel Node functions: strict CORS, security headers, rate limiting, safe errors. */
const { APPS } = require('../catalog');

// ---- CORS: only our own apps (catalog URLs) + ALLOWED_ORIGINS env + localhost for development ----
function appOrigins() {
  const set = new Set(Object.values(APPS).map(a => { try { return new URL(a.url).origin; } catch (e) { return null; } }).filter(Boolean));
  (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).forEach(o => set.add(o.replace(/\/$/, '')));
  return set;
}
function isDevOrigin(origin) {
  if (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_LOCALHOST !== 'true') return false;
  try { const u = new URL(origin); return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'); } catch (e) { return false; }
}
function allowedOrigin(origin) {
  if (!origin) return null;                      // non-browser clients don't need CORS headers
  if (appOrigins().has(origin) || isDevOrigin(origin)) return origin;
  return null;
}
/** True when `url` belongs to one of our apps (used to validate return URLs → no open redirects). */
function isOwnUrl(url) {
  try { const u = new URL(url); return appOrigins().has(u.origin) || isDevOrigin(u.origin); } catch (e) { return false; }
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}
function cors(req, res) {
  securityHeaders(res);
  const o = allowedOrigin(req.headers.origin);
  if (o) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(o ? 204 : 403).end(); return true; }
  // state-changing requests from a browser must come from one of our apps (CSRF defence in depth)
  if (req.method === 'POST' && req.headers.origin && !o) { json(res, 403, { error: 'Origin not allowed' }); return true; }
  return false;
}

// ---- Rate limiting (per instance, per IP) ----
const hits = new Map();
function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown'; }
function rateLimit(req, res, { limit = 30, windowMs = 60000, bucket = 'default' } = {}) {
  const key = bucket + ':' + clientIp(req), now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) { if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k); }
  if (arr.length > limit) { res.setHeader('Retry-After', Math.ceil(windowMs / 1000)); json(res, 429, { error: 'Too many requests. Try again in a minute.' }); return true; }
  return false;
}

function json(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
function body(req) {
  let b = req.body;
  if (!b || typeof b !== 'object') { try { b = JSON.parse(req.body || '{}'); } catch (e) { b = {}; } }
  // drop prototype-pollution keys
  if (b && typeof b === 'object') for (const k of ['__proto__', 'constructor', 'prototype']) delete b[k];
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}
/** wraps a handler: CORS + headers + rate limit + error → JSON (no internal details leaked) */
function handler(fn, opts = {}) {
  return async (req, res) => {
    if (cors(req, res)) return;
    if (rateLimit(req, res, Object.assign({ bucket: fn.name || 'h' }, opts.rate || {}))) return;
    try { await fn(req, res); }
    catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      if (status >= 500) console.error('handler error', e.message, e.details ? JSON.stringify(e.details).slice(0, 500) : '');
      // client sees a generic message for upstream/internal errors; validation errors keep their message
      const safe = status === 503 ? e.message : status >= 500 || (e.details && status !== 400) ? 'Payment provider error. Please try again.' : e.message;
      json(res, status, { error: safe || 'Internal error' });
    }
  };
}
const serviceOrigin = () => (process.env.PAYMENTS_ORIGIN || '').replace(/\/$/, '');

module.exports = { cors, json, body, handler, serviceOrigin, isOwnUrl, rateLimit, clientIp, securityHeaders };
