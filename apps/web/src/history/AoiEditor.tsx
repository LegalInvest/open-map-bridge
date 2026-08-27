import { useEffect, useRef, useState } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Polygon from 'ol/geom/Polygon.js';
import Modify from 'ol/interaction/Modify.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import { Circle, Fill, Stroke, Style } from 'ol/style.js';
import type { AreaOfInterest, Position } from '@omb/aois';

interface AoiEditorProps {
  aoi: AreaOfInterest;
  sourceId: string;
  dateId: string;
  confirming: boolean;
  onConfirm(aoi: AreaOfInterest): Promise<void>;
}

function ring(aoi: AreaOfInterest): Position[] {
  return aoi.geometry.type === 'Polygon' ? (aoi.geometry.coordinates[0] ?? []) : (aoi.geometry.coordinates[0]?.[0] ?? []);
}

export function AoiEditor({ aoi, sourceId, dateId, confirming, onConfirm }: AoiEditorProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(aoi);

  useEffect(() => setDraft(aoi), [aoi]);
  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const polygon = new Polygon([ring(draft)]).transform('EPSG:4326', 'EPSG:3857');
    const feature = new Feature({ geometry: polygon });
    const vectors = new VectorSource({ features: [feature] });
    const modify = new Modify({ source: vectors });
    const positions = ring(draft);
    const longitude = positions.reduce((sum, value) => sum + value[0], 0) / positions.length;
    const latitude = positions.reduce((sum, value) => sum + value[1], 0) / positions.length;
    const map = new Map({
      target,
      layers: [
        new TileLayer({ source: new XYZ({ url: `/api/temporal/tiles/${sourceId}/${dateId}/{z}/{x}/{y}` }) }),
        new VectorLayer({
          source: vectors,
          style: new Style({
            stroke: new Stroke({ color: '#ff4f42', width: 3 }),
            fill: new Fill({ color: 'rgba(255,79,66,.18)' }),
            image: new Circle({ radius: 5, fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color: '#ff4f42' }) }),
          }),
        }),
      ],
      interactions: [modify],
      controls: [],
      view: new View({ center: fromLonLat([longitude, latitude]), zoom: aoi.id === 'baoying-lake' ? 10 : 9 }),
    });
    modify.on('modifyend', () => {
      const edited = feature.getGeometry()?.clone().transform('EPSG:3857', 'EPSG:4326') as Polygon | undefined;
      if (!edited) return;
      setDraft({ ...draft, geometry: { type: 'Polygon', coordinates: edited.getCoordinates() as Position[][] } });
    });
    return () => map.setTarget(undefined);
  }, [aoi.id, dateId, draft.version, sourceId]);

  return (
    <section className="aoi-editor" aria-label="范围确认">
      <div className="aoi-editor-map" ref={targetRef} />
      <p>红线来自你上传的参考图；可拖动顶点微调，确认后生成新版本。</p>
      <div className="aoi-actions">
        <button type="button" onClick={() => setDraft(aoi)} disabled={confirming}>撤销本次编辑</button>
        <button type="button" className="primary" onClick={() => void onConfirm(draft)} disabled={confirming}>
          {confirming ? '正在确认…' : '确认当前范围'}
        </button>
      </div>
    </section>
  );
}
