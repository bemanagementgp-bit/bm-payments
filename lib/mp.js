/** Minimal Mercado Pago REST client (no SDK). Docs: https://www.mercadopago.com.ar/developers/es/reference */
const crypto = require('crypto');

const API = 'https://api.mercadopago.com';

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) { const e = new Error('MP_ACCESS_TOKEN is not configured'); e.status = 503; throw e; }
  return t;
}

async function mp(method, path, body, extraHeaders) {
  const r = await fetch(API + path, {
    method,
    headers: Object.assign({
      'Authorization': 'Bearer ' + token(),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    }, extraHeaders || {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!r.ok) {
    const e = new Error((data && (data.message || data.error)) || ('Mercado Pago error ' + r.status));
    e.status = r.status; e.details = data; throw e;
  }
  return data;
}

// ---- Checkout Pro: one-time payment via preference ----
async function createPreference(pref) { return mp('POST', '/checkout/preferences', pref); }
async function getPayment(id) { return mp('GET', '/v1/payments/' + encodeURIComponent(id)); }
async function searchPaymentsByReference(externalReference) {
  return mp('GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + encodeURIComponent(externalReference));
}
// ---- Subscriptions (preapproval without plan) ----
async function createPreapproval(body) { return mp('POST', '/preapproval', body); }
async function getPreapproval(id) { return mp('GET', '/preapproval/' + encodeURIComponent(id)); }
async function updatePreapproval(id, body) { return mp('PUT', '/preapproval/' + encodeURIComponent(id), body); }
// ---- Refunds (for support tooling) ----
async function refundPayment(id, amount) { return mp('POST', `/v1/payments/${encodeURIComponent(id)}/refunds`, amount ? { amount } : {}); }

/**
 * Webhook signature check (x-signature: "ts=...,v1=..."; manifest = id:{data.id};request-id:{x-request-id};ts:{ts};)
 * Returns true when MP_WEBHOOK_SECRET is unset (verification disabled) or the signature matches.
 */
function verifyWebhookSignature(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.headers['x-signature'] || '';
  const reqId = req.headers['x-request-id'] || '';
  const parts = Object.fromEntries(sig.split(',').map(p => p.trim().split('=')).filter(p => p.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-zA-Z0-9]+$/.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${reqId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1)); } catch (e) { return false; }
}

module.exports = { createPreference, getPayment, searchPaymentsByReference, createPreapproval, getPreapproval, updatePreapproval, refundPayment, verifyWebhookSignature };
