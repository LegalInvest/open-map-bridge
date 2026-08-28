import { describe, expect, it } from 'vitest';
import { decodeOviMap } from './index.js';
import { buildSyntheticRecord37Ovmap } from './synthetic.js';
import { decodeOviContainer } from './container.js';
import { decodeRecord37Payload } from './record37.js';

describe('record37-zlib', () => {
  it('decodes five bounded layers from one file', () => {
    const file = buildSyntheticRecord37Ovmap([
      { mapId: 204, maxZoom: 18, name: 'A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
      { mapId: 205, maxZoom: 18, name: 'B', host: 'b.example.invalid', path: '/{$z}/{$x}/{$y}.png', group: 'G' },
      { mapId: 209, maxZoom: 18, name: 'C', host: 'c.example.invalid', path: '/tile?z={$z}&x={$x}&y={$y}', group: 'G' },
      { mapId: 213, maxZoom: 18, name: 'D', host: 'd.example.invalid', path: '/{$z}/{$x/16}/{$y/16}.jpg', group: 'G' },
      { mapId: 214, maxZoom: 18, name: 'E', host: 'e.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    ]);
    const result = decodeOviMap(file);
    expect(result.family).toBe('record37-zlib');
    expect(result.layers.map((layer) => [layer.legacyId, layer.name])).toEqual([
      [204, 'A'], [205, 'B'], [209, 'C'], [213, 'D'], [214, 'E'],
    ]);
  });

  it('rejects truncated and invalid UTF-8 records', () => {
    const valid = buildSyntheticRecord37Ovmap([
      { mapId: 204, maxZoom: 18, name: 'A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    ]);
    expect(() => decodeOviMap(valid.subarray(0, valid.length - 1))).toThrow();
  });

  it('rejects invalid UTF-8 and oversized strings before creating a layer', () => {
    const valid = buildSyntheticRecord37Ovmap([
      { mapId: 204, maxZoom: 18, name: 'A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    ]);
    const payload = decodeOviContainer(valid).payload.slice();
    payload[132] = 0xff;
    expect(() => decodeRecord37Payload(payload)).toThrow(/FORMAT_UTF8/);
    new DataView(payload.buffer, payload.byteOffset, payload.byteLength).setUint32(128, 9_000, true);
    expect(() => decodeRecord37Payload(payload)).toThrow(/FORMAT_STRING_LIMIT/);
  });

  it('caps a bundle at one thousand records', () => {
    const one = buildSyntheticRecord37Ovmap([
      { mapId: 1, maxZoom: 1, name: 'A', host: 'a.invalid', path: '/{$z}/{$x}/{$y}', group: 'G' },
    ]);
    const record = decodeOviContainer(one).payload;
    const payload = new Uint8Array(record.length * 1_001);
    for (let index = 0; index < 1_001; index += 1) payload.set(record, index * record.length);
    expect(() => decodeRecord37Payload(payload)).toThrow(/FORMAT_RECORD_COUNT/);
  });
});
