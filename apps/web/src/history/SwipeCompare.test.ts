import { expect, it } from 'vitest';
import { clampSwipePercentage } from './SwipeCompare.js';

it('clamps swipe position to the visible canvas', () => {
  expect(clampSwipePercentage(-20)).toBe(0);
  expect(clampSwipePercentage(43.5)).toBe(43.5);
  expect(clampSwipePercentage(120)).toBe(100);
});
