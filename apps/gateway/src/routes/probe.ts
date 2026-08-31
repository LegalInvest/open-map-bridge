import type { FastifyInstance } from 'fastify';
import { GenericProbePreconditionError, type GenericSourceProbeService } from '../probe/generic-source-probe.js';

const notFoundCodes = new Set(['PROBE_SOURCE_NOT_FOUND']);
const invalidInputCodes = new Set(['PROBE_COORDINATE_INVALID']);

export function registerProbeRoutes(app: FastifyInstance, service: GenericSourceProbeService): void {
  app.post('/api/import/sources/:sourceId/probe', async (request, reply) => {
    const sourceId = (request.params as { sourceId?: unknown }).sourceId;
    const body = request.body as Record<string, unknown> | null;
    if (
      typeof sourceId !== 'string' ||
      !body ||
      Object.keys(body).some((key) => !['authorized', 'z', 'x', 'y'].includes(key)) ||
      body.authorized !== true
    ) {
      return reply.code(400).send({ error: 'probe-authorization-required' });
    }
    try {
      const result = await service.probe(sourceId, {
        z: body.z as number,
        x: body.x as number,
        y: body.y as number,
      });
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (cause) {
      if (!(cause instanceof GenericProbePreconditionError)) throw cause;
      const status = notFoundCodes.has(cause.code) ? 404 : invalidInputCodes.has(cause.code) ? 400 : 409;
      return reply.code(status).send({ error: cause.code });
    }
  });
}
