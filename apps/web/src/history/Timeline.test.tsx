// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { TemporalDateEntry } from '@omb/temporal-source';
import { Timeline } from './Timeline.js';

const dates: TemporalDateEntry[] = Array.from({ length: 20 }, (_, offset) => {
  const year = 2006 + offset;
  return {
    id: `scene-${year}`,
    requestDate: `${year}-07-15`,
    captureDate: `${year}-07-15`,
    precision: 'capture-date',
    availability: year === 2012 ? 'missing' : 'available',
    provenance: 'fixture',
  };
});

afterEach(cleanup);

it('keeps a missing year visible and advances to the next available frame', async () => {
  const user = userEvent.setup();
  const onFrame = vi.fn();
  render(<Timeline dates={dates} initialDateId="scene-2012" intervalMs={20} onFrame={onFrame} />);
  expect(screen.getByText('2012：缺失')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '下一可用帧' }));
  expect(onFrame).toHaveBeenLastCalledWith('scene-2013');
  expect(screen.getByText('当前帧：2013')).toBeVisible();
});

it('moves between playing and paused without treating time passage as a loaded frame', async () => {
  const user = userEvent.setup();
  const onFrame = vi.fn();
  render(<Timeline dates={dates} initialDateId="scene-2006" intervalMs={1_000} onFrame={onFrame} />);
  await user.click(screen.getByRole('button', { name: '播放变化' }));
  expect(screen.getByRole('button', { name: '暂停播放' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '暂停播放' }));
  expect(screen.getByRole('button', { name: '播放变化' })).toBeVisible();
  expect(onFrame).not.toHaveBeenCalled();
});
