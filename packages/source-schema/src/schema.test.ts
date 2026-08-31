import { describe, expect, it } from 'vitest';
import { isSafeNonSecretQueryParameter, parseMapSourceDefinition, parseProbeResult } from './index.js';

const validSource = {
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  legacyId: 402,
  name: 'Fixture XYZ',
  sourceKind: 'ovmap',
  protocol: 'ovi-template',
  projection: 'unknown',
  minZoom: 0,
  maxZoom: 18,
  tileSize: 256,
  format: 'png',
  transportScheme: 'https',
  hosts: ['tiles.example.invalid'],
  pathTemplate: '/{$z}/{$x}/{$y}.png',
  queryParameters: {},
  requestPlanProvenance: {
    transportScheme: 'parsed',
    hosts: 'parsed',
    pathTemplate: 'parsed',
    queryParameters: {},
  },
  credentialRef: null,
  attribution: null,
  license: null,
  sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'synthetic-v1' },
  compatibilityExtension: {},
  status: 'parsed',
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
  lastVerifiedAt: null,
} as const;

describe('MapSourceDefinition', () => {
  it('accepts a bounded secret-free definition', () => {
    expect(parseMapSourceDefinition(validSource).name).toBe('Fixture XYZ');
  });

  it('keeps old persisted definitions loadable but labels their request plan as legacy unknown', () => {
    const { transportScheme: _scheme, requestPlanProvenance: _provenance, ...legacy } = validSource;
    expect(parseMapSourceDefinition(legacy)).toMatchObject({
      transportScheme: 'unknown',
      requestPlanProvenance: {
        transportScheme: 'legacy-unknown',
        hosts: 'legacy-unknown',
        pathTemplate: 'legacy-unknown',
        queryParameters: {},
      },
    });
  });

  it('requires exact provenance for public query parameters and explicit provenance for a known scheme', () => {
    expect(() => parseMapSourceDefinition({
      ...validSource,
      queryParameters: { style: 'satellite' },
    })).toThrow(/provenance/i);
    expect(() => parseMapSourceDefinition({
      ...validSource,
      requestPlanProvenance: { ...validSource.requestPlanProvenance, transportScheme: 'redacted' },
    })).toThrow(/known transport scheme/i);
  });

  it('recognizes only bounded public constants or tile variables as safe query fields', () => {
    expect(isSafeNonSecretQueryParameter('style', 'satellite')).toBe(true);
    expect(isSafeNonSecretQueryParameter('x', '{$x}')).toBe(true);
    expect(isSafeNonSecretQueryParameter('p', 'opaque-fixed-value')).toBe(false);
    expect(isSafeNonSecretQueryParameter('token', '{$x}')).toBe(false);
  });

  it.each(['token', 'apiKey', 'client_secret', 'cookie', 'authorization'])('rejects inline secret key %s', (key) => {
    expect(() => parseMapSourceDefinition({ ...validSource, queryParameters: { [key]: 'secret' } })).toThrow(/secret/i);
  });

  it('accepts only a vault reference owned by the same source UUID', () => {
    expect(() => parseMapSourceDefinition({ ...validSource, credentialRef: 'vault://credential-reference' })).toThrow();
    expect(() =>
      parseMapSourceDefinition({
        ...validSource,
        credentialRef: 'vault://source/018f4d39-32f1-7a31-9f60-81c6b453b887',
      }),
    ).toThrow(/same source/i);
    expect(
      parseMapSourceDefinition({ ...validSource, credentialRef: `vault://source/${validSource.id}` }).credentialRef,
    ).toBe(`vault://source/${validSource.id}`);
  });

  it('rejects invalid zoom ordering and non-host input', () => {
    expect(() => parseMapSourceDefinition({ ...validSource, minZoom: 19 })).toThrow();
    expect(() => parseMapSourceDefinition({ ...validSource, hosts: ['https://tiles.example.invalid/path'] })).toThrow();
  });
});

describe('ProbeResult', () => {
  const success = {
    schemaVersion: 1,
    sourceId: validSource.id,
    inputFingerprint: 'b'.repeat(64),
    startedAt: '2026-08-31T15:00:00.000Z',
    endedAt: '2026-08-31T15:00:01.000Z',
    category: 'success',
    httpStatus: 200,
    contentType: 'image/png',
    width: 256,
    height: 256,
    errorCode: null,
  } as const;

  it('accepts complete redacted image evidence', () => {
    expect(parseProbeResult(success)).toEqual(success);
  });

  it('rejects success without decoded dimensions and failures without stable error codes', () => {
    expect(() => parseProbeResult({ ...success, width: null })).toThrow(/validated image evidence/i);
    expect(() =>
      parseProbeResult({
        ...success,
        category: 'forbidden',
        httpStatus: 403,
        contentType: null,
        width: null,
        height: null,
      }),
    ).toThrow(/error code/i);
  });

  it('rejects unknown fields and reversed timestamps', () => {
    expect(() => parseProbeResult({ ...success, upstreamUrl: 'http://private.invalid' })).toThrow();
    expect(() => parseProbeResult({ ...success, endedAt: '2026-08-31T14:59:59.000Z' })).toThrow(/precede/i);
  });
});
