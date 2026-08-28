import { afterEach, expect, it, vi } from 'vitest';
import { buildSyntheticRecord37Ovmap } from '@omb/ovmap-codec/synthetic';
import {
  OVMAP_BASE64_MAX_CHARS,
  OVMAP_FILE_MAX_BYTES,
  OVMAP_INSPECT_BODY_MAX_BYTES,
} from '@omb/source-schema';
import { buildTestApp as buildApp } from '../test-app.js';

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

it('lets an exactly 1 MiB decoded file reach the format parser instead of the HTTP body gate', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/ovmap',
    payload: { bytesBase64: Buffer.alloc(OVMAP_FILE_MAX_BYTES).toString('base64') },
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'FORMAT_IMPORT', detail: { parseCode: 'FORMAT_MAGIC' } } });
});

it('rejects one decoded byte over the file limit with a stable application error', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/ovmap',
    payload: { bytesBase64: Buffer.alloc(OVMAP_FILE_MAX_BYTES + 1).toString('base64') },
  });
  expect(response.statusCode).toBe(413);
  expect(response.json()).toEqual({
    error: {
      code: 'INPUT_OVMAP_LIMIT',
      message: '.ovmap 文件不能超过 1 MiB',
      retryable: false,
      nextAction: '请检查输入后重试',
      detail: { maxBytes: OVMAP_FILE_MAX_BYTES },
    },
  });
});

it('maps an oversized encoded JSON envelope to a stable HTTP body error', async () => {
  expect(OVMAP_BASE64_MAX_CHARS).toBeLessThan(OVMAP_INSPECT_BODY_MAX_BYTES);
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/ovmap',
    payload: { bytesBase64: 'A'.repeat(OVMAP_INSPECT_BODY_MAX_BYTES) },
  });
  expect(response.statusCode).toBe(413);
  expect(response.json()).toMatchObject({
    error: { code: 'INPUT_BODY_LIMIT', detail: { maxBytes: OVMAP_INSPECT_BODY_MAX_BYTES } },
  });
});
