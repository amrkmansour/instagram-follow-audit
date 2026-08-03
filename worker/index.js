import Stripe from 'stripe';

const encoder = new TextEncoder();

function json(body, status = 200, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'vary': 'Origin',
      'cache-control': 'no-store',
    },
  });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function allowedOrigin(request, env) {
  return request.headers.get('origin') === env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : '';
}

function stripeClient(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export class EntitlementGate {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const event = await request.json();
    if (event.action === 'paid') {
      await this.state.storage.put('paid', true);
      return json({ recorded: true });
    }
    if (event.action !== 'redeem') return json({ error: 'Invalid action.' }, 400);
    return this.state.storage.transaction(async (storage) => {
      if (await storage.get('redeemed')) return json({ error: 'This audit has already been used.' }, 409);
      await storage.put('redeemed', new Date().toISOString());
      return json({ redeemed: true });
    });
  }
}

async function createCheckout(request, env, origin) {
  if (!origin) return json({ error: 'Origin not allowed.' }, 403, env.ALLOWED_ORIGIN);
  const claimSecret = randomSecret();
  const claimHash = await sha256(claimSecret);
  const stripe = stripeClient(env);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}&claim=${encodeURIComponent(claimSecret)}`,
    cancel_url: `${env.APP_URL}/?checkout=cancelled#payment-title`,
    metadata: { product: 'instagram_follow_audit', claim_hash: claimHash },
  });
  return json({ url: session.url }, 200, origin);
}

async function redeem(request, env, origin) {
  if (!origin) return json({ error: 'Origin not allowed.' }, 403, env.ALLOWED_ORIGIN);
  const { sessionId, claimSecret } = await request.json();
  if (!/^cs_(test_|live_)/.test(sessionId || '') || typeof claimSecret !== 'string' || claimSecret.length < 32) {
    return json({ error: 'Invalid payment proof.' }, 400, origin);
  }
  const stripe = stripeClient(env);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const validClaim = session.metadata?.claim_hash === await sha256(claimSecret);
  const validPurchase = session.payment_status === 'paid'
    && session.mode === 'payment'
    && session.metadata?.product === 'instagram_follow_audit'
    && session.amount_total === 199
    && session.currency === 'usd';
  if (!validClaim || !validPurchase) return json({ error: 'Payment could not be verified.' }, 402, origin);

  const gate = env.ENTITLEMENT_GATE.get(env.ENTITLEMENT_GATE.idFromName(session.id));
  const response = await gate.fetch('https://entitlement.internal/', {
    method: 'POST',
    body: JSON.stringify({ action: 'redeem' }),
  });
  return json(await response.json(), response.status, origin);
}

async function webhook(request, env) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature.' }, 400);
  const rawBody = await request.text();
  let event;
  try {
    event = await stripeClient(env).webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return json({ error: 'Invalid Stripe signature.' }, 400);
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.metadata?.product === 'instagram_follow_audit' && session.payment_status === 'paid') {
      const gate = env.ENTITLEMENT_GATE.get(env.ENTITLEMENT_GATE.idFromName(session.id));
      await gate.fetch('https://entitlement.internal/', { method: 'POST', body: JSON.stringify({ action: 'paid' }) });
    }
  }
  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS' && origin) {
      return new Response(null, { status: 204, headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'vary': 'Origin',
      } });
    }
    if (request.method === 'OPTIONS') return json({ error: 'Origin not allowed.' }, 403, env.ALLOWED_ORIGIN);
    try {
      if (request.method === 'POST' && url.pathname === '/api/checkout-session') return await createCheckout(request, env, origin);
      if (request.method === 'POST' && url.pathname === '/api/redeem') return await redeem(request, env, origin);
      if (request.method === 'POST' && url.pathname === '/api/webhook') return await webhook(request, env);
      return json({ error: 'Not found.' }, 404, origin);
    } catch (error) {
      console.error('Payment API error', error instanceof Error ? error.message : error);
      return json({ error: 'Payment service unavailable.' }, 500, origin || env.ALLOWED_ORIGIN);
    }
  },
};
