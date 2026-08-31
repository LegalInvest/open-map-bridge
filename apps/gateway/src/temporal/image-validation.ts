import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface ImageHeader {
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

const MAX_IMAGE_DIMENSION = 2048;
const MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION ** 2;
function imageHeader(bytes: Uint8Array): ImageHeader {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) break;
      if (
        marker !== undefined &&
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
      ) {
        return {
          format: 'jpeg',
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }
  throw new Error('Ovi bridge response is not a supported PNG or JPEG');
}

function requireSafeDimensions(header: ImageHeader): void {
  const pixels = header.width * header.height;
  if (
    !Number.isSafeInteger(header.width) ||
    !Number.isSafeInteger(header.height) ||
    header.width < 1 ||
    header.height < 1 ||
    header.width > MAX_IMAGE_DIMENSION ||
    header.height > MAX_IMAGE_DIMENSION ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAX_IMAGE_PIXELS
  ) {
    throw new Error('Ovi bridge image dimensions exceed the safe tile limit');
  }
}

export function validateDecodedTile(bytes: Uint8Array, contentType: string): ImageHeader {
  const header = imageHeader(bytes);
  if (
    (header.format === 'png' && contentType !== 'image/png') ||
    (header.format === 'jpeg' && contentType !== 'image/jpeg')
  ) {
    throw new Error('Ovi bridge image content type does not match its bytes');
  }
  requireSafeDimensions(header);
  let decoded: DecodedImage;
  try {
    const encoded = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    decoded = header.format === 'png'
      ? PNG.sync.read(encoded, { checkCRC: true })
      : jpeg.decode(encoded, { useTArray: true, formatAsRGBA: true });
  } catch {
    throw new Error('Ovi bridge response is not a decodable image');
  }
  if (
    decoded.width !== header.width ||
    decoded.height !== header.height ||
    decoded.data.byteLength !== header.width * header.height * 4
  ) {
    throw new Error('Ovi bridge decoder returned inconsistent image data');
  }
  return header;
}
