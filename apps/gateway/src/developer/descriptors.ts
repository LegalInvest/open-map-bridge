import {
  parseDeveloperSourceDescriptor,
  type DeveloperSourceDescriptor,
} from '@omb/developer-sdk';
import type { MapSourceDefinition } from '@omb/source-schema';
import type { TemporalSourceRecord, TemporalSourceRegistry } from '../temporal/registry.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import type { GenericSourceTileService } from '../probe/generic-source-probe.js';

function links(id: string, ready: boolean, mapTiles = false) {
  const sourcePath = `/api/v1/developer/sources/${encodeURIComponent(id)}`;
  return {
    self: sourcePath,
    ...(ready
      ? {
          dates: `${sourcePath}/dates`,
          tileTemplate: `${sourcePath}/tiles/{dateId}/{z}/{x}/{y}`,
        }
      : {}),
    ...(mapTiles ? { mapTileTemplate: `${sourcePath}/map-tiles/{z}/{x}/{y}` } : {}),
  };
}

export function describeImportedSource(source: MapSourceDefinition, mapTiles = false): DeveloperSourceDescriptor {
  return parseDeveloperSourceDescriptor({
    apiVersion: 'v1',
    id: source.id,
    name: source.name,
    providerKind: 'imported',
    protocol: source.protocol,
    projection: source.projection,
    lifecycle: source.status,
    accessStatus: mapTiles ? 'ready' : 'metadata-only',
    capabilities: mapTiles ? ['metadata', 'map-tiles'] : ['metadata'],
    datePrecision: null,
    attribution: source.attribution,
    license: source.license,
    links: links(source.id, false, mapTiles),
  });
}

export function describeRuntimeSource(
  record: TemporalSourceRecord,
  imported: MapSourceDefinition | null = null,
): DeveloperSourceDescriptor {
  const ready = record.availability === 'ready';
  return parseDeveloperSourceDescriptor({
    apiVersion: 'v1',
    id: record.id,
    name: imported?.name ?? record.name,
    providerKind: record.kind,
    protocol: imported?.protocol ?? 'temporal-adapter',
    projection: imported?.projection ?? 'unknown',
    lifecycle: ready ? 'ready' : 'configured',
    accessStatus: ready ? 'ready' : 'metadata-only',
    capabilities: ready ? ['metadata', 'temporal-catalog', 'tiles'] : ['metadata'],
    datePrecision: ready ? record.datePrecision : null,
    attribution: imported?.attribution ?? null,
    license: imported?.license ?? null,
    links: links(record.id, ready),
  });
}

export function listDeveloperSources(
  registry: TemporalSourceRegistry,
  repository: TemporalStateRepository,
  genericTiles: GenericSourceTileService,
): DeveloperSourceDescriptor[] {
  const imported = new Map(repository.listImportSources().map((source) => [source.id, source]));
  const descriptors = registry.list().map((record) => {
    const source = imported.get(record.id) ?? null;
    imported.delete(record.id);
    return describeRuntimeSource(record, source);
  });
  descriptors.push(...[...imported.values()].map((source) => describeImportedSource(source, genericTiles.isReady(source.id))));
  return descriptors;
}
