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
