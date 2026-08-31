import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  IMPORT_PREVIEW_MAX_BYTES,
  OVMAP_BASE64_MAX_CHARS,
  OVMAP_FILE_MAX_BYTES,
  OVMAP_INSPECT_BODY_MAX_BYTES,
  appError,
  parseCredentialBundle,
  parseMapSourceDefinition,
  transitionSource,
  type ImportReceipt,
} from '@omb/source-schema';
import type { ImportInspector } from '../import/inspector.js';
import { ImportPreviewStore } from '../import/preview-store.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import type { CredentialVault } from '../security/credential-vault.js';

function fail(reply: FastifyReply, status: number, code: Parameters<typeof appError>[0], message: string) {
  return reply.status(status).send({ error: appError(code, message) });
}

function safeImportFailure(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : '';
  if (message === 'INPUT_OVMAP_REQUIRED') {
    return fail(reply, 400, 'INPUT_OVMAP_REQUIRED', '请选择非空的 .ovmap 文件');
  }
  if (message === 'INPUT_OVMAP_LIMIT') {
    return reply.status(413).send({
      error: appError('INPUT_OVMAP_LIMIT', '.ovmap 文件不能超过 1 MiB', {
        detail: { maxBytes: OVMAP_FILE_MAX_BYTES },
      }),
    });
  }
  if (message === 'INPUT_PREVIEW_TOO_LARGE') {
    return reply.status(413).send({
      error: appError('INPUT_PREVIEW_LIMIT', '导入预览超过安全内存上限', {
        detail: { maxBytes: IMPORT_PREVIEW_MAX_BYTES },
      }),
    });
  }
  const parseCode = /^[A-Z]+_[A-Z0-9_]+$/.test(message) ? message : 'FORMAT_UNKNOWN';
  return reply.status(400).send({
    error: appError('FORMAT_IMPORT', '无法识别该导入内容；文件可能损坏、版本不受支持或字段不完整', {
      detail: { parseCode },
    }),
  });
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) throw new Error('INPUT_OVMAP_REQUIRED');
  if (value.length > OVMAP_BASE64_MAX_CHARS) throw new Error('INPUT_OVMAP_LIMIT');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('FORMAT_BASE64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0) throw new Error('INPUT_OVMAP_REQUIRED');
  if (bytes.length > OVMAP_FILE_MAX_BYTES) throw new Error('INPUT_OVMAP_LIMIT');
  if (Buffer.from(bytes).toString('base64') !== value) throw new Error('FORMAT_BASE64');
  return bytes;
}

