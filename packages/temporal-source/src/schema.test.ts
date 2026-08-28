import { expect, it } from 'vitest';
import { parseTemporalDateWindow, parseTemporalTileRequest } from './schema.js';

it('accepts actual ordered ISO dates and bounded temporal IDs', () => {
  expect(parseTemporalDateWindow({ aoiId: 'area-1', from: '2006-01-01', to: '2025-12-31' })).toEqual({
    aoiId: 'area-1',
    from: '2006-01-01',
    to: '2025-12-31',
  });
});

it.each([
  { aoiId: '', from: '2006-01-01', to: '2025-12-31' },
  { aoiId: ' area-1', from: '2006-01-01', to: '2025-12-31' },
  { aoiId: 'x'.repeat(161), from: '2006-01-01', to: '2025-12-31' },
  { aoiId: 'area-1', from: '2025-02-29', to: '2025-12-31' },
  { aoiId: 'area-1', from: '2025-12-31', to: '2006-01-01' },
  { aoiId: 'area-1', from: '2006-01-01', to: '2025-12-31', extra: true },
])('rejects an invalid temporal date window: %#', (input) => {
  expect(() => parseTemporalDateWindow(input)).toThrow();
});

it('parses canonical decimal path coordinates', () => {
  expect(parseTemporalTileRequest({ dateId: 'scene-2006', z: '8', x: '212', y: '102' })).toEqual({
    dateId: 'scene-2006',
    z: 8,
    x: 212,
    y: 102,
  });
});

it.each([
  { dateId: '', z: 8, x: 212, y: 102 },
  { dateId: ' scene-2006', z: 8, x: 212, y: 102 },
  { dateId: 'x'.repeat(161), z: 8, x: 212, y: 102 },
  { dateId: 'scene-2006', z: '01', x: '0', y: '0' },
  { dateId: 'scene-2006', z: '1e1', x: '0', y: '0' },
  { dateId: 'scene-2006', z: 31, x: 0, y: 0 },
  { dateId: 'scene-2006', z: 8, x: 256, y: 0 },
  { dateId: 'scene-2006', z: 8, x: 0, y: 256 },
  { dateId: 'scene-2006', z: 8, x: 1.5, y: 0 },
  { dateId: 'scene-2006', z: 8, x: 0, y: 0, extra: true },
])('rejects an invalid temporal tile request: %#', (input) => {
  expect(() => parseTemporalTileRequest(input)).toThrow();
});
