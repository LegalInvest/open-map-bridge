import { parseAreaOfInterest, type AreaOfInterest } from './schema.js';

export const lakeAoiPresets: AreaOfInterest[] = [
  parseAreaOfInterest({
    id: 'baoying-lake',
    version: 1,
    name: '宝应湖',
    crs: 'EPSG:4326',
    status: 'approximate',
    provenance: 'user-screenshot-2026-08-27',
    confirmedAt: null,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [119.1, 33.04],
          [119.16, 33.31],
          [119.32, 33.34],
          [119.46, 33.26],
          [119.47, 33.06],
          [119.1, 33.04],
        ],
      ],
    },
  }),
  parseAreaOfInterest({
    id: 'gaoyou-lake',
    version: 1,
    name: '高邮湖',
    crs: 'EPSG:4326',
    status: 'approximate',
    provenance: 'user-screenshot-2026-08-27',
    confirmedAt: null,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [118.95, 32.73],
          [119.05, 32.45],
          [119.5, 32.66],
          [119.47, 33.07],
          [119.3, 33.07],
          [119.2, 32.91],
          [119.05, 32.93],
          [118.95, 32.73],
        ],
      ],
    },
  }),
];
