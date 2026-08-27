import { useCallback, type ComponentType } from 'react';
import type { AreaOfInterest } from '@omb/aois';
import type { TemporalDateEntry } from '@omb/temporal-source';
import { MapPane, type MapPaneProps, type PaneStatus } from './MapPane.js';
import type { ViewSync } from './view-sync.js';

interface MapGridProps {
  sourceId: string;
  aoi: AreaOfInterest;
  dates: TemporalDateEntry[];
  viewSync: ViewSync;
  MapPaneComponent?: ComponentType<MapPaneProps>;
  onPaneStatus(index: number, status: PaneStatus): void;
}

interface PaneSlotProps extends Omit<MapPaneProps, 'onStatus'> {
  MapPaneComponent: ComponentType<MapPaneProps>;
  onPaneStatus(index: number, status: PaneStatus): void;
}

function PaneSlot({ MapPaneComponent, onPaneStatus, ...props }: PaneSlotProps) {
  const handleStatus = useCallback(
    (status: PaneStatus) => onPaneStatus(props.panelIndex, status),
    [onPaneStatus, props.panelIndex],
  );
  return <MapPaneComponent {...props} onStatus={handleStatus} />;
}

export function MapGrid({ MapPaneComponent = MapPane, onPaneStatus, ...props }: MapGridProps) {
  return (
    <section className="map-grid" aria-label="四期影像对比">
      {props.dates.map((date, panelIndex) => (
        <article className="map-card" key={panelIndex}>
          <div className="map-card-title">
            <strong>{date.captureDate?.slice(0, 4) ?? date.requestDate.slice(0, 4)}</strong>
            <span>{date.captureDate ? `拍摄 ${date.captureDate}` : `请求 ${date.requestDate} · 拍摄日未知`}</span>
          </div>
          <PaneSlot
            MapPaneComponent={MapPaneComponent}
            onPaneStatus={onPaneStatus}
            panelIndex={panelIndex}
            sourceId={props.sourceId}
            date={date}
            aoi={props.aoi}
            viewSync={props.viewSync}
          />
        </article>
      ))}
    </section>
  );
}
