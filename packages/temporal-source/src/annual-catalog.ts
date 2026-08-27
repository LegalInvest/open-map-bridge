import { parseTemporalDateEntry, type TemporalDateEntry } from './schema.js';

export function buildAnnualRequestCatalog(fromYear: number, toYear: number): TemporalDateEntry[] {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
    throw new TypeError('annual range years must be integers');
  }
  if (fromYear > toYear) throw new RangeError('from year must not be after to year');
  if (toYear - fromYear + 1 > 100) throw new RangeError('annual range cannot exceed 100 years');

  return Array.from({ length: toYear - fromYear + 1 }, (_, offset) => {
    const year = fromYear + offset;
    return parseTemporalDateEntry({
      id: `annual-${year}`,
      requestDate: `${year}-06-30`,
      captureDate: null,
      precision: 'request-date-only',
      availability: 'unknown',
      provenance: 'annual-request-catalog-v1',
    });
  });
}
