import { createHash, randomUUID } from 'node:crypto';
import { decodeOviMap } from '@omb/ovmap-codec';
import { decodeQrPayload } from '@omb/qr-import';
import type { ImportPreview } from '@omb/source-schema';
import { normalizeOviLayer, normalizeQrCandidate } from './normalizer.js';

interface InspectorDependencies {
  now?: () => Date;
  networkAttempt?: () => unknown;
}

function sha256(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function createImportInspector(dependencies: InspectorDependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  return {
    async inspectQr(payload: string): Promise<ImportPreview> {
      const at = now();
      const inputSha256 = sha256(payload);
      const raw = decodeQrPayload(payload);
      const parser = raw[0]?.adapter ?? 'unknown';
      return {
        previewId: randomUUID(),
        inputType: parser === 'oms-qr-v1' ? 'oms' : 'qr',
        inputSha256,
        parser,
        layers: raw.map((candidate) => normalizeQrCandidate(candidate, inputSha256, at.toISOString())),
        warnings: [],
        expiresAt: new Date(at.getTime() + 15 * 60_000).toISOString(),
      };
    },
    async inspectOvmap(bytes: Uint8Array): Promise<ImportPreview> {
      const at = now();
      const inputSha256 = sha256(bytes);
      const decoded = decodeOviMap(bytes);
      return {
        previewId: randomUUID(),
        inputType: 'ovmap',
        inputSha256,
        parser: `ovmap-${decoded.family}`,
        layers: decoded.layers.map((layer) => normalizeOviLayer(layer, inputSha256, at.toISOString())),
        warnings: [],
        expiresAt: new Date(at.getTime() + 15 * 60_000).toISOString(),
      };
    },
  };
}

export type ImportInspector = ReturnType<typeof createImportInspector>;
