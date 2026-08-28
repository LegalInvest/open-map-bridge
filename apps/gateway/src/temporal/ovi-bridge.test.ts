import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { OviBridgeAdapter } from './ovi-bridge.js';

const verifiedDate = {
  id: 'verified-scene-2018',
  requestDate: '2018-06-30',
  captureDate: null,
  precision: 'request-date-only' as const,
  availability: 'available' as const,
  provenance: 'authorized test fixture',
};

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

function responseBody(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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
    verifiedDates: [verifiedDate],
    fetchImpl: (async () =>
      new Response(responseBody(tileBytes), { status: 200, headers: { 'content-type': contentType } })) as typeof fetch,
  });
  const response = await adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 });
  expect(response.status).toBe(200);
  expect(response.contentType).toBe(contentType);
  expect(Array.from(response.body)).toEqual(Array.from(tileBytes));
});

it('does not relay a non-success upstream response body', async () => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [verifiedDate],
    fetchImpl: (async () => new Response('upstream-secret-body', { status: 403 })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 })).resolves.toEqual({
    status: 403,
    contentType: 'application/json',
    body: new Uint8Array(),
  });
});

it.each([201, 206, 418])('normalizes an unrecognized upstream status %s without relaying its body', async (status) => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [verifiedDate],
    fetchImpl: (async () => new Response('unexpected-body', { status })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 })).resolves.toEqual({
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
    new Response(responseBody(validPng()), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
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
      verifiedDates: [verifiedDate],
      fetchImpl: (async () => response) as typeof fetch,
    });
    await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 })).rejects.toThrow(/image|PNG|JPEG/);
  }
});

it.each([
  { declaredLength: String(5 * 1024 * 1024 + 1), expected: /5 MiB/i },
  { declaredLength: 'not-a-number', expected: /content length/i },
])('rejects an unsafe declared content length before decoding: $declaredLength', async ({ declaredLength, expected }) => {
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [verifiedDate],
    fetchImpl: (async () =>
      new Response(responseBody(validPng()), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': declaredLength },
      })) as typeof fetch,
  });
  await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 })).rejects.toThrow(expected);
});

it('refuses to invent a date catalog or accept an unverified date id', async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    fetchImpl,
  });
  await expect(adapter.listDates({ aoiId: 'gaoyou-lake', from: '2006-01-01', to: '2025-12-31' })).rejects.toThrow(
    /no verified date catalog/i,
  );
  await expect(adapter.tile({ dateId: 'annual-2018', z: 8, x: 212, y: 102 })).resolves.toEqual({
    status: 404,
    contentType: 'application/json',
    body: new Uint8Array(),
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('does not fetch catalog entries recorded as missing or failed', async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [
      { ...verifiedDate, id: 'verified-missing', availability: 'missing' },
      { ...verifiedDate, id: 'verified-failed', availability: 'failed' },
    ],
    fetchImpl,
  });
  for (const dateId of ['verified-missing', 'verified-failed']) {
    await expect(adapter.tile({ dateId, z: 8, x: 212, y: 102 })).resolves.toEqual({
      status: 404,
      contentType: 'application/json',
      body: new Uint8Array(),
    });
  }
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('rejects invalid or duplicate verified date catalog entries', () => {
  expect(
    () =>
      new OviBridgeAdapter({
        baseUrl: 'http://127.0.0.1:19991',
        mapType: 200,
        verifiedDates: [{ ...verifiedDate, requestDate: '2018-02-31' }],
      }),
  ).toThrow(/invalid ISO calendar date/i);
  expect(
    () =>
      new OviBridgeAdapter({
        baseUrl: 'http://127.0.0.1:19991',
        mapType: 200,
        verifiedDates: [verifiedDate, { ...verifiedDate }],
      }),
  ).toThrow(/unique/i);
});

it('rejects invalid temporal inputs before an upstream fetch', async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [verifiedDate],
    fetchImpl,
  });
  await expect(
    adapter.listDates({ aoiId: 'area-1', from: '2025-02-29', to: '2025-12-31' }),
  ).rejects.toThrow(/calendar date/i);
  await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 256, y: 0 })).rejects.toThrow(/zoom extent/i);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('returns only injected verified dates and caps oversized responses', async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }),
  );
  const adapter = new OviBridgeAdapter({
    baseUrl: 'http://127.0.0.1:19991',
    mapType: 200,
    verifiedDates: [
      verifiedDate,
      { ...verifiedDate, id: 'verified-scene-2020', requestDate: '2020-08-15' },
    ],
    fetchImpl: fetchImpl as typeof fetch,
  });
  const dates = await adapter.listDates({ aoiId: 'gaoyou-lake', from: '2019-01-01', to: '2025-12-31' });
  expect(dates).toEqual([{ ...verifiedDate, id: 'verified-scene-2020', requestDate: '2020-08-15' }]);
  await expect(adapter.tile({ dateId: verifiedDate.id, z: 8, x: 212, y: 102 })).rejects.toThrow(/5 MiB/i);
});
