import { describe, expect, it } from 'vitest';
import { getPendingCheckout } from './payments.js';

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
