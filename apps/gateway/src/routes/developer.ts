import type { FastifyInstance } from 'fastify';
import { completeYearWindow } from '@omb/temporal-source';
import type { TemporalSourceRegistry } from '../temporal/registry.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import { listDeveloperSources } from '../developer/descriptors.js';
import { parseDateWindowQuery, parseTilePath } from './temporal-input.js';

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
    const defaultWindow = completeYearWindow(new Date().getUTCFullYear());
    const parsed = parseDateWindowQuery(request.query as Record<string, unknown>, defaultWindow);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const record = registry.get(id);
    if (!record) return reply.code(409).send({ error: 'capability-not-available', capability: 'temporal-catalog' });
    return record.adapter.listDates(parsed.value);
  });

  app.get('/api/v1/developer/sources/:id/tiles/:dateId/:z/:x/:y', async (request, reply) => {
    if (Object.keys(request.query as object).length > 0) return reply.code(400).send({ error: 'query-not-allowed' });
    const params = request.params as { id: string; dateId: string; z: string; x: string; y: string };
    const source = descriptors().find((entry) => entry.id === params.id);
    if (!source) return reply.code(404).send({ error: 'source-not-found' });
    if (!source.capabilities.includes('tiles')) {
      return reply.code(409).send({ error: 'capability-not-available', capability: 'tiles' });
    }
    const parsed = parseTilePath(params);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const record = registry.get(params.id);
    if (!record) return reply.code(409).send({ error: 'capability-not-available', capability: 'tiles' });
    const tile = await record.adapter.tile(parsed.value);
    return reply.code(tile.status).type(tile.contentType).send(Buffer.from(tile.body));
  });
}
