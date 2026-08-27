// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useEffect, type ComponentType } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lakeAoiPresets } from '@omb/aois';
import { HistoryWorkspace, type MapPaneProps } from './HistoryWorkspace.js';
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
  confirmAoi: async (aoi) => ({ ...aoi, version: aoi.version + 1, status: 'confirmed', confirmedAt: '2026-08-27T12:00:00.000Z' }),
};

const TestMapPane: ComponentType<MapPaneProps> = ({ panelIndex, onStatus }) => {
  useEffect(() => {
    onStatus(panelIndex === 2 ? { state: 'failed', loaded: 0, failed: 1 } : { state: 'loaded', loaded: 1, failed: 0 });
  }, [onStatus, panelIndex]);
  return <div aria-label={`测试地图 ${panelIndex + 1}`} />;
};

describe('HistoryWorkspace', () => {
  it('shows four independent dates and keeps one failed pane isolated', async () => {
    render(<HistoryWorkspace api={api} MapPaneComponent={TestMapPane} />);
    expect(await screen.findByRole('heading', { name: '双湖历史影像' })).toBeVisible();
    const selectors = await screen.findAllByLabelText('面板日期');
    expect(selectors).toHaveLength(4);
    expect(selectors.map((selector) => (selector as HTMLSelectElement).value)).toEqual([
      'scene-2006',
      'scene-2011',
      'scene-2018',
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
});
