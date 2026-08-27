import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { TemporalStateRepository } from './temporal-state.js';

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
