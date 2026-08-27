import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../app.js';

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
