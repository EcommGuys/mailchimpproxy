// Serverless Mailchimp subscribe proxy for the Caveman Tools teaser form.
//
// The browser posts { email, hp } here. This function calls the Mailchimp
// Marketing API server-to-server, so the browser never contacts
// list-manage.com and ad blockers / Firefox ETP have nothing to block.
//
// The Mailchimp API key lives ONLY in the MAILCHIMP_API_KEY environment
// variable on the host. It must never appear in the theme or any client code.

const crypto = require('crypto');

// --- Fixed config for the Home RenoVision DIY (us20) audience --------------
const LIST_ID = '6adf28eedf';
const TAGS = ['Caveman Tools', 'Caveman Waitlist'];
// New subscribers are added as 'subscribed' (single opt-in), matching a
// waitlist signup. Change to 'pending' if you want Mailchimp's confirmation
// email (double opt-in).
const STATUS_IF_NEW = 'subscribed';
// ---------------------------------------------------------------------------

// Which storefront origins may call this endpoint. Set ALLOWED_ORIGINS as a
// comma-separated list to lock it down further; by default we allow the
// Caveman Tools domain and any *.myshopify.com preview.
function isAllowedOrigin(origin) {
  if (!origin) return false;
  const custom = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  if (custom.length) return custom.indexOf(origin) !== -1;
  return /^https:\/\/([a-z0-9-]+\.)*cavemantools\.com$/i.test(origin)
    || /^https:\/\/[a-z0-9-]+\.myshopify\.com$/i.test(origin);
}

function cleanMailchimpError(detail) {
  return String(detail || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*-\s*/, '')
    .trim();
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  var email = (body.email || '').trim();
  var hp = body.hp || '';

  // Honeypot filled = bot. Pretend it worked, subscribe nobody.
  if (hp) return res.status(200).json({ ok: true });

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  var key = process.env.MAILCHIMP_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, message: 'Signup is temporarily unavailable. Please try again later.' });
  }
  var dc = key.split('-')[1] || 'us20';
  var auth = 'Basic ' + Buffer.from('key:' + key).toString('base64');
  var hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  var base = 'https://' + dc + '.api.mailchimp.com/3.0/lists/' + LIST_ID + '/members/' + hash;

  try {
    // Upsert the member. PUT won't error if they already exist.
    var put = await fetch(base, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: email, status_if_new: STATUS_IF_NEW })
    });

    if (!put.ok) {
      var err = await put.json().catch(function () { return {}; });
      // Previously unsubscribed / cleaned contacts can't be re-added silently.
      if (err.title === 'Member In Compliance State') {
        return res.status(200).json({ ok: false, message: "You've unsubscribed before, so we can't re-add you automatically. Reply to any past email to opt back in." });
      }
      var msg = cleanMailchimpError(err.detail) || 'Something went wrong. Please try again.';
      return res.status(502).json({ ok: false, message: msg });
    }

    // Apply both tags (additive; existing HRV tags are kept).
    await fetch(base + '/tags', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: TAGS.map(function (t) { return { name: t, status: 'active' }; }) })
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, message: 'Could not reach the signup service. Please try again.' });
  }
};
