import { describe, expect, it } from 'vitest';
import { completeYearWindow, parseTemporalDateEntry, selectFourFrameDates } from './index.js';

function entry(year: number, availability: 'available' | 'unknown' | 'missing' | 'failed' = 'available') {
  return parseTemporalDateEntry({
    id: `scene-${year}`,
    requestDate: `${year}-06-30`,
    captureDate: availability === 'available' ? `${year}-06-15` : null,
    precision: availability === 'available' ? 'capture-date' : 'request-date-only',
    availability,
    provenance: 'four-frame-test',
  });
}

describe('generic four-frame policy', () => {
  it('uses the twenty complete calendar years before the current UTC year', () => {
    expect(completeYearWindow(2026)).toEqual({
      from: '2006-01-01',
      to: '2025-12-31',
      fromYear: 2006,
      toYear: 2025,
    });
    expect(() => completeYearWindow(2026.5)).toThrow(/integer/i);
  });

  it('selects four unique dates nearest evenly spaced anchors including both ends', () => {
    const selected = selectFourFrameDates(Array.from({ length: 20 }, (_, offset) => entry(2006 + offset)));
    expect(selected.map((item) => item.requestDate.slice(0, 4))).toEqual(['2006', '2012', '2019', '2025']);
    expect(new Set(selected.map((item) => item.id)).size).toBe(4);
  });

  it('keeps requestable unknown dates but excludes missing and failed dates', () => {
    const selected = selectFourFrameDates([
      entry(2006, 'available'),
      entry(2012, 'unknown'),
      entry(2019, 'missing'),
      entry(2020, 'unknown'),
      entry(2025, 'failed'),
    ]);
    expect(selected.map((item) => item.id)).toEqual(['scene-2006', 'scene-2012', 'scene-2020']);
  });

  it('returns the honest number of periods instead of duplicating frames', () => {
    const selected = selectFourFrameDates([entry(2010), entry(2020), entry(2020)]);
    expect(selected.map((item) => item.id)).toEqual(['scene-2010', 'scene-2020']);
  });
});
