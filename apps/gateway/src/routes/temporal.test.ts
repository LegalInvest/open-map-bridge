import { afterEach, expect, it } from 'vitest';
import { buildTestApp as buildApp } from '../test-app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

it('lists explicit source truth and serves known synthetic dates only', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const sources = await app.inject({ method: 'GET', url: '/api/temporal/sources' });
  expect(sources.statusCode).toBe(200);
  expect(sources.json()).toEqual([
    expect.objectContaining({ id: 'synthetic-lakes', kind: 'synthetic', datePrecision: 'capture-date' }),
  ]);

  const tile = await app.inject({
    method: 'GET',
    url: '/api/temporal/tiles/synthetic-lakes/scene-2006/8/212/102',
  });
  expect(tile.statusCode).toBe(200);
  expect(tile.headers['content-type']).toContain('image/svg+xml');
  expect(tile.body).toContain('SYNTHETIC');
  expect(
    (await app.inject({ method: 'GET', url: '/api/temporal/tiles/synthetic-lakes/unknown/8/212/102' })).statusCode,
  ).toBe(404);
});

it.each(['url=https%3A%2F%2Fevil.test', 'host=evil.test', 'token=canary', 'mapType=999'])(
  'rejects open-proxy query %s',
  async (query) => {
    const app = await buildApp({ dataPath: null });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: `/api/temporal/tiles/synthetic-lakes/scene-2006/8/212/102?${query}`,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain('canary');
  },
);

it('defaults date discovery to the previous twenty complete calendar years', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'GET',
    url: '/api/temporal/sources/synthetic-lakes/dates?aoiId=arbitrary-area',
  });
  const dates = response.json<Array<{ requestDate: string }>>();
  const previousYear = new Date().getUTCFullYear() - 1;
  expect(response.statusCode).toBe(200);
  expect(dates).toHaveLength(20);
  expect(dates.at(0)?.requestDate).toBe(`${previousYear - 19}-07-15`);
  expect(dates.at(-1)?.requestDate).toBe(`${previousYear}-07-15`);
});

it('does not silently substitute a lake when arbitrary-area date discovery omits its AOI', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'GET',
    url: '/api/temporal/sources/synthetic-lakes/dates',
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: 'aoi-id-required' });
});

it.each([
  { query: 'aoiId=area-1&extra=true', error: 'query-not-allowed' },
  { query: 'aoiId=%20area-1', error: 'invalid-aoi-id' },
  { query: `aoiId=${'x'.repeat(161)}`, error: 'invalid-aoi-id' },
  { query: 'aoiId=area-1&from=2025-02-29&to=2025-12-31', error: 'invalid-date-window' },
  { query: 'aoiId=area-1&from=2025-12-31&to=2006-01-01', error: 'invalid-date-window' },
])('applies the strict shared date-window contract to the legacy route: $query', async ({ query, error }) => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'GET',
    url: `/api/temporal/sources/synthetic-lakes/dates?${query}`,
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error });
});

it.each([
  { path: 'scene-2006/01/0/0', error: 'invalid-coordinate' },
  { path: 'scene-2006/1e1/0/0', error: 'invalid-coordinate' },
  { path: 'scene-2006/31/0/0', error: 'invalid-coordinate' },
  { path: 'scene-2006/8/256/0', error: 'invalid-coordinate' },
  { path: 'scene-2006/8/0/256', error: 'invalid-coordinate' },
])('applies the strict shared tile contract to the legacy route: $path', async ({ path, error }) => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'GET',
    url: `/api/temporal/tiles/synthetic-lakes/${path}`,
  });
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error });
});

it('keeps the HTTP path-length gate ahead of the legacy tile route', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const response = await app.inject({
    method: 'GET',
    url: `/api/temporal/tiles/synthetic-lakes/${'x'.repeat(161)}/8/212/102`,
  });
  expect(response.statusCode).toBe(414);
});
