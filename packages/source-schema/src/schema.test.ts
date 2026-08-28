import { describe, expect, it } from 'vitest';
import { parseMapSourceDefinition } from './index.js';

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
  hosts: ['tiles.example.invalid'],
  pathTemplate: '/{$z}/{$x}/{$y}.png',
  queryParameters: {},
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

  it.each(['token', 'apiKey', 'client_secret', 'cookie', 'authorization'])('rejects inline secret key %s', (key) => {
    expect(() => parseMapSourceDefinition({ ...validSource, queryParameters: { [key]: 'secret' } })).toThrow(/secret/i);
  });

  it('rejects invalid zoom ordering and non-host input', () => {
    expect(() => parseMapSourceDefinition({ ...validSource, minZoom: 19 })).toThrow();
    expect(() => parseMapSourceDefinition({ ...validSource, hosts: ['https://tiles.example.invalid/path'] })).toThrow();
  });
});
