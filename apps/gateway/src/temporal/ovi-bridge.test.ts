import { expect, it, vi } from 'vitest';
import { OviBridgeAdapter } from './ovi-bridge.js';

it.each(['http://0.0.0.0:19991', 'http://192.168.1.9:19991', 'https://example.com']) (
  'rejects non-loopback %s',
  (baseUrl) => {
    expect(() => new OviBridgeAdapter({ baseUrl, mapType: 200 })).toThrow(/loopback/i);
  },
);

it('builds the documented dated tile path without exposing auth', () => {
  const adapter = new OviBridgeAdapter({ baseUrl: 'http://127.0.0.1:19991', mapType: 200 });
  expect(adapter.pathFor({ requestDate: '2018-06-30', z: 8, x: 212, y: 102 })).toBe(
    '/getomap_200_8_212_102_jpg_20180630.jpg',
  );
});

it('uses a request-date-only catalog and caps oversized responses', async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }),
  );
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl: fetchImpl as typeof fetch,
  });
  const dates = await adapter.listDates({ aoiId: 'gaoyou-lake', from: '2006-01-01', to: '2025-12-31' });
  expect(dates).toHaveLength(20);
  expect(dates[0]).toMatchObject({ captureDate: null, precision: 'request-date-only' });
  await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).rejects.toThrow(/5 MiB/i);
});
