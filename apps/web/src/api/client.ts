import type { AreaOfInterest } from '@omb/aois';
import type { TemporalDateEntry } from '@omb/temporal-source';

export interface TemporalSourceSummary {
  id: string;
  name: string;
  kind: 'synthetic' | 'ovi-bridge';
  datePrecision: 'capture-date' | 'request-date-only';
}

export interface HistoryApi {
  listSources(): Promise<TemporalSourceSummary[]>;
  listAois(): Promise<AreaOfInterest[]>;
  listDates(sourceId: string, aoiId: string): Promise<TemporalDateEntry[]>;
  confirmAoi(aoi: AreaOfInterest): Promise<AreaOfInterest>;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed with ${response.status}`);
  return (await response.json()) as T;
}

export function createApiClient(baseUrl = ''): HistoryApi {
  return {
    async listSources() {
      return readJson<TemporalSourceSummary[]>(await fetch(`${baseUrl}/api/temporal/sources`));
    },
    async listAois() {
      return readJson<AreaOfInterest[]>(await fetch(`${baseUrl}/api/aois`));
    },
    async listDates(sourceId, aoiId) {
      const query = new URLSearchParams({ aoiId, from: '2006-01-01', to: '2025-12-31' });
      return readJson<TemporalDateEntry[]>(
        await fetch(`${baseUrl}/api/temporal/sources/${encodeURIComponent(sourceId)}/dates?${query}`),
      );
    },
    async confirmAoi(aoi) {
      return readJson<AreaOfInterest>(
        await fetch(`${baseUrl}/api/aois/${encodeURIComponent(aoi.id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ geometry: aoi.geometry }),
        }),
      );
    },
  };
}
