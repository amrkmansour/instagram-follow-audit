const CHECKOUT_KEY = 'followcheck-checkout';
const PASSWORD_ACCESS_KEY = 'followcheck-password-access';

const configuredApiOrigins = () => [...new Set([
  import.meta.env.VITE_PAYMENTS_API_URL,
  import.meta.env.VITE_PAYMENTS_API_FALLBACK_URL,
].map((value) => String(value || '').replace(/\/$/, '')).filter(Boolean))];

export async function fetchPaymentApi(path, options, fetchImpl = fetch, origins = configuredApiOrigins()) {
  if (!origins.length) throw new Error('Payments are not configured yet.');
  let networkError;
  for (const origin of origins) {
    try {
      return await fetchImpl(`${origin}${path}`, options);
    } catch (error) {
      networkError = error;
    }
  }
  throw networkError || new Error('Payment service unavailable.');
}

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

export function hasPasswordAccess(storage = sessionStorage) {
  return storage.getItem(PASSWORD_ACCESS_KEY) === 'granted';
}

export async function unlockWithPassword(password, fetchImpl = fetch, storage = sessionStorage) {
  const response = await fetchPaymentApi('/api/password-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }, fetchImpl);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.unlocked !== true) throw new Error(body.error || 'Incorrect access password.');
  storage.setItem(PASSWORD_ACCESS_KEY, 'granted');
}

export async function startCheckout(fetchImpl = fetch) {
  let response;
  try {
    response = await fetchPaymentApi('/api/checkout-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }, fetchImpl);
  } catch {
    throw new Error('Could not connect to secure checkout. Check your connection or content-blocking settings and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.url) throw new Error(body.error || 'Could not start secure checkout.');
  window.location.assign(body.url);
}

export async function redeemAudit(checkout, fetchImpl = fetch, storage = sessionStorage) {
  if (!checkout) throw new Error('Pay $2.99 to run this audit.');
  const response = await fetchPaymentApi('/api/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(checkout),
  }, fetchImpl);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.redeemed !== true) throw new Error(body.error || 'Payment could not be verified.');
  storage.removeItem(CHECKOUT_KEY);
}
