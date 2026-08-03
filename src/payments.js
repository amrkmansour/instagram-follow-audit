const CHECKOUT_KEY = 'followcheck-checkout';

const apiUrl = (path) => {
  const origin = String(import.meta.env.VITE_PAYMENTS_API_URL || '').replace(/\/$/, '');
  if (!origin) throw new Error('Payments are not configured yet.');
  return `${origin}${path}`;
};

export function captureCheckoutReturn(locationLike = window.location, storage = sessionStorage) {
  const params = new URLSearchParams(locationLike.search);
  const sessionId = params.get('session_id');
  const claimSecret = params.get('claim');
  if (params.get('checkout') !== 'success' || !sessionId || !claimSecret) return null;

  const checkout = { sessionId, claimSecret };
  storage.setItem(CHECKOUT_KEY, JSON.stringify(checkout));
  params.delete('checkout');
  params.delete('session_id');
  params.delete('claim');
  const cleanUrl = `${locationLike.pathname}${params.size ? `?${params}` : ''}${locationLike.hash}`;
  window.history.replaceState({}, '', cleanUrl);
  return checkout;
}

export function getPendingCheckout(storage = sessionStorage) {
  try {
    const value = JSON.parse(storage.getItem(CHECKOUT_KEY) || 'null');
    return typeof value?.sessionId === 'string' && typeof value?.claimSecret === 'string' ? value : null;
  } catch {
    return null;
  }
}

export async function startCheckout(fetchImpl = fetch) {
  const response = await fetchImpl(apiUrl('/api/checkout-session'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.url) throw new Error(body.error || 'Could not start secure checkout.');
  window.location.assign(body.url);
}

export async function redeemAudit(checkout, fetchImpl = fetch, storage = sessionStorage) {
  if (!checkout) throw new Error('Pay $1.99 to run this audit.');
  const response = await fetchImpl(apiUrl('/api/redeem'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(checkout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.redeemed !== true) throw new Error(body.error || 'Payment could not be verified.');
  storage.removeItem(CHECKOUT_KEY);
}
