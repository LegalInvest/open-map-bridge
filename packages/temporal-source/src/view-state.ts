import { z } from 'zod';

const finiteNumber = z.custom<number>(
  (value) => typeof value === 'number' && Number.isFinite(value),
  'value must be finite',
);

const viewStateSchema = z.object({
  center: z.tuple([finiteNumber, finiteNumber]),
  zoom: finiteNumber.refine((value) => value >= 0 && value <= 30, 'zoom must be between 0 and 30'),
  rotation: finiteNumber,
  projection: z.literal('EPSG:3857'),
});

export type ViewState = z.infer<typeof viewStateSchema>;

export function normalizeViewState(value: unknown): ViewState {
  const parsed = viewStateSchema.parse(value);
  return {
    center: [parsed.center[0], parsed.center[1]],
    zoom: parsed.zoom,
    rotation: parsed.rotation,
    projection: parsed.projection,
  };
}
