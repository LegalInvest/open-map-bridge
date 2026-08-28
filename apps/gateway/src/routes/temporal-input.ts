import {
  temporalDateWindowSchema,
  temporalTileRequestSchema,
  type TemporalDateWindow,
  type TemporalTileRequest,
} from '@omb/temporal-source';

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseDateWindowQuery(
  query: Record<string, unknown>,
  defaults: { from: string; to: string },
): ValidationResult<TemporalDateWindow> {
  if (Object.keys(query).some((key) => !['aoiId', 'from', 'to'].includes(key))) {
    return { ok: false, error: 'query-not-allowed' };
  }
  if (query.aoiId === undefined || query.aoiId === '') return { ok: false, error: 'aoi-id-required' };
  const parsed = temporalDateWindowSchema.safeParse({
    aoiId: query.aoiId,
    from: query.from ?? defaults.from,
    to: query.to ?? defaults.to,
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  const invalidAoi = parsed.error.issues.some((issue) => issue.path[0] === 'aoiId');
  return { ok: false, error: invalidAoi ? 'invalid-aoi-id' : 'invalid-date-window' };
}

export function parseTilePath(input: {
  dateId: unknown;
  z: unknown;
  x: unknown;
  y: unknown;
}): ValidationResult<TemporalTileRequest> {
  const parsed = temporalTileRequestSchema.safeParse({
    dateId: input.dateId,
    z: input.z,
    x: input.x,
    y: input.y,
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  const invalidDateId = parsed.error.issues.some((issue) => issue.path[0] === 'dateId');
  return { ok: false, error: invalidDateId ? 'invalid-date-id' : 'invalid-coordinate' };
}
