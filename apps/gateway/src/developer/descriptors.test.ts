import { expect, it } from 'vitest';
import { parseMapSourceDefinition } from '@omb/source-schema';
import { describeImportedSource, describeRuntimeSource } from './descriptors.js';

const imported = parseMapSourceDefinition({
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  legacyId: 402,
  name: 'Authorized source',
  sourceKind: 'qr',
  protocol: 'ovi-template',
  projection: 'unknown',
  minZoom: 0,
  maxZoom: 18,
  tileSize: 256,
  format: 'png',
  hosts: ['upstream-secret.example.invalid'],
  pathTemplate: '/private/{$z}/{$x}/{$y}.png',
  queryParameters: { harmless: 'internal-only' },
  credentialRef: 'vault://source/018f4d39-32f1-7a31-9f60-81c6b453b886',
  attribution: 'Fixture attribution',
  license: null,
  sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'test-adapter' },
  compatibilityExtension: { privateCode: 'do-not-export' },
  status: 'confirmed',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  lastVerifiedAt: null,
});

it('serializes imported sources by whitelist instead of copying the internal definition', () => {
  const serialized = JSON.stringify(describeImportedSource(imported));
  expect(serialized).toContain('Authorized source');
  for (const forbidden of [
    'upstream-secret.example.invalid',
    '/private/',
    'internal-only',
    'vault://source/',
    'a'.repeat(64),
    'privateCode',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
});

it('does not grant tile or temporal capabilities to a merely configured Ovi bridge', () => {
  const descriptor = describeRuntimeSource({
    id: 'ovi-history-200',
    name: 'Configured Ovi bridge',
    kind: 'ovi-bridge',
    availability: 'configured',
    datePrecision: 'request-date-only',
    adapter: {
      probe: async () => ({ ok: false, detail: 'not-probed' }),
      listDates: async () => [],
      tile: async () => ({ status: 404, contentType: 'application/json', body: new Uint8Array() }),
    },
  });
  expect(descriptor).toMatchObject({ accessStatus: 'metadata-only', capabilities: ['metadata'] });
  expect(descriptor.links).toEqual({ self: '/api/v1/developer/sources/ovi-history-200' });
});
