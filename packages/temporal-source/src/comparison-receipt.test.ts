import { describe, expect, it } from 'vitest';
import { parseComparisonReceipt, parseCreateComparisonReceipt } from './comparison-receipt.js';

const frame = (dateId: string) => ({
  dateId,
  status: 'loaded' as const,
  expectedTileCount: 6,
  loadedTileCount: 6,
  failedTileCount: 0,
});

const input = {
  schemaVersion: 1 as const,
  sourceId: 'synthetic-lakes',
  aoiId: 'area-1',
  aoiVersion: 1,
  dateIds: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2025'],
  viewState: { center: [13_270_000, 3_890_000] as [number, number], zoom: 9, rotation: 0, projection: 'EPSG:3857' as const },
  frames: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2025'].map(frame),
};

describe('comparison receipt schema', () => {
  it('accepts exactly four ordered, terminal frame facts', () => {
    expect(parseCreateComparisonReceipt(input)).toEqual(input);
    expect(parseComparisonReceipt({ ...input, id: 'comparison-1', createdAt: '2026-09-01T00:00:00.000Z' }))
      .toMatchObject({ id: 'comparison-1', schemaVersion: 1 });
  });

  it.each([
    { ...input, dateIds: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2019'] },
    { ...input, frames: [frame('scene-2011'), ...input.frames.slice(1)] },
    { ...input, frames: [{ ...frame('scene-2006'), status: 'loaded', loadedTileCount: 5, failedTileCount: 1 }, ...input.frames.slice(1)] },
    { ...input, frames: [{ dateId: 'scene-2006', status: 'missing', expectedTileCount: 1, loadedTileCount: 0, failedTileCount: 1 }, ...input.frames.slice(1)] },
    { ...input, extra: true },
  ])('rejects ambiguous or internally inconsistent receipts', (candidate) => {
    expect(() => parseCreateComparisonReceipt(candidate)).toThrow();
  });
});
