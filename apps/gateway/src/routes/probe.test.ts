import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { buildTestApp } from '../test-app.js';
import { EncryptedCredentialVault } from '../security/credential-vault.js';

const localRequire = createRequire(import.meta.url);
const { PNG } = localRequire('pngjs') as {
  PNG: {
    new (options: { width: number; height: number }): { width: number; height: number; data: Uint8Array };
    sync: { write(image: { width: number; height: number; data: Uint8Array }): Uint8Array };
  };
};

const apps: Array<Awaited<ReturnType<typeof buildTestApp>>> = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

function validPng(): Uint8Array {
  const image = new PNG({ width: 1, height: 1 });
  image.data.set([24, 68, 135, 255]);
  return PNG.sync.write(image);
}

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ server: Server; port: number }> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server did not expose a port');
  return { server, port: address.port };
}

async function confirmSource(app: Awaited<ReturnType<typeof buildTestApp>>, port: number): Promise<string> {
  const authority = `tiles.fixture.invalid:${port}`;
  const payload = `ovobj?${new URLSearchParams({
    t: '1',
    id: '730',
    na: 'Generic probe fixture',
    po: '1',
    he: '18',
    oy: '3',
    df: '0',
    hn: authority,
    ul: `http://${authority}/tiles/{$z}/{$x}/{$y}.png?style=satellite`,
  }).toString()}`;
  const inspected = await app.inject({ method: 'POST', url: '/api/import/inspect/qr', payload: { payload } });
  expect(inspected.statusCode).toBe(200);
  const preview = inspected.json();
  const confirmed = await app.inject({
    method: 'POST',
    url: '/api/import/confirm',
    payload: { previewId: preview.previewId, candidateIds: [preview.layers[0].candidateId], authorized: true },
  });
  expect(confirmed.statusCode).toBe(201);
  return confirmed.json().sources[0].id as string;
}

function fixtureDependencies() {
  const resolver = vi.fn(async () => [{ address: '127.0.0.1', family: 4 as const }]);
  return {
    resolver,
    inspectPolicy: () => ({ decision: 'allowed' as const, code: null, message: 'fixture allowed', nextAction: '' }),
    allowedNonPublicAddresses: () => ['127.0.0.1'],
  };
}

it('runs one explicit same-UUID vault and pinned-transport probe, persists only redacted evidence, and reuses it', async () => {
  const fixtureQueryValue = 'fixture-query-value-not-a-secret';
  const fixtureHeaderValue = 'Bearer fixture-header-value-not-a-secret';
  let expectedQueryValue = fixtureQueryValue;
  let expectedHeaderValue = fixtureHeaderValue;
  let requestCount = 0;
  const png = validPng();
  const { port } = await listen((request, response) => {
    requestCount += 1;
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    expect(url.pathname).toBe('/tiles/2/1/2.png');
    expect(url.searchParams.get('style')).toBe('satellite');
    expect(url.searchParams.get('api_key')).toBe(expectedQueryValue);
    expect(request.headers.authorization).toBe(expectedHeaderValue);
    response.writeHead(200, { 'content-type': 'image/png', 'content-length': png.byteLength });
    response.end(png);
  });
  const directory = await mkdtemp(join(tmpdir(), 'omb-generic-probe-'));
  const dataPath = join(directory, 'state.json');
  const vault = await EncryptedCredentialVault.open(join(directory, 'vault.json'), Buffer.alloc(32, 19));
  let releaseResolver!: () => void;
  const resolverGate = new Promise<void>((resolve) => {
    releaseResolver = resolve;
  });
  const dependencies = fixtureDependencies();
  dependencies.resolver = vi.fn(async () => {
    await resolverGate;
    return [{ address: '127.0.0.1', family: 4 as const }];
  });
  const app = await buildTestApp({ dataPath, credentialVault: vault, genericProbeDependencies: dependencies });
  apps.push(app);
  const sourceId = await confirmSource(app, port);
  const credential = await app.inject({
    method: 'PUT',
    url: `/api/import/sources/${sourceId}/credential`,
    payload: {
      fields: [
        { placement: 'query', name: 'api_key', value: fixtureQueryValue },
        { placement: 'header', name: 'Authorization', value: fixtureHeaderValue },
      ],
    },
  });
  expect(credential.statusCode).toBe(200);
  expect(credential.body).not.toContain(fixtureQueryValue);
  expect(credential.body).not.toContain(fixtureHeaderValue);

  const denied = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: false, z: 2, x: 1, y: 2 },
  });
  expect(denied.statusCode).toBe(400);
  expect(requestCount).toBe(0);

  const firstRequest = app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  await vi.waitFor(() => expect(dependencies.resolver).toHaveBeenCalledOnce());
  const concurrentRequest = app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  releaseResolver();
  const [first, concurrent] = await Promise.all([firstRequest, concurrentRequest]);
  expect(first.statusCode).toBe(201);
  expect(first.json()).toMatchObject({
    created: true,
    externalRequest: true,
    result: {
      schemaVersion: 1,
      sourceId,
      category: 'success',
      httpStatus: 200,
      contentType: 'image/png',
      width: 1,
      height: 1,
      errorCode: null,
    },
  });
  expect(first.body).not.toContain('tiles.fixture.invalid');
  expect(first.body).not.toContain(fixtureQueryValue);
  expect(first.body).not.toContain(fixtureHeaderValue);
  expect(concurrent.statusCode).toBe(200);
  expect(concurrent.json()).toMatchObject({ created: false, externalRequest: false, result: { category: 'success' } });
  expect(requestCount).toBe(1);
  expect(dependencies.resolver).toHaveBeenCalledOnce();

  const repeated = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(repeated.statusCode).toBe(200);
  expect(repeated.json()).toMatchObject({ created: false, externalRequest: false });
  expect(requestCount).toBe(1);
  expect(dependencies.resolver).toHaveBeenCalledOnce();

  const descriptor = await app.inject({ method: 'GET', url: `/api/v1/developer/sources/${sourceId}` });
  expect(descriptor.json()).toMatchObject({
    lifecycle: 'probed',
    accessStatus: 'ready',
    capabilities: ['metadata', 'map-tiles'],
    links: { mapTileTemplate: `/api/v1/developer/sources/${sourceId}/map-tiles/{z}/{x}/{y}` },
  });
  const tile = await app.inject({ method: 'GET', url: `/api/tiles/${sourceId}/2/1/2` });
  expect(tile.statusCode).toBe(200);
  expect(tile.headers['content-type']).toContain('image/png');
  expect(tile.rawPayload).toEqual(Buffer.from(png));
  expect(requestCount).toBe(2);
  expect(dependencies.resolver).toHaveBeenCalledTimes(2);

  for (const url of [
    `/api/tiles/${sourceId}/2/1/2?url=https://evil.invalid`,
    `/api/tiles/${sourceId}/31/0/0`,
    `/api/tiles/${sourceId}/2/4/0`,
  ]) {
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(400);
  }
  expect(requestCount).toBe(2);

  const sources = (await app.inject({ method: 'GET', url: '/api/import/sources' })).json<Array<Record<string, unknown>>>();
  expect(sources.find((source) => source.id === sourceId)).toMatchObject({ status: 'probed' });
  const stateText = await readFile(dataPath, 'utf8');
  expect(stateText).not.toContain(fixtureQueryValue);
  expect(stateText).not.toContain(fixtureHeaderValue);
  const state = JSON.parse(stateText) as {
    probeResults: Array<Record<string, unknown>>;
    genericRuntimeBindings: Array<Record<string, unknown>>;
  };
  expect(state.probeResults).toHaveLength(1);
  expect(state.genericRuntimeBindings).toEqual([
    expect.objectContaining({ schemaVersion: 1, sourceId, probeInputFingerprint: state.probeResults[0]?.inputFingerprint }),
  ]);
  expect(Object.keys(state.genericRuntimeBindings[0] ?? {}).sort()).toEqual([
    'probeInputFingerprint',
    'requestPlanFingerprint',
    'schemaVersion',
    'sourceId',
    'verifiedAt',
  ]);
  expect(Object.keys(state.probeResults[0] ?? {}).sort()).toEqual([
    'category',
    'contentType',
    'endedAt',
    'errorCode',
    'height',
    'httpStatus',
    'inputFingerprint',
    'schemaVersion',
    'sourceId',
    'startedAt',
    'width',
  ]);

  const rotatedQueryValue = 'rotated-query-value-not-a-secret';
  const rotatedHeaderValue = 'Bearer rotated-header-value-not-a-secret';
  const rotated = await app.inject({
    method: 'PUT',
    url: `/api/import/sources/${sourceId}/credential`,
    payload: {
      fields: [
        { placement: 'query', name: 'api_key', value: rotatedQueryValue },
        { placement: 'header', name: 'Authorization', value: rotatedHeaderValue },
      ],
    },
  });
  expect(rotated.statusCode).toBe(200);
  expect(
    (await app.inject({ method: 'GET', url: `/api/v1/developer/sources/${sourceId}` })).json(),
  ).toMatchObject({ accessStatus: 'metadata-only', capabilities: ['metadata'] });
  const staleTile = await app.inject({ method: 'GET', url: `/api/tiles/${sourceId}/2/1/2` });
  expect(staleTile.statusCode).toBe(409);
  expect(staleTile.json()).toEqual({ error: 'TILE_RUNTIME_NOT_READY' });
  expect(requestCount).toBe(2);

  expectedQueryValue = rotatedQueryValue;
  expectedHeaderValue = rotatedHeaderValue;
  const reprobe = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(reprobe.statusCode).toBe(201);
  expect(reprobe.json()).toMatchObject({ created: true, externalRequest: true, result: { category: 'success' } });
  expect(requestCount).toBe(3);
  expect((await app.inject({ method: 'GET', url: `/api/tiles/${sourceId}/2/1/2` })).statusCode).toBe(200);
  expect(requestCount).toBe(4);

  await app.close();
  apps.splice(apps.indexOf(app), 1);
  const restartedDependencies = fixtureDependencies();
  const restarted = await buildTestApp({
    dataPath,
    credentialVault: vault,
    genericProbeDependencies: restartedDependencies,
  });
  apps.push(restarted);
  const afterRestart = await restarted.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(afterRestart.statusCode).toBe(200);
  expect(afterRestart.json()).toMatchObject({ created: false, externalRequest: false });
  expect(restartedDependencies.resolver).not.toHaveBeenCalled();
  expect(requestCount).toBe(4);
  const restartedTile = await restarted.inject({
    method: 'GET',
    url: `/api/v1/developer/sources/${sourceId}/map-tiles/2/1/2`,
  });
  expect(restartedTile.statusCode).toBe(200);
  expect(restartedTile.rawPayload).toEqual(Buffer.from(png));
  expect(restartedDependencies.resolver).toHaveBeenCalledOnce();
  expect(requestCount).toBe(5);
});

