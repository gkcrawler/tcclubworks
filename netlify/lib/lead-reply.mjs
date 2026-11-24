import logo from './lead-reply-logo.json' with { type: 'json' };

const sender = 'paul@tcclubworks.io';
const copies = ['info@tcclubworks.io', 'brian@tcclubworks.io'];
const subject = 'Thanks for reaching out to Chronic Clubworks';
const body = 'Thanks for reaching out to Chronic Clubworks. We’ve received your request and are reviewing the details. I’ll follow up with you about next steps. If you have photos or anything else you’d like me to see, just reply to this email or shoot me a text.';
const hour = 60 * 60 * 1000;

function message(data, email) {
  const first = typeof data.name === 'string' ? data.name.trim().split(/\s+/u)[0] : '';
  const name = /^[\p{L}\p{M}][\p{L}\p{M}'’.\-]{0,79}$/u.test(first) ? first : 'there';
  const greeting = `Hi ${name},`;
  const signature = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font:14px/20px Arial,Helvetica,sans-serif">' +
    '<tr aria-hidden="true"><td height="40" style="height:40px;font-size:1px;mso-line-height-rule:exactly;line-height:40px">&nbsp;</td></tr>' +
    '<tr><td style="font-size:18px;line-height:24px"><strong>Paul Cohn</strong></td></tr>' +
    '<tr><td>Owner | Master Clubmaker</td></tr><tr><td>Denver, CO</td></tr>' +
    '<tr><td><a href="tel:+17208544132" style="color:inherit">(720) 854-4132</a></td></tr>' +
    '<tr><td style="padding-top:10px"><a href="https://tcclubworks.io"><img src="cid:ccw-logo" alt="Chronic Clubworks" width="144" height="66" style="display:block;border:0"></a></td></tr></table>';
  return {
    from: `Paul Cohn <${sender}>`, reply_to: sender, to: [email], cc: copies, subject,
    text: `${greeting}\n\n${body}\n\n\nPaul Cohn\nOwner | Master Clubmaker\nDenver, CO\n(720) 854-4132\nhttps://tcclubworks.io`,
    html: `<p>${greeting}</p><p style="margin-bottom:0">${body.replace('shoot me a text', '<a href="sms:+17208544132">shoot me a text</a>')}</p>${signature}`,
    attachments: [{ filename: 'ccw-logo.png', content: logo, content_type: 'image/png', content_id: 'ccw-logo' }],
  };
}

export function alreadyHandled(board, id) {
  const key = 'inquiry:' + id;
  const job = board?.jobs?.[key];
  return Boolean(board?.links?.[key] || job?.archived || (job?.stage && job.stage !== 'inquiry') || job?.checks?.some(Boolean));
}

export async function acknowledge(payload, { env, getLedger, getBoard, send = sendEmail, now = Date.now }) {
  if (payload?.form_name !== 'quote') return 'ignored';
  const data = payload.data || {};
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  if (!/^[^\s@,;:<>"\\()[\]\x00-\x1f\x7f]+@[^\s@,;:<>"\\()[\]\x00-\x1f\x7f]+\.[^\s@,;:<>"\\()[\]\x00-\x1f\x7f]+$/u.test(email) || email.length > 254) return 'invalid email';
  const id = payload.id;
  if (typeof id !== 'string' || !/^[a-z\d_-]{1,128}$/i.test(id)) throw new Error('Missing valid form submission ID');
  const created = Date.parse(payload.created_at);
  if (!Number.isFinite(created)) throw new Error('Missing valid form submission date');
  const timestamp = now();
  if (env.CCW_LEAD_REPLY_LIVE_FROM) {
    const activation = Date.parse(env.CCW_LEAD_REPLY_LIVE_FROM);
    if (!Number.isFinite(activation)) throw new Error('Invalid lead reply activation date');
    if (created < activation || timestamp < activation) return 'before activation';
  } else if (email.toLowerCase() !== env.CCW_LEAD_TEST_TO?.trim().toLowerCase() || timestamp - created > hour) {
    return 'off';
  }
  if (!env.CCW_RESEND_API_KEY) throw new Error('Missing Resend sending credential');
  const ledger = getLedger();
  const entry = await ledger.get(id, { type: 'json' });
  if (entry?.messageId) return 'already sent';
  if (alreadyHandled(await getBoard(), id)) return 'already handled';
  let reservation = entry;
  if (!reservation) {
    reservation = { firstAttempt: timestamp };
    const result = await ledger.setJSON(id, reservation, { onlyIfNew: true });
    if (!result.modified) reservation = await ledger.get(id, { type: 'json' });
  }
  if (reservation?.messageId) return 'already sent';
  // Resend retains idempotency keys for 24 hours. Never replay an ambiguous older send.
  if (!Number.isFinite(reservation?.firstAttempt) || timestamp - reservation.firstAttempt >= 23 * hour) {
    throw new Error('Unconfirmed acknowledgment needs review');
  }
  const messageId = await send(message(data, email), 'ccw-lead/' + id, env.CCW_RESEND_API_KEY);
  await ledger.setJSON(id, { firstAttempt: reservation.firstAttempt, messageId });
  return 'sent';
}

async function sendEmail(message, key, token) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Resend returned HTTP ' + response.status);
  const result = await response.json();
  if (!result?.id || typeof result.id !== 'string') throw new Error('Resend returned no message ID');
  return result.id;
}
