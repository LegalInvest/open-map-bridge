import { BoundedReader } from './reader.js';

export interface RawOviLayer37 {
  legacyId: number;
  maxZoom: number;
  name: string;
  host: string;
  pathTemplate: string;
  group: string;
  projectionCode: number;
  imageKindCode: number;
  unknownHeaderWords: number[];
}

const textDecoder = new TextDecoder('utf-8', { fatal: true });

function decodeString(reader: BoundedReader, cursor: number, end: number): { value: string; next: number } {
  const length = reader.u32(cursor, 'FORMAT_STRING_LENGTH');
  if (length > 8192 || cursor + 4 + length > end) throw new Error('FORMAT_STRING_LIMIT');
  try {
    return { value: textDecoder.decode(reader.slice(cursor + 4, length)), next: cursor + 4 + length };
  } catch {
    throw new Error('FORMAT_UTF8');
  }
}

export function decodeRecord37Payload(payload: Uint8Array): RawOviLayer37[] {
  const reader = new BoundedReader(payload);
  const layers: RawOviLayer37[] = [];
  let cursor = 0;
  while (cursor < payload.length) {
    if (layers.length >= 1000) throw new Error('FORMAT_RECORD_COUNT');
    const recordLength = reader.u32(cursor, 'FORMAT_RECORD_LENGTH');
    const totalLength = recordLength + 8;
    if (totalLength < 144 || cursor + totalLength > payload.length) throw new Error('FORMAT_RECORD_BOUNDS');
    const recordEnd = cursor + totalLength;
    const stringsStart = cursor + 128;
    const name = decodeString(reader, stringsStart, recordEnd);
    const host = decodeString(reader, name.next, recordEnd);
    const path = decodeString(reader, host.next, recordEnd);
    const group = decodeString(reader, path.next, recordEnd);
    const unknownHeaderWords: number[] = [];
    for (let offset = cursor + 8; offset < stringsStart; offset += 4) unknownHeaderWords.push(reader.u32(offset));
    layers.push({
      legacyId: reader.u32(cursor + 24),
      maxZoom: reader.u32(cursor + 32),
      name: name.value,
      host: host.value,
      pathTemplate: path.value,
      group: group.value,
      projectionCode: 0,
      imageKindCode: 0,
      unknownHeaderWords,
    });
    cursor = recordEnd;
  }
  if (cursor !== payload.length) throw new Error('FORMAT_TRAILING_BYTES');
  return layers;
}
