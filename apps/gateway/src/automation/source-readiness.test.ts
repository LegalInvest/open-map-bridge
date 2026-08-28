import { expect, it } from 'vitest';
import { parseMapSourceDefinition } from '@omb/source-schema';
import { SyntheticTemporalAdapter } from '../temporal/synthetic-adapter.js';
import { TemporalSourceRegistry } from '../temporal/registry.js';
import { buildSourceReadinessRun } from './source-readiness.js';

const source = parseMapSourceDefinition({
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  legacyId: null,
  name: 'Bound Fixture',
  sourceKind: 'manual',
  protocol: 'xyz',
  projection: 'EPSG:3857',
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
  sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'fixture' },
  compatibilityExtension: { credentialRequired: false },
  status: 'confirmed',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  lastVerifiedAt: null,
});

function registry(availability: 'configured' | 'ready') {
  const value = new TemporalSourceRegistry();
  value.register({
    id: source.id,
    name: 'Bound Fixture Runtime',
    kind: 'synthetic',
    availability,
    datePrecision: 'capture-date',
    adapter: new SyntheticTemporalAdapter(),
  });
  return value;
}

it('completes only the static readiness run when the exact runtime is ready', () => {
  const run = buildSourceReadinessRun(source, registry('ready'), '2026-08-28T00:00:00.000Z');
  expect(run.status).toBe('completed');
  expect(run.currentStep).toBeNull();
  expect(run.nextAction).toContain('真实探测');
  expect(run.steps.every((step) => step.externalRequest === false)).toBe(true);
});

it('changes the deduplication fingerprint when runtime readiness changes', () => {
  const configured = buildSourceReadinessRun(source, registry('configured'), '2026-08-28T00:00:00.000Z');
  const ready = buildSourceReadinessRun(source, registry('ready'), '2026-08-28T00:00:00.000Z');
  expect(configured.status).toBe('blocked');
  expect(configured.inputFingerprint).not.toBe(ready.inputFingerprint);
});
