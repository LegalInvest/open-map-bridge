export type PaneState = 'waiting' | 'loading' | 'loaded' | 'partial' | 'failed';

export interface PaneStatus {
  state: PaneState;
  expected: number;
  loaded: number;
  failed: number;
}

type TileOutcome = 'loading' | 'loaded' | 'failed';

function summarize(tiles: ReadonlyMap<string, TileOutcome>): PaneStatus {
  let loaded = 0;
  let failed = 0;
  let pending = 0;
  for (const outcome of tiles.values()) {
    if (outcome === 'loaded') loaded += 1;
    else if (outcome === 'failed') failed += 1;
    else pending += 1;
  }
  const expected = tiles.size;
  if (expected === 0) return { state: 'waiting', expected, loaded, failed };
  if (pending > 0) return { state: 'loading', expected, loaded, failed };
  if (loaded === expected) return { state: 'loaded', expected, loaded, failed };
  if (failed === expected) return { state: 'failed', expected, loaded, failed };
  return { state: 'partial', expected, loaded, failed };
}

export class FrameQualityTracker {
  private readonly tiles = new Map<string, TileOutcome>();

  start(tileKey: string): PaneStatus {
    this.tiles.set(tileKey, 'loading');
    return summarize(this.tiles);
  }

  succeed(tileKey: string): PaneStatus {
    this.tiles.set(tileKey, 'loaded');
    return summarize(this.tiles);
  }

  fail(tileKey: string): PaneStatus {
    this.tiles.set(tileKey, 'failed');
    return summarize(this.tiles);
  }

  snapshot(): PaneStatus {
    return summarize(this.tiles);
  }
}
