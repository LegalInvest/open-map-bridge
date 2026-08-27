import type { FastifyInstance } from 'fastify';
import { createNextAoiVersion } from '@omb/aois';
import type { TemporalStateRepository } from '../storage/temporal-state.js';

export function registerAoiRoutes(app: FastifyInstance, repository: TemporalStateRepository): void {
  app.get('/api/aois', async () => repository.listAoIs());

  app.put('/api/aois/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { geometry?: unknown };
    const current = repository
      .listAoIs()
      .filter((aoi) => aoi.id === id)
      .sort((left, right) => right.version - left.version)[0];
    if (!current) return reply.code(404).send({ error: 'aoi-not-found' });
    if (!body?.geometry) return reply.code(400).send({ error: 'geometry-required' });
    try {
      const next = createNextAoiVersion(current, body.geometry as typeof current.geometry, new Date().toISOString());
      await repository.appendAoi(next);
      return next;
    } catch (error) {
      return reply.code(400).send({ error: 'invalid-geometry', message: (error as Error).message });
    }
  });
}
