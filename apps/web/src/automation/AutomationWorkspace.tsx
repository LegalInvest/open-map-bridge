import { useEffect, useState } from 'react';
import type { AutomationRun, AutomationStep, MapSourceDefinition } from '@omb/source-schema';
import type { AutomationApi, ImportApi } from '../api/client.js';

interface AutomationWorkspaceProps {
  api: AutomationApi & Pick<ImportApi, 'listImportSources'>;
  onOpenImport?: () => void;
}

const runStatus: Record<AutomationRun['status'], string> = {
  running: '运行中',
  'awaiting-intervention': '等待处理',
  completed: '静态检查完成',
  partial: '部分完成',
  blocked: '已阻塞',
  failed: '失败',
  cancelled: '已取消',
};

const stepName: Record<AutomationStep['kind'], string> = {
  'source-confirmed': '图源确认',
  'network-policy': '网络策略',
  'credential-readiness': '凭证准备',
  'runtime-binding': '运行时绑定',
};

const stepStatus: Record<AutomationStep['status'], string> = {
  pending: '等待',
  running: '运行中',
  succeeded: '通过',
  blocked: '阻塞',
  skipped: '跳过',
  'retryable-failed': '可重试失败',
};

function updateRun(runs: AutomationRun[], run: AutomationRun): AutomationRun[] {
  return [run, ...runs.filter((entry) => entry.id !== run.id)].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function AutomationWorkspace({ api, onOpenImport }: AutomationWorkspaceProps) {
  const [sources, setSources] = useState<MapSourceDefinition[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([api.listImportSources(), api.listAutomationRuns()])
      .then(([nextSources, nextRuns]) => {
        if (!active) return;
        setSources(nextSources);
        setRuns(nextRuns);
        setSourceId((current) => current || nextSources[0]?.id || '');
      })
      .catch((cause) => active && setError((cause as Error).message || '无法读取任务'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [api]);

  async function start() {
    if (!sourceId) return;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.startSourceReadiness(sourceId);
      setRuns((current) => updateRun(current, result.run));
      setNotice(result.created ? '已生成新的静态检查任务。' : '输入没有变化，已返回原任务，未重复执行。');
    } catch (cause) {
      setError((cause as Error).message || '任务启动失败');
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="automation-shell">
      <header className="automation-hero">
        <div>
          <p className="eyebrow">OPENMAPBRIDGE · AUTOMATION LEDGER</p>
          <h1>图源任务驾驶舱</h1>
          <p>把“已导入但为何不能出图”拆成可复现的步骤、阻塞和下一动作。</p>
        </div>
        <div className="truth-strip">
          <span className="truth-chip">零外联静态检查</span>
          <span className="truth-chip">任务原子持久化</span>
          <span className="truth-chip warning">通过 ≠ 瓦片可用</span>
        </div>
      </header>

      <section className="automation-controls" aria-label="图源就绪检查">
        {loading ? <span>读取图源与任务…</span> : sources.length > 0 ? (
          <>
            <label>已保存图源
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
            </label>
            <button type="button" className="primary" disabled={starting || !sourceId} onClick={() => void start()}>
              {starting ? '检查中…' : '检查图源准备度'}
            </button>
          </>
        ) : (
          <div className="automation-empty">
            <strong>还没有已授权保存的图源</strong>
            <span>二维码解码成功或 .ovmap 解析成功都不等于已经保存。</span>
            {onOpenImport ? <button type="button" className="primary" onClick={onOpenImport}>去导入图源</button> : null}
          </div>
        )}
      </section>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {notice ? <div className="automation-notice" role="status">{notice}</div> : null}

      <section className="automation-runs" aria-label="任务记录">
        {runs.length === 0 && !loading ? <p className="empty-copy">尚无任务记录。先选择一个已保存图源执行静态检查。</p> : null}
        {runs.map((run) => (
          <article className="automation-run" key={run.id}>
            <header>
              <div><p className="eyebrow">{run.processId}</p><h2>{run.sourceName}</h2></div>
              <div className={`run-status ${run.status}`}><strong>{runStatus[run.status]}</strong><time>{new Date(run.createdAt).toLocaleString('zh-CN')}</time></div>
            </header>
            <div className="automation-steps">
              {run.steps.map((step, index) => (
                <div className={`automation-step ${step.status}`} key={step.kind}>
                  <span className="step-number">{index + 1}</span>
                  <div><strong>{stepName[step.kind]} · {stepStatus[step.status]}</strong><p>{step.message}</p></div>
                  <small>{step.externalRequest ? '发生上游请求' : '未发出上游请求'}</small>
                </div>
              ))}
            </div>
            <footer className="run-next"><strong>下一动作</strong><span>{run.nextAction || '无需人工动作'}</span></footer>
          </article>
        ))}
      </section>
    </main>
  );
}
