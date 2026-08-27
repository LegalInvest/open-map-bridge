import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'invalid ISO calendar date');

export const temporalDateEntrySchema = z
  .object({
    id: z.string().min(1).max(160),
    requestDate: isoDate,
    captureDate: isoDate.nullable(),
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

export function parseTemporalDateEntry(value: unknown): TemporalDateEntry {
  return temporalDateEntrySchema.parse(value);
}

export interface TemporalTileResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

export interface TemporalSourceAdapter {
  probe(): Promise<{ ok: boolean; detail: string }>;
  listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]>;
  tile(input: { dateId: string; z: number; x: number; y: number }): Promise<TemporalTileResponse>;
}