it('persists a stable category for a denied upstream response and does not retry the same fingerprint', async () => {
  let requestCount = 0;
  const { port } = await listen((_request, response) => {
    requestCount += 1;
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('fixture denial body must not be persisted');
  });
  const directory = await mkdtemp(join(tmpdir(), 'omb-generic-probe-denied-'));
  const dataPath = join(directory, 'state.json');
  const dependencies = fixtureDependencies();
  const app = await buildTestApp({ dataPath, genericProbeDependencies: dependencies });
  apps.push(app);
  const sourceId = await confirmSource(app, port);

  const first = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(first.statusCode).toBe(201);
  expect(first.json()).toMatchObject({
    created: true,
    externalRequest: true,
    result: { sourceId, category: 'forbidden', httpStatus: 403, errorCode: 'PROBE_HTTP_403' },
  });
  expect(first.body).not.toContain('denial body');
  const repeated = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(repeated.statusCode).toBe(200);
  expect(repeated.json()).toMatchObject({ created: false, externalRequest: false });
  expect(requestCount).toBe(1);
  const tile = await app.inject({ method: 'GET', url: `/api/tiles/${sourceId}/2/1/2` });
  expect(tile.statusCode).toBe(409);
  expect(tile.json()).toEqual({ error: 'TILE_RUNTIME_NOT_READY' });
  expect(requestCount).toBe(1);
  expect((await readFile(dataPath, 'utf8'))).not.toContain('denial body');
});

