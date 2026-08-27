import { expect, it } from 'vitest';
import { normalizeViewState } from './index.js';

it('normalizes finite Web Mercator state and rejects NaN', () => {
  expect(
    normalizeViewState({
      center: [13_270_000, 3_890_000],
      zoom: 10,
      rotation: 0,
      projection: 'EPSG:3857',
    }),
  ).toEqual({
    center: [13_270_000, 3_890_000],
    zoom: 10,
    rotation: 0,
    projection: 'EPSG:3857',
  });

  expect(() =>
    normalizeViewState({ center: [Number.NaN, 0], zoom: 10, rotation: 0, projection: 'EPSG:3857' }),
  ).toThrow(/finite/i);
});
