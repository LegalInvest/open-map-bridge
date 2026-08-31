import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Polygon from 'ol/geom/Polygon.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import type { AreaOfInterest, Position } from '@omb/aois';
import type { TemporalDateEntry, ViewState } from '@omb/temporal-source';
import type { ViewSync } from './view-sync.js';
import { aoiExtent3857 } from './aoi-view.js';
import { FrameQualityTracker, type PaneStatus } from './frame-quality.js';

export type { PaneStatus } from './frame-quality.js';

export interface MapPaneProps {
  panelIndex: number;
  sourceId: string;
  date: TemporalDateEntry;
  aoi: AreaOfInterest;
  viewSync: ViewSync;
  onStatus(status: PaneStatus): void;
}

function outerRing(aoi: AreaOfInterest): Position[] {
  if (aoi.geometry.type === 'Polygon') return aoi.geometry.coordinates[0] ?? [];
  return aoi.geometry.coordinates[0]?.[0] ?? [];
}

export function MapPane({ panelIndex, sourceId, date, aoi, viewSync, onStatus }: MapPaneProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    let active = true;
    let applyingRemote = false;
    const quality = new FrameQualityTracker();
    const source = new XYZ({
      url: `/api/temporal/tiles/${encodeURIComponent(sourceId)}/${encodeURIComponent(date.id)}/{z}/{x}/{y}`,
      crossOrigin: 'anonymous',
    });
    const report = (status: PaneStatus) => {
      if (active) onStatus(status);
    };
    const handleTileStart = (event: { tile: { getKey(): string } }) => report(quality.start(event.tile.getKey()));
    const handleTileEnd = (event: { tile: { getKey(): string } }) => report(quality.succeed(event.tile.getKey()));
    const handleTileError = (event: { tile: { getKey(): string } }) => report(quality.fail(event.tile.getKey()));
    source.on('tileloadstart', handleTileStart);
    source.on('tileloadend', handleTileEnd);
    source.on('tileloaderror', handleTileError);

    const geometry = new Polygon([outerRing(aoi)]).transform('EPSG:4326', 'EPSG:3857');
    const outline = new VectorLayer({
      source: new VectorSource({ features: [new Feature({ geometry })] }),
      style: new Style({
        stroke: new Stroke({ color: '#ff5d4a', width: 3 }),
        fill: new Fill({ color: 'rgba(255, 93, 74, 0.08)' }),
      }),
    });
    const view = new View();
    const map = new Map({
      target,
      layers: [new TileLayer({ source }), outline],
      view,
      controls: [],
    });
    map.updateSize();
    view.fit(aoiExtent3857(aoi), { padding: [24, 24, 24, 24], maxZoom: 14, size: map.getSize() });
    const exposeViewState = (state: ViewState) => {
      target.dataset.viewState = JSON.stringify(state);
    };
    const paneId = `pane-${panelIndex}`;
    const hadSharedView = viewSync.current() !== null;
    const unsubscribe = viewSync.subscribe(paneId, (state: ViewState) => {
      applyingRemote = true;
      view.setCenter(state.center);
      view.setZoom(state.zoom);
      view.setRotation(state.rotation);
      exposeViewState(state);
      map.render();
      applyingRemote = false;
    });
    const initialCenter = view.getCenter();
    const initialZoom = view.getZoom();
    if (!hadSharedView && initialCenter && initialZoom !== undefined) {
      const initialState: ViewState = {
        center: [initialCenter[0] ?? 0, initialCenter[1] ?? 0],
        zoom: initialZoom,
        rotation: view.getRotation(),
        projection: 'EPSG:3857',
      };
      exposeViewState(initialState);
      viewSync.publish(paneId, initialState);
    }
    map.on('moveend', () => {
      if (applyingRemote) return;
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (!center || zoom === undefined) return;
      const [centerX, centerY] = center;
      if (centerX === undefined || centerY === undefined) return;
      const state: ViewState = {
        center: [centerX, centerY],
        zoom,
        rotation: view.getRotation(),
        projection: 'EPSG:3857',
      };
      exposeViewState(state);
      viewSync.publish(paneId, state);
    });
    return () => {
      active = false;
      source.un('tileloadstart', handleTileStart);
      source.un('tileloadend', handleTileEnd);
      source.un('tileloaderror', handleTileError);
      unsubscribe();
      map.setTarget(undefined);
    };
  }, [aoi, date.id, onStatus, panelIndex, sourceId, viewSync]);

  return <div ref={targetRef} className="map-pane-canvas" aria-label={`历史影像地图 ${panelIndex + 1}`} />;
}
