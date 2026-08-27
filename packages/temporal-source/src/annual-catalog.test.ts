import { describe, expect, it } from 'vitest';
import { buildAnnualRequestCatalog, parseTemporalDateEntry } from './index.js';

describe('temporal date truth', () => {
  it('builds exactly 2006–2025 as request-date-only without inventing capture dates', () => {
    const dates = buildAnnualRequestCatalog(2006, 2025);
    expect(dates).toHaveLength(20);
    expect(dates[0]).toMatchObject({
      requestDate: '2006-06-30',
      captureDate: null,
      precision: 'request-date-only',
      availability: 'unknown',
    });
    expect(dates[19]).toMatchObject({
      requestDate: '2025-06-30',
      captureDate: null,
      precision: 'request-date-only',
    });
  });

  it('preserves a real capture date independently', () => {
    expect(
      parseTemporalDateEntry({
        id: 'scene-2018-07-13',
        requestDate: '2018-07-15',
        captureDate: '2018-07-13',
        precision: 'capture-date',
        availability: 'available',
        provenance: 'fixture',
      }).captureDate,
    ).toBe('2018-07-13');
  });

  it('rejects reversed and unbounded annual ranges', () => {
    expect(() => buildAnnualRequestCatalog(2025, 2006)).toThrow(/after/i);
    expect(() => buildAnnualRequestCatalog(1900, 2025)).toThrow(/100 years/i);
  });
});
