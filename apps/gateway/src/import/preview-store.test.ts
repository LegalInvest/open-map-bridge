import { expect, it } from 'vitest';
import type { ImportPreview } from '@omb/source-schema';
import { ImportPreviewStore } from './preview-store.js';

function preview(id: string, expiresAt = '2099-01-01T00:00:00.000Z', parser = 'fixture'): ImportPreview {
  return {
    previewId: id,
    inputType: 'qr',
    inputSha256: 'a'.repeat(64),
    parser,
    layers: [],
    warnings: [],
    expiresAt,
  };
}

it('expires previews by TTL and prunes expired entries on later writes', () => {
  const store = new ImportPreviewStore({ maxEntries: 2, maxBytes: 10_000 });
  store.put(preview('expired', '2026-08-28T12:01:00.000Z'), new Date('2026-08-28T12:00:00.000Z'));
  store.put(preview('fresh-a'), new Date('2026-08-28T12:02:00.000Z'));
  store.put(preview('fresh-b'), new Date('2026-08-28T12:02:00.000Z'));
  expect(() => store.get('expired', new Date('2026-08-28T12:02:00.000Z'))).toThrow('INPUT_PREVIEW_NOT_FOUND');
  expect(store.get('fresh-a').previewId).toBe('fresh-a');
  expect(store.get('fresh-b').previewId).toBe('fresh-b');
});

it('evicts the least recently used preview when the count limit is reached', () => {
  const store = new ImportPreviewStore({ maxEntries: 2, maxBytes: 10_000 });
  store.put(preview('a'));
  store.put(preview('b'));
  store.get('a');
  store.put(preview('c'));
  expect(() => store.get('b')).toThrow('INPUT_PREVIEW_NOT_FOUND');
  expect(store.get('a').previewId).toBe('a');
  expect(store.get('c').previewId).toBe('c');
});

it('enforces both the aggregate byte limit and the single-preview byte limit', () => {
  const a = preview('a', undefined, 'a'.repeat(100));
  const b = preview('b', undefined, 'b'.repeat(100));
  const bytes = (value: ImportPreview) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  const store = new ImportPreviewStore({ maxEntries: 10, maxBytes: bytes(a) + bytes(b) - 1 });
  store.put(a);
  store.put(b);
  expect(() => store.get('a')).toThrow('INPUT_PREVIEW_NOT_FOUND');
  expect(store.get('b').previewId).toBe('b');

  const tooSmall = new ImportPreviewStore({ maxEntries: 10, maxBytes: bytes(a) - 1 });
  expect(() => tooSmall.put(a)).toThrow('INPUT_PREVIEW_TOO_LARGE');
});

it('stores and returns clones instead of caller-owned objects', () => {
  const store = new ImportPreviewStore();
  const input = preview('clone');
  store.put(input);
  input.parser = 'mutated-outside';
  const first = store.get('clone');
  first.parser = 'mutated-result';
  expect(store.get('clone').parser).toBe('fixture');
});
