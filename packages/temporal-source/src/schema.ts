import { z } from 'zod';

export const temporalIdSchema = z
  .string()
  .min(1)
  .max(160)
  .refine((value) => value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value), 'invalid temporal ID');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'invalid ISO calendar date');

export const temporalDateWindowSchema = z
  .object({
    aoiId: temporalIdSchema,
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({ code: 'custom', path: ['to'], message: 'date window must not be reversed' });
    }
  });

const tileIntegerSchema = z.preprocess(
  (value) => (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value),
  z.number().int().nonnegative().refine(Number.isSafeInteger, 'expected a safe integer'),
);

export const temporalTileRequestSchema = z
  .object({
    dateId: temporalIdSchema,
    z: tileIntegerSchema.pipe(z.number().max(30)),
    x: tileIntegerSchema,
    y: tileIntegerSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const limit = 2 ** value.z;
    if (value.x >= limit) context.addIssue({ code: 'custom', path: ['x'], message: 'x exceeds zoom extent' });
    if (value.y >= limit) context.addIssue({ code: 'custom', path: ['y'], message: 'y exceeds zoom extent' });
  });

export const temporalDateEntrySchema = z
  .object({
    id: temporalIdSchema,
    requestDate: isoDateSchema,
    captureDate: isoDateSchema.nullable(),
    precision: z.enum(['capture-date', 'request-date-only']),
    availability: z.enum(['available', 'missing', 'unknown', 'failed']),
    provenance: z.string().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (value.precision === 'capture-date' && value.captureDate === null) {
      context.addIssue({
        code: 'custom',
        path: ['captureDate'],
        message: 'capture-date precision requires captureDate',
      });
    }
    if (value.precision === 'request-date-only' && value.captureDate !== null) {
      context.addIssue({
        code: 'custom',
        path: ['captureDate'],
        message: 'request-date-only precision cannot claim captureDate',
      });
    }
  });

export type TemporalDateEntry = z.infer<typeof temporalDateEntrySchema>;
export type TemporalDateWindow = z.infer<typeof temporalDateWindowSchema>;
export type TemporalTileRequest = z.infer<typeof temporalTileRequestSchema>;

export function parseTemporalDateEntry(value: unknown): TemporalDateEntry {
  return temporalDateEntrySchema.parse(value);
}

export function parseTemporalDateWindow(value: unknown): TemporalDateWindow {
  return temporalDateWindowSchema.parse(value);
}

export function parseTemporalTileRequest(value: unknown): TemporalTileRequest {
  return temporalTileRequestSchema.parse(value);
}

export interface TemporalTileResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

export interface TemporalSourceAdapter {
  probe(): Promise<{ ok: boolean; detail: string }>;
  listDates(input: TemporalDateWindow): Promise<TemporalDateEntry[]>;
  tile(input: TemporalTileRequest): Promise<TemporalTileResponse>;
}
