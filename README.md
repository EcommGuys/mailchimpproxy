# Caveman Tools Mailchimp subscribe proxy

Small serverless function that receives teaser signups and subscribes them to
the **Home RenoVision DIY** Mailchimp audience (us20) via the Marketing API.
Because the API call happens server-side, the visitor's browser never contacts
`list-manage.com`, so Firefox Enhanced Tracking Protection and ad blockers can
no longer break signups.

## What it does

- Accepts `POST { "email": "...", "hp": "..." }` (JSON).
- Rejects bots via the `hp` honeypot field.
- Upserts the contact into list `6adf28eedf` as `subscribed`.
- Applies the tags **Caveman Tools** and **Caveman Waitlist** (additive; existing HRV tags are kept).
- Returns `{ "ok": true }` on success or `{ "ok": false, "message": "..." }` on failure.

## Deploy to Vercel (free, no DNS changes)

1. Create a free account at https://vercel.com (sign in with email or GitHub).
2. Create a new project and upload this `mailchimp-proxy` folder
   (or push it to a Git repo and import it). Vercel auto-detects the
   `/api/subscribe.js` function. No build step or framework needed.
3. In the project: **Settings → Environment Variables**, add:
   - Name: `MAILCHIMP_API_KEY`
   - Value: an API key created in the **HomeRenoVisionDIY** Mailchimp account
     (Account → Extras → API keys). The key ends in `-us20`.
   - Apply to Production (and Preview if you want).
   - Never commit this key to any file or the theme.
4. Deploy. Your endpoint is:
   `https://YOUR-PROJECT.vercel.app/api/subscribe`
5. Paste that full URL into the Shopify theme editor:
   **Teaser landing section → Mailchimp → "Signup proxy endpoint URL"**.

## Test

    curl -i -X POST https://YOUR-PROJECT.vercel.app/api/subscribe \
      -H "Content-Type: application/json" \
      -d '{"email":"you+test@example.com"}'

Expect `{"ok":true}`, then confirm the contact appears in Mailchimp with both
tags. Remove the test contact afterward.

## Notes

- **Single vs double opt-in:** new contacts are added as `subscribed`
  (single opt-in). To send Mailchimp's confirmation email instead, change
  `STATUS_IF_NEW` to `'pending'` in `api/subscribe.js`.
- **Locking down callers:** by default the function accepts requests from
  `*.cavemantools.com` and `*.myshopify.com`. To restrict it, set an
  `ALLOWED_ORIGINS` environment variable to a comma-separated list of exact
  origins, e.g. `https://cavemantools.com`.
- **Rotating the key:** if the API key is ever exposed, delete it in Mailchimp
  and set a new one in the Vercel environment variable. Nothing in the theme
  changes.
# mailchimpproxy
