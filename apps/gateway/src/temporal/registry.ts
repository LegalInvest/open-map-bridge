import type { TemporalSourceAdapter } from '@omb/temporal-source';

export interface TemporalSourceRecord {
  id: string;
  name: string;
  kind: 'synthetic' | 'ovi-bridge';
  availability: 'configured' | 'ready';
  datePrecision: 'capture-date' | 'request-date-only';
  adapter: TemporalSourceAdapter;
}

export class TemporalSourceRegistry {
  private readonly records = new Map<string, TemporalSourceRecord>();

  register(record: TemporalSourceRecord): void {
    if (this.records.has(record.id)) throw new Error(`duplicate temporal source ${record.id}`);
    this.records.set(record.id, record);
  }

  get(id: string): TemporalSourceRecord | null {
    return this.records.get(id) ?? null;
  }

  list(): TemporalSourceRecord[] {
    return [...this.records.values()];
  }
}
