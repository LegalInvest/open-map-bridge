import { inflateSync } from 'node:zlib';

export interface OvMapLimits {
  maxInput: number;
  maxOutput: number;
  maxRatio: number;
}

export interface DecodedOviContainer {
  magic: 'OviO';
  family: 'record37-zlib';
  payload: Uint8Array;
  header: Uint8Array;
}

const defaultLimits: OvMapLimits = {
  maxInput: 1_048_576,
  maxOutput: 8_388_608,
  maxRatio: 64,
};

function isZlibHeader(cmf: number, flg: number): boolean {
  return (cmf & 0x0f) === 8 && ((cmf << 8) + flg) % 31 === 0;
}

export function decodeOviContainer(input: Uint8Array, limits: OvMapLimits = defaultLimits): DecodedOviContainer {
  if (input.length > limits.maxInput) throw new Error('FORMAT_INPUT_LIMIT');
  if (input.length < 24 || new TextDecoder().decode(input.subarray(0, 4)) !== 'OviO') throw new Error('FORMAT_MAGIC');

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const declaredFileSize = view.getUint32(4, true);
  const declaredOutputSize = view.getUint32(8, true);
  if (declaredFileSize !== input.length) throw new Error('FORMAT_DECLARED_SIZE');
  if (declaredOutputSize > limits.maxOutput) throw new Error('FORMAT_DECOMPRESS_LIMIT');

  const compressed = input.subarray(24);
  if (compressed.length < 2 || !isZlibHeader(compressed[0] ?? 0, compressed[1] ?? 0)) {
    throw new Error('FORMAT_UNSUPPORTED_CONTAINER');
  }
  if (compressed.length > 0 && declaredOutputSize / compressed.length > limits.maxRatio) {
    throw new Error('FORMAT_DECOMPRESS_RATIO');
  }

  let payload: Uint8Array;
  try {
    payload = inflateSync(compressed, { maxOutputLength: limits.maxOutput });
  } catch {
    throw new Error('FORMAT_DECOMPRESS_FAILED');
  }
  if (payload.length !== declaredOutputSize) throw new Error('FORMAT_OUTPUT_SIZE');
  return {
    magic: 'OviO',
    family: 'record37-zlib',
    payload,
    header: input.slice(0, 24),
  };
}
