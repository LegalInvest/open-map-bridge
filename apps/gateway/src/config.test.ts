import { expect, it } from 'vitest';
import { parseOviBridgeConfig } from './config.js';

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
