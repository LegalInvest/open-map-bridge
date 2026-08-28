import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { OviBridgeAdapter } from './ovi-bridge.js';

const localRequire = createRequire(import.meta.url);
const { PNG } = localRequire('pngjs') as {
  PNG: {
    new (options: { width: number; height: number }): { width: number; height: number; data: Uint8Array };
    sync: { write(image: { width: number; height: number; data: Uint8Array }): Uint8Array };
  };
};
const jpeg = localRequire('jpeg-js') as {
  encode(image: { width: number; height: number; data: Uint8Array }, quality: number): { data: Uint8Array };
};

function validPng(): Uint8Array {
  const image = new PNG({ width: 1, height: 1 });
  image.data.set([12, 34, 56, 255]);
  return PNG.sync.write(image);
}

function validJpeg(): Uint8Array {
  return jpeg.encode({ width: 1, height: 1, data: new Uint8Array([12, 34, 56, 255]) }, 90).data;
}

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

it('does not report readiness before a real tile has been verified', async () => {
  const adapter = new OviBridgeAdapter({ baseUrl: 'http://127.0.0.1:19991', mapType: 200 });
  await expect(adapter.probe()).resolves.toEqual({
    ok: false,
    detail: 'loopback configuration accepted; no tile has been verified',
  });
});

it.each([
  { contentType: 'image/png', tileBytes: validPng() },
  { contentType: 'image/jpeg', tileBytes: validJpeg() },
])('streams and decodes a valid $contentType image before returning it', async ({ contentType, tileBytes }) => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl: (async () => new Response(tileBytes, { status: 200, headers: { 'content-type': contentType } })) as typeof fetch,
  });
  const response = await adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 });
  expect(response.status).toBe(200);
  expect(response.contentType).toBe(contentType);
  expect(Array.from(response.body)).toEqual(Array.from(tileBytes));
});

it('does not relay a non-success upstream response body', async () => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl: (async () => new Response('upstream-secret-body', { status: 403 })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).resolves.toEqual({
    status: 403,
    contentType: 'application/json',
    body: new Uint8Array(),
  });
});

it.each([201, 206, 418])('normalizes an unrecognized upstream status %s without relaying its body', async (status) => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl: (async () => new Response('unexpected-body', { status })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).resolves.toEqual({
    status: 502,
    contentType: 'application/json',
    body: new Uint8Array(),
  });
});

it('rejects mislabeled, malformed, and unsafe-dimension image responses', async () => {
  const hugeHeader = new Uint8Array(24);
  hugeHeader.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(hugeHeader.buffer).setUint32(16, 2049);
  new DataView(hugeHeader.buffer).setUint32(20, 1);
  const responses = [
    new Response(validPng(), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }),
    new Response(hugeHeader, { status: 200, headers: { 'content-type': 'image/png' } }),
  ];
  for (const response of responses) {
    const adapter = new OviBridgeAdapter({
      baseUrl: 'http://127.0.0.1:19991',
      mapType: 200,
      fetchImpl: (async () => response) as typeof fetch,
    });
    await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).rejects.toThrow(/image|PNG|JPEG/);
  }
});

it.each([
  { declaredLength: String(5 * 1024 * 1024 + 1), expected: /5 MiB/i },
  { declaredLength: 'not-a-number', expected: /content length/i },
])('rejects an unsafe declared content length before decoding: $declaredLength', async ({ declaredLength, expected }) => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl: (async () =>
      new Response(validPng(), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': declaredLength },
      })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).rejects.toThrow(expected);
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
