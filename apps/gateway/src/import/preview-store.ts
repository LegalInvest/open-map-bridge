import type { ImportPreview } from '@omb/source-schema';

export class ImportPreviewStore {
  private readonly previews = new Map<string, ImportPreview>();

  put(preview: ImportPreview): void {
    this.previews.set(preview.previewId, structuredClone(preview));
  }

  get(previewId: string, now = new Date()): ImportPreview {
    const preview = this.previews.get(previewId);
    if (!preview) throw new Error('INPUT_PREVIEW_NOT_FOUND');
    if (Date.parse(preview.expiresAt) <= now.getTime()) {
      this.previews.delete(previewId);
      throw new Error('INPUT_PREVIEW_EXPIRED');
    }
    return structuredClone(preview);
  }

  consume(previewId: string, now = new Date()): ImportPreview {
    const preview = this.get(previewId, now);
    this.previews.delete(previewId);
    return preview;
  }
}
