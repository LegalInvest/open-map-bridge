import type { TemporalDateEntry } from './schema.js';

export interface CompleteYearWindow {
  from: string;
  to: string;
  fromYear: number;
  toYear: number;
}

export function completeYearWindow(currentYear: number): CompleteYearWindow {
  if (!Number.isInteger(currentYear)) throw new TypeError('current year must be an integer');
  const toYear = currentYear - 1;
  const fromYear = toYear - 19;
  return {
    from: `${fromYear}-01-01`,
    to: `${toYear}-12-31`,
    fromYear,
    toYear,
  };
}

function entryYear(entry: TemporalDateEntry): number {
  return Number(entry.requestDate.slice(0, 4));
}

export function selectFourFrameDates(entries: readonly TemporalDateEntry[]): TemporalDateEntry[] {
  const byId = new Map<string, TemporalDateEntry>();
  for (const entry of entries) {
    if ((entry.availability === 'available' || entry.availability === 'unknown') && !byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  const eligible = [...byId.values()].sort((left, right) => left.requestDate.localeCompare(right.requestDate));
  if (eligible.length <= 4) return eligible;

  const firstYear = entryYear(eligible[0] as TemporalDateEntry);
  const lastYear = entryYear(eligible.at(-1) as TemporalDateEntry);
  const anchors = Array.from({ length: 4 }, (_, index) => Math.round(firstYear + ((lastYear - firstYear) * index) / 3));
  const remaining = [...eligible];
  const selected: TemporalDateEntry[] = [];
  for (const anchor of anchors) {
    remaining.sort((left, right) => {
      const distance = Math.abs(entryYear(left) - anchor) - Math.abs(entryYear(right) - anchor);
      if (distance !== 0) return distance;
      const availability = Number(left.availability !== 'available') - Number(right.availability !== 'available');
      return availability || left.requestDate.localeCompare(right.requestDate);
    });
    const next = remaining.shift();
    if (next) selected.push(next);
  }
  return selected.sort((left, right) => left.requestDate.localeCompare(right.requestDate));
}
