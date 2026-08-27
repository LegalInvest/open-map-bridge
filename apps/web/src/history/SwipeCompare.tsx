import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import type RenderEvent from 'ol/render/Event.js';
import type { AreaOfInterest } from '@omb/aois';
import type { TemporalDateEntry } from '@omb/temporal-source';
import { aoiExtent3857 } from './aoi-view.js';

interface SwipeCompareProps {
  sourceId: string;
  aoi: AreaOfInterest;
  leftDate: TemporalDateEntry;
  rightDate: TemporalDateEntry;
}

export function clampSwipePercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function SwipeCompare({ sourceId, aoi, leftDate, rightDate }: SwipeCompareProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [percentage, setPercentage] = useState(50);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const left = new TileLayer({
      source: new XYZ({ url: `/api/temporal/tiles/${sourceId}/${leftDate.id}/{z}/{x}/{y}` }),
    });
    const right = new TileLayer({
      source: new XYZ({ url: `/api/temporal/tiles/${sourceId}/${rightDate.id}/{z}/{x}/{y}` }),
    });
    right.on('prerender', (event: RenderEvent) => {
      const context = event.context as CanvasRenderingContext2D | undefined;
      if (!context) return;
      const width = context.canvas.width * (clampSwipePercentage(percentage) / 100);
      context.save();
      context.beginPath();
      context.rect(0, 0, width, context.canvas.height);
      context.clip();
    });
    right.on('postrender', (event: RenderEvent) => {
      const context = event.context as CanvasRenderingContext2D | undefined;
      context?.restore();
    });
    const view = new View();
    const map = new Map({
      target,
      layers: [left, right],
      controls: [],
      view,
    });
    map.updateSize();
    view.fit(aoiExtent3857(aoi), { padding: [24, 24, 24, 24], maxZoom: 14, size: map.getSize() });
    return () => map.setTarget(undefined);
  }, [aoi, leftDate.id, percentage, rightDate.id, sourceId]);

  return (
    <section className="swipe-compare" aria-label="双期卷帘对比">
      <div className="swipe-labels"><span>{leftDate.requestDate}</span><span>{rightDate.requestDate}</span></div>
      <div ref={targetRef} className="swipe-map" />
      <label>卷帘位置
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(event) => setPercentage(clampSwipePercentage(Number(event.target.value)))}
        />
      </label>
    </section>
  );
}
