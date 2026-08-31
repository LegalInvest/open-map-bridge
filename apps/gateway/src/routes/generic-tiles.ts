import type { FastifyInstance } from 'fastify';
import {
  GenericTileRuntimeError,
  type GenericSourceTileService,
} from '../probe/generic-source-probe.js';

function parseCoordinate(params: { z: string; x: string; y: string }): { z: number; x: number; y: number } | null {
  const values = [params.z, params.x, params.y];
  if (values.some((value) => !/^(0|[1-9]\d*)$/.test(value))) return null;
  const [z, x, y] = values.map(Number) as [number, number, number];
  if (!Number.isSafeInteger(z) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (z > 30 || x >= 2 ** z || y >= 2 ** z) return null;
  return { z, x, y };
}

export function registerGenericTileRoutes(app: FastifyInstance, service: GenericSourceTileService): void {
  const serve = async (
    request: { params: unknown; query: unknown },
    reply: { code(status: number): typeof reply; type(contentType: string): typeof reply; send(body: unknown): unknown },
  ) => {
    if (Object.keys(request.query as object).length > 0) {
      return reply.code(400).send({ error: 'query-not-allowed' });
    }
    const params = request.params as { sourceId?: unknown; z?: unknown; x?: unknown; y?: unknown };
    if (
      typeof params.sourceId !== 'string' ||
      typeof params.z !== 'string' ||
      typeof params.x !== 'string' ||
      typeof params.y !== 'string'
    ) {
      return reply.code(400).send({ error: 'invalid-coordinate' });
    }
    const coordinate = parseCoordinate({ z: params.z, x: params.x, y: params.y });
    if (!coordinate) return reply.code(400).send({ error: 'invalid-coordinate' });
    try {
      const tile = await service.tile(params.sourceId, coordinate);
      return reply.code(200).type(tile.contentType).send(Buffer.from(tile.body));
    } catch (error) {
      if (!(error instanceof GenericTileRuntimeError)) throw error;
      return reply.code(error.statusCode).send({ error: error.code });
    }
  };

  app.get('/api/tiles/:sourceId/:z/:x/:y', serve);
  app.get('/api/v1/developer/sources/:sourceId/map-tiles/:z/:x/:y', serve);
}
