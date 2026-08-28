import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { appError, parseMapSourceDefinition, transitionSource, type ImportReceipt } from '@omb/source-schema';
import type { ImportInspector } from '../import/inspector.js';
import { ImportPreviewStore } from '../import/preview-store.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';

function fail(reply: FastifyReply, status: number, code: Parameters<typeof appError>[0], message: string) {
  return reply.status(status).send({ error: appError(code, message) });
}

function safeImportFailure(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : '';
  const parseCode = /^[A-Z]+_[A-Z0-9_]+$/.test(message) ? message : 'FORMAT_UNKNOWN';
  return reply.status(400).send({
    error: appError('FORMAT_IMPORT', '无法识别该导入内容；文件可能损坏、版本不受支持或字段不完整', {
      detail: { parseCode },
    }),
  });
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1_500_000) throw new Error('INPUT_OVMAP_LIMIT');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('FORMAT_BASE64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length === 0 || bytes.length > 1_048_576) throw new Error('INPUT_OVMAP_LIMIT');
  return bytes;
}

export function registerImportRoutes(
  app: FastifyInstance,
  inspector: ImportInspector,
  repository: TemporalStateRepository,
  previews = new ImportPreviewStore(),
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

  app.post('/api/import/inspect/ovmap', async (request, reply) => {
    try {
      const body = request.body as { bytesBase64?: unknown };
      const preview = await inspector.inspectOvmap(decodeBase64(body?.bytesBase64));
      previews.put(preview);
      return preview;
    } catch (cause) {
      return safeImportFailure(reply, cause);
    }
  });

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
}
