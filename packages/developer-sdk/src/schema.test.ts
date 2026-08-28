import { describe, expect, it } from 'vitest';
import { parseDeveloperAppManifest, parseDeveloperSourceDescriptor } from './index.js';

const descriptor = {
  apiVersion: 'v1',
  id: 'synthetic-lakes',
  name: 'Synthetic source',
  providerKind: 'synthetic',
  protocol: 'temporal-adapter',
  projection: 'unknown',
  lifecycle: 'ready',
  accessStatus: 'ready',
  capabilities: ['metadata', 'temporal-catalog', 'tiles'],
  datePrecision: 'capture-date',
  attribution: null,
  license: null,
  links: {
    self: '/api/v1/developer/sources/synthetic-lakes',
    dates: '/api/v1/developer/sources/synthetic-lakes/dates',
    tileTemplate: '/api/v1/developer/sources/synthetic-lakes/tiles/{dateId}/{z}/{x}/{y}',
  },
} as const;

describe('developer contract', () => {
  it('accepts a strict V1 capability descriptor', () => {
    expect(parseDeveloperSourceDescriptor(descriptor).capabilities).toContain('tiles');
    expect(() => parseDeveloperSourceDescriptor({ ...descriptor, hosts: ['secret.invalid'] })).toThrow();
  });

  it('fails closed on unknown API versions, permissions, fields and mismatched grants', () => {
    const manifest = {
      schemaVersion: 1,
      id: 'org.example.history',
      name: 'History consumer',
      apiVersion: 'v1',
      requiredCapabilities: ['metadata', 'temporal-catalog'],
      permissions: ['read-source-metadata', 'read-temporal-catalog'],
    };
    expect(parseDeveloperAppManifest(manifest).id).toBe('org.example.history');
    expect(() => parseDeveloperAppManifest({ ...manifest, apiVersion: 'v2' })).toThrow();
    expect(() => parseDeveloperAppManifest({ ...manifest, permissions: ['network:*'] })).toThrow();
    expect(() => parseDeveloperAppManifest({ ...manifest, secret: 'nope' })).toThrow();
    expect(() => parseDeveloperAppManifest({ ...manifest, permissions: ['read-source-metadata'] })).toThrow(
      /read-temporal-catalog/,
    );
  });
});
