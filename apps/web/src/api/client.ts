import type { AoiGeometry, AreaOfInterest } from '@omb/aois';
import { completeYearWindow, type TemporalDateEntry } from '@omb/temporal-source';
import type { AutomationRun, ImportPreview, ImportReceipt, MapSourceDefinition } from '@omb/source-schema';

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
  createAoi(input: { name: string; geometry: AoiGeometry }): Promise<AreaOfInterest>;
  confirmAoi(aoi: AreaOfInterest): Promise<AreaOfInterest>;
}

export interface ImportApi {
  inspectQr(payload: string): Promise<ImportPreview>;
  inspectOvmap(file: File): Promise<ImportPreview>;
  confirmImport(previewId: string, candidateIds: string[], authorized: boolean): Promise<{
    sources: MapSourceDefinition[];
    receipt: ImportReceipt;
  }>;
  listImportSources(): Promise<MapSourceDefinition[]>;
}

export interface AutomationApi {
  listAutomationRuns(): Promise<AutomationRun[]>;
  startSourceReadiness(sourceId: string): Promise<{ run: AutomationRun; created: boolean }>;
}

export type OpenMapBridgeApi = HistoryApi & ImportApi & AutomationApi;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string | { message?: string }; message?: string } | null;
    const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
    throw new Error(message ?? body?.message ?? `request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 16_384));
  }
  return btoa(binary);
}

export function createApiClient(baseUrl = '', currentYear = new Date().getUTCFullYear()): OpenMapBridgeApi {
  const yearWindow = completeYearWindow(currentYear);
  return {
    async listSources() {
      return readJson<TemporalSourceSummary[]>(await fetch(`${baseUrl}/api/temporal/sources`));
    },
    async listAois() {
      return readJson<AreaOfInterest[]>(await fetch(`${baseUrl}/api/aois`));
    },
    async listDates(sourceId, aoiId) {
      const query = new URLSearchParams({ aoiId, from: yearWindow.from, to: yearWindow.to });
      return readJson<TemporalDateEntry[]>(
        await fetch(`${baseUrl}/api/temporal/sources/${encodeURIComponent(sourceId)}/dates?${query}`),
      );
    },
    async createAoi(input) {
      return readJson<AreaOfInterest>(
        await fetch(`${baseUrl}/api/aois`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }),
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
    async inspectQr(payload) {
      return readJson<ImportPreview>(
        await fetch(`${baseUrl}/api/import/inspect/qr`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payload }),
        }),
      );
    },
    async inspectOvmap(file) {
      if (file.size > 1_048_576) throw new Error('.ovmap 文件不能超过 1 MiB');
      return readJson<ImportPreview>(
        await fetch(`${baseUrl}/api/import/inspect/ovmap`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, bytesBase64: arrayBufferToBase64(await file.arrayBuffer()) }),
        }),
      );
    },
    async confirmImport(previewId, candidateIds, authorized) {
      return readJson<{ sources: MapSourceDefinition[]; receipt: ImportReceipt }>(
        await fetch(`${baseUrl}/api/import/confirm`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ previewId, candidateIds, authorized }),
        }),
      );
    },
    async listImportSources() {
      return readJson<MapSourceDefinition[]>(await fetch(`${baseUrl}/api/import/sources`));
    },
    async listAutomationRuns() {
      return readJson<AutomationRun[]>(await fetch(`${baseUrl}/api/v1/jobs`));
    },
    async startSourceReadiness(sourceId) {
      return readJson<{ run: AutomationRun; created: boolean }>(
        await fetch(`${baseUrl}/api/v1/processes/source-readiness/execution`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId }),
        }),
      );
    },
  };
}
