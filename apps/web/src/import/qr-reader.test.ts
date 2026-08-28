import { describe, expect, it, vi } from 'vitest';
import { createQrReader, type QrDecoderBackend } from './qr-reader.js';

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
    await expect(reader.decodeFile(new File(['qr'], 'qr.png', { type: 'image/png' }))).resolves.toBe('ovobj?fixture');
    expect(revoke).toHaveBeenCalledWith('blob:local-only');
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
});
