import { useState } from 'react';

const causeLabels: Record<string, string> = {
  unknown: '仅记录可见变化',
  aquaculture: '养殖/围网变化',
  pollution: '污染',
  development: '岸线或建设开发',
};

export function ObservationPanel() {
  const [cause, setCause] = useState('unknown');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const hasIndependentEvidence = /^https:\/\/[^\s]+$/i.test(evidenceUrl);

  return (
    <section className="observation-panel" aria-label="变化观察">
      <h2>变化观察</h2>
      <label>可见对象
        <select defaultValue="shoreline">
          <option value="shoreline">岸线/圩区</option>
          <option value="nets">围网/养殖格网</option>
          <option value="water">水色/水面纹理</option>
          <option value="construction">道路/建设用地</option>
        </select>
      </label>
      <label>可能原因
        <select value={cause} onChange={(event) => setCause(event.target.value)}>
          {Object.entries(causeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {cause !== 'unknown' ? <p className="hypothesis">假设：影像不能单独证明{causeLabels[cause]}</p> : null}
      <label>独立证据链接
        <input
          value={evidenceUrl}
          onChange={(event) => setEvidenceUrl(event.target.value)}
          placeholder="https://政府/论文/监测数据"
        />
      </label>
      <button type="button" disabled={!hasIndependentEvidence || cause === 'unknown'}>标记为有证据支持</button>
    </section>
  );
}
