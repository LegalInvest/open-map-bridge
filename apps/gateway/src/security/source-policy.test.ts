import { expect, it } from 'vitest';
import { parseMapSourceDefinition, type MapSourceDefinition } from '@omb/source-schema';
import { inspectSourceNetworkPolicy } from './source-policy.js';

function source(overrides: Partial<MapSourceDefinition> = {}): MapSourceDefinition {
  return parseMapSourceDefinition({
    schemaVersion: 1,
    id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
    legacyId: 402,
    name: 'Fixture',
    sourceKind: 'qr',
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
    sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'fixture' },
    compatibilityExtension: { credentialRequired: false },
    status: 'confirmed',
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    lastVerifiedAt: null,
    ...overrides,
  });
}

it('allows a public domain only as a zero-network static result', () => {
  expect(inspectSourceNetworkPolicy(source())).toEqual(expect.objectContaining({ decision: 'allowed', code: null }));
});

it('permanently blocks cloud metadata and unsafe paths', () => {
  expect(inspectSourceNetworkPolicy(source({ hosts: ['169.254.169.254'] }))).toEqual(
    expect.objectContaining({ decision: 'blocked', code: 'POLICY_METADATA_HOST' }),
  );
  expect(inspectSourceNetworkPolicy(source({ hosts: ['[::ffff:169.254.169.254]'] }))).toEqual(
    expect.objectContaining({ decision: 'blocked', code: 'POLICY_METADATA_HOST' }),
  );
  expect(inspectSourceNetworkPolicy(source({ pathTemplate: '/../secret' }))).toEqual(
    expect.objectContaining({ decision: 'blocked', code: 'POLICY_PATH_TEMPLATE' }),
  );
  expect(inspectSourceNetworkPolicy(source({ pathTemplate: '/tiles/%2e%2e/secret' }))).toEqual(
    expect.objectContaining({ decision: 'blocked', code: 'POLICY_PATH_TEMPLATE' }),
  );
});

it('requires explicit enterprise review for private and nonstandard endpoints', () => {
  expect(inspectSourceNetworkPolicy(source({ hosts: ['10.0.0.4'] }))).toEqual(
    expect.objectContaining({ decision: 'intervention', code: 'POLICY_PRIVATE_IP_REVIEW' }),
  );
  expect(inspectSourceNetworkPolicy(source({ hosts: ['tiles.example.invalid:8443'] }))).toEqual(
    expect.objectContaining({ decision: 'intervention', code: 'POLICY_ENTERPRISE_PORT_REVIEW' }),
  );
});

it('fails closed for unknown, insecure, or unproven generic request plans', () => {
  expect(inspectSourceNetworkPolicy(source({ transportScheme: 'unknown' }))).toEqual(
    expect.objectContaining({ decision: 'intervention', code: 'POLICY_TRANSPORT_SCHEME_UNKNOWN' }),
  );
  expect(inspectSourceNetworkPolicy(source({ transportScheme: 'http' }))).toEqual(
    expect.objectContaining({ decision: 'intervention', code: 'POLICY_INSECURE_TRANSPORT_REVIEW' }),
  );
  expect(inspectSourceNetworkPolicy(source({
    requestPlanProvenance: {
      transportScheme: 'parsed',
      hosts: 'redacted',
      pathTemplate: 'parsed',
      queryParameters: {},
    },
  }))).toEqual(expect.objectContaining({ decision: 'intervention', code: 'POLICY_REQUEST_PLAN_UNVERIFIED' }));
});

it('keeps opaque Ovi bridge records on the controlled bridge path', () => {
  expect(inspectSourceNetworkPolicy(source({
    transportScheme: 'unknown',
    requestPlanProvenance: {
      transportScheme: 'redacted',
      hosts: 'parsed',
      pathTemplate: 'redacted',
      queryParameters: {},
    },
    compatibilityExtension: { credentialRequired: true, needsOviBridge: true },
  }))).toEqual(expect.objectContaining({ decision: 'allowed', code: null }));
});
