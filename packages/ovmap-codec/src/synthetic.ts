import { deflateSync } from 'node:zlib';

export interface SyntheticLayer37 {
  mapId: number;
  maxZoom: number;
  name: string;
  host: string;
  path: string;
  group: string;
}

function encodeString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  const output = new Uint8Array(4 + text.length);
  new DataView(output.buffer).setUint32(0, text.length, true);
  output.set(text, 4);
  return output;
}

function buildRecord(layer: SyntheticLayer37): Uint8Array {
  const parts = [layer.name, layer.host, layer.path, layer.group].map(encodeString);
  const totalLength = 128 + parts.reduce((sum, part) => sum + part.length, 0);
  const record = new Uint8Array(totalLength);
  const view = new DataView(record.buffer);
  view.setUint32(0, totalLength - 8, true);
  view.setUint32(24, layer.mapId, true);
  view.setUint32(32, layer.maxZoom, true);
  let cursor = 128;
  for (const part of parts) {
    record.set(part, cursor);
    cursor += part.length;
  }
  return record;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

export function buildSyntheticRecord37Ovmap(layers: SyntheticLayer37[]): Uint8Array {
  const payload = concat(layers.map(buildRecord));
  const compressed = deflateSync(payload, { level: 1 });
  const file = new Uint8Array(24 + compressed.length);
  file.set(new TextEncoder().encode('OviO'));
  const view = new DataView(file.buffer);
  view.setUint32(4, file.length, true);
  view.setUint32(8, payload.length, true);
  file.set(compressed, 24);
  return file;
}
