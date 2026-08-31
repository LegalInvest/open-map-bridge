import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  completeYearWindow,
  createComparisonReceiptSchema,
  parseComparisonReceipt,
} from '@omb/temporal-source';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import type { TemporalSourceRegistry } from '../temporal/registry.js';

export function registerComparisonRoutes(
  app: FastifyInstance,
  repository: TemporalStateRepository,
  registry: TemporalSourceRegistry,
): void {
  app.get('/api/comparisons', async () => repository.listComparisons());

  app.post('/api/comparisons', async (request, reply) => {
    const parsed = createComparisonReceiptSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid-comparison' });

    const input = parsed.data;
    const source = registry.get(input.sourceId);
    if (!source) return reply.code(404).send({ error: 'source-not-found' });
    if (source.availability !== 'ready') return reply.code(409).send({ error: 'source-not-ready' });

    const aoi = repository
      .listAoIs()
      .find((entry) => entry.id === input.aoiId && entry.version === input.aoiVersion);
    if (!aoi) return reply.code(404).send({ error: 'aoi-version-not-found' });
    if (aoi.status !== 'confirmed') return reply.code(409).send({ error: 'aoi-not-confirmed' });

    const yearWindow = completeYearWindow(new Date().getUTCFullYear());
    const catalog = await source.adapter.listDates({ aoiId: aoi.id, from: yearWindow.from, to: yearWindow.to });
    const dates = new Map(catalog.map((entry) => [entry.id, entry]));
    for (const frame of input.frames) {
      const date = dates.get(frame.dateId);
      if (!date) return reply.code(409).send({ error: 'comparison-date-not-in-catalog' });
      if (date.availability === 'failed') return reply.code(409).send({ error: 'comparison-date-not-requestable' });
      if ((date.availability === 'missing') !== (frame.status === 'missing')) {
        return reply.code(409).send({ error: 'comparison-frame-availability-mismatch' });
      }
    }

    const receipt = parseComparisonReceipt({
      ...input,
      id: `comparison-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    });
    await repository.appendComparison(receipt);
    return reply.code(201).send(receipt);
  });
}
