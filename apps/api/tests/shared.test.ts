import { describe, expect, it } from 'vitest';
import { formatIDR } from '@juragan/shared';

describe('formatIDR', () => {
  it('formats thousands with dot separators', () => {
    expect(formatIDR(1500000)).toBe('Rp 1.500.000');
    expect(formatIDR(75000)).toBe('Rp 75.000');
    expect(formatIDR(500)).toBe('Rp 500');
  });

  it('handles zero', () => {
    expect(formatIDR(0)).toBe('Rp 0');
  });

  it('handles negatives with leading minus', () => {
    expect(formatIDR(-250000)).toBe('-Rp 250.000');
  });
});
