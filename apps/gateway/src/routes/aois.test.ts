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
