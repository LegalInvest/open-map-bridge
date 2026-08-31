// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { ImportPreview, MapSourceDefinition } from '@omb/source-schema';
import { ImportWorkspace } from './ImportWorkspace.js';
import type { ImportApi } from '../api/client.js';
import type { QrReader } from './qr-reader.js';

const source: MapSourceDefinition = {
  schemaVersion: 1,
  id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
  legacyId: 402,
  name: 'Fixture Map',
  sourceKind: 'qr',
  protocol: 'ovi-template',
  projection: 'unknown',
  minZoom: 0,
  maxZoom: 0,
  tileSize: 256,
  format: 'png',
  hosts: ['tiles.example.invalid'],
  pathTemplate: '/{$z}/{$x}/{$y}.png',
  queryParameters: {},
  credentialRef: null,
  attribution: null,
  license: null,
  sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'ovi-query-v1' },
  compatibilityExtension: {},
  status: 'parsed',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  lastVerifiedAt: null,
};

const preview: ImportPreview = {
  previewId: '018f4d39-32f1-7a31-9f60-81c6b453b887',
  inputType: 'qr',
  inputSha256: 'a'.repeat(64),
  parser: 'ovi-query-v1',
  layers: [{ candidateId: 'candidate-1', source, selectable: true, warnings: [], requiresCredential: false, requiresCompanionData: false }],
  warnings: [],
  expiresAt: '2099-01-01T00:00:00.000Z',
};

it('decodes a QR image, previews it, and gates confirmation on authorization', async () => {
  const user = userEvent.setup();
  const api: ImportApi = {
    inspectQr: vi.fn().mockResolvedValue(preview),
    inspectOvmap: vi.fn(),
    confirmImport: vi.fn().mockResolvedValue({ sources: [{ ...source, status: 'confirmed' }], receipt: {} as never }),
    listImportSources: vi.fn().mockResolvedValue([]),
    configureCredential: vi.fn(),
    removeCredential: vi.fn(),
  };
  const qrReader: QrReader = {
    decodeFile: vi.fn().mockResolvedValue('ovobj?fixture'),
    startCamera: vi.fn(),
  };
  render(<ImportWorkspace api={api} qrReader={qrReader} />);
  await user.upload(screen.getByLabelText('选择二维码图片'), new File(['qr'], 'source.png', { type: 'image/png' }));
  expect(await screen.findByText('Fixture Map')).toBeVisible();
  const confirm = screen.getByRole('button', { name: '确认并保存配置' });
  expect(confirm).toBeDisabled();
  await user.click(screen.getByLabelText('我确认有权使用所选图源'));
  expect(confirm).toBeEnabled();
  await user.click(confirm);
  expect(await screen.findByText('已保存配置（尚未探测）')).toBeVisible();
  expect(api.confirmImport).toHaveBeenCalledWith(preview.previewId, ['candidate-1'], true);
});

it('lets a saved source configure a secret without echoing it after vault storage', async () => {
  const user = userEvent.setup();
  const credentialSource: MapSourceDefinition = {
    ...source,
    status: 'confirmed',
    compatibilityExtension: { credentialRequired: true },
  };
  const api: ImportApi = {
    inspectQr: vi.fn(),
    inspectOvmap: vi.fn(),
    confirmImport: vi.fn(),
    listImportSources: vi.fn().mockResolvedValue([credentialSource]),
    configureCredential: vi.fn().mockResolvedValue({
      ...credentialSource,
      credentialRef: `vault://source/${credentialSource.id}`,
    }),
    removeCredential: vi.fn(),
  };
  render(<ImportWorkspace api={api} />);
  expect(await screen.findByText('配置本地凭证')).toBeVisible();
  await user.type(screen.getByLabelText('参数或请求头名称'), 'token');
  await user.type(screen.getByLabelText('凭证值'), 'fixture-value-never-rendered');
  await user.click(screen.getByRole('button', { name: '加密保存凭证' }));
  expect(api.configureCredential).toHaveBeenCalledWith(credentialSource.id, [
    { placement: 'query', name: 'token', value: 'fixture-value-never-rendered' },
  ]);
  expect(await screen.findByText('本地凭证：已配置（不回显）')).toBeVisible();
  expect(screen.queryByText('fixture-value-never-rendered')).not.toBeInTheDocument();
});
