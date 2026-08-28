import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { buildTestApp as buildApp } from '../test-app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

async function confirmImportedSource(
  app: Awaited<ReturnType<typeof buildApp>>,
  path = '/private/{$z}/{$x}/{$y}.png',
) {
  const inspect = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    payload: {
      payload:
        `ovobj?t=1&id=402&na=Private%20Fixture&po=1&he=18&oy=3&df=0&hn=upstream-secret.example.invalid&ul=${encodeURIComponent(path)}`,
    },
  });
  const preview = inspect.json();
  const confirmed = await app.inject({
    method: 'POST',
    url: '/api/import/confirm',
    payload: { previewId: preview.previewId, candidateIds: [preview.layers[0].candidateId], authorized: true },
  });
  return confirmed.json().sources[0].id as string;
}

it('binds an opaque Ovi import to its persisted UUID while keeping configured runtime out of temporal use', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-ovi-binding-'));
  const dataPath = join(directory, 'state.json');
  const importing = await buildApp({ dataPath });
  const importedId = await confirmImportedSource(importing, 'opaque-private-template');
  const sameLegacyId = await confirmImportedSource(importing, 'second-opaque-private-template');
  await importing.close();

  await expect(
    buildApp({
      dataPath,
      ovi: {
        baseUrl: 'http://127.0.0.1:54321',
        mapType: 402,
        sourceId: '018f4d39-32f1-7a31-9f60-81c6b453b886',
      },
    }),
  ).rejects.toThrow(/not found/);
  await expect(
    buildApp({
      dataPath,
      ovi: { baseUrl: 'http://127.0.0.1:54321', mapType: 999, sourceId: importedId },
    }),
  ).rejects.toThrow(/map type/);

  const app = await buildApp({
    dataPath,
    ovi: { baseUrl: 'http://127.0.0.1:54321', mapType: 402, sourceId: importedId },
  });
  apps.push(app);

  const developerSources = (
    await app.inject({ method: 'GET', url: '/api/v1/developer/sources' })
  ).json<Array<Record<string, unknown>>>();
  expect(developerSources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: importedId,
        providerKind: 'ovi-bridge',
        lifecycle: 'configured',
        accessStatus: 'metadata-only',
        capabilities: ['metadata'],
      }),
    ]),
  );
  expect(developerSources.some((source) => source.id === 'ovi-history-200')).toBe(false);
  expect(developerSources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: sameLegacyId, providerKind: 'imported', accessStatus: 'metadata-only' }),
    ]),
  );

  const temporalSources = await app.inject({ method: 'GET', url: '/api/temporal/sources' });
  expect(temporalSources.json()).toEqual([
    expect.objectContaining({ id: 'synthetic-lakes', availability: 'ready' }),
  ]);

  const dates = await app.inject({
    method: 'GET',
    url: `/api/temporal/sources/${encodeURIComponent(importedId)}/dates?aoiId=area-1`,
  });
  expect(dates.statusCode).toBe(409);
  expect(dates.json()).toEqual({ error: 'source-not-ready' });

  const tile = await app.inject({
    method: 'GET',
    url: `/api/temporal/tiles/${encodeURIComponent(importedId)}/unverified-date/8/212/102`,
  });
  expect(tile.statusCode).toBe(409);
  expect(tile.json()).toEqual({ error: 'source-not-ready' });
});

it('exposes runtime and imported sources through a secret-free capability directory', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const importedId = await confirmImportedSource(app);
  const response = await app.inject({ method: 'GET', url: '/api/v1/developer/sources' });
  expect(response.statusCode).toBe(200);
  const body = response.json<Array<Record<string, unknown>>>();
  expect(body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'synthetic-lakes',
        accessStatus: 'ready',
        capabilities: ['metadata', 'temporal-catalog', 'tiles'],
      }),
      expect.objectContaining({
        id: importedId,
        accessStatus: 'metadata-only',
        capabilities: ['metadata'],
      }),
    ]),
  );
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    'upstream-secret.example.invalid',
    '/private/',
    'hosts',
    'pathTemplate',
    'queryParameters',
    'credentialRef',
    'sourceProvenance',
    'compatibilityExtension',
    'inputSha256',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  const unavailable = await app.inject({
    method: 'GET',
    url: `/api/v1/developer/sources/${encodeURIComponent(importedId)}/dates?aoiId=area-1`,
  });
  expect(unavailable.statusCode).toBe(409);
  expect(unavailable.json()).toEqual({ error: 'capability-not-available', capability: 'temporal-catalog' });
});

it('serves the representative SDK date and tile journey without accepting proxy parameters', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const dates = await app.inject({
    method: 'GET',
    url: '/api/v1/developer/sources/synthetic-lakes/dates?aoiId=area-1&from=2006-01-01&to=2025-12-31',
  });
  expect(dates.statusCode).toBe(200);
  expect(dates.json()).toHaveLength(20);

  const tile = await app.inject({
    method: 'GET',
    url: '/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/8/212/102',
  });
  expect(tile.statusCode).toBe(200);
  expect(tile.headers['content-type']).toContain('image/svg+xml');

  for (const url of [
    '/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/8/212/102?url=https://evil.invalid',
    '/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/x/212/102',
    '/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/31/0/0',
    '/api/v1/developer/sources/synthetic-lakes/tiles/scene-2006/8/256/0',
  ]) {
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(400);
  }
});

it('applies the same strict date, ID, and coordinate contract to V1 routes', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  for (const { path, error } of [
    {
      path: 'dates?aoiId=area-1&from=2025-02-29&to=2025-12-31',
      error: 'invalid-date-window',
    },
    {
      path: 'dates?aoiId=%20area-1&from=2006-01-01&to=2025-12-31',
      error: 'invalid-aoi-id',
    },
    {
      path: `tiles/${'x'.repeat(161)}/8/212/102`,
      error: 'invalid-date-id',
    },
    { path: 'tiles/scene-2006/1e1/0/0', error: 'invalid-coordinate' },
    { path: 'tiles/scene-2006/8/256/0', error: 'invalid-coordinate' },
  ]) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/developer/sources/synthetic-lakes/${path}`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error });
  }
});
