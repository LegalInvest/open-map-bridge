import { describe, expect, it } from 'vitest';
import { FrameQualityTracker } from './frame-quality.js';

describe('FrameQualityTracker', () => {
  it('does not mark a frame loaded while another expected tile is pending', () => {
    const tracker = new FrameQualityTracker();
    tracker.start('8/210/100');
    tracker.start('8/211/100');
    expect(tracker.succeed('8/210/100')).toEqual({
      state: 'loading',
      expected: 2,
      loaded: 1,
      failed: 0,
    });
  });

  it('distinguishes complete, partial, and fully failed settled frames', () => {
    const complete = new FrameQualityTracker();
    complete.start('a');
    complete.start('b');
    complete.succeed('a');
    expect(complete.succeed('b')).toEqual({ state: 'loaded', expected: 2, loaded: 2, failed: 0 });

    const partial = new FrameQualityTracker();
    partial.start('a');
    partial.start('b');
    partial.succeed('a');
    expect(partial.fail('b')).toEqual({ state: 'partial', expected: 2, loaded: 1, failed: 1 });

    const failed = new FrameQualityTracker();
    failed.start('a');
    expect(failed.fail('a')).toEqual({ state: 'failed', expected: 1, loaded: 0, failed: 1 });
  });

  it('counts a tile key once and allows a failed tile to recover on retry', () => {
    const tracker = new FrameQualityTracker();
    tracker.start('a');
    tracker.start('a');
    tracker.fail('a');
    expect(tracker.start('a')).toEqual({ state: 'loading', expected: 1, loaded: 0, failed: 0 });
    expect(tracker.succeed('a')).toEqual({ state: 'loaded', expected: 1, loaded: 1, failed: 0 });
  });
});
