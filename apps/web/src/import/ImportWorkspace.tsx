import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { ImportPreview, MapSourceDefinition } from '@omb/source-schema';
import type { ImportApi } from '../api/client.js';
import { browserQrReader, type QrReader } from './qr-reader.js';

interface ImportWorkspaceProps {
  api: ImportApi;
  qrReader?: QrReader;
}

type ImportState = 'input' | 'inspecting' | 'preview' | 'confirming' | 'result' | 'error';
type InputTab = 'qr-image' | 'camera' | 'ovmap';

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function ImportWorkspace({ api, qrReader = browserQrReader }: ImportWorkspaceProps) {
  const [state, setState] = useState<ImportState>('input');
  const [tab, setTab] = useState<InputTab>('qr-image');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [authorized, setAuthorized] = useState(false);
  const [savedSources, setSavedSources] = useState<MapSourceDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraSession = useRef<{ stop(): void } | null>(null);

  useEffect(() => {
    let active = true;
    void api.listImportSources().then((sources) => active && setSavedSources(sources)).catch(() => undefined);
    return () => {
      active = false;
      cameraSession.current?.stop();
    };
  }, [api]);

  function acceptPreview(next: ImportPreview) {
    setPreview(next);
    setSelected(new Set(next.layers.filter((layer) => layer.selectable).map((layer) => layer.candidateId)));
    setAuthorized(false);
    setState('preview');
  }

  function fail(cause: unknown) {
    setError((cause as Error).message || '导入失败');
    setState('error');
  }

  async function inspectQrPayload(payload: string) {
    setState('inspecting');
    setError(null);
    try {
      acceptPreview(await api.inspectQr(payload));
    } catch (cause) {
      fail(cause);
    }
  }

  async function inspectQrFile(file: File) {
    setState('inspecting');
    setError(null);
    try {
      await inspectQrPayload(await qrReader.decodeFile(file));
    } catch (cause) {
      fail(cause);
    }
  }

  async function inspectOvmap(file: File) {
    setState('inspecting');
    setError(null);
    try {
      acceptPreview(await api.inspectOvmap(file));
    } catch (cause) {
      fail(cause);
    }
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setError(null);
    try {
      cameraSession.current?.stop();
      cameraSession.current = await qrReader.startCamera(videoRef.current, (payload) => {
        setCameraActive(false);
        void inspectQrPayload(payload);
      });
      setCameraActive(true);
    } catch (cause) {
      setCameraActive(false);
      setError(`无法使用摄像头：${(cause as Error).message || '请改用二维码图片'}`);
    }
  }

  function stopCamera() {
    cameraSession.current?.stop();
    cameraSession.current = null;
    setCameraActive(false);
  }

  async function confirm() {
    if (!preview) return;
    setState('confirming');
    try {
      const result = await api.confirmImport(preview.previewId, [...selected], authorized);
      setSavedSources((current) => [...current, ...result.sources]);
      setState('result');
    } catch (cause) {
      fail(cause);
    }
  }

  function reset() {
    stopCamera();
    setPreview(null);
    setSelected(new Set());
    setAuthorized(false);
    setError(null);
    setState('input');
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void inspectOvmap(file);
  }

  return (
    <main className="import-shell">
      <header className="import-hero">
        <div>
          <p className="eyebrow">OPENMAPBRIDGE · SOURCE INTAKE</p>
          <h1>导入奥维兼容图源</h1>
          <p>二维码图片 / 摄像头 / .ovmap → 本地解析 → 脱敏预览 → 授权保存</p>
        </div>
        <div className="truth-strip">
          <span className="truth-chip">检查阶段：零上游请求</span>
          <span className="truth-chip warning">保存 ≠ 已出图</span>
        </div>
      </header>

      <div className="import-layout">
        <section className="import-card" aria-label="图源导入">
          {(state === 'input' || state === 'error') && (
            <>
              <div className="import-tabs" role="tablist" aria-label="导入方式">
                <button type="button" className={tab === 'qr-image' ? 'active' : ''} onClick={() => { stopCamera(); setTab('qr-image'); }}>二维码图片</button>
                <button type="button" className={tab === 'camera' ? 'active' : ''} onClick={() => setTab('camera')}>摄像头扫一扫</button>
                <button type="button" className={tab === 'ovmap' ? 'active' : ''} onClick={() => { stopCamera(); setTab('ovmap'); }}>.ovmap 文件</button>
              </div>
              {error ? <div className="error-banner" role="alert">{error}</div> : null}
              {tab === 'qr-image' ? (
                <label className="drop-zone">
                  <strong>选择二维码截图或照片</strong>
                  <span>图像只在浏览器本地送入 ZXing 解码；原图不上传到网关。</span>
                  <input
                    aria-label="选择二维码图片"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectQrFile(file); }}
                  />
                </label>
              ) : null}
              {tab === 'camera' ? (
                <div className="camera-panel">
                  <video ref={videoRef} muted playsInline aria-label="二维码摄像头预览" />
                  <div className="camera-actions">
                    <button type="button" className="primary" onClick={() => void startCamera()} disabled={cameraActive}>开始扫一扫</button>
                    <button type="button" onClick={stopCamera} disabled={!cameraActive}>取消扫描</button>
                  </div>
                  <p>无摄像头或未授权时，可随时切回“二维码图片”。</p>
                </div>
              ) : null}
              {tab === 'ovmap' ? (
                <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                  <strong>拖入或选择 .ovmap 文件</strong>
                  <span>上限 1 MiB；先做魔数、长度、解压比和记录边界检查。</span>
                  <label className="file-button">
                    选择 .ovmap 文件
                    <input
                      aria-label="选择 .ovmap 文件"
                      type="file"
                      accept=".ovmap,application/octet-stream"
                      onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectOvmap(file); }}
                    />
                  </label>
                </div>
              ) : null}
            </>
          )}

          {state === 'inspecting' ? <div className="import-progress"><strong>正在本地检查…</strong><span>此阶段不访问二维码或文件中的服务器。</span></div> : null}

          {(state === 'preview' || state === 'confirming') && preview ? (
            <div className="preview-step">
              <div className="preview-heading">
                <div><p className="eyebrow">安全预览</p><h2>发现 {preview.layers.length} 个图层</h2></div>
                <div className="preview-meta"><span>解析器 {preview.parser}</span><span>输入 {shortHash(preview.inputSha256)}</span></div>
              </div>
              <div className="layer-preview-list">
                {preview.layers.map((layer) => (
                  <label className="layer-preview" key={layer.candidateId}>
                    <input
                      type="checkbox"
                      checked={selected.has(layer.candidateId)}
                      disabled={!layer.selectable || state === 'confirming'}
                      onChange={(event) => setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(layer.candidateId); else next.delete(layer.candidateId);
                        return next;
                      })}
                    />
                    <div>
                      <strong>{layer.source.name}</strong>
                      <span>{layer.source.hosts[0]} · {layer.source.protocol} · {layer.source.format} · 投影 {layer.source.projection}</span>
                      <small>legacy ID {layer.source.legacyId ?? '无'} · 级别 {layer.source.minZoom}–{layer.source.maxZoom}</small>
                      {layer.warnings.map((warning) => <em key={warning.code}>{warning.message}；{warning.nextAction}</em>)}
                    </div>
                  </label>
                ))}
              </div>
              <label className="authorization-check">
                <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
                我确认有权使用所选图源
              </label>
              <div className="preview-actions">
                <button type="button" onClick={reset} disabled={state === 'confirming'}>重新选择</button>
                <button type="button" className="primary" onClick={() => void confirm()} disabled={!authorized || selected.size === 0 || state === 'confirming'}>
                  {state === 'confirming' ? '正在保存…' : '确认并保存配置'}
                </button>
              </div>
            </div>
          ) : null}

          {state === 'result' ? (
            <div className="result-step">
              <span className="result-mark">✓</span>
              <h2>已保存配置（尚未探测）</h2>
              <p>配置与脱敏回执已写入本地；投影、凭证、服务器可用性和真实瓦片仍需分别验证。</p>
              <button type="button" className="primary" onClick={reset}>继续导入</button>
            </div>
          ) : null}
        </section>

        <aside className="source-registry">
          <div><p className="eyebrow">LOCAL REGISTRY</p><h2>已保存图源</h2></div>
          {savedSources.length === 0 ? <p className="empty-copy">还没有保存配置。二维码解码成功或文件解析成功都不会自动加入这里。</p> : null}
          {savedSources.map((source) => (
            <article key={source.id}>
              <div><strong>{source.name}</strong><span className="source-status">{source.status}</span></div>
              <p>{source.hosts[0]} · {source.sourceKind} · {source.projection}</p>
              <small>{source.sourceProvenance.adapter} · {shortHash(source.sourceProvenance.inputSha256)}</small>
            </article>
          ))}
        </aside>
      </div>
    </main>
  );
}
