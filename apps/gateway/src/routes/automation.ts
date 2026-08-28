import type { FastifyInstance } from 'fastify';
import type { SourceReadinessService } from '../automation/source-readiness.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';

const processDescriptor = {
  id: 'source-readiness',
  name: '图源就绪检查',
  version: 1,
  externalRequest: false,
  input: ['sourceId'],
  steps: ['source-confirmed', 'network-policy', 'credential-readiness', 'runtime-binding'],
  proves: '已保存图源的静态策略、凭证元数据和运行时绑定状态',
  doesNotProve: 'DNS、HTTP、瓦片内容、历史年份目录或渲染可用性',
} as const;

export function registerAutomationRoutes(
  app: FastifyInstance,
  service: SourceReadinessService,
  repository: TemporalStateRepository,
): void {
  app.get('/api/v1/processes', async () => [processDescriptor]);

  app.post('/api/v1/processes/source-readiness/execution', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (
      !body ||
      Object.keys(body).some((key) => key !== 'sourceId') ||
      typeof body.sourceId !== 'string' ||
      body.sourceId.length < 1 ||
      body.sourceId.length > 160
    ) {
      return reply.code(400).send({ error: 'source-id-required' });
    }
    try {
      const result = await service.start(body.sourceId);
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'source-not-found') {
        return reply.code(404).send({ error: 'source-not-found' });
      }
      throw cause;
    }
  });

  app.get('/api/v1/jobs', async () => repository.listAutomationRuns());

  app.get('/api/v1/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = repository.getAutomationRun(id);
    if (!run) return reply.code(404).send({ error: 'job-not-found' });
    return run;
  });
}
