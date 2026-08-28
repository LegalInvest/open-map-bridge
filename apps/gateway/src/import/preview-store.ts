import {
  IMPORT_PREVIEW_MAX_BYTES,
  IMPORT_PREVIEW_MAX_ENTRIES,
  type ImportPreview,
} from '@omb/source-schema';

interface PreviewEntry {
  preview: ImportPreview;
  bytes: number;
}

export interface ImportPreviewStoreOptions {
  maxEntries?: number;
  maxBytes?: number;
}

function previewBytes(preview: ImportPreview): number {
  return new TextEncoder().encode(JSON.stringify(preview)).byteLength;
}

export class ImportPreviewStore {
  private readonly previews = new Map<string, PreviewEntry>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private totalBytes = 0;

  constructor(options: ImportPreviewStoreOptions = {}) {
    this.maxEntries = options.maxEntries ?? IMPORT_PREVIEW_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? IMPORT_PREVIEW_MAX_BYTES;
    if (!Number.isSafeInteger(this.maxEntries) || this.maxEntries <= 0) throw new Error('CONFIG_PREVIEW_MAX_ENTRIES');
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes <= 0) throw new Error('CONFIG_PREVIEW_MAX_BYTES');
  }

  put(preview: ImportPreview, now = new Date()): void {
    this.pruneExpired(now);
    if (Date.parse(preview.expiresAt) <= now.getTime()) throw new Error('INPUT_PREVIEW_EXPIRED');
    const clone = structuredClone(preview);
    const bytes = previewBytes(clone);
    if (bytes > this.maxBytes) throw new Error('INPUT_PREVIEW_TOO_LARGE');
    this.delete(preview.previewId);
    this.previews.set(preview.previewId, { preview: clone, bytes });
    this.totalBytes += bytes;
    this.evictToLimits();
  }

  get(previewId: string, now = new Date()): ImportPreview {
    const entry = this.previews.get(previewId);
    if (!entry) throw new Error('INPUT_PREVIEW_NOT_FOUND');
    if (Date.parse(entry.preview.expiresAt) <= now.getTime()) {
      this.delete(previewId);
      throw new Error('INPUT_PREVIEW_EXPIRED');
    }
    this.previews.delete(previewId);
    this.previews.set(previewId, entry);
    return structuredClone(entry.preview);
  }

  consume(previewId: string, now = new Date()): ImportPreview {
    const preview = this.get(previewId, now);
    this.delete(previewId);
    return preview;
  }

  private pruneExpired(now: Date): void {
    for (const [previewId, entry] of this.previews) {
      if (Date.parse(entry.preview.expiresAt) <= now.getTime()) this.delete(previewId);
    }
  }

  private evictToLimits(): void {
    while (this.previews.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestId = this.previews.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.delete(oldestId);
    }
  }

  private delete(previewId: string): void {
    const entry = this.previews.get(previewId);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.previews.delete(previewId);
  }
}
