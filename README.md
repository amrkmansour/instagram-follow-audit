# FollowCheck

A privacy-first Instagram follow audit. Visitors upload their official Instagram data export, which is processed entirely in their browser to identify accounts that do not follow them back.

## Run locally

```bash
npm install
npm run dev
```

Requires Node.js 22 or newer. Run `npm test` for the parser and CSV safety tests.

The production site uses `https://follow-check.com/`. For a deployment at a different path, set `VITE_BASE_PATH` before building; it defaults to `/`.

## Privacy

Uploaded ZIP files never leave the visitor's device. No Instagram password or account connection is required.

## Payments

One audit costs $2.99 USD through Stripe-hosted Checkout. The static frontend sends no uploaded files, parsed usernames, or audit results to the payment Worker. See [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md) for architecture, security boundaries, configuration, and launch checks.

For local payment development, copy `.env.example` to `.env.local`, set its public Worker URL, and run `npm run dev`. Configure Worker values without committing secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put AUDIT_ACCESS_PASSWORD
npm run payments:deploy
```

The non-secret Price ID is configured as `STRIPE_PRICE_ID` in `wrangler.toml`. Use test-mode secrets and a test-mode $2.99 Price until the launch checks pass. `ALLOWED_ORIGIN` and `APP_URL` lock requests and redirects to the published app; use a separate Wrangler environment for local development.

## Scope

FollowCheck compares the follower and following usernames contained in an official JSON export. It does not query live follower counts or filter accounts by audience size. Always request an **All time** export; Instagram does not include a reliable field that lets the site verify the selected date range afterward.

Users can exclude celebrities, brands, or any other account from their results. Those preferences are stored only in that browser's local storage and are applied to future uploads and CSV downloads.

For convenience, the uploader accepts either the original Instagram ZIP or `following.json` together with every `followers_*.json` file. Results include username search and a one-click reset for another export.
