import type { FastifyInstance } from 'fastify';
import { completeYearWindow } from '@omb/temporal-source';
import type { TemporalSourceRegistry } from '../temporal/registry.js';

export function registerTemporalRoutes(app: FastifyInstance, registry: TemporalSourceRegistry): void {
  app.get('/api/temporal/sources', async () =>
    registry.list().map(({ adapter: _adapter, ...record }) => record),
  );

  app.get('/api/temporal/sources/:id/dates', async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = registry.get(id);
    if (!record) return reply.code(404).send({ error: 'source-not-found' });
    const query = request.query as Record<string, string | undefined>;
    if (!query.aoiId) return reply.code(400).send({ error: 'aoi-id-required' });
    const defaultWindow = completeYearWindow(new Date().getUTCFullYear());
    return record.adapter.listDates({
      aoiId: query.aoiId,
      from: query.from ?? defaultWindow.from,
      to: query.to ?? defaultWindow.to,
    });
  });

  app.get('/api/temporal/tiles/:sourceId/:dateId/:z/:x/:y', async (request, reply) => {
    if (Object.keys(request.query as object).length > 0) return reply.code(400).send({ error: 'query-not-allowed' });
    const params = request.params as { sourceId: string; dateId: string; z: string; x: string; y: string };
    const record = registry.get(params.sourceId);
    if (!record) return reply.code(404).send({ error: 'source-not-found' });
    const coordinates = { z: Number(params.z), x: Number(params.x), y: Number(params.y) };
    if (Object.values(coordinates).some((value) => !Number.isInteger(value) || value < 0)) {
      return reply.code(400).send({ error: 'invalid-coordinate' });
    }
    const tile = await record.adapter.tile({ dateId: params.dateId, ...coordinates });
    return reply.code(tile.status).type(tile.contentType).send(Buffer.from(tile.body));
  });
}
