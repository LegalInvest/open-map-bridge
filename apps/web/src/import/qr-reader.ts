import { BrowserQRCodeReader } from '@zxing/browser';
import {
  QR_IMAGE_MAX_BYTES,
  QR_IMAGE_MAX_PIXELS,
  QR_IMAGE_PREPROCESS_MAX_PIXELS,
  QR_IMAGE_PREPROCESS_SCALES,
} from '@omb/source-schema';
import { readRasterDimensions, type RasterDimensions } from './image-dimensions.js';

interface QrTextResult {
  getText(): string;
}

interface ScannerControls {
  stop(): void;
}

type DecodeCallback = (result: QrTextResult | undefined, error: unknown, controls: ScannerControls) => void;

export interface QrDecoderBackend {
  decodeFromImageUrl(url: string, dimensions: RasterDimensions): Promise<QrTextResult>;
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
    async decodeFromImageUrl(url, expectedDimensions) {
      const image = new Image();
      image.src = url;
      if (typeof image.decode === 'function') await image.decode();
      else {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('二维码图片无法读取'));
        });
      }
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width !== expectedDimensions.width || height !== expectedDimensions.height) {
        throw new Error('二维码图片尺寸与文件头不一致');
      }
      try {
        return await reader.decodeFromImageElement(image);
      } catch (firstError) {
        if (width <= 0 || height <= 0) throw firstError;
        for (const scale of allowedQrPreprocessScales(width, height)) {
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

export function allowedQrPreprocessScales(width: number, height: number): number[] {
  const sourcePixels = width * height;
  return QR_IMAGE_PREPROCESS_SCALES.filter(
    (scale) => Number.isSafeInteger(sourcePixels * scale * scale) && sourcePixels * scale * scale <= QR_IMAGE_PREPROCESS_MAX_PIXELS,
  );
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
      if (file.size <= 0) throw new Error('二维码图片不能为空');
      if (file.size > QR_IMAGE_MAX_BYTES) throw new Error('二维码图片不能超过 8 MiB');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength <= 0) throw new Error('二维码图片不能为空');
      if (bytes.byteLength > QR_IMAGE_MAX_BYTES) throw new Error('二维码图片不能超过 8 MiB');
      const dimensions = readRasterDimensions(bytes);
      const pixels = dimensions.width * dimensions.height;
      if (!Number.isSafeInteger(pixels) || pixels > QR_IMAGE_MAX_PIXELS) {
        throw new Error('二维码图片像素不能超过 16777216');
      }
      const url = createObjectUrl(file);
      try {
        return (await createBackend().decodeFromImageUrl(url, dimensions)).getText();
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
