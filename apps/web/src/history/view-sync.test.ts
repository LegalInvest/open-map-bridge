import { expect, it } from 'vitest';
import type { ViewState } from '@omb/temporal-source';
import { createViewSync } from './view-sync.js';

it('broadcasts one normalized state without feeding the origin back', () => {
  const sync = createViewSync();
  const a: ViewState[] = [];
  const b: ViewState[] = [];
  sync.subscribe('a', (state) => a.push(state));
  sync.subscribe('b', (state) => b.push(state));
  sync.publish('a', { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' });
  expect(a).toHaveLength(0);
  expect(b).toEqual([
    { center: [13_270_000, 3_890_000], zoom: 9, rotation: 0, projection: 'EPSG:3857' },
  ]);
});

it('unsubscribes listeners and keeps subscriber state isolated', () => {
  const sync = createViewSync();
  const received: ViewState[] = [];
  const unsubscribe = sync.subscribe('pane-b', (state) => received.push(state));
  unsubscribe();
  sync.publish('pane-a', { center: [1, 2], zoom: 8, rotation: 0.1, projection: 'EPSG:3857' });
  expect(received).toEqual([]);
});

it('replays the last shared view to a pane that remounts after a date change', () => {
  const sync = createViewSync();
  sync.publish('pane-a', { center: [13_260_000, 3_880_000], zoom: 10, rotation: 0, projection: 'EPSG:3857' });
  const received: ViewState[] = [];
  sync.subscribe('pane-b', (state) => received.push(state));
  expect(received).toEqual([
    { center: [13_260_000, 3_880_000], zoom: 10, rotation: 0, projection: 'EPSG:3857' },
  ]);
  const snapshot = sync.current();
  expect(snapshot).toEqual(received[0]);
  snapshot!.center[0] = 0;
  expect(sync.current()?.center[0]).toBe(13_260_000);
});
