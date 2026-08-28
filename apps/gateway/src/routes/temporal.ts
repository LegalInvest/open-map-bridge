import type { FastifyInstance } from 'fastify';
import { completeYearWindow } from '@omb/temporal-source';
import type { TemporalSourceRegistry } from '../temporal/registry.js';
import { parseDateWindowQuery, parseTilePath } from './temporal-input.js';

export function registerTemporalRoutes(app: FastifyInstance, registry: TemporalSourceRegistry): void {
  app.get('/api/temporal/sources', async () =>
    registry
      .list()
      .filter((record) => record.availability === 'ready')
      .map(({ adapter: _adapter, ...record }) => record),
  );

  app.get('/api/temporal/sources/:id/dates', async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = registry.get(id);
    if (!record) return reply.code(404).send({ error: 'source-not-found' });
    if (record.availability !== 'ready') return reply.code(409).send({ error: 'source-not-ready' });
    const defaultWindow = completeYearWindow(new Date().getUTCFullYear());
    const parsed = parseDateWindowQuery(request.query as Record<string, unknown>, defaultWindow);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    return record.adapter.listDates(parsed.value);
  });

  app.get('/api/temporal/tiles/:sourceId/:dateId/:z/:x/:y', async (request, reply) => {
    if (Object.keys(request.query as object).length > 0) return reply.code(400).send({ error: 'query-not-allowed' });
    const params = request.params as { sourceId: string; dateId: string; z: string; x: string; y: string };
    const record = registry.get(params.sourceId);
    if (!record) return reply.code(404).send({ error: 'source-not-found' });
    if (record.availability !== 'ready') return reply.code(409).send({ error: 'source-not-ready' });
    const parsed = parseTilePath(params);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const tile = await record.adapter.tile(parsed.value);
    return reply.code(tile.status).type(tile.contentType).send(Buffer.from(tile.body));
  });
}
