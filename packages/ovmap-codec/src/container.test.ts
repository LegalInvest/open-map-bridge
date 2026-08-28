import { describe, expect, it } from 'vitest';
import { decodeOviContainer } from './container.js';
import { buildSyntheticRecord37Ovmap } from './synthetic.js';

describe('OviO container', () => {
  it('rejects a false extension payload before decompression', () => {
    expect(() => decodeOviContainer(new Uint8Array([0, 1, 2]))).toThrow(/FORMAT_MAGIC/);
  });

  it('rejects a declared output larger than the limit', () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x4f, 0x76, 0x69, 0x4f]);
    const view = new DataView(bytes.buffer);
    view.setUint32(4, 24, true);
    view.setUint32(8, 9_000_000, true);
    expect(() => decodeOviContainer(bytes)).toThrow(/FORMAT_DECOMPRESS_LIMIT/);
  });

  it('rejects an unknown container family with the right magic', () => {
    const bytes = new Uint8Array(26);
    bytes.set([0x4f, 0x76, 0x69, 0x4f]);
    const view = new DataView(bytes.buffer);
    view.setUint32(4, bytes.length, true);
    expect(() => decodeOviContainer(bytes)).toThrow(/FORMAT_UNSUPPORTED_CONTAINER/);
  });

  it('rejects a compression ratio above the configured bound', () => {
    const file = buildSyntheticRecord37Ovmap([
      { mapId: 1, maxZoom: 1, name: 'A'.repeat(8_000), host: 'a.invalid', path: '/{$z}/{$x}/{$y}', group: 'G' },
    ]);
    expect(() => decodeOviContainer(file, { maxInput: 1_048_576, maxOutput: 8_388_608, maxRatio: 2 })).toThrow(
      /FORMAT_DECOMPRESS_RATIO/,
    );
  });
});
