import { expect, it } from 'vitest';
import { createConfirmedAoi, createNextAoiVersion, parseAreaOfInterest } from './index.js';
import { lakeAoiPresets } from './presets.js';

it('rejects an unclosed polygon before it can become an AOI', () => {
  expect(() =>
    parseAreaOfInterest({
      id: 'baoying-lake',
      version: 1,
      name: '宝应湖',
      status: 'approximate',
      crs: 'EPSG:4326',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.1, 33.0],
            [119.4, 33.0],
            [119.4, 33.3],
            [119.1, 33.3],
          ],
        ],
      },
      provenance: 'user-screenshot-2026-08-27',
      confirmedAt: null,
    }),
  ).toThrow(/closed/i);
});

it('creates a confirmed version without mutating the approximate source', () => {
  const source = lakeAoiPresets[0];
  if (!source) throw new Error('missing baoying preset');
  const next = createNextAoiVersion(source, source.geometry, '2026-08-27T12:00:00.000Z');
  expect(next).toMatchObject({
    id: 'baoying-lake',
    version: 2,
    status: 'confirmed',
    confirmedAt: '2026-08-27T12:00:00.000Z',
  });
  expect(source).toMatchObject({ version: 1, status: 'approximate', confirmedAt: null });
});

it('rejects invalid coordinates and excessive vertices', () => {
  const source = lakeAoiPresets[0];
  if (!source) throw new Error('missing baoying preset');
  expect(() =>
    parseAreaOfInterest({
      ...source,
      geometry: { type: 'Polygon', coordinates: [[[-181, 33], [119, 33], [119, 34], [-181, 33]]] },
    }),
  ).toThrow(/longitude/i);

  const ring = Array.from({ length: 2_001 }, (_, index) => [119 + index / 100_000, 33] as [number, number]);
  ring.push(ring[0] as [number, number]);
  expect(() =>
    parseAreaOfInterest({ ...source, geometry: { type: 'Polygon', coordinates: [ring] } }),
  ).toThrow(/2,000/i);
});

it('rejects a self-intersecting bow-tie polygon', () => {
  const source = lakeAoiPresets[0];
  if (!source) throw new Error('missing baoying preset');
  expect(() =>
    parseAreaOfInterest({
      ...source,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.1, 33.0],
            [119.4, 33.3],
            [119.4, 33.0],
            [119.1, 33.3],
            [119.1, 33.0],
          ],
        ],
      },
    }),
  ).toThrow(/self-intersect/i);
});

it('creates a server-owned confirmed version one for a newly drawn area', () => {
  const geometry = lakeAoiPresets[0]?.geometry;
  if (!geometry) throw new Error('missing geometry fixture');
  expect(
    createConfirmedAoi({
      id: 'area-test',
      name: '实验区域',
      geometry,
      provenance: 'user-drawn-web',
      confirmedAt: '2026-08-27T12:00:00.000Z',
    }),
  ).toMatchObject({
    id: 'area-test',
    name: '实验区域',
    version: 1,
    status: 'confirmed',
    confirmedAt: '2026-08-27T12:00:00.000Z',
  });
});
