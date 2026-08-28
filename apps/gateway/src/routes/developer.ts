import type { FastifyInstance } from 'fastify';
import { completeYearWindow } from '@omb/temporal-source';
import type { TemporalSourceRegistry } from '../temporal/registry.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import { listDeveloperSources } from '../developer/descriptors.js';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function registerDeveloperRoutes(
  app: FastifyInstance,
  registry: TemporalSourceRegistry,
  repository: TemporalStateRepository,
): void {
  const descriptors = () => listDeveloperSources(registry, repository);

  app.get('/api/v1/developer/sources', async () => descriptors());

  app.get('/api/v1/developer/sources/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = descriptors().find((entry) => entry.id === id);
    if (!source) return reply.code(404).send({ error: 'source-not-found' });
    return source;
  });

  app.get('/api/v1/developer/sources/:id/dates', async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = descriptors().find((entry) => entry.id === id);
    if (!source) return reply.code(404).send({ error: 'source-not-found' });
    if (!source.capabilities.includes('temporal-catalog')) {
      return reply.code(409).send({ error: 'capability-not-available', capability: 'temporal-catalog' });
    }
    const query = request.query as Record<string, string | undefined>;
    if (Object.keys(query).some((key) => !['aoiId', 'from', 'to'].includes(key))) {
      return reply.code(400).send({ error: 'query-not-allowed' });
    }
    if (!query.aoiId || query.aoiId.length > 160) return reply.code(400).send({ error: 'aoi-id-required' });
    const defaultWindow = completeYearWindow(new Date().getUTCFullYear());
    const from = query.from ?? defaultWindow.from;
    const to = query.to ?? defaultWindow.to;
    if (!isoDate.test(from) || !isoDate.test(to) || from > to) {
      return reply.code(400).send({ error: 'invalid-date-window' });
    }
    const record = registry.get(id);
    if (!record) return reply.code(409).send({ error: 'capability-not-available', capability: 'temporal-catalog' });
    return record.adapter.listDates({ aoiId: query.aoiId, from, to });
  });

  app.get('/api/v1/developer/sources/:id/tiles/:dateId/:z/:x/:y', async (request, reply) => {
    if (Object.keys(request.query as object).length > 0) return reply.code(400).send({ error: 'query-not-allowed' });
    const params = request.params as { id: string; dateId: string; z: string; x: string; y: string };
    const source = descriptors().find((entry) => entry.id === params.id);
    if (!source) return reply.code(404).send({ error: 'source-not-found' });
    if (!source.capabilities.includes('tiles')) {
      return reply.code(409).send({ error: 'capability-not-available', capability: 'tiles' });
    }
    const coordinates = { z: Number(params.z), x: Number(params.x), y: Number(params.y) };
    if (
      Object.values(coordinates).some((value) => !Number.isSafeInteger(value) || value < 0) ||
      coordinates.z > 30 ||
      coordinates.x >= 2 ** coordinates.z ||
      coordinates.y >= 2 ** coordinates.z
    ) {
      return reply.code(400).send({ error: 'invalid-coordinate' });
    }
    const record = registry.get(params.id);
    if (!record) return reply.code(409).send({ error: 'capability-not-available', capability: 'tiles' });
    const tile = await record.adapter.tile({ dateId: params.dateId, ...coordinates });
    return reply.code(tile.status).type(tile.contentType).send(Buffer.from(tile.body));
  });
}
