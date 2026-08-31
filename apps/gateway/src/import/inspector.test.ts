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

  it('preserves a bounded non-secret constant query value with field provenance', async () => {
    const inspector = createImportInspector({ now: () => new Date('2026-08-28T00:00:00.000Z') });
    const preview = await inspector.inspectOvmap(buildSyntheticRecord37Ovmap([
      { mapId: 207, maxZoom: 18, name: 'Public style', host: 'https://r.example.invalid', path: '/{$z}/{$x}/{$y}.png?style=satellite', group: 'G' },
    ]));
    expect(preview.layers[0]?.requiresCredential).toBe(false);
    expect(preview.layers[0]?.source).toMatchObject({
      transportScheme: 'https',
      hosts: ['r.example.invalid'],
      queryParameters: { style: 'satellite' },
      requestPlanProvenance: {
        transportScheme: 'parsed',
        hosts: 'parsed',
        pathTemplate: 'parsed',
        queryParameters: { style: 'parsed' },
      },
    });
  });

  it('preserves only observed opaque QR field names in the open compatibility record', async () => {
    const inspector = createImportInspector({ now: () => new Date('2026-08-28T00:00:00.000Z') });
    const preview = await inspector.inspectQr(
      'ovobj?t=1&id=402&na=Dialect&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png&hs=hidden-hs&mt=hidden-mt&pt=hidden-pt',
    );
    expect(preview.layers[0]?.source.compatibilityExtension.observedOpaqueFields).toEqual(['hs', 'mt', 'pt']);
    expect(JSON.stringify(preview)).not.toContain('hidden-');
  });

  it('preserves complete secret-free OMS source facts instead of flattening them', async () => {
    const inspector = createImportInspector({ now: () => new Date('2026-08-28T00:00:00.000Z') });
    const definition = {
      schemaVersion: 1,
      id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
      legacyId: 208,
      name: 'OMS WMTS',
      sourceKind: 'manual',
      protocol: 'wmts',
      projection: 'EPSG:4326',
      minZoom: 2,
      maxZoom: 14,
      tileSize: 512,
      format: 'jpg',
      transportScheme: 'https',
      hosts: ['wmts.example.invalid'],
      pathTemplate: '/service/{$z}/{$x}/{$y}.jpg',
      queryParameters: { style: 'satellite' },
      requestPlanProvenance: {
        transportScheme: 'parsed',
        hosts: 'parsed',
        pathTemplate: 'parsed',
        queryParameters: { style: 'parsed' },
      },
      credentialRef: null,
      attribution: 'Fixture attribution',
      license: 'Fixture license',
      sourceProvenance: { inputSha256: 'b'.repeat(64), adapter: 'fixture-author' },
      compatibilityExtension: { fixtureFlag: true, credentialRequired: false },
      status: 'saved',
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
      lastVerifiedAt: '2026-08-27T00:00:00.000Z',
    };
    const payload = `oms1:${Buffer.from(JSON.stringify(definition)).toString('base64url')}`;
    const preview = await inspector.inspectQr(payload);
    expect(preview.layers[0]?.source).toMatchObject({
      sourceKind: 'oms',
      protocol: 'wmts',
      projection: 'EPSG:4326',
      minZoom: 2,
      maxZoom: 14,
      tileSize: 512,
      format: 'jpg',
      transportScheme: 'https',
      hosts: ['wmts.example.invalid'],
      queryParameters: { style: 'satellite' },
      attribution: 'Fixture attribution',
      license: 'Fixture license',
      status: 'parsed',
      sourceProvenance: { adapter: 'oms-qr-v1' },
    });
    expect(preview.layers[0]?.warnings).toEqual([]);
    expect(preview.layers[0]?.source.id).not.toBe(definition.id);
  });
});
