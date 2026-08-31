import { expect, it } from 'vitest';
import { parseGatewayServerConfig, parseOviBridgeConfig } from './config.js';

const gatewayToken = 'g'.repeat(43);

it('requires the Ovi port, map type, and imported source UUID together', () => {
  expect(() => parseOviBridgeConfig({ OMB_OVI_PORT: '19991' })).toThrow(/configured together/);
  expect(() => parseOviBridgeConfig({ OMB_OVI_MAP_TYPE: '402' })).toThrow(/configured together/);
  expect(() => parseOviBridgeConfig({ OMB_OVI_SOURCE_ID: '018f4d39-32f1-7a31-9f60-81c6b453b886' })).toThrow(
    /configured together/,
  );
  expect(parseOviBridgeConfig({})).toBeUndefined();
});

it('validates and preserves the authorized Ovi map type', () => {
  const sourceId = '018f4d39-32f1-7a31-9f60-81c6b453b886';
  expect(
    parseOviBridgeConfig({ OMB_OVI_PORT: '19991', OMB_OVI_MAP_TYPE: '402', OMB_OVI_SOURCE_ID: sourceId }),
  ).toEqual({ baseUrl: 'http://127.0.0.1:19991', mapType: 402, sourceId });
  for (const port of ['0', '65536', '1.5', 'invalid']) {
    expect(() =>
      parseOviBridgeConfig({ OMB_OVI_PORT: port, OMB_OVI_MAP_TYPE: '402', OMB_OVI_SOURCE_ID: sourceId }),
    ).toThrow(/PORT/);
  }
  for (const mapType of ['0', '-1', '1.5', 'invalid']) {
    expect(() =>
      parseOviBridgeConfig({ OMB_OVI_PORT: '19991', OMB_OVI_MAP_TYPE: mapType, OMB_OVI_SOURCE_ID: sourceId }),
    ).toThrow(/MAP_TYPE/);
  }
  expect(() =>
    parseOviBridgeConfig({
      OMB_OVI_PORT: '19991',
      OMB_OVI_MAP_TYPE: '402',
      OMB_OVI_SOURCE_ID: 'not-a-uuid',
    }),
  ).toThrow(/SOURCE_ID/);
});

it('accepts only bounded verified Ovi date and probe metadata', () => {
  const sourceId = '018f4d39-32f1-7a31-9f60-81c6b453b886';
  const date = {
    id: 'verified-scene-2018',
    requestDate: '2018-06-30',
    captureDate: null,
    precision: 'request-date-only',
    availability: 'available',
  };
  const base = { OMB_OVI_PORT: '19991', OMB_OVI_MAP_TYPE: '402', OMB_OVI_SOURCE_ID: sourceId };
  expect(
    parseOviBridgeConfig({
      ...base,
      OMB_OVI_VERIFIED_DATES_JSON: JSON.stringify([date]),
      OMB_OVI_PROBE_JSON: JSON.stringify({ dateId: date.id, z: 8, x: 212, y: 102 }),
    }),
  ).toMatchObject({
    verifiedDates: [{ ...date, provenance: 'authorized-operator-ovi-date' }],
    probeRequest: { dateId: date.id, z: 8, x: 212, y: 102 },
  });
  expect(() => parseOviBridgeConfig({ ...base, OMB_OVI_PROBE_JSON: '{}' })).toThrow(/requires/);
  expect(() =>
    parseOviBridgeConfig({
      ...base,
      OMB_OVI_VERIFIED_DATES_JSON: JSON.stringify([date]),
      OMB_OVI_PROBE_JSON: JSON.stringify({ dateId: 'unknown-date', z: 8, x: 212, y: 102 }),
    }),
  ).toThrow(/requestable verified date/);
  expect(() => parseOviBridgeConfig({ OMB_OVI_VERIFIED_DATES_JSON: JSON.stringify([date]) })).toThrow(
    /configured together/,
  );
  expect(() =>
    parseOviBridgeConfig({
      ...base,
      OMB_OVI_VERIFIED_DATES_JSON: JSON.stringify([{ ...date, token: 'must-not-be-accepted' }]),
    }),
  ).toThrow(/non-public field/);
});

it('requires a strong gateway token and derives exact loopback trust values', () => {
  expect(() => parseGatewayServerConfig({})).toThrow(/OMB_GATEWAY_TOKEN/);
  expect(() => parseGatewayServerConfig({ OMB_GATEWAY_TOKEN: 'too-short' })).toThrow(/OMB_GATEWAY_TOKEN/);
  expect(parseGatewayServerConfig({ OMB_GATEWAY_TOKEN: gatewayToken })).toMatchObject({
    port: 4174,
    access: {
      allowedHosts: ['127.0.0.1:4174', 'localhost:4174'],
      allowedOrigins: ['http://127.0.0.1:5173'],
      rateLimit: { maxRequests: 600, windowMs: 60_000 },
    },
  });
  for (const port of ['0', '65536', '1.5', 'invalid']) {
    expect(() => parseGatewayServerConfig({ OMB_GATEWAY_TOKEN: gatewayToken, OMB_GATEWAY_PORT: port })).toThrow(
      /PORT/,
    );
  }
  for (const origin of ['https://example.com', 'http://127.0.0.1:5173/path', 'not-a-url']) {
    expect(() => parseGatewayServerConfig({ OMB_GATEWAY_TOKEN: gatewayToken, OMB_WEB_ORIGIN: origin })).toThrow(
      /ORIGIN/,
    );
  }
});

it('parses only unique, scoped developer principals', () => {
  const appToken = 'd'.repeat(43);
  const developer = JSON.stringify([
    { id: 'org.example.history', token: appToken, permissions: ['read-source-metadata', 'read-tiles'] },
  ]);
  expect(parseGatewayServerConfig({ OMB_GATEWAY_TOKEN: gatewayToken, OMB_DEVELOPER_TOKENS_JSON: developer }))
    .toMatchObject({
      access: {
        principals: [
          { id: 'omb.local.web' },
          { id: 'org.example.history', token: appToken, permissions: ['read-source-metadata', 'read-tiles'] },
        ],
      },
    });
  expect(() =>
    parseGatewayServerConfig({
      OMB_GATEWAY_TOKEN: gatewayToken,
      OMB_DEVELOPER_TOKENS_JSON: JSON.stringify([
        { id: 'org.example.history', token: appToken, permissions: ['gateway:ui'] },
      ]),
    }),
  ).toThrow(/permission/);
  expect(() =>
    parseGatewayServerConfig({
      OMB_GATEWAY_TOKEN: gatewayToken,
      OMB_DEVELOPER_TOKENS_JSON: JSON.stringify([
        { id: 'org.example.history', token: gatewayToken, permissions: ['read-source-metadata'] },
      ]),
    }),
  ).toThrow(/unique/);
});
