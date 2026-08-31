import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { TemporalStateRepository } from './temporal-state.js';
import { parseAutomationRun, parseMapSourceDefinition } from '@omb/source-schema';

it('atomically preserves AOI versions and comparison receipts across reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-temporal-state-'));
  const path = join(directory, 'state.json');
  const first = await TemporalStateRepository.open(path, lakeAoiPresets);
  await first.appendComparison({
    schemaVersion: 1,
    id: 'comparison-1',
    sourceId: 'synthetic-lakes',
    aoiId: 'baoying-lake',
    aoiVersion: 1,
    dateIds: ['scene-2006', 'scene-2012', 'scene-2018', 'scene-2025'],
    viewState: { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' },
    frames: ['scene-2006', 'scene-2012', 'scene-2018', 'scene-2025'].map((dateId) => ({
      dateId,
      status: 'loaded' as const,
      expectedTileCount: 6,
      loadedTileCount: 6,
      failedTileCount: 0,
    })),
    createdAt: '2026-09-01T00:00:00.000Z',
  });
  const reopened = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopened.listComparisons()).toHaveLength(1);
  expect(reopened.listComparisons()[0]?.aoiVersion).toBe(1);
  expect((await readFile(path, 'utf8')).includes('host')).toBe(false);
});

it('rejects a comparison whose immutable AOI version is absent', async () => {
  const repository = await TemporalStateRepository.open(null, lakeAoiPresets);
  await expect(repository.appendComparison({
    schemaVersion: 1,
    id: 'comparison-unknown-aoi',
    sourceId: 'synthetic-lakes',
    aoiId: 'unknown-area',
    aoiVersion: 1,
    dateIds: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2025'],
    viewState: { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' },
    frames: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2025'].map((dateId) => ({
      dateId,
      status: 'loaded' as const,
      expectedTileCount: 1,
      loadedTileCount: 1,
      failedTileCount: 0,
    })),
    createdAt: '2026-09-01T00:00:00.000Z',
  })).rejects.toThrow('AOI version not found');
});

it('atomically preserves confirmed import sources and receipts across reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-import-state-'));
  const path = join(directory, 'state.json');
  const repository = await TemporalStateRepository.open(path, lakeAoiPresets);
  const source = parseMapSourceDefinition({
    schemaVersion: 1,
    id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
    legacyId: 402,
    name: 'Fixture',
    sourceKind: 'qr',
    protocol: 'ovi-template',
    projection: 'unknown',
    minZoom: 0,
    maxZoom: 0,
    tileSize: 256,
    format: 'png',
    hosts: ['tiles.example.invalid'],
    pathTemplate: '/{$z}/{$x}/{$y}.png',
    queryParameters: {},
    credentialRef: null,
    attribution: null,
    license: null,
    sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'ovi-query-v1' },
    compatibilityExtension: {},
    status: 'confirmed',
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    lastVerifiedAt: null,
  });
  await repository.appendConfirmedImport({
    sources: [source],
    receipt: {
      receiptId: '018f4d39-32f1-7a31-9f60-81c6b453b887',
      batchId: '018f4d39-32f1-7a31-9f60-81c6b453b888',
      inputSha256: 'a'.repeat(64),
      parser: 'ovi-query-v1',
      confirmedAt: '2026-08-28T00:00:00.000Z',
      results: [{ candidateId: 'candidate-1', sourceId: source.id, status: 'confirmed', errorCode: null }],
      undoneAt: null,
    },
  });
  const reopened = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopened.listImportSources()).toEqual([source]);
  expect(reopened.listImportReceipts()).toHaveLength(1);

  const credentialRef = `vault://source/${source.id}`;
  await reopened.setImportSourceCredentialRef(source.id, credentialRef);
  const reopenedAgain = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopenedAgain.listImportSources()[0]?.credentialRef).toBe(credentialRef);
  expect(await reopenedAgain.setImportSourceCredentialRef(source.id, null)).toMatchObject({ credentialRef: null });
});

it('persists an automation run once under concurrent duplicate starts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-automation-state-'));
  const path = join(directory, 'state.json');
  const repository = await TemporalStateRepository.open(path, lakeAoiPresets);
  const run = parseAutomationRun({
    schemaVersion: 1,
    id: '018f4d39-32f1-7a31-9f60-81c6b453b889',
    processId: 'source-readiness',
    inputFingerprint: 'b'.repeat(64),
    sourceId: '018f4d39-32f1-7a31-9f60-81c6b453b886',
    sourceName: 'Fixture',
    status: 'blocked',
    currentStep: 'runtime-binding',
    nextAction: '绑定运行时',
    intervention: null,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    steps: [
      { kind: 'source-confirmed', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: 'ok', nextAction: '' },
      { kind: 'network-policy', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: 'ok', nextAction: '' },
      { kind: 'credential-readiness', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: 'ok', nextAction: '' },
      { kind: 'runtime-binding', status: 'blocked', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: 'RUNTIME_NOT_BOUND', message: 'blocked', nextAction: '绑定运行时' },
    ],
  });
  const [first, second] = await Promise.all([repository.ensureAutomationRun(run), repository.ensureAutomationRun(run)]);
  expect([first.created, second.created].sort()).toEqual([false, true]);
  const reopened = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopened.listAutomationRuns()).toEqual([run]);
});

it('atomically persists one redacted probe result per source input fingerprint', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-probe-state-'));
  const path = join(directory, 'state.json');
  const repository = await TemporalStateRepository.open(path, lakeAoiPresets);
  const result = {
    schemaVersion: 1 as const,
    sourceId: '018f4d39-32f1-7a31-9f60-81c6b453b886',
    inputFingerprint: 'c'.repeat(64),
    startedAt: '2026-08-31T15:00:00.000Z',
    endedAt: '2026-08-31T15:00:01.000Z',
    category: 'forbidden' as const,
    httpStatus: 403,
    contentType: null,
    width: null,
    height: null,
    errorCode: 'PROBE_HTTP_403',
  };
  const [first, second] = await Promise.all([
    repository.ensureProbeResult(result),
    repository.ensureProbeResult({ ...result, endedAt: '2026-08-31T15:00:02.000Z' }),
  ]);
  expect([first.created, second.created].sort()).toEqual([false, true]);

  const reopened = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopened.listProbeResults()).toHaveLength(1);
  expect(reopened.findProbeResult(result.sourceId, result.inputFingerprint)).toEqual(result);
  const serialized = await readFile(path, 'utf8');
  expect(serialized).not.toContain('upstreamUrl');
  expect(serialized).not.toContain('credential');
});
