import { describe, expect, it, vi } from 'vitest';
import { buildSyntheticRecord37Ovmap } from '@omb/ovmap-codec/synthetic';
import { createImportInspector } from './inspector.js';

const layers = [
  { mapId: 204, maxZoom: 18, name: '卫星 A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
  { mapId: 205, maxZoom: 18, name: '路网 B', host: 'b.example.invalid', path: '/{$z}/{$x}/{$y}.png?token=hidden', group: 'G' },
];

describe('zero-network import inspector', () => {
  it('normalizes every ovmap record without any upstream call', async () => {
    const networkAttempt = vi.fn();
    const inspector = createImportInspector({
      now: () => new Date('2026-08-28T00:00:00.000Z'),
      networkAttempt,
    });
    const preview = await inspector.inspectOvmap(buildSyntheticRecord37Ovmap(layers));
    expect(preview.layers).toHaveLength(2);
    expect(preview.layers.every((layer) => layer.source.status === 'parsed')).toBe(true);
    expect(preview.layers[1]?.requiresCredential).toBe(true);
    expect(preview.layers[1]?.source.pathTemplate).not.toContain('token');
    expect(networkAttempt).not.toHaveBeenCalled();
  });

  it('normalizes an ovobj QR without returning raw payload fields', async () => {
    const inspector = createImportInspector({ now: () => new Date('2026-08-28T00:00:00.000Z') });
    const preview = await inspector.inspectQr(
      'ovobj?t=1&id=402&na=Fixture%20Map&po=1&he=opaque&oy=3&df=0&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png',
    );
    expect(preview.layers[0]?.source).toMatchObject({ name: 'Fixture Map', legacyId: 402, projection: 'unknown' });
    expect(JSON.stringify(preview)).not.toContain('opaque');
  });

  it('redacts a fixed query value even when its key is not a known secret word', async () => {
    const inspector = createImportInspector({ now: () => new Date('2026-08-28T00:00:00.000Z') });
    const preview = await inspector.inspectOvmap(buildSyntheticRecord37Ovmap([
      { mapId: 206, maxZoom: 18, name: 'Redaction', host: 'r.example.invalid', path: '/{$z}/{$x}/{$y}.png?p=opaque-fixed-value', group: 'G' },
    ]));
    expect(preview.layers[0]?.requiresCredential).toBe(true);
    expect(JSON.stringify(preview)).not.toContain('opaque-fixed-value');
  });
});
