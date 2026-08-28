export interface RasterDimensions {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function pngDimensions(bytes: Uint8Array): RasterDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 24
    || !signature.every((value, index) => bytes[index] === value)
    || u32be(bytes, 8) !== 13
    || !ascii(bytes, 12, 'IHDR')
  ) return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20), format: 'png' };
}

function jpegDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let cursor = 2;
  while (cursor < bytes.length) {
    while (bytes[cursor] === 0xff) cursor += 1;
    const marker = bytes[cursor];
    cursor += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.length) break;
    const length = u16be(bytes, cursor);
    if (length < 2 || cursor + length > bytes.length) break;
    if (sofMarkers.has(marker)) {
      if (length < 7) break;
      return { width: u16be(bytes, cursor + 5), height: u16be(bytes, cursor + 3), format: 'jpeg' };
    }
    cursor += length;
  }
  throw new Error('INPUT_QR_IMAGE_DIMENSIONS');
}

function webpDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 30 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null;
  if (ascii(bytes, 12, 'VP8X')) {
    return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1, format: 'webp' };
  }
  if (ascii(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
    const b1 = bytes[21]!;
    const b2 = bytes[22]!;
    const b3 = bytes[23]!;
    const b4 = bytes[24]!;
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      format: 'webp',
    };
  }
  if (ascii(bytes, 12, 'VP8 ') && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff, format: 'webp' };
  }
  throw new Error('INPUT_QR_IMAGE_DIMENSIONS');
}

export function readRasterDimensions(bytes: Uint8Array): RasterDimensions {
  const dimensions = pngDimensions(bytes) ?? jpegDimensions(bytes) ?? webpDimensions(bytes);
  if (!dimensions) throw new Error('INPUT_QR_IMAGE_FORMAT');
  if (!Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error('INPUT_QR_IMAGE_DIMENSIONS');
  }
  return dimensions;
}
