// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { AutomationRun, MapSourceDefinition } from '@omb/source-schema';
import type { AutomationApi, ImportApi } from '../api/client.js';
import { AutomationWorkspace } from './AutomationWorkspace.js';

const source: MapSourceDefinition = {
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  legacyId: 402,
  name: '历史影像图源',
  sourceKind: 'qr',
  protocol: 'ovi-template',
  projection: 'unknown',
  minZoom: 0,
  maxZoom: 18,
  tileSize: 256,
  format: 'png',
  hosts: ['tiles.example.invalid'],
  pathTemplate: '/{$z}/{$x}/{$y}.png',
  queryParameters: {},
  credentialRef: null,
  attribution: null,
  license: null,
  sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'fixture' },
  compatibilityExtension: { credentialRequired: false },
  status: 'confirmed',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  lastVerifiedAt: null,
};

const run: AutomationRun = {
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b889',
  processId: 'source-readiness',
  inputFingerprint: 'b'.repeat(64),
  sourceId: source.id,
  sourceName: source.name,
  status: 'blocked',
  currentStep: 'runtime-binding',
  nextAction: '实现并绑定安全瓦片适配器',
  intervention: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  steps: [
    { kind: 'source-confirmed', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: '已确认', nextAction: '' },
    { kind: 'network-policy', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: '静态策略通过', nextAction: '' },
    { kind: 'credential-readiness', status: 'succeeded', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: null, message: '无需固定凭证', nextAction: '' },
    { kind: 'runtime-binding', status: 'blocked', attempt: 1, startedAt: '2026-08-28T00:00:00.000Z', endedAt: '2026-08-28T00:00:00.000Z', externalRequest: false, errorCode: 'RUNTIME_NOT_BOUND', message: '没有绑定适配器', nextAction: '实现并绑定安全瓦片适配器' },
  ],
};

it('starts a readiness job and presents its truthful blocker and dedupe result', async () => {
  const user = userEvent.setup();
  const api: AutomationApi & Pick<ImportApi, 'listImportSources'> = {
    listImportSources: vi.fn().mockResolvedValue([source]),
    listAutomationRuns: vi.fn().mockResolvedValue([]),
    startSourceReadiness: vi.fn().mockResolvedValue({ run, created: false }),
  };
  render(<AutomationWorkspace api={api} />);
  await user.click(await screen.findByRole('button', { name: '检查图源准备度' }));
  expect(await screen.findByText('输入没有变化，已返回原任务，未重复执行。')).toBeVisible();
  expect(screen.getByText('运行时绑定 · 阻塞')).toBeVisible();
  expect(screen.getByText('实现并绑定安全瓦片适配器')).toBeVisible();
  expect(screen.getAllByText('未发出上游请求')).toHaveLength(4);
  expect(api.startSourceReadiness).toHaveBeenCalledWith(source.id);
});

it('routes an empty registry back to source import', async () => {
  const user = userEvent.setup();
  const openImport = vi.fn();
  const api: AutomationApi & Pick<ImportApi, 'listImportSources'> = {
    listImportSources: vi.fn().mockResolvedValue([]),
    listAutomationRuns: vi.fn().mockResolvedValue([]),
    startSourceReadiness: vi.fn(),
  };
  render(<AutomationWorkspace api={api} onOpenImport={openImport} />);
  await user.click(await screen.findByRole('button', { name: '去导入图源' }));
  expect(openImport).toHaveBeenCalledOnce();
});
