/** Optional license e-mail via Resend (https://resend.com). Skipped silently when RESEND_API_KEY is unset. */
async function sendLicenseEmail(to, { key, title, app, url }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const from = process.env.FROM_EMAIL || 'Be Management Tools <tools@bemanagement.app>';
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:auto;color:#1d1d1f">
      <h2 style="margin:0 0 8px">Thanks for your purchase 🎉</h2>
      <p>Here is your license key for <strong>${title}</strong>:</p>
      <p style="font-family:ui-monospace,Menlo,monospace;font-size:18px;background:#f5f5f7;padding:14px 16px;border-radius:12px;letter-spacing:.04em">${key}</p>
      <p>Open <a href="${url}">${url}</a>, click <strong>Pro</strong> → <em>Enter license key</em> and paste it. It works on any device; keep this e-mail.</p>
      <p style="color:#86868b;font-size:13px">Be Management Tools · support: reply to this e-mail.</p>
    </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `Your ${title} license key`, html }),
  });
  return r.ok;
}
module.exports = { sendLicenseEmail };
