import { z } from 'zod';
import type { AppError } from './errors.js';

export type SourceKind = 'qr' | 'ovmap' | 'oms' | 'manual';
export type MapProtocol = 'xyz' | 'tms' | 'wmts' | 'wms' | 'arcgis' | 'ovi-template';
export type ProjectionId = 'EPSG:3857' | 'EPSG:4326' | `EPSG:${number}` | 'unknown';
export type TileFormat = 'png' | 'jpg' | 'webp' | 'unknown';
export type SourceStatus =
  | 'received'
  | 'parsed'
  | 'confirmed'
  | 'probed'
  | 'rendered'
  | 'saved'
  | 'invalid'
  | 'unsupported'
  | 'blocked'
  | 'needs-credential'
  | 'needs-data'
  | 'probe-failed'
  | 'render-failed'
  | 'stale'
  | 'disabled';

export interface MapSourceDefinition {
  schemaVersion: 1;
  id: string;
  legacyId: number | null;
  name: string;
  sourceKind: SourceKind;
  protocol: MapProtocol;
  projection: ProjectionId;
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
  format: TileFormat;
  hosts: string[];
  pathTemplate: string;
  queryParameters: Record<string, string>;
  credentialRef: string | null;
  attribution: string | null;
  license: string | null;
  sourceProvenance: { inputSha256: string; adapter: string };
  compatibilityExtension: Record<string, unknown>;
  status: SourceStatus;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface ImportLayerCandidate {
  candidateId: string;
  source: MapSourceDefinition;
  selectable: boolean;
  warnings: AppError[];
  requiresCredential: boolean;
  requiresCompanionData: boolean;
}

export interface ImportPreview {
  previewId: string;
  inputType: 'qr' | 'ovmap' | 'oms';
  inputSha256: string;
  parser: string;
  layers: ImportLayerCandidate[];
  warnings: AppError[];
  expiresAt: string;
}

export interface ProbeResult {
  schemaVersion: 1;
  sourceId: string;
  inputFingerprint: string;
  startedAt: string;
  endedAt: string;
  category:
    | 'success'
    | 'dns'
    | 'tls'
    | 'timeout'
    | 'unauthorized'
    | 'forbidden'
    | 'not-found'
    | 'rate-limited'
    | 'upstream'
    | 'invalid-content';
  httpStatus: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  errorCode: string | null;
}

export interface ImportReceipt {
  receiptId: string;
  batchId: string;
  inputSha256: string;
  parser: string;
  confirmedAt: string | null;
  results: Array<{
    candidateId: string;
    sourceId: string | null;
    status: SourceStatus;
    errorCode: string | null;
  }>;
  undoneAt: string | null;
}

const secretKey = /token|key|secret|cookie|authorization|auth|sig|session|password|credential|access/i;
const host = z
  .string()
  .min(1)
  .max(253)
  .refine((value) => !value.includes('/') && !value.includes('@') && !value.includes('://'), 'host must not contain URL syntax');

export const sourceStatusSchema = z.enum([
  'received',
  'parsed',
  'confirmed',
  'probed',
  'rendered',
  'saved',
  'invalid',
  'unsupported',
  'blocked',
  'needs-credential',
  'needs-data',
  'probe-failed',
  'render-failed',
  'stale',
  'disabled',
]);

export const mapSourceDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    legacyId: z.number().int().nonnegative().nullable(),
    name: z.string().trim().min(1).max(256),
    sourceKind: z.enum(['qr', 'ovmap', 'oms', 'manual']),
    protocol: z.enum(['xyz', 'tms', 'wmts', 'wms', 'arcgis', 'ovi-template']),
    projection: z.union([z.literal('unknown'), z.string().regex(/^EPSG:\d{4,6}$/)]),
    minZoom: z.number().int().min(0).max(30),
    maxZoom: z.number().int().min(0).max(30),
    tileSize: z.union([z.literal(256), z.literal(512)]),
    format: z.enum(['png', 'jpg', 'webp', 'unknown']),
    hosts: z.array(host).min(1).max(32),
    pathTemplate: z.string().min(1).max(8192),
    queryParameters: z
      .record(z.string().max(128), z.string().max(4096))
      .superRefine((value, context) => {
        for (const key of Object.keys(value)) {
          if (secretKey.test(key)) {
            context.addIssue({ code: 'custom', message: `inline secret query key is forbidden: ${key}` });
          }
        }
      }),
    credentialRef: z.string().regex(/^vault:\/\/source\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/).nullable(),
    attribution: z.string().max(2048).nullable(),
    license: z.string().max(256).nullable(),
    sourceProvenance: z.object({
      inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
      adapter: z.string().min(1).max(128),
    }),
    compatibilityExtension: z.record(z.string().max(128), z.unknown()),
    status: sourceStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastVerifiedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.minZoom > value.maxZoom) {
      context.addIssue({ code: 'custom', message: 'minZoom must not exceed maxZoom', path: ['minZoom'] });
    }
    if (value.credentialRef !== null && value.credentialRef !== `vault://source/${value.id.toLowerCase()}`) {
      context.addIssue({ code: 'custom', message: 'credential reference must belong to the same source UUID', path: ['credentialRef'] });
    }
  });

export const probeResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceId: z.string().uuid(),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    category: z.enum([
      'success',
      'dns',
      'tls',
      'timeout',
      'unauthorized',
      'forbidden',
      'not-found',
      'rate-limited',
      'upstream',
      'invalid-content',
    ]),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    contentType: z.string().max(256).nullable(),
    width: z.number().int().positive().max(2048).nullable(),
    height: z.number().int().positive().max(2048).nullable(),
    errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endedAt < value.startedAt) {
      context.addIssue({ code: 'custom', message: 'probe end must not precede start', path: ['endedAt'] });
    }
    if (value.category === 'success') {
      if (
        value.httpStatus !== 200 ||
        !['image/png', 'image/jpeg'].includes(value.contentType ?? '') ||
        value.width === null ||
        value.height === null ||
        value.errorCode !== null
      ) {
        context.addIssue({ code: 'custom', message: 'successful probe requires validated image evidence' });
      }
      return;
    }
    if (value.width !== null || value.height !== null || value.errorCode === null) {
      context.addIssue({ code: 'custom', message: 'failed probe requires an error code and no image dimensions' });
    }
  });

export function parseMapSourceDefinition(value: unknown): MapSourceDefinition {
  return mapSourceDefinitionSchema.parse(value) as MapSourceDefinition;
}

export function parseProbeResult(value: unknown): ProbeResult {
  return probeResultSchema.parse(value) as ProbeResult;
}
