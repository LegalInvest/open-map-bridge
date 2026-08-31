// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useEffect, type ComponentType } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { HistoryWorkspace, type MapPaneProps } from './HistoryWorkspace.js';
import type { AoiCreatorProps } from './AoiCreator.js';
import type { HistoryApi } from '../api/client.js';

const dates = Array.from({ length: 20 }, (_, offset) => {
  const year = 2006 + offset;
  return {
    id: `scene-${year}`,
    requestDate: `${year}-07-15`,
    captureDate: `${year}-07-15`,
    precision: 'capture-date' as const,
    availability: year === 2012 ? ('missing' as const) : ('available' as const),
    provenance: 'fixture',
  };
});

const api: HistoryApi = {
  listSources: async () => [
    {
      id: 'synthetic-lakes',
      name: '合成时序验收源',
      kind: 'synthetic',
      availability: 'ready',
      datePrecision: 'capture-date',
    },
  ],
  listAois: async () => structuredClone(lakeAoiPresets),
  listDates: async () => dates,
  listComparisons: async () => [],
  createComparison: async (input) => ({
    ...input,
    id: 'comparison-test',
    createdAt: '2026-09-01T00:00:00.000Z',
  }),
  createAoi: async ({ name, geometry }) => ({
    id: 'area-test',
    version: 1,
    name,
    geometry,
    crs: 'EPSG:4326',
    status: 'confirmed',
    provenance: 'user-drawn-web',
    confirmedAt: '2026-08-27T12:00:00.000Z',
  }),
  confirmAoi: async (aoi) => ({ ...aoi, version: aoi.version + 1, status: 'confirmed', confirmedAt: '2026-08-27T12:00:00.000Z' }),
};

const TestMapPane: ComponentType<MapPaneProps> = ({ panelIndex, onStatus, viewSync }) => {
  useEffect(() => {
    if (panelIndex === 0) {
      viewSync.publish('test-pane-0', {
        center: [13_270_000, 3_890_000],
        zoom: 9,
        rotation: 0,
        projection: 'EPSG:3857',
      });
    }
    onStatus(
      panelIndex === 1
        ? { state: 'partial', expected: 2, loaded: 1, failed: 1 }
        : panelIndex === 2
          ? { state: 'failed', expected: 1, loaded: 0, failed: 1 }
          : { state: 'loaded', expected: 2, loaded: 2, failed: 0 },
    );
  }, [onStatus, panelIndex, viewSync]);
  return <div aria-label={`测试地图 ${panelIndex + 1}`} />;
};

afterEach(() => cleanup());

describe('HistoryWorkspace', () => {
  it('shows four independent dates and keeps one failed pane isolated', async () => {
    render(<HistoryWorkspace api={api} MapPaneComponent={TestMapPane} />);
    expect(await screen.findByRole('heading', { name: '历史影像四期对比' })).toBeVisible();
    const selectors = await screen.findAllByLabelText('面板日期');
    expect(selectors).toHaveLength(4);
    expect(selectors.map((selector) => (selector as HTMLSelectElement).value)).toEqual([
      'scene-2006',
      'scene-2011',
      'scene-2019',
      'scene-2025',
    ]);
    expect(await screen.findByText('面板 3：加载失败（成功 0/1，失败 1）')).toBeVisible();
    expect(screen.getByText('面板 1：完整加载（成功 2/2，失败 0）')).toBeVisible();
    expect(screen.getByText('面板 2：部分加载（成功 1/2，失败 1）')).toBeVisible();
    expect(screen.getByText('范围待确认')).toBeVisible();
  });

  it('confirms a reference AOI as a new immutable version', async () => {
    const user = userEvent.setup();
    render(<HistoryWorkspace api={api} MapPaneComponent={TestMapPane} />);
    await screen.findAllByLabelText('面板日期');
    await user.click(screen.getByRole('button', { name: '确认当前范围' }));
    expect(await screen.findByText('已确认 v2')).toBeVisible();
  });

  it('persists terminal frame counts and exposes the receipt after save', async () => {
    const user = userEvent.setup();
    const createComparison = vi.fn(api.createComparison);
    render(<HistoryWorkspace api={{ ...api, createComparison }} MapPaneComponent={TestMapPane} />);
    await screen.findAllByLabelText('面板日期');
    expect(screen.getByRole('button', { name: '保存四期比较回执' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '确认当前范围' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存四期比较回执' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '保存四期比较回执' }));
    expect(await screen.findByRole('status')).toHaveTextContent('comparison-test');
    expect(screen.getByText('当前范围已保存 1 条')).toBeVisible();
    expect(createComparison).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      aoiVersion: 2,
      dateIds: ['scene-2006', 'scene-2011', 'scene-2019', 'scene-2025'],
      frames: [
        expect.objectContaining({ status: 'loaded', expectedTileCount: 2, loadedTileCount: 2, failedTileCount: 0 }),
        expect.objectContaining({ status: 'partial', expectedTileCount: 2, loadedTileCount: 1, failedTileCount: 1 }),
        expect.objectContaining({ status: 'failed', expectedTileCount: 1, loadedTileCount: 0, failedTileCount: 1 }),
        expect.objectContaining({ status: 'loaded', expectedTileCount: 2, loadedTileCount: 2, failedTileCount: 0 }),
      ],
    }));
  });

  it('creates and selects a non-preset area before automatically showing four dates', async () => {
    const user = userEvent.setup();
    const createAoi = vi.fn(api.createAoi);
    const localApi: HistoryApi = { ...api, createAoi };
    const TestCreator: ComponentType<AoiCreatorProps> = ({ onCreate }) => (
      <button
        type="button"
        onClick={() => void onCreate({
          name: '实验区域',
          geometry: {
            type: 'Polygon',
            coordinates: [[[118.5, 31.2], [119.4, 31.2], [119.4, 32.1], [118.5, 32.1], [118.5, 31.2]]],
          },
        })}
      >
        提交实验区域
      </button>
    );
    render(
      <HistoryWorkspace api={localApi} MapPaneComponent={TestMapPane} AoiCreatorComponent={TestCreator} />,
    );
    await screen.findAllByLabelText('面板日期');
    await user.click(screen.getByRole('button', { name: '新建框选区域' }));
    await user.click(screen.getByRole('button', { name: '提交实验区域' }));
    expect(createAoi).toHaveBeenCalledOnce();
    expect(await screen.findByRole('combobox', { name: '区域' })).toHaveValue('area-test');
    expect(await screen.findByText('已确认 v1')).toBeVisible();
    expect(screen.getAllByLabelText('面板日期')).toHaveLength(4);
  });

  it('uses the first ready source returned by the API instead of inferring readiness from provider kind', async () => {
    const localApi: HistoryApi = {
      ...api,
      listSources: async () => [
        ...(await api.listSources()),
        {
          id: 'ready-ovi-source',
          name: '已就绪本机授权历史影像',
          kind: 'ovi-bridge',
          availability: 'ready',
          datePrecision: 'request-date-only',
        },
      ],
    };
    render(<HistoryWorkspace api={localApi} MapPaneComponent={TestMapPane} />);
    expect(await screen.findByRole('combobox', { name: '图源' })).toHaveValue('synthetic-lakes');
  });

  it('shows an explicit empty state when the API has no ready source', async () => {
    const listDates = vi.fn(api.listDates);
    const localApi: HistoryApi = { ...api, listSources: async () => [], listDates };
    render(<HistoryWorkspace api={localApi} MapPaneComponent={TestMapPane} />);
    expect(await screen.findByText('当前：无已就绪图源')).toBeVisible();
    expect(listDates).not.toHaveBeenCalled();
  });
});
