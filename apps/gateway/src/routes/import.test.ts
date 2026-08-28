import { afterEach, expect, it, vi } from 'vitest';
import { buildSyntheticRecord37Ovmap } from '@omb/ovmap-codec/synthetic';
import { buildApp } from '../app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

it('inspects QR and confirms a source only after authorization', async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const inspect = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    payload: {
      payload: 'ovobj?t=1&id=402&na=Fixture%20Map&po=1&he=18&oy=3&df=0&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png',
    },
  });
  expect(inspect.statusCode).toBe(200);
  const preview = inspect.json();
  expect(preview.layers[0].source.name).toBe('Fixture Map');
  expect(preview.layers[0].source.compatibilityExtension.credentialRequired).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();

  const rejected = await app.inject({
    method: 'POST',
    url: '/api/import/confirm',
    payload: { previewId: preview.previewId, candidateIds: [preview.layers[0].candidateId], authorized: false },
  });
  expect(rejected.statusCode).toBe(400);

  const confirmed = await app.inject({
    method: 'POST',
    url: '/api/import/confirm',
    payload: { previewId: preview.previewId, candidateIds: [preview.layers[0].candidateId], authorized: true },
  });
  expect(confirmed.statusCode).toBe(201);
  expect(confirmed.json().sources[0].status).toBe('confirmed');
  expect((await app.inject({ method: 'GET', url: '/api/import/sources' })).json()).toHaveLength(1);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('inspects base64 ovmap and returns two independent candidates', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const file = buildSyntheticRecord37Ovmap([
    { mapId: 204, maxZoom: 18, name: 'A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    { mapId: 205, maxZoom: 18, name: 'B', host: 'b.example.invalid', path: '/{$z}/{$x}/{$y}.png', group: 'G' },
  ]);
  const response = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/ovmap',
    payload: { fileName: 'fixture.ovmap', bytesBase64: Buffer.from(file).toString('base64') },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().layers.map((layer: { source: { name: string } }) => layer.source.name)).toEqual(['A', 'B']);
});

it('returns a stable safe error for malformed input', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({ method: 'POST', url: '/api/import/inspect/ovmap', payload: { bytesBase64: 'AAAA' } });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'FORMAT_IMPORT', retryable: false } });
});
