import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import type { AoiGeometry, AreaOfInterest } from '@omb/aois';
import { completeYearWindow, selectFourFrameDates, type TemporalDateEntry } from '@omb/temporal-source';
import type { HistoryApi, TemporalSourceSummary } from '../api/client.js';
import { AoiCreator, type AoiCreatorProps } from './AoiCreator.js';
import { AoiEditor } from './AoiEditor.js';
import { MapGrid } from './MapGrid.js';
import { MapPane, type MapPaneProps, type PaneStatus } from './MapPane.js';
import { ObservationPanel } from './ObservationPanel.js';
import { SwipeCompare } from './SwipeCompare.js';
import { Timeline } from './Timeline.js';
import { createViewSync } from './view-sync.js';

export type { MapPaneProps } from './MapPane.js';

interface HistoryWorkspaceProps {
  api: HistoryApi;
  MapPaneComponent?: ComponentType<MapPaneProps>;
  AoiCreatorComponent?: ComponentType<AoiCreatorProps>;
}

function createInitialStatuses(): PaneStatus[] {
  return Array.from({ length: 4 }, () => ({ state: 'waiting', loaded: 0, failed: 0 }));
}

function latestAois(entries: AreaOfInterest[]): AreaOfInterest[] {
  const byId = new Map<string, AreaOfInterest>();
  for (const entry of entries) {
    const current = byId.get(entry.id);
    if (!current || entry.version > current.version) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

function chooseInitialDates(dates: TemporalDateEntry[]): string[] {
  return selectFourFrameDates(dates).map((date) => date.id);
}

function statusLabel(index: number, status: PaneStatus): string {
  const label = status.state === 'loaded' ? '已加载' : status.state === 'failed' ? '加载失败' : status.state === 'loading' ? '加载中' : '等待加载';
  return `面板 ${index + 1}：${label}`;
}

export function HistoryWorkspace({ api, MapPaneComponent = MapPane, AoiCreatorComponent = AoiCreator }: HistoryWorkspaceProps) {
  const [sources, setSources] = useState<TemporalSourceSummary[]>([]);
  const [aois, setAois] = useState<AreaOfInterest[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [aoiId, setAoiId] = useState('');
  const viewSync = useMemo(() => createViewSync(), [aoiId]);
  const [dates, setDates] = useState<TemporalDateEntry[]>([]);
  const [panelDateIds, setPanelDateIds] = useState<string[]>([]);
  const [paneStatuses, setPaneStatuses] = useState<PaneStatus[]>(createInitialStatuses);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [creatingAoi, setCreatingAoi] = useState(false);
  const [showAoiCreator, setShowAoiCreator] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'swipe'>('grid');
  const yearWindow = useMemo(() => completeYearWindow(new Date().getUTCFullYear()), []);

  useEffect(() => {
    let active = true;
    void Promise.all([api.listSources(), api.listAois()])
      .then(([sourceRows, aoiRows]) => {
        if (!active) return;
        setSources(sourceRows);
        setAois(aoiRows);
        setSourceId(sourceRows.find((source) => source.kind === 'ovi-bridge')?.id ?? sourceRows[0]?.id ?? '');
        setAoiId(aoiRows[0]?.id ?? '');
      })
      .catch((cause: unknown) => active && setError((cause as Error).message));
    return () => {
      active = false;
    };
  }, [api]);

  const visibleAois = latestAois(aois);
  const selectedAoi = visibleAois.find((aoi) => aoi.id === aoiId) ?? visibleAois[0] ?? null;
  const selectedSource = sources.find((source) => source.id === sourceId) ?? sources[0] ?? null;

  useEffect(() => {
    if (!selectedSource || !selectedAoi) return;
    let active = true;
    setDates([]);
    setPanelDateIds([]);
    setPaneStatuses(createInitialStatuses());
    void api
      .listDates(selectedSource.id, selectedAoi.id)
      .then((rows) => {
        if (!active) return;
        setDates(rows);
        setPanelDateIds(chooseInitialDates(rows));
      })
      .catch((cause: unknown) => active && setError((cause as Error).message));
    return () => {
      active = false;
    };
  }, [api, selectedAoi?.id, selectedSource?.id]);

  const selectedDates = panelDateIds
    .map((id) => dates.find((date) => date.id === id))
    .filter((date): date is TemporalDateEntry => Boolean(date));

  const handlePaneStatus = useCallback((index: number, status: PaneStatus) => {
    setPaneStatuses((current) => {
      const existing = current[index];
      if (existing && existing.state === status.state && existing.loaded === status.loaded && existing.failed === status.failed) return current;
      const next = [...current];
      next[index] = status;
      return next;
    });
  }, []);

  const handleTimelineFrame = useCallback((dateId: string) => {
    setPanelDateIds((current) => current.map((value, index) => (index === 3 ? dateId : value)));
  }, []);

  async function confirmAoi(aoi: AreaOfInterest) {
    setConfirming(true);
    setError(null);
    try {
      const confirmed = await api.confirmAoi(aoi);
      setAois((current) => [...current, confirmed]);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  async function createAoi(input: { name: string; geometry: AoiGeometry }) {
    setCreatingAoi(true);
    setError(null);
    try {
      const created = await api.createAoi(input);
      setAois((current) => [...current, created]);
      setAoiId(created.id);
      setShowAoiCreator(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setCreatingAoi(false);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">OPENMAPBRIDGE · TEMPORAL LAB</p>
          <h1>历史影像四期对比</h1>
          <p>任意框选区域｜{yearWindow.fromYear}–{yearWindow.toYear}｜自动四期、同范围、同视角</p>
        </div>
        <div className="truth-strip">
          <span className={selectedSource?.kind === 'synthetic' ? 'truth-chip warning' : 'truth-chip'}>
            {selectedSource?.kind === 'synthetic' ? '当前：合成验收源' : '当前：本机授权源'}
          </span>
          <span className="truth-chip">拍摄日期：{selectedSource?.datePrecision === 'capture-date' ? '可用' : '未知/按请求日'}</span>
        </div>
      </header>

      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      <section className="control-bar" aria-label="历史影像控制">
        <label>区域
          <select value={aoiId} onChange={(event) => setAoiId(event.target.value)}>
            {visibleAois.map((aoi) => <option key={aoi.id} value={aoi.id}>{aoi.name}</option>)}
          </select>
        </label>
        <button type="button" className="primary" onClick={() => setShowAoiCreator(true)}>新建框选区域</button>
        <label>图源
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
        </label>
        <span className={selectedAoi?.status === 'confirmed' ? 'aoi-state confirmed' : 'aoi-state'}>
          {selectedAoi?.status === 'confirmed' ? `已确认 v${selectedAoi.version}` : '范围待确认'}
        </span>
        <span className="date-count">
          可请求 {dates.filter((date) => date.availability === 'available' || date.availability === 'unknown').length} / 20 年 · 自动 {selectedDates.length} 期
        </span>
        <div className="view-mode" role="group" aria-label="对比模式">
          <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>四屏对比</button>
          <button type="button" className={viewMode === 'swipe' ? 'active' : ''} onClick={() => setViewMode('swipe')}>双屏卷帘</button>
        </div>
      </section>

      <div className="workspace-layout">
        <aside className="side-panel">
          <section>
            <h2>四期选择</h2>
            {panelDateIds.map((dateId, index) => (
              <label className="date-field" key={index}>
                <span>面板 {index + 1}</span>
                <select
                  aria-label="面板日期"
                  value={dateId}
                  onChange={(event) => setPanelDateIds((current) => current.map((value, item) => item === index ? event.target.value : value))}
                >
                  {dates.map((date) => (
                    <option key={date.id} value={date.id}>
                      {date.requestDate.slice(0, 4)}{date.availability === 'missing' ? '（缺失）' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </section>
          {showAoiCreator && selectedAoi && selectedSource && dates[0] ? (
            <AoiCreatorComponent
              sourceId={selectedSource.id}
              dateId={dates[0].id}
              seedAoi={selectedAoi}
              creating={creatingAoi}
              onCreate={createAoi}
              onCancel={() => setShowAoiCreator(false)}
            />
          ) : selectedAoi && selectedSource && dates[0] ? (
            <AoiEditor
              aoi={selectedAoi}
              sourceId={selectedSource.id}
              dateId={dates[0].id}
              confirming={confirming}
              onConfirm={confirmAoi}
            />
          ) : <p>正在载入范围…</p>}
          <ObservationPanel />
        </aside>

        <section className="map-stage">
          <div className="pane-status-grid">
            {paneStatuses.map((status, index) => <span key={index}>{statusLabel(index, status)}</span>)}
          </div>
          {selectedAoi && selectedSource && selectedDates.length === 4 && viewMode === 'grid' ? (
            <MapGrid
              sourceId={selectedSource.id}
              aoi={selectedAoi}
              dates={selectedDates}
              viewSync={viewSync}
              MapPaneComponent={MapPaneComponent}
              onPaneStatus={handlePaneStatus}
            />
          ) : null}
          {selectedAoi && selectedSource && selectedDates.length === 4 && viewMode === 'swipe' ? (
            <SwipeCompare
              sourceId={selectedSource.id}
              aoi={selectedAoi}
              leftDate={selectedDates[0] as TemporalDateEntry}
              rightDate={selectedDates[3] as TemporalDateEntry}
            />
          ) : null}
          {(!selectedAoi || !selectedSource || selectedDates.length !== 4) ? (
            <div className="loading-state">当前找到 {selectedDates.length} 个可请求时期；四屏需要四个不重复日期。</div>
          ) : null}
          {dates.length > 0 ? (
            <Timeline dates={dates} initialDateId={dates[0]?.id} onFrame={handleTimelineFrame} />
          ) : null}
        </section>
      </div>
      <footer>影像显示可见变化，不单独证明污染、过度养殖或开发原因。</footer>
    </main>
  );
}
