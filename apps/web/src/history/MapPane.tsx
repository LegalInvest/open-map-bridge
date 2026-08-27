import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Polygon from 'ol/geom/Polygon.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import type { AreaOfInterest, Position } from '@omb/aois';
import type { TemporalDateEntry, ViewState } from '@omb/temporal-source';
import type { ViewSync } from './view-sync.js';

export interface PaneStatus {
  state: 'waiting' | 'loading' | 'loaded' | 'failed';
  loaded: number;
  failed: number;
}

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

function aoiCenter(aoi: AreaOfInterest): [number, number] {
  const ring = outerRing(aoi);
  const longitudes = ring.map((position) => position[0]);
  const latitudes = ring.map((position) => position[1]);
  return [(Math.min(...longitudes) + Math.max(...longitudes)) / 2, (Math.min(...latitudes) + Math.max(...latitudes)) / 2];
}

export function MapPane({ panelIndex, sourceId, date, aoi, viewSync, onStatus }: MapPaneProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    let loaded = 0;
    let failed = 0;
    let applyingRemote = false;
    const source = new XYZ({
      url: `/api/temporal/tiles/${encodeURIComponent(sourceId)}/${encodeURIComponent(date.id)}/{z}/{x}/{y}`,
      crossOrigin: 'anonymous',
    });
    source.on('tileloadstart', () => onStatus({ state: 'loading', loaded, failed }));
    source.on('tileloadend', () => {
      loaded += 1;
      onStatus({ state: 'loaded', loaded, failed });
    });
    source.on('tileloaderror', () => {
      failed += 1;
      onStatus({ state: loaded > 0 ? 'loaded' : 'failed', loaded, failed });
    });

    const geometry = new Polygon([outerRing(aoi)]).transform('EPSG:4326', 'EPSG:3857');
    const outline = new VectorLayer({
      source: new VectorSource({ features: [new Feature({ geometry })] }),
      style: new Style({
        stroke: new Stroke({ color: '#ff5d4a', width: 3 }),
        fill: new Fill({ color: 'rgba(255, 93, 74, 0.08)' }),
      }),
    });
    const view = new View({ center: fromLonLat(aoiCenter(aoi)), zoom: aoi.id === 'baoying-lake' ? 10 : 9 });
    const map = new Map({
      target,
      layers: [new TileLayer({ source }), outline],
      view,
      controls: [],
    });
    const exposeViewState = (state: ViewState) => {
      target.dataset.viewState = JSON.stringify(state);
    };
    const initialCenter = view.getCenter();
    const initialZoom = view.getZoom();
    if (initialCenter && initialZoom !== undefined) {
      exposeViewState({
        center: [initialCenter[0] ?? 0, initialCenter[1] ?? 0],
        zoom: initialZoom,
        rotation: view.getRotation(),
        projection: 'EPSG:3857',
      });
    }
    const paneId = `pane-${panelIndex}`;
    const unsubscribe = viewSync.subscribe(paneId, (state: ViewState) => {
      applyingRemote = true;
      view.setCenter(state.center);
      view.setZoom(state.zoom);
      view.setRotation(state.rotation);
      exposeViewState(state);
      map.render();
      applyingRemote = false;
    });
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
      unsubscribe();
      map.setTarget(undefined);
    };
  }, [aoi, date.id, onStatus, panelIndex, sourceId, viewSync]);

  return <div ref={targetRef} className="map-pane-canvas" aria-label={`历史影像地图 ${panelIndex + 1}`} />;
}
