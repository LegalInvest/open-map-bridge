import { z } from 'zod';

export type Position = [number, number];
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}
export type AoiGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface AreaOfInterest {
  id: string;
  version: number;
  name: string;
  geometry: AoiGeometry;
  crs: 'EPSG:4326';
  status: 'approximate' | 'confirmed';
  provenance: string;
  confirmedAt: string | null;
}

const baseSchema = z.object({
  id: z.string().min(1).max(120),
  version: z.number().int().positive(),
  name: z.string().min(1).max(120),
  geometry: z.unknown(),
  crs: z.literal('EPSG:4326'),
  status: z.enum(['approximate', 'confirmed']),
  provenance: z.string().min(1).max(500),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
});

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function orientation(a: Position, b: Position, c: Position): number {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function intersects(a: Position, b: Position, c: Position, d: Position): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function validateRing(raw: unknown, positions: { count: number }): Position[] {
  if (!Array.isArray(raw) || raw.length < 4) throw new Error('polygon ring requires at least four positions');
  const ring = raw.map((rawPosition) => {
    if (!Array.isArray(rawPosition) || rawPosition.length !== 2) {
      throw new Error('each position must contain longitude and latitude');
    }
    const [longitude, latitude] = rawPosition;
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('longitude must be finite and between -180 and 180');
    }
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error('latitude must be finite and between -90 and 90');
    }
    positions.count += 1;
    if (positions.count > 2_000) throw new Error('AOI cannot contain more than 2,000 positions');
    return [longitude, latitude] as Position;
  });

  const first = ring[0];
  const last = ring.at(-1);
  if (!first || !last || !samePosition(first, last)) throw new Error('polygon ring must be closed');
  for (let index = 1; index < ring.length; index += 1) {
    const previous = ring[index - 1];
    const current = ring[index];
    if (previous && current && samePosition(previous, current)) {
      throw new Error('polygon ring cannot contain consecutive duplicate positions');
    }
  }

  const segmentCount = ring.length - 1;
  for (let left = 0; left < segmentCount; left += 1) {
    for (let right = left + 1; right < segmentCount; right += 1) {
      if (Math.abs(left - right) <= 1 || (left === 0 && right === segmentCount - 1)) continue;
      const a = ring[left];
      const b = ring[left + 1];
      const c = ring[right];
      const d = ring[right + 1];
      if (a && b && c && d && intersects(a, b, c, d)) throw new Error('polygon ring must not self-intersect');
    }
  }
  return ring;
}

function parseGeometry(value: unknown): AoiGeometry {
  if (typeof value !== 'object' || value === null) throw new Error('geometry must be an object');
  const raw = value as { type?: unknown; coordinates?: unknown };
  const positions = { count: 0 };
  if (raw.type === 'Polygon') {
    if (!Array.isArray(raw.coordinates) || raw.coordinates.length === 0) {
      throw new Error('Polygon requires at least one ring');
    }
    return { type: 'Polygon', coordinates: raw.coordinates.map((ring) => validateRing(ring, positions)) };
  }
  if (raw.type === 'MultiPolygon') {
    if (!Array.isArray(raw.coordinates) || raw.coordinates.length === 0) {
      throw new Error('MultiPolygon requires at least one polygon');
    }
    return {
      type: 'MultiPolygon',
      coordinates: raw.coordinates.map((polygon) => {
        if (!Array.isArray(polygon) || polygon.length === 0) throw new Error('each polygon requires a ring');
        return polygon.map((ring) => validateRing(ring, positions));
      }),
    };
  }
  throw new Error('geometry type must be Polygon or MultiPolygon');
}

export function parseAreaOfInterest(value: unknown): AreaOfInterest {
  const base = baseSchema.parse(value);
  if (base.status === 'confirmed' && base.confirmedAt === null) {
    throw new Error('confirmed AOI requires confirmedAt');
  }
  if (base.status === 'approximate' && base.confirmedAt !== null) {
    throw new Error('approximate AOI cannot have confirmedAt');
  }
  return { ...base, geometry: parseGeometry(base.geometry) };
}

export function createNextAoiVersion(
  current: AreaOfInterest,
  geometry: AoiGeometry,
  confirmedAt: string,
): AreaOfInterest {
  return parseAreaOfInterest({
    ...current,
    version: current.version + 1,
    geometry: structuredClone(geometry),
    status: 'confirmed',
    confirmedAt,
  });
}

export function createConfirmedAoi(input: {
  id: string;
  name: string;
  geometry: AoiGeometry;
  provenance: string;
  confirmedAt: string;
}): AreaOfInterest {
  return parseAreaOfInterest({
    id: input.id,
    version: 1,
    name: input.name,
    geometry: structuredClone(input.geometry),
    crs: 'EPSG:4326',
    status: 'confirmed',
    provenance: input.provenance,
    confirmedAt: input.confirmedAt,
  });
}
