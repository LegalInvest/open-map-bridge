import { expect, it } from 'vitest';
import { readRasterDimensions } from './image-dimensions.js';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13, false);
  bytes.set(new TextEncoder().encode('IHDR'), 12);
  new DataView(bytes.buffer).setUint32(16, width, false);
  new DataView(bytes.buffer).setUint32(20, height, false);
  return bytes;
}

it('reads PNG, JPEG, and WebP dimensions from bounded headers', () => {
  expect(readRasterDimensions(png(640, 480))).toEqual({ width: 640, height: 480, format: 'png' });
  expect(readRasterDimensions(new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x11, 0x00,
  ]))).toEqual({ width: 640, height: 480, format: 'jpeg' });
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBP'), 8);
  webp.set(new TextEncoder().encode('VP8X'), 12);
  webp.set([0x7f, 0x02, 0x00], 24);
  webp.set([0xdf, 0x01, 0x00], 27);
  expect(readRasterDimensions(webp)).toEqual({ width: 640, height: 480, format: 'webp' });
});

it('rejects unknown, truncated, and zero-dimension headers', () => {
  expect(() => readRasterDimensions(new Uint8Array([1, 2, 3]))).toThrow('INPUT_QR_IMAGE_FORMAT');
  expect(() => readRasterDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xc0]))).toThrow('INPUT_QR_IMAGE_DIMENSIONS');
  expect(() => readRasterDimensions(png(0, 480))).toThrow('INPUT_QR_IMAGE_DIMENSIONS');
});
