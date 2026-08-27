import type { AreaOfInterest, Position } from '@omb/aois';
import { transformExtent } from 'ol/proj.js';

export type AoiExtent = [number, number, number, number];

function positions(aoi: AreaOfInterest): Position[] {
  if (aoi.geometry.type === 'Polygon') return aoi.geometry.coordinates.flat();
  return aoi.geometry.coordinates.flat(2);
}

export function aoiBounds4326(aoi: AreaOfInterest): AoiExtent {
  const points = positions(aoi);
  if (points.length === 0) throw new Error('AOI geometry contains no positions');
  const longitudes = points.map((position) => position[0]);
  const latitudes = points.map((position) => position[1]);
  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
}

export function aoiExtent3857(aoi: AreaOfInterest): AoiExtent {
  return transformExtent(aoiBounds4326(aoi), 'EPSG:4326', 'EPSG:3857') as AoiExtent;
}
