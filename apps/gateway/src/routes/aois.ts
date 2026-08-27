import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createConfirmedAoi, createNextAoiVersion } from '@omb/aois';
import type { TemporalStateRepository } from '../storage/temporal-state.js';

export function registerAoiRoutes(app: FastifyInstance, repository: TemporalStateRepository): void {
  app.get('/api/aois', async () => repository.listAoIs());

  app.post('/api/aois', async (request, reply) => {
    const body = request.body as { name?: unknown; geometry?: unknown } | null;
    if (typeof body?.name !== 'string' || body.name.trim().length === 0) {
      return reply.code(400).send({ error: 'name-required' });
    }
    if (!body.geometry) return reply.code(400).send({ error: 'geometry-required' });
    try {
      const created = createConfirmedAoi({
        id: `area-${randomUUID()}`,
        name: body.name.trim(),
        geometry: body.geometry as Parameters<typeof createConfirmedAoi>[0]['geometry'],
        provenance: 'user-drawn-web',
        confirmedAt: new Date().toISOString(),
      });
      await repository.appendAoi(created);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: 'invalid-area', message: (error as Error).message });
    }
  });

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
