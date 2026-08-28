import { BrowserQRCodeReader } from '@zxing/browser';

interface QrTextResult {
  getText(): string;
}

interface ScannerControls {
  stop(): void;
}

type DecodeCallback = (result: QrTextResult | undefined, error: unknown, controls: ScannerControls) => void;

export interface QrDecoderBackend {
  decodeFromImageUrl(url: string): Promise<QrTextResult>;
  decodeFromVideoDevice(
    deviceId: string | undefined,
    video: HTMLVideoElement,
    callback: DecodeCallback,
  ): Promise<ScannerControls>;
}

export interface QrReader {
  decodeFile(file: File): Promise<string>;
  startCamera(video: HTMLVideoElement, onResult: (payload: string) => void): Promise<{ stop(): void }>;
}

interface QrReaderDependencies {
  createBackend?: () => QrDecoderBackend;
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (url: string) => void;
}

function defaultBackend(): QrDecoderBackend {
  const reader = new BrowserQRCodeReader();
  return {
    async decodeFromImageUrl(url) {
      const image = new Image();
      image.src = url;
      if (typeof image.decode === 'function') await image.decode();
      else {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('二维码图片无法读取'));
        });
      }
      try {
        return await reader.decodeFromImageElement(image);
      } catch (firstError) {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (width <= 0 || height <= 0) throw firstError;
        for (const scale of [2, 3]) {
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) continue;
          context.imageSmoothingEnabled = false;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            return reader.decodeFromCanvas(canvas);
          } catch {
            // Continue with the next bounded local preprocessing scale.
          }
        }
        throw firstError;
      }
    },
    decodeFromVideoDevice: (deviceId, video, callback) =>
      reader.decodeFromVideoDevice(deviceId, video, (result, error, controls) => callback(result, error, controls)),
  };
}

function stopTracks(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  if (stream && 'getTracks' in stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  video.srcObject = null;
}

export function createQrReader(dependencies: QrReaderDependencies = {}): QrReader {
  const createBackend = dependencies.createBackend ?? defaultBackend;
  const createObjectUrl = dependencies.createObjectUrl ?? ((file: File) => URL.createObjectURL(file));
  const revokeObjectUrl = dependencies.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
  return {
    async decodeFile(file) {
      const url = createObjectUrl(file);
      try {
        return (await createBackend().decodeFromImageUrl(url)).getText();
      } finally {
        revokeObjectUrl(url);
      }
    },
    async startCamera(video, onResult) {
      const backend = createBackend();
      let controls: ScannerControls | null = null;
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        controls?.stop();
        stopTracks(video);
      };
      controls = await backend.decodeFromVideoDevice(undefined, video, (result, _error, liveControls) => {
        if (!result || stopped) return;
        controls = liveControls;
        try {
          onResult(result.getText());
        } finally {
          stop();
        }
      });
      if (stopped) controls.stop();
      return { stop };
    },
  };
}

export const browserQrReader = createQrReader();
