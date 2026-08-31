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
const mapManifest: DeveloperAppManifest = {
  schemaVersion: 1,
  id: 'org.example.map',
  name: 'Map consumer',
  apiVersion: 'v1',
  requiredCapabilities: ['metadata', 'map-tiles'],
  permissions: ['read-source-metadata', 'read-map-tiles'],
};

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

const readyMap = {
  ...metadataOnly,
  lifecycle: 'probed',
  accessStatus: 'ready',
  capabilities: ['metadata', 'map-tiles'],
  links: {
    self: metadataOnly.links.self,
    mapTileTemplate:
      '/api/v1/developer/sources/018f4d39-32f1-7a31-9f60-81c6b453b886/map-tiles/{z}/{x}/{y}',
  },
} satisfies DeveloperSourceDescriptor;

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

it('rejects invalid temporal inputs before fetch', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const client = new OpenMapBridgeClient({ manifest, fetcher });

  for (const { input, code } of [
    { input: { aoiId: ' area-1', from: '2006-01-01', to: '2025-12-31' }, code: 'invalid-aoi-id' },
    { input: { aoiId: 'area-1', from: '2025-02-29', to: '2025-12-31' }, code: 'invalid-date-window' },
    { input: { aoiId: 'area-1', from: '2025-12-31', to: '2006-01-01' }, code: 'invalid-date-window' },
  ]) {
    await expect(client.listDates(ready, input)).rejects.toMatchObject({ code });
  }
  for (const { input, code } of [
    { input: { dateId: 'x'.repeat(161), z: 8, x: 212, y: 102 }, code: 'invalid-date-id' },
    { input: { dateId: 'scene-2006', z: 31, x: 0, y: 0 }, code: 'invalid-coordinate' },
    { input: { dateId: 'scene-2006', z: 8, x: 256, y: 0 }, code: 'invalid-coordinate' },
    { input: { dateId: 'scene-2006', z: 8, x: 1.5, y: 0 }, code: 'invalid-coordinate' },
  ]) {
    try {
      client.tileUrl(ready, input);
      throw new Error('expected tileUrl to reject invalid input');
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it('builds and fetches a non-temporal map tile only with the explicit map capability', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(new ArrayBuffer(4), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
  );
  const client = new OpenMapBridgeClient({ manifest: mapManifest, fetcher });
  expect(client.mapTileUrl(readyMap, { z: 8, x: 212, y: 102 })).toBe(
    '/api/v1/developer/sources/018f4d39-32f1-7a31-9f60-81c6b453b886/map-tiles/8/212/102',
  );
  await expect(client.fetchMapTile(readyMap, { z: 8, x: 212, y: 102 })).resolves.toMatchObject({
    contentType: 'image/jpeg',
    body: new Uint8Array(4),
  });
  expect(() => client.mapTileUrl(metadataOnly, { z: 8, x: 212, y: 102 })).toThrow(
    /capability-not-available/,
  );
  expect(() => client.mapTileUrl(readyMap, { z: 31, x: 0, y: 0 })).toThrow(/invalid-coordinate/);
});

it('requires a separate gateway token for direct loopback access', () => {
  expect(() => new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest })).toThrow(
    /gateway-token-required/,
  );
  expect(() =>
    new OpenMapBridgeClient({ baseUrl: 'http://127.0.0.1:4174', manifest, gatewayToken: 'short' }),
  ).toThrow(/invalid-gateway-token/);
});
