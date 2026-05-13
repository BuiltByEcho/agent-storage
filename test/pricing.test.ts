import { describe, expect, it } from 'vitest';
import { calculatePaymentAmount, calculateRetrievalCost, calculateStorageCost, calculateWriteCost } from '../src/pricing.ts';

describe('tier pricing', () => {
  const halfGb = 512 * 1024 * 1024;
  const twoMb = 2 * 1024 * 1024;

  it('charges more for private writes than open writes', () => {
    expect(calculateWriteCost(halfGb, 'private')).toBeGreaterThan(calculateWriteCost(halfGb, 'open'));
    expect(calculatePaymentAmount('write', halfGb, 'private')).toBeGreaterThan(
      calculatePaymentAmount('write', halfGb, 'open')
    );
  });

  it('charges more for private storage than open storage', () => {
    expect(calculateStorageCost(halfGb, 1, 'private')).toBeGreaterThan(calculateStorageCost(halfGb, 1, 'open'));
    expect(calculatePaymentAmount('storage', halfGb, 'private')).toBeGreaterThan(
      calculatePaymentAmount('storage', halfGb, 'open')
    );
  });

  it('charges more for private retrieval than open retrieval above free threshold', () => {
    expect(calculateRetrievalCost(twoMb, 'private')).toBeGreaterThan(calculateRetrievalCost(twoMb, 'open'));
    expect(calculatePaymentAmount('read', twoMb, 'private')).toBeGreaterThan(
      calculatePaymentAmount('read', twoMb, 'open')
    );
  });
});
