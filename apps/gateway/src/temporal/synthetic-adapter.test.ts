import { expect, it } from 'vitest';
import { SyntheticTemporalAdapter } from './synthetic-adapter.js';

it('serves distinct same-origin synthetic SVG tiles for two years', async () => {
  const adapter = new SyntheticTemporalAdapter();
  const a = await adapter.tile({ dateId: 'scene-2006', z: 8, x: 212, y: 102 });
  const b = await adapter.tile({ dateId: 'scene-2025', z: 8, x: 212, y: 102 });
  expect(a.status).toBe(200);
  expect(a.contentType).toBe('image/svg+xml');
  expect(Buffer.from(a.body).equals(Buffer.from(b.body))).toBe(false);
  expect(Buffer.from(a.body).toString('utf8')).toContain('SYNTHETIC');
});

it('keeps a configured missing year unavailable', async () => {
  const adapter = new SyntheticTemporalAdapter({ missingYears: [2012] });
  const dates = await adapter.listDates({ aoiId: 'baoying-lake', from: '2006-01-01', to: '2025-12-31' });
  expect(dates.find((date) => date.id === 'scene-2012')?.availability).toBe('missing');
  expect((await adapter.tile({ dateId: 'scene-2012', z: 8, x: 212, y: 102 })).status).toBe(404);
});

it('builds the synthetic catalog from the requested twenty-year window instead of fixed lake years', async () => {
  const adapter = new SyntheticTemporalAdapter();
  const dates = await adapter.listDates({ aoiId: 'arbitrary-area', from: '2010-01-01', to: '2029-12-31' });
  expect(dates).toHaveLength(20);
  expect(dates.at(0)?.id).toBe('scene-2010');
  expect(dates.at(-1)?.id).toBe('scene-2029');
  expect((await adapter.tile({ dateId: 'scene-2029', z: 8, x: 212, y: 102 })).status).toBe(200);
});
