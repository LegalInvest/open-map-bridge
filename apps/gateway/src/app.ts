import Fastify, { type FastifyInstance } from 'fastify';
import { lakeAoiPresets } from '@omb/aois';
import { registerTemporalRoutes } from './routes/temporal.js';
import { registerAoiRoutes } from './routes/aois.js';
import { TemporalStateRepository } from './storage/temporal-state.js';
import { TemporalSourceRegistry } from './temporal/registry.js';
import { SyntheticTemporalAdapter } from './temporal/synthetic-adapter.js';
import { OviBridgeAdapter } from './temporal/ovi-bridge.js';
import { createImportInspector } from './import/inspector.js';
import { registerImportRoutes } from './routes/import.js';

interface BuildAppOptions {
  dataPath: string | null;
  ovi?: { baseUrl: string; mapType: number };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const repository = await TemporalStateRepository.open(options.dataPath, lakeAoiPresets);
  const registry = new TemporalSourceRegistry();
  registry.register({
    id: 'synthetic-lakes',
    name: '合成时序验收源',
    kind: 'synthetic',
    datePrecision: 'capture-date',
    adapter: new SyntheticTemporalAdapter({ missingYears: [2012] }),
  });
  if (options.ovi) {
    registry.register({
      id: 'ovi-history-200',
      name: '本机授权历史影像',
      kind: 'ovi-bridge',
      datePrecision: 'request-date-only',
      adapter: new OviBridgeAdapter(options.ovi),
    });
  }

  app.get('/api/health', async () => ({ ok: true, persistence: options.dataPath === null ? 'memory' : 'atomic-json' }));
  app.get('/api/comparisons', async () => repository.listComparisons());
  registerAoiRoutes(app, repository);
  registerTemporalRoutes(app, registry);
  registerImportRoutes(app, createImportInspector(), repository);
  return app;
}
