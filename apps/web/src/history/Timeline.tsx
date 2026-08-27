import { useEffect, useMemo, useState } from 'react';
import type { TemporalDateEntry } from '@omb/temporal-source';

interface TimelineProps {
  dates: TemporalDateEntry[];
  initialDateId?: string | undefined;
  intervalMs?: number;
  onFrame(dateId: string): void;
}

type PlaybackState = 'stopped' | 'playing' | 'paused';

export function Timeline({ dates, initialDateId, intervalMs = 1_200, onFrame }: TimelineProps) {
  const initialIndex = Math.max(0, dates.findIndex((date) => date.id === initialDateId));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [playback, setPlayback] = useState<PlaybackState>('stopped');
  const [speed, setSpeed] = useState(1);
  const current = dates[currentIndex] ?? null;
  const missing = useMemo(() => dates.filter((date) => date.availability === 'missing'), [dates]);

  useEffect(() => {
    if (playback !== 'playing' || dates.length === 0) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        const next = (index + 1) % dates.length;
        const entry = dates[next];
        if (entry?.availability === 'available') onFrame(entry.id);
        return next;
      });
    }, intervalMs / speed);
    return () => window.clearInterval(timer);
  }, [dates, intervalMs, onFrame, playback, speed]);

  function nextAvailable(direction: 1 | -1) {
    if (dates.length === 0) return;
    for (let step = 1; step <= dates.length; step += 1) {
      const next = (currentIndex + direction * step + dates.length) % dates.length;
      const entry = dates[next];
      if (entry?.availability === 'available') {
        setCurrentIndex(next);
        onFrame(entry.id);
        return;
      }
    }
  }

  return (
    <section className="timeline" aria-label="历史影像时间轴">
      <div className="timeline-actions">
        <button type="button" onClick={() => nextAvailable(-1)}>上一可用帧</button>
        <button
          type="button"
          className="primary"
          onClick={() => setPlayback((value) => (value === 'playing' ? 'paused' : 'playing'))}
        >
          {playback === 'playing' ? '暂停播放' : '播放变化'}
        </button>
        <button type="button" onClick={() => nextAvailable(1)}>下一可用帧</button>
        <label>速度
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <strong>当前帧：{current?.requestDate.slice(0, 4) ?? '未知'}</strong>
      </div>
      <div className="timeline-track">
        {dates.map((date, index) => (
          <button
            type="button"
            key={date.id}
            className={`${index === currentIndex ? 'active' : ''} ${date.availability}`}
            aria-label={`切换到 ${date.requestDate.slice(0, 4)}`}
            onClick={() => {
              setCurrentIndex(index);
              if (date.availability === 'available') onFrame(date.id);
            }}
          >
            {date.requestDate.slice(2, 4)}
          </button>
        ))}
      </div>
      <div className="timeline-gaps" aria-live="polite">
        {missing.map((date) => <span key={date.id}>{date.requestDate.slice(0, 4)}：缺失</span>)}
      </div>
    </section>
  );
}
