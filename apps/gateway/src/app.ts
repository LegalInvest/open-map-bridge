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
import { registerDeveloperRoutes } from './routes/developer.js';
import { SourceReadinessService } from './automation/source-readiness.js';
import { registerAutomationRoutes } from './routes/automation.js';
import type { MapSourceDefinition } from '@omb/source-schema';
import {
  registerGatewayAccessControl,
  type GatewayAccessConfig,
} from './security/gateway-access.js';

export interface BuildAppOptions {
  dataPath: string | null;
  ovi?: { baseUrl: string; mapType: number; sourceId: string };
  access: GatewayAccessConfig | null;
}

function bindImportedOviSource(
  registry: TemporalSourceRegistry,
  source: MapSourceDefinition,
  ovi: NonNullable<BuildAppOptions['ovi']>,
): void {
  if (source.id !== ovi.sourceId) throw new Error('configured Ovi source ID does not match the imported source');
  if (source.compatibilityExtension.needsOviBridge !== true) {
    throw new Error('configured Ovi source does not require the local bridge');
  }
  if (source.legacyId !== ovi.mapType) throw new Error('configured Ovi map type does not match the imported source');
  if (registry.get(source.id)) throw new Error(`duplicate temporal source ${source.id}`);
  registry.register({
    id: source.id,
    name: source.name,
    kind: 'ovi-bridge',
    legacyMapType: ovi.mapType,
    availability: 'configured',
    datePrecision: 'request-date-only',
    adapter: new OviBridgeAdapter(ovi),
  });
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const repository = await TemporalStateRepository.open(options.dataPath, lakeAoiPresets);
  const registry = new TemporalSourceRegistry();
  registry.register({
    id: 'synthetic-lakes',
    name: '合成时序验收源',
    kind: 'synthetic',
    availability: 'ready',
    datePrecision: 'capture-date',
    adapter: new SyntheticTemporalAdapter({ missingYears: [2012] }),
  });
  if (options.ovi) {
    const ovi = options.ovi;
    const source = repository.listImportSources().find((candidate) => candidate.id === ovi.sourceId);
    if (!source) throw new Error('configured Ovi source ID was not found in persisted imports');
    bindImportedOviSource(registry, source, ovi);
  }

  const app = Fastify({ logger: false });
  if (options.access) registerGatewayAccessControl(app, options.access);
  app.get('/api/health', async () => ({ ok: true, persistence: options.dataPath === null ? 'memory' : 'atomic-json' }));
  app.get('/api/comparisons', async () => repository.listComparisons());
  registerAoiRoutes(app, repository);
  registerTemporalRoutes(app, registry);
  registerImportRoutes(app, createImportInspector(), repository);
  registerDeveloperRoutes(app, registry, repository);
  registerAutomationRoutes(app, new SourceReadinessService(repository, registry), repository);
  return app;
}
