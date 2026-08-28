import { afterEach, describe, expect, it, vi } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { OVMAP_FILE_MAX_BYTES, OVMAP_INSPECT_BODY_MAX_BYTES } from '@omb/source-schema';
import { createApiClient } from './client.js';

afterEach(() => vi.unstubAllGlobals());

describe('history API client', () => {
  it('requests the twenty complete years before the injected current year', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await createApiClient('', 2030).listDates('source-1', 'area-1');
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      '/api/temporal/sources/source-1/dates?aoiId=area-1&from=2010-01-01&to=2029-12-31',
    );
  });

  it('creates an AOI with only its user-owned name and geometry', async () => {
    const created = { ...lakeAoiPresets[0], id: 'area-server', name: '实验区域', status: 'confirmed' };
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const geometry = lakeAoiPresets[0]?.geometry;
    if (!geometry) throw new Error('missing geometry fixture');
    await createApiClient('', 2026).createAoi({ name: '实验区域', geometry });
    const request = fetchSpy.mock.calls[0];
    expect(request?.[0]).toBe('/api/aois');
    expect(request?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ name: '实验区域', geometry });
  });
});

it('starts source readiness with only the selected source id', async () => {
  const body = { run: {}, created: true };
  const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 201, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchSpy);
  await createApiClient('', 2026).startSourceReadiness('source-1');
  expect(fetchSpy).toHaveBeenCalledWith('/api/v1/processes/source-readiness/execution', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ sourceId: 'source-1' }),
  }));
});

it('sends an exactly 1 MiB ovmap in the bounded base64 envelope without a redundant filename', async () => {
  const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
    new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchSpy);
  const file = {
    name: 'boundary.ovmap',
    size: OVMAP_FILE_MAX_BYTES,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(OVMAP_FILE_MAX_BYTES)),
  } as unknown as File;
  await createApiClient('', 2026).inspectOvmap(file);
  const request = fetchSpy.mock.calls[0];
  expect(request?.[0]).toBe('/api/import/inspect/ovmap');
  const body = String(request?.[1]?.body);
  expect(Object.keys(JSON.parse(body))).toEqual(['bytesBase64']);
  expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(OVMAP_INSPECT_BODY_MAX_BYTES);
});

it('rejects an ovmap over 1 MiB before reading or fetching it', async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  const arrayBuffer = vi.fn();
  const file = { name: 'too-large.ovmap', size: OVMAP_FILE_MAX_BYTES + 1, arrayBuffer } as unknown as File;
  await expect(createApiClient('', 2026).inspectOvmap(file)).rejects.toThrow('不能超过 1 MiB');
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
});
