import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

async function confirmImportedSource(app: Awaited<ReturnType<typeof buildApp>>) {
  const inspect = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    payload: {
      payload:
        'ovobj?t=1&id=402&na=Private%20Fixture&po=1&he=18&oy=3&df=0&hn=upstream-secret.example.invalid&ul=%2Fprivate%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png',
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
