import { describe, expect, it } from 'vitest';
import { parseAreaOfInterest } from '@omb/aois';
import { aoiBounds4326, aoiExtent3857 } from './aoi-view.js';

const arbitraryArea = parseAreaOfInterest({
  id: 'not-a-lake-preset',
  version: 1,
  name: '实验区域',
  crs: 'EPSG:4326',
  status: 'confirmed',
  provenance: 'test',
  confirmedAt: '2026-08-27T12:00:00.000Z',
  geometry: {
    type: 'Polygon',
    coordinates: [[[118.5, 31.2], [119.4, 31.2], [119.4, 32.1], [118.5, 32.1], [118.5, 31.2]]],
  },
});

describe('AOI driven map view', () => {
  it('derives exact geographic bounds from arbitrary geometry instead of its ID', () => {
    expect(aoiBounds4326(arbitraryArea)).toEqual([118.5, 31.2, 119.4, 32.1]);
  });

  it('projects arbitrary bounds into a finite increasing web mercator extent', () => {
    const extent = aoiExtent3857(arbitraryArea);
    expect(extent.every(Number.isFinite)).toBe(true);
    expect(extent[0]).toBeLessThan(extent[2]);
    expect(extent[1]).toBeLessThan(extent[3]);
  });
});
