# Stripe integration plan

Planner guide: `iguide_61V9YxbmLjK98gq1k41C2qM4SAqsB`

The Stripe implementation planner selected a Stripe-only, browser-based, standard checkout integration using full-page Stripe-hosted Checkout. The charge is a one-time $2.99 USD payment for one Instagram follow audit.

## Architecture

1. GitHub Pages calls the payment Worker to create a Checkout Session. The price, amount, currency, return URLs, and product metadata are controlled by the Worker.
2. Checkout redirects back with the Stripe Session ID and a 256-bit random redemption secret. Only a SHA-256 digest of that secret is stored in Stripe metadata.
3. The browser keeps the proof in session storage. It reads and validates the Instagram export locally; no file, username, or parsed result crosses the network.
4. Immediately before showing valid results, the browser redeems the purchase. The Worker retrieves the Checkout Session from Stripe and verifies paid status, mode, product, exact amount, currency, and the redemption-secret digest.
5. A Durable Object transaction atomically marks the Checkout Session as redeemed, preventing ordinary replay and concurrent double redemption.
6. A signed Stripe webhook records completed payments. Redemption also retrieves the Session directly, so fulfillment is not broken by webhook delivery delay.

## Secrets and deployment

- The one-time $2.99 USD Price is configured as Worker variable `STRIPE_PRICE_ID`; Price IDs are public configuration, not API secrets.
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with `wrangler secret put`; never put either value in source, Vite variables, GitHub Actions logs, or Git history.
- Register `https://followcheck-payments.instagram-follow-audit.workers.dev/api/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- The frontend build variable `VITE_PAYMENTS_API_URL` points to the deployed Worker origin. This is public configuration, not a secret.
- Keep test and live Stripe credentials, Prices, webhook endpoints, and Worker environments separate.

## Launch checks

- Exercise success, cancellation, declined card, duplicate redemption, malformed proof, invalid webhook signature, and allowed-origin failures in Stripe test mode.
- Confirm DevTools shows only payment-proof requests and never uploaded file bodies or parsed usernames.
- Enable Stripe-hosted payment methods appropriate for the account, review statement descriptor/refund policy, and monitor webhook failures.
- Replace test values with live Worker secrets and the live $2.99 Price ID, then run one live purchase and refund it from the Dashboard.

## Security limitation

The audit algorithm is shipped to the browser because privacy requires local processing. A determined visitor can modify downloaded JavaScript to bypass UI gating. The server securely enforces redemption of the paid flow, but no purely client-side product can make the algorithm itself secret or fully tamper-proof. Stronger enforcement would require moving the audit to a server, which would conflict with the requirement that Instagram files remain on-device.
