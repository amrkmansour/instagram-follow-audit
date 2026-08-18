import { describe, expect, it } from 'vitest';
import { fetchPaymentApi, getPendingCheckout } from './payments.js';

function storageWith(value) {
  return { getItem: () => value };
}

describe('getPendingCheckout', () => {
  it('returns a complete browser-local payment proof', () => {
    expect(getPendingCheckout(storageWith(JSON.stringify({ sessionId: 'cs_test_123', claimSecret: 'secret' })))).toEqual({
      sessionId: 'cs_test_123',
      claimSecret: 'secret',
    });
  });

  it('rejects malformed or incomplete stored values', () => {
    expect(getPendingCheckout(storageWith('{bad json'))).toBeNull();
    expect(getPendingCheckout(storageWith(JSON.stringify({ sessionId: 'cs_test_123' })))).toBeNull();
  });
});

describe('fetchPaymentApi', () => {
  it('retries the fallback origin after a primary network failure', async () => {
    const calls = [];
    const response = { ok: true };
    const fetchImpl = async (url) => {
      calls.push(url);
      if (calls.length === 1) throw new TypeError('Load failed');
      return response;
    };

    await expect(fetchPaymentApi('/api/checkout-session', { method: 'POST' }, fetchImpl, [
      'https://api.follow-check.com',
      'https://fallback.example',
    ])).resolves.toBe(response);
    expect(calls).toEqual([
      'https://api.follow-check.com/api/checkout-session',
      'https://fallback.example/api/checkout-session',
    ]);
  });
});