it('reports no external request when request-time DNS authorization fails before transport', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-generic-probe-dns-'));
  const dataPath = join(directory, 'state.json');
  const dependencies = fixtureDependencies();
  dependencies.resolver = vi.fn(async () => {
    throw new Error('synthetic resolver failure');
  });
  const app = await buildTestApp({ dataPath, genericProbeDependencies: dependencies });
  apps.push(app);
  const sourceId = await confirmSource(app, 443);

  const response = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    created: true,
    externalRequest: false,
    result: { sourceId, category: 'dns', errorCode: 'UPSTREAM_DNS_FAILURE' },
  });
  expect(dependencies.resolver).toHaveBeenCalledOnce();
});

it('does not resolve or request an insecure imported source without an explicit policy decision', async () => {
  let requestCount = 0;
  const { port } = await listen((_request, response) => {
    requestCount += 1;
    response.writeHead(500);
    response.end();
  });
  const directory = await mkdtemp(join(tmpdir(), 'omb-generic-probe-policy-'));
  const dataPath = join(directory, 'state.json');
  const resolver = vi.fn(async () => [{ address: '127.0.0.1', family: 4 as const }]);
  const app = await buildTestApp({ dataPath, genericProbeDependencies: { resolver } });
  apps.push(app);
  const sourceId = await confirmSource(app, port);

  const response = await app.inject({
    method: 'POST',
    url: `/api/import/sources/${sourceId}/probe`,
    payload: { authorized: true, z: 2, x: 1, y: 2 },
  });
  expect(response.statusCode).toBe(409);
  expect(response.json()).toEqual({ error: 'POLICY_INSECURE_TRANSPORT_REVIEW' });
  expect(resolver).not.toHaveBeenCalled();
  expect(requestCount).toBe(0);
  const state = JSON.parse(await readFile(dataPath, 'utf8')) as { probeResults: unknown[] };
  expect(state.probeResults).toEqual([]);
});
