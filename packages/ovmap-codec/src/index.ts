import { decodeOviContainer, type OvMapLimits } from './container.js';
import { decodeRecord37Payload, type RawOviLayer37 } from './record37.js';

export interface DecodedOvMapBundle {
  magic: 'OviO';
  family: 'record37-zlib';
  layers: RawOviLayer37[];
}

export function decodeOviMap(input: Uint8Array, limits?: OvMapLimits): DecodedOvMapBundle {
  const container = decodeOviContainer(input, limits);
  return { magic: container.magic, family: container.family, layers: decodeRecord37Payload(container.payload) };
}

export * from './container.js';
export * from './record37.js';
