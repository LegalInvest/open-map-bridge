import { afterEach, expect, it } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { selectFourFrameDates } from '@omb/temporal-source';
import { buildTestApp as buildApp } from '../test-app.js';

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

async function confirmedComparisonFixture() {
  const app = await buildApp({ dataPath: null });
  apps.push(app);
  const geometry = lakeAoiPresets.find((aoi) => aoi.id === 'baoying-lake')?.geometry;
  if (!geometry) throw new Error('missing AOI fixture');
  const confirmed = await app.inject({ method: 'PUT', url: '/api/aois/baoying-lake', payload: { geometry } });
  const aoi = confirmed.json<{ id: string; version: number }>();
  const datesResponse = await app.inject({
    method: 'GET',
    url: `/api/temporal/sources/synthetic-lakes/dates?aoiId=${aoi.id}`,
  });
  const dates = selectFourFrameDates(datesResponse.json());
  const payload = {
    schemaVersion: 1,
    sourceId: 'synthetic-lakes',
    aoiId: aoi.id,
    aoiVersion: aoi.version,
    dateIds: dates.map((date) => date.id),
    viewState: { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' },
    frames: dates.map((date) => ({
      dateId: date.id,
      status: 'loaded',
      expectedTileCount: 6,
      loadedTileCount: 6,
      failedTileCount: 0,
    })),
  };
  return { app, payload };
}

it('creates and revisits a strict four-frame comparison receipt', async () => {
  const { app, payload } = await confirmedComparisonFixture();
  const created = await app.inject({ method: 'POST', url: '/api/comparisons', payload });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toMatchObject({ ...payload, id: expect.stringMatching(/^comparison-/), createdAt: expect.any(String) });
  const listed = await app.inject({ method: 'GET', url: '/api/comparisons' });
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toEqual([created.json()]);
});

it('fails closed on unconfirmed AOIs and fabricated frame facts', async () => {
  const { app, payload } = await confirmedComparisonFixture();
  const unconfirmed = await app.inject({
    method: 'POST',
    url: '/api/comparisons',
    payload: { ...payload, aoiVersion: 1 },
  });
  expect(unconfirmed.statusCode).toBe(409);
  expect(unconfirmed.json()).toEqual({ error: 'aoi-not-confirmed' });

  const invalidCounts = await app.inject({
    method: 'POST',
    url: '/api/comparisons',
    payload: { ...payload, frames: payload.frames.map((frame, index) => index === 0 ? { ...frame, loadedTileCount: 5 } : frame) },
  });
  expect(invalidCounts.statusCode).toBe(400);
  expect(invalidCounts.json()).toEqual({ error: 'invalid-comparison' });
});
