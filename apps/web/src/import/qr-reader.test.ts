import { describe, expect, it, vi } from 'vitest';
import { QR_IMAGE_MAX_BYTES } from '@omb/source-schema';
import { allowedQrPreprocessScales, createQrReader, type QrDecoderBackend } from './qr-reader.js';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13, false);
  bytes.set(new TextEncoder().encode('IHDR'), 12);
  new DataView(bytes.buffer).setUint32(16, width, false);
  new DataView(bytes.buffer).setUint32(20, height, false);
  return bytes;
}

describe('QR reader resource lifecycle', () => {
  it('revokes the local object URL after image decode', async () => {
    const revoke = vi.fn();
    const backend: QrDecoderBackend = {
      decodeFromImageUrl: vi.fn().mockResolvedValue({ getText: () => 'ovobj?fixture' }),
      decodeFromVideoDevice: vi.fn(),
    };
    const reader = createQrReader({
      createBackend: () => backend,
      createObjectUrl: () => 'blob:local-only',
      revokeObjectUrl: revoke,
    });
    await expect(reader.decodeFile(new File([png(1, 1)], 'qr.png', { type: 'image/png' }))).resolves.toBe('ovobj?fixture');
    expect(revoke).toHaveBeenCalledWith('blob:local-only');
    expect(backend.decodeFromImageUrl).toHaveBeenCalledWith('blob:local-only', { width: 1, height: 1, format: 'png' });
  });

  it('stops decoder controls and media tracks after first camera result', async () => {
    const trackStop = vi.fn();
    const controlsStop = vi.fn();
    let callback: Parameters<QrDecoderBackend['decodeFromVideoDevice']>[2] | undefined;
    const backend: QrDecoderBackend = {
      decodeFromImageUrl: vi.fn(),
      decodeFromVideoDevice: vi.fn(async (_id, _video, next) => {
        callback = next;
        return { stop: controlsStop };
      }),
    };
    const reader = createQrReader({ createBackend: () => backend });
    const video = { srcObject: { getTracks: () => [{ stop: trackStop }] } } as unknown as HTMLVideoElement;
    const onResult = vi.fn();
    const session = await reader.startCamera(video, onResult);
    callback?.({ getText: () => 'ovobj?fixture' }, undefined, { stop: controlsStop });
    expect(onResult).toHaveBeenCalledWith('ovobj?fixture');
    expect(controlsStop).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
    session.stop();
  });

  it('rejects byte and pixel limits before creating an object URL or invoking the decoder', async () => {
    const createObjectUrl = vi.fn();
    const backend: QrDecoderBackend = {
      decodeFromImageUrl: vi.fn(),
      decodeFromVideoDevice: vi.fn(),
    };
    const reader = createQrReader({ createBackend: () => backend, createObjectUrl });
    const readOversized = vi.fn();
    const oversized = { size: QR_IMAGE_MAX_BYTES + 1, arrayBuffer: readOversized } as unknown as File;
    await expect(reader.decodeFile(oversized)).rejects.toThrow('不能超过 8 MiB');
    expect(readOversized).not.toHaveBeenCalled();

    await expect(reader.decodeFile(new File([png(5000, 5000)], 'pixels.png', { type: 'image/png' }))).rejects.toThrow('像素不能超过');
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(backend.decodeFromImageUrl).not.toHaveBeenCalled();
  });

  it('only allows preprocessing scales that remain inside the pixel budget', () => {
    expect(allowedQrPreprocessScales(1000, 1000)).toEqual([2, 3]);
    expect(allowedQrPreprocessScales(2000, 1000)).toEqual([2]);
    expect(allowedQrPreprocessScales(3000, 2000)).toEqual([]);
  });
});
