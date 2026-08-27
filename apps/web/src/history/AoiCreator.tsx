import { useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import type { Geometry } from 'ol/geom.js';
import Polygon from 'ol/geom/Polygon.js';
import DragBox from 'ol/interaction/DragBox.js';
import Draw from 'ol/interaction/Draw.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import type { AoiGeometry, AreaOfInterest, Position } from '@omb/aois';
import { aoiExtent3857 } from './aoi-view.js';

export interface AoiCreatorProps {
  sourceId: string;
  dateId: string;
  seedAoi: AreaOfInterest;
  creating: boolean;
  onCreate(input: { name: string; geometry: AoiGeometry }): Promise<void>;
  onCancel(): void;
}

export function AoiCreator({ sourceId, dateId, seedAoi, creating, onCreate, onCancel }: AoiCreatorProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'box' | 'polygon'>('box');
  const [geometry, setGeometry] = useState<AoiGeometry | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const vectors = new VectorSource();
    const interaction = mode === 'box'
      ? new DragBox()
      : new Draw({ source: vectors, type: 'Polygon' });
    const view = new View();
    const map = new Map({
      target,
      controls: [],
      layers: [
        new TileLayer({ source: new XYZ({ url: `/api/temporal/tiles/${sourceId}/${dateId}/{z}/{x}/{y}` }) }),
        new VectorLayer({
          source: vectors,
          style: new Style({
            stroke: new Stroke({ color: '#ff4f42', width: 3 }),
            fill: new Fill({ color: 'rgba(255,79,66,.2)' }),
          }),
        }),
      ],
      interactions: [interaction],
      view,
    });
    map.updateSize();
    view.fit(aoiExtent3857(seedAoi), { padding: [24, 24, 24, 24], maxZoom: 13, size: map.getSize() });
    if (interaction instanceof DragBox) {
      interaction.on('boxstart', () => vectors.clear());
      interaction.on('boxend', () => {
        const drawn = interaction.getGeometry().clone();
        vectors.addFeature(new Feature(drawn));
        const lonLat = drawn.transform('EPSG:3857', 'EPSG:4326');
        setGeometry({ type: 'Polygon', coordinates: lonLat.getCoordinates() as Position[][] });
      });
    } else {
      interaction.on('drawstart', () => vectors.clear());
      interaction.on('drawend', (event) => {
        const drawn = (event.feature as Feature<Geometry>).getGeometry();
        if (!(drawn instanceof Polygon)) return;
        const lonLat = drawn.clone().transform('EPSG:3857', 'EPSG:4326');
        setGeometry({ type: 'Polygon', coordinates: lonLat.getCoordinates() as Position[][] });
      });
    }
    return () => map.setTarget(undefined);
  }, [dateId, mode, seedAoi, sourceId]);

  return (
    <section className="aoi-creator" aria-label="新建框选区域">
      <div className="aoi-create-head">
        <strong>在地图上框选区域</strong>
        <button type="button" onClick={onCancel} disabled={creating}>取消</button>
      </div>
      <label>区域名称
        <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="例如：项目东区" />
      </label>
      <div className="draw-mode" role="group" aria-label="绘制方式">
        <button type="button" className={mode === 'box' ? 'active' : ''} onClick={() => setMode('box')}>矩形框选</button>
        <button type="button" className={mode === 'polygon' ? 'active' : ''} onClick={() => setMode('polygon')}>多边形</button>
      </div>
      <div className="aoi-creator-map" ref={targetRef} />
      <p>{geometry ? '范围已就绪；保存后自动生成四期对比。' : '拖动绘制矩形，或逐点绘制多边形。'}</p>
      <button
        type="button"
        className="primary"
        disabled={creating || name.trim().length === 0 || geometry === null}
        onClick={() => geometry && void onCreate({ name: name.trim(), geometry })}
      >
        {creating ? '正在保存…' : '使用此范围'}
      </button>
    </section>
  );
}
