import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { decodeOviMap } from './index.js';

it('decodes the locally acquired five-map record37 fixture', () => {
  const result = decodeOviMap(readFileSync('fixtures/local/tencent-5.ovmap'));
  expect(result.layers.map((layer) => [layer.legacyId, layer.name])).toEqual([
    [204, '腾讯卫星地图'],
    [205, '腾讯路网小字体'],
    [209, '腾讯地图'],
    [213, '腾讯地形图'],
    [214, '腾讯地形图小字体'],
  ]);
  expect(result.layers.every((layer) => layer.host.length > 0 && layer.pathTemplate.length > 0)).toBe(true);
});
