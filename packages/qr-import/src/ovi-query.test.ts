import { describe, expect, it } from 'vitest';
import { decodeQrPayload } from './index.js';

const fixture = 'ovobj?t=1&id=402&na=Fixture%20Map&po=1&he=18&oy=3&df=0&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png';

describe('Ovital QR query adapter', () => {
  it('maps only verified fields and preserves unknown codes', () => {
    const [result] = decodeQrPayload(fixture);
    expect(result).toMatchObject({
      adapter: 'ovi-query-v1',
      legacyId: 402,
      name: 'Fixture Map',
      host: 'tiles.example.invalid',
      pathTemplate: '/{$z}/{$x}/{$y}.png',
      rawCodes: { t: '1', po: '1', he: '18', oy: '3', df: '0' },
      opaqueFieldNames: [],
      projection: 'unknown',
    });
  });

  it.each([
    ['duplicate field', `${fixture}&id=403`],
    ['missing field', 'ovobj?t=1&id=402&na=A&hn=h.example.invalid'],
    ['userinfo host', fixture.replace('tiles.example.invalid', 'u%3Ap%40tiles.example.invalid')],
    ['unknown key', `${fixture}&token=secret`],
    ['wrong head', fixture.replace('ovobj?', 'https://example.invalid/?')],
    ['malformed percent encoding', fixture.replace('Fixture%20Map', 'Fixture%ZZMap')],
    ['payload limit', `ovobj?${'x'.repeat(4_100)}`],
  ])('rejects %s', (_name, payload) => {
    expect(() => decodeQrPayload(payload)).toThrow();
  });

  it('accepts the observed at/ad/al credential variant without returning those values', () => {
    const payload = 'ovobj?t=1&id=402&na=Credential%20Variant&at=opaque-a&ad=opaque-b&al=opaque-c&df=0&hn=tiles.example.invalid&ul=opaque-config-without-tile-variables';
    const [result] = decodeQrPayload(payload);
    expect(result?.containsSensitiveQuery).toBe(true);
    expect(result?.opaqueTemplate).toBe(true);
    expect(result?.pathTemplate).toBe('/');
    expect(JSON.stringify(result)).not.toContain('opaque-');
  });

  it('accepts observed opaque extension keys without returning or interpreting their values', () => {
    const payload = `${fixture}&hs=private-hs&mf=private-mf&ml=private-ml&ms=private-ms&mt=private-mt&pn=private-pn&pt=private-pt`;
    const [result] = decodeQrPayload(payload);
    expect(result?.opaqueFieldNames).toEqual(['hs', 'mf', 'ml', 'ms', 'mt', 'pn', 'pt']);
    expect(result?.projection).toBe('unknown');
    expect(result?.rawCodes).toEqual({ t: '1', po: '1', he: '18', oy: '3', df: '0' });
    expect(JSON.stringify(result)).not.toContain('private-');
  });

  it('rejects duplicate opaque extension keys instead of choosing an ambiguous value', () => {
    expect(() => decodeQrPayload(`${fixture}&mt=one&mt=two`)).toThrow('FORMAT_QR_DUPLICATE');
  });
});