export function registerImportRoutes(
  app: FastifyInstance,
  inspector: ImportInspector,
  repository: TemporalStateRepository,
  previews = new ImportPreviewStore(),
  vault: CredentialVault | null = null,
): void {
  app.post('/api/import/inspect/qr', async (request, reply) => {
    try {
      const body = request.body as { payload?: unknown };
      if (typeof body?.payload !== 'string') return fail(reply, 400, 'INPUT_QR_REQUIRED', '请选择二维码图片或扫描二维码');
      const preview = await inspector.inspectQr(body.payload);
      previews.put(preview);
      return preview;
    } catch (cause) {
      return safeImportFailure(reply, cause);
    }
  });

  app.post(
    '/api/import/inspect/ovmap',
    {
      bodyLimit: OVMAP_INSPECT_BODY_MAX_BYTES,
      errorHandler(error, _request, reply) {
        if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
          return reply.status(413).send({
            error: appError('INPUT_BODY_LIMIT', '上传请求超过 .ovmap 检查接口允许的编码上限', {
              detail: { maxBytes: OVMAP_INSPECT_BODY_MAX_BYTES },
            }),
          });
        }
        throw error;
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as { bytesBase64?: unknown };
        const preview = await inspector.inspectOvmap(decodeBase64(body?.bytesBase64));
        previews.put(preview);
        return preview;
      } catch (cause) {
        return safeImportFailure(reply, cause);
      }
    },
  );

  app.post('/api/import/confirm', async (request, reply) => {
    try {
      const body = request.body as { previewId?: unknown; candidateIds?: unknown; authorized?: unknown };
      if (body.authorized !== true) return fail(reply, 400, 'POLICY_AUTHORIZATION_REQUIRED', '必须确认你有权使用所选图源');
      if (typeof body.previewId !== 'string' || !Array.isArray(body.candidateIds) || body.candidateIds.length === 0) {
        return fail(reply, 400, 'INPUT_SELECTION_REQUIRED', '请选择至少一个图层');
      }
      if (body.candidateIds.length > 1000 || body.candidateIds.some((id) => typeof id !== 'string')) {
        return fail(reply, 400, 'INPUT_SELECTION_INVALID', '图层选择无效');
      }
      const preview = previews.consume(body.previewId);
      const selectedIds = new Set(body.candidateIds as string[]);
      const selected = preview.layers.filter((layer) => selectedIds.has(layer.candidateId));
      if (selected.length !== selectedIds.size || selected.some((layer) => !layer.selectable)) {
        return fail(reply, 400, 'INPUT_SELECTION_INVALID', '图层选择无效或当前不可保存');
      }
      const confirmedAt = new Date().toISOString();
      const sources = selected.map((candidate) =>
        parseMapSourceDefinition({
          ...candidate.source,
          status: transitionSource(candidate.source.status, 'confirmed'),
          updatedAt: confirmedAt,
        }),
      );
      const receipt: ImportReceipt = {
        receiptId: randomUUID(),
        batchId: randomUUID(),
        inputSha256: preview.inputSha256,
        parser: preview.parser,
        confirmedAt,
        results: selected.map((candidate, index) => ({
          candidateId: candidate.candidateId,
          sourceId: sources[index]?.id ?? null,
          status: 'confirmed',
          errorCode: null,
        })),
        undoneAt: null,
      };
      await repository.appendConfirmedImport({ sources, receipt });
      return reply.status(201).send({ sources, receipt });
    } catch {
      return fail(reply, 400, 'INPUT_PREVIEW_INVALID', '预览已失效，请重新读取二维码或文件');
    }
  });

  app.get('/api/import/sources', async () => repository.listImportSources());
  app.get('/api/import/receipts', async () => repository.listImportReceipts());

  app.put('/api/import/sources/:sourceId/credential', async (request, reply) => {
    if (!vault) {
      return fail(reply, 503, 'CREDENTIAL_VAULT_UNAVAILABLE', '本地凭证保险库尚未由操作员启用');
    }
    const sourceId = (request.params as { sourceId?: unknown }).sourceId;
    if (typeof sourceId !== 'string' || !repository.listImportSources().some((source) => source.id === sourceId)) {
      return fail(reply, 404, 'INPUT_SOURCE_NOT_FOUND', '没有找到要配置凭证的图源');
    }
    let bundle;
    try {
      bundle = parseCredentialBundle(request.body);
    } catch {
      return fail(reply, 400, 'CREDENTIAL_INPUT_INVALID', '凭证字段、名称或大小不符合安全约束');
    }
    try {
      const credentialRef = await vault.put(sourceId, bundle);
      const source = await repository.setImportSourceCredentialRef(sourceId, credentialRef);
      return { source, credential: { configured: true, fieldCount: bundle.fields.length } };
    } catch {
      return fail(reply, 500, 'STORAGE_CREDENTIAL_WRITE', '本地凭证保险库写入失败');
    }
  });

  app.delete('/api/import/sources/:sourceId/credential', async (request, reply) => {
    if (!vault) {
      return fail(reply, 503, 'CREDENTIAL_VAULT_UNAVAILABLE', '本地凭证保险库尚未由操作员启用');
    }
    const sourceId = (request.params as { sourceId?: unknown }).sourceId;
    const source = typeof sourceId === 'string'
      ? repository.listImportSources().find((candidate) => candidate.id === sourceId)
      : undefined;
    if (!source) return fail(reply, 404, 'INPUT_SOURCE_NOT_FOUND', '没有找到要移除凭证的图源');
    if (source.credentialRef === null) return { source, credential: { configured: false, fieldCount: 0 } };
    try {
      const updated = await repository.setImportSourceCredentialRef(source.id, null);
      await vault.remove(source.credentialRef);
      return { source: updated, credential: { configured: false, fieldCount: 0 } };
    } catch {
      return fail(reply, 500, 'STORAGE_CREDENTIAL_DELETE', '本地凭证保险库删除失败；图源保持不可使用');
    }
  });
}
