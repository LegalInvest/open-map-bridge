import { expect, it } from 'vitest';
import { transitionSource } from './index.js';

it('allows parsed to confirmed but rejects parsed to saved', () => {
  expect(transitionSource('parsed', 'confirmed')).toBe('confirmed');
  expect(() => transitionSource('parsed', 'saved')).toThrow(/invalid source transition/i);
});

it('allows an explicit retry after a failed probe', () => {
  expect(transitionSource('probe-failed', 'confirmed')).toBe('confirmed');
});
