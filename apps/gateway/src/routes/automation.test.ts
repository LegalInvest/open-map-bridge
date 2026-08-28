import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function importSource(app: Awaited<ReturnType<typeof buildApp>>, host: string, path: string) {
  const inspect = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    payload: {
      payload: `ovobj?t=1&id=402&na=Readiness%20Fixture&po=1&he=18&oy=3&df=0&hn=${encodeURIComponent(host)}&ul=${encodeURIComponent(path)}`,
    },
  });
  expect(inspect.statusCode).toBe(200);
  const preview = inspect.json();
  const confirmed = await app.inject({
    method: 'POST',
    url: '/api/import/confirm',
    payload: { previewId: preview.previewId, candidateIds: [preview.layers[0].candidateId], authorized: true },
  });
  expect(confirmed.statusCode).toBe(201);
  return confirmed.json().sources[0] as { id: string };
}

it('persists and deduplicates a zero-network readiness run without leaking source internals', async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const source = await importSource(app, 'tiles.example.invalid', '/{$z}/{$x}/{$y}.png');

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: source.id },
  });
  expect(first.statusCode).toBe(201);
  const firstBody = first.json();
  expect(firstBody.created).toBe(true);
  expect(firstBody.run).toMatchObject({ status: 'blocked', currentStep: 'runtime-binding' });
  expect(firstBody.run.steps.map((step: { status: string }) => step.status)).toEqual([
    'succeeded',
    'succeeded',
    'succeeded',
    'blocked',
  ]);
  expect(firstBody.run.steps.every((step: { externalRequest: boolean }) => step.externalRequest === false)).toBe(true);
  expect(JSON.stringify(firstBody.run)).not.toContain('tiles.example.invalid');

  const repeated = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: source.id },
  });
  expect(repeated.statusCode).toBe(200);
  expect(repeated.json()).toMatchObject({ created: false, run: { id: firstBody.run.id } });
  expect((await app.inject({ method: 'GET', url: '/api/v1/jobs' })).json()).toHaveLength(1);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('requires intervention for a private host without making a request', async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const source = await importSource(app, '192.168.10.8', '/{$z}/{$x}/{$y}.png');
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: source.id },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json().run).toMatchObject({
    status: 'awaiting-intervention',
    currentStep: 'network-policy',
    intervention: { kind: 'enterprise-host' },
  });
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('surfaces the missing credential vault while keeping redacted query data out of the job', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const source = await importSource(app, 'tiles.example.invalid', '/{$z}/{$x}/{$y}.png?token=hidden');
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: source.id },
  });
  const body = response.json();
  expect(body.run).toMatchObject({
    status: 'awaiting-intervention',
    currentStep: 'credential-readiness',
    intervention: { kind: 'credential-vault' },
  });
  expect(JSON.stringify(body.run)).not.toContain('hidden');
});

it('recognizes an opaque Ovi source as needing the configured local bridge without calling it', async () => {
  const fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  const directory = await mkdtemp(join(tmpdir(), 'omb-ovi-readiness-'));
  const dataPath = join(directory, 'state.json');
  const importing = await buildApp({ dataPath });
  const source = await importSource(importing, 'tiles.example.invalid', 'opaque-private-template');
  await importing.close();
  const app = await buildApp({
    dataPath,
    ovi: { baseUrl: 'http://127.0.0.1:54321', mapType: 402, sourceId: source.id },
  });
  apps.push(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: source.id },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json().run).toMatchObject({
    status: 'awaiting-intervention',
    currentStep: 'runtime-binding',
    intervention: { kind: 'local-bridge' },
    steps: [
      { status: 'succeeded' },
      { status: 'succeeded' },
      { status: 'skipped' },
      { status: 'blocked', errorCode: 'RUNTIME_NOT_READY' },
    ],
  });
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('rejects unknown sources and extra execution inputs', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: 'missing', url: 'https://unexpected.example' },
  });
  expect(invalid.statusCode).toBe(400);
  const missing = await app.inject({
    method: 'POST',
    url: '/api/v1/processes/source-readiness/execution',
    payload: { sourceId: 'missing' },
  });
  expect(missing.statusCode).toBe(404);
});
