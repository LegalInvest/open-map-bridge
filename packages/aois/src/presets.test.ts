import { expect, it } from 'vitest';
import { lakeAoiPresets } from './presets.js';

it('ships two separate screenshot-derived approximate navigation presets', () => {
  expect(lakeAoiPresets.map((aoi) => aoi.id)).toEqual(['baoying-lake', 'gaoyou-lake']);
  expect(lakeAoiPresets.every((aoi) => aoi.status === 'approximate' && aoi.version === 1)).toBe(true);
  expect(lakeAoiPresets.every((aoi) => aoi.provenance === 'user-screenshot-2026-08-27')).toBe(true);
  expect(lakeAoiPresets[0]?.geometry).not.toEqual(lakeAoiPresets[1]?.geometry);
});
