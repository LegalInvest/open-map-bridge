import { expect, it, vi } from 'vitest';
import { OpenMapBridgeClient, type DeveloperAppManifest, type DeveloperSourceDescriptor } from './index.js';

const manifest: DeveloperAppManifest = {
  schemaVersion: 1,
  id: 'org.example.history',
  name: 'History consumer',
  apiVersion: 'v1',
  requiredCapabilities: ['metadata', 'temporal-catalog', 'tiles'],
  permissions: ['read-source-metadata', 'read-temporal-catalog', 'read-tiles'],
};
const gatewayToken = 'd'.repeat(43);

const metadataOnly: DeveloperSourceDescriptor = {
  apiVersion: 'v1',
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  name: 'Imported Ovi-compatible source',
  providerKind: 'imported',
  protocol: 'ovi-template',
  projection: 'unknown',
  lifecycle: 'confirmed',
  accessStatus: 'metadata-only',
  capabilities: ['metadata'],
  datePrecision: null,
  attribution: null,
  license: null,
  links: { self: '/api/v1/developer/sources/018f4d39-32f1-7a31-9f60-81c6b453b886' },
};

it('rejects unavailable capabilities before fetch', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const client = new OpenMapBridgeClient({ manifest, fetcher });
  await expect(
    client.listDates(metadataOnly, { aoiId: 'area-1', from: '2006-01-01', to: '2025-12-31' }),
  ).rejects.toMatchObject({ code: 'capability-not-available' });
  expect(() => client.tileUrl(metadataOnly, { dateId: 'scene-2006', z: 8, x: 212, y: 102 })).toThrow(
    /capability-not-available/,
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('uses only V1 local gateway paths for ready sources', async () => {
  const ready = {
    ...metadataOnly,
    id: 'synthetic-lakes',
    providerKind: 'synthetic',
    protocol: 'temporal-adapter',
    lifecycle: 'ready',
    accessStatus: 'ready',
    capabilities: ['metadata', 'temporal-catalog', 'tiles'],
    datePrecision: 'capture-date',
    links: {
      self: '/api/v1/developer/sources/synthetic-lakes',
      dates: '/api/v1/developer/sources/synthetic-lakes/dates',
      tileTemplate: '/api/v1/developer/sources/synthetic-lakes/tiles/{dateId}/{z}/{x}/{y}',
    },
  } satisfies DeveloperSourceDescriptor;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: 'scene-2006',
          requestDate: '2006-07-15',
          captureDate: '2006-07-15',
          precision: 'capture-date',
          availability: 'available',
          provenance: 'synthetic contract fixture',
        },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
  const client = new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174/', manifest, gatewayToken, fetcher });
  const dates = await client.listDates(ready, { aoiId: 'area-1', from: '2006-01-01', to: '2025-12-31' });
  expect(dates[0]?.captureDate).toBe('2006-07-15');
  expect(fetcher).toHaveBeenCalledWith(
    'http://127.0.0.1:4174/api/v1/developer/sources/synthetic-lakes/dates?aoiId=area-1&from=2006-01-01&to=2025-12-31',
    expect.objectContaining({
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${gatewayToken}`,
        'x-omb-app-id': manifest.id,
      },
    }),
  );
  expect(client.tileUrl(ready, { dateId: 'scene-2006', z: 8, x: 212, y: 102 })).toBe(
    'http://127.0.0.1:4174/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/8/212/102',
  );
  fetcher.mockResolvedValueOnce(
    new Response(new ArrayBuffer(4), { status: 200, headers: { 'content-type': 'image/png' } }),
  );
  await expect(client.fetchTile(ready, { dateId: 'scene-2006', z: 8, x: 212, y: 102 })).resolves.toMatchObject({
    contentType: 'image/png',
    body: new Uint8Array(4),
  });
});

it('requires a separate gateway token for direct loopback access', () => {
  expect(() => new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest })).toThrow(
    /gateway-token-required/,
  );
  expect(() =>
    new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest, gatewayToken: 'short' }),
  ).toThrow(/invalid-gateway-token/);
});
