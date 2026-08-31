import { z } from 'zod';
import { temporalIdSchema } from './schema.js';

const tileCountSchema = z.number().int().nonnegative().max(1_000_000);

export const comparisonFrameReceiptSchema = z
  .object({
    dateId: temporalIdSchema,
    status: z.enum(['loaded', 'partial', 'missing', 'failed']),
    expectedTileCount: tileCountSchema,
    loadedTileCount: tileCountSchema,
    failedTileCount: tileCountSchema,
  })
  .strict()
  .superRefine((frame, context) => {
    const settled = frame.loadedTileCount + frame.failedTileCount;
    if (frame.status === 'missing') {
      if (frame.expectedTileCount !== 0 || settled !== 0) {
        context.addIssue({ code: 'custom', message: 'missing frame cannot claim requested tiles' });
      }
      return;
    }
    if (frame.expectedTileCount === 0 || settled !== frame.expectedTileCount) {
      context.addIssue({ code: 'custom', message: 'terminal frame counts must settle every expected tile' });
      return;
    }
    if (frame.status === 'loaded' && (frame.loadedTileCount !== frame.expectedTileCount || frame.failedTileCount !== 0)) {
      context.addIssue({ code: 'custom', message: 'loaded frame must contain only successful tiles' });
    }
    if (frame.status === 'partial' && (frame.loadedTileCount === 0 || frame.failedTileCount === 0)) {
      context.addIssue({ code: 'custom', message: 'partial frame requires both successful and failed tiles' });
    }
    if (frame.status === 'failed' && (frame.loadedTileCount !== 0 || frame.failedTileCount !== frame.expectedTileCount)) {
      context.addIssue({ code: 'custom', message: 'failed frame must contain only failed tiles' });
    }
  });

const viewStateSchema = z
  .object({
    center: z.tuple([z.number().finite(), z.number().finite()]),
    zoom: z.number().finite().min(0).max(30),
    rotation: z.number().finite(),
    projection: z.literal('EPSG:3857'),
  })
  .strict();

const comparisonCoreShape = {
  schemaVersion: z.literal(1),
  sourceId: temporalIdSchema,
  aoiId: temporalIdSchema,
  aoiVersion: z.number().int().positive(),
  dateIds: z.array(temporalIdSchema).length(4),
  viewState: viewStateSchema,
  frames: z.array(comparisonFrameReceiptSchema).length(4),
} as const;

function validateComparisonOrder(
  value: { dateIds: string[]; frames: Array<{ dateId: string }> },
  context: z.RefinementCtx,
): void {
  if (new Set(value.dateIds).size !== 4) {
    context.addIssue({ code: 'custom', path: ['dateIds'], message: 'comparison requires four unique dates' });
  }
  value.frames.forEach((frame, index) => {
    if (frame.dateId !== value.dateIds[index]) {
      context.addIssue({ code: 'custom', path: ['frames', index, 'dateId'], message: 'frame order must match dateIds' });
    }
  });
}

export const createComparisonReceiptSchema = z
  .object(comparisonCoreShape)
  .strict()
  .superRefine(validateComparisonOrder);

export const comparisonReceiptSchema = z
  .object({
    ...comparisonCoreShape,
    id: temporalIdSchema,
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine(validateComparisonOrder);

export type ComparisonFrameReceipt = z.infer<typeof comparisonFrameReceiptSchema>;
export type CreateComparisonReceipt = z.infer<typeof createComparisonReceiptSchema>;
export type ComparisonReceipt = z.infer<typeof comparisonReceiptSchema>;

export function parseCreateComparisonReceipt(value: unknown): CreateComparisonReceipt {
  return createComparisonReceiptSchema.parse(value);
}

export function parseComparisonReceipt(value: unknown): ComparisonReceipt {
  return comparisonReceiptSchema.parse(value);
}
