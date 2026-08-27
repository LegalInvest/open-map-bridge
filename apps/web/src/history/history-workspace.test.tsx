// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useEffect, type ComponentType } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
      datePrecision: 'capture-date',
    },
  ],
  listAois: async () => structuredClone(lakeAoiPresets),
  listDates: async () => dates,
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

const TestMapPane: ComponentType<MapPaneProps> = ({ panelIndex, onStatus }) => {
  useEffect(() => {
    onStatus(panelIndex === 2 ? { state: 'failed', loaded: 0, failed: 1 } : { state: 'loaded', loaded: 1, failed: 0 });
  }, [onStatus, panelIndex]);
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
    expect(await screen.findByText('面板 3：加载失败')).toBeVisible();
    expect(screen.getByText('面板 1：已加载')).toBeVisible();
    expect(screen.getByText('范围待确认')).toBeVisible();
  });

  it('confirms a reference AOI as a new immutable version', async () => {
    const user = userEvent.setup();
    render(<HistoryWorkspace api={api} MapPaneComponent={TestMapPane} />);
    await screen.findAllByLabelText('面板日期');
    await user.click(screen.getByRole('button', { name: '确认当前范围' }));
    expect(await screen.findByText('已确认 v2')).toBeVisible();
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

  it('prefers a configured local authorized source over the synthetic fixture', async () => {
    const localApi: HistoryApi = {
      ...api,
      listSources: async () => [
        ...(await api.listSources()),
        { id: 'ovi-history-200', name: '本机授权历史影像', kind: 'ovi-bridge', datePrecision: 'request-date-only' },
      ],
    };
    render(<HistoryWorkspace api={localApi} MapPaneComponent={TestMapPane} />);
    expect(await screen.findByRole('combobox', { name: '图源' })).toHaveValue('ovi-history-200');
  });
});
