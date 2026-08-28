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
    id: 'comparison-1',
    sourceId: 'synthetic-lakes',
    aoiId: 'baoying-lake',
    aoiVersion: 1,
    dateIds: ['scene-2006', 'scene-2012', 'scene-2018', 'scene-2025'],
    viewState: { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' },
    frames: [],
  });
  const reopened = await TemporalStateRepository.open(path, lakeAoiPresets);
  expect(reopened.listComparisons()).toHaveLength(1);
  expect(reopened.listComparisons()[0]?.aoiVersion).toBe(1);
  expect((await readFile(path, 'utf8')).includes('host')).toBe(false);
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
