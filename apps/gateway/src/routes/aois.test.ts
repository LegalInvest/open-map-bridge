import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

it('confirms an AOI by appending version two and preserving version one', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const original = (await app.inject({ method: 'GET', url: '/api/aois' })).json()[0];
  const response = await app.inject({
    method: 'PUT',
    url: '/api/aois/baoying-lake',
    payload: { geometry: original.geometry },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ id: 'baoying-lake', version: 2, status: 'confirmed' });
  const versions = (await app.inject({ method: 'GET', url: '/api/aois' })).json().filter(
    (aoi: { id: string }) => aoi.id === 'baoying-lake',
  );
  expect(versions.map((aoi: { version: number }) => aoi.version)).toEqual([1, 2]);
});

it('creates an arbitrary confirmed AOI without accepting client-owned identity fields', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const geometry = (await app.inject({ method: 'GET', url: '/api/aois' })).json()[0].geometry;
  const response = await app.inject({
    method: 'POST',
    url: '/api/aois',
    payload: {
      id: 'client-controlled',
      version: 99,
      status: 'approximate',
      name: '实验区域',
      geometry,
    },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ name: '实验区域', version: 1, status: 'confirmed' });
  expect(response.json().id).toMatch(/^area-[0-9a-f-]{36}$/);
  expect(response.json().id).not.toBe('client-controlled');
  expect((await app.inject({ method: 'GET', url: '/api/aois' })).json()).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: '实验区域', version: 1 })]),
  );
});

it('rejects an unnamed or invalid newly drawn AOI', async () => {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const geometry = (await app.inject({ method: 'GET', url: '/api/aois' })).json()[0].geometry;
  expect((await app.inject({ method: 'POST', url: '/api/aois', payload: { name: '  ', geometry } })).statusCode).toBe(400);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/aois',
        payload: {
          name: '坏区域',
          geometry: {
            type: 'Polygon',
            coordinates: [[[119, 33], [120, 34], [120, 33], [119, 34], [119, 33]]],
          },
        },
      })
    ).statusCode,
  ).toBe(400);
});
