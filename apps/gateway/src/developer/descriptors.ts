import {
  parseDeveloperSourceDescriptor,
  type DeveloperSourceDescriptor,
} from '@omb/developer-sdk';
import type { MapSourceDefinition } from '@omb/source-schema';
import type { TemporalSourceRecord, TemporalSourceRegistry } from '../temporal/registry.js';
import type { TemporalStateRepository } from '../storage/temporal-state.js';

function links(id: string, ready: boolean) {
  const sourcePath = `/api/v1/developer/sources/${encodeURIComponent(id)}`;
  return ready
    ? {
        self: sourcePath,
        dates: `${sourcePath}/dates`,
        tileTemplate: `${sourcePath}/tiles/{dateId}/{z}/{x}/{y}`,
      }
    : { self: sourcePath };
}

export function describeImportedSource(source: MapSourceDefinition): DeveloperSourceDescriptor {
  return parseDeveloperSourceDescriptor({
    apiVersion: 'v1',
    id: source.id,
    name: source.name,
    providerKind: 'imported',
    protocol: source.protocol,
    projection: source.projection,
    lifecycle: source.status,
    accessStatus: 'metadata-only',
    capabilities: ['metadata'],
    datePrecision: null,
    attribution: source.attribution,
    license: source.license,
    links: links(source.id, false),
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
): DeveloperSourceDescriptor[] {
  const imported = new Map(repository.listImportSources().map((source) => [source.id, source]));
  const descriptors = registry.list().map((record) => {
    const source = imported.get(record.id) ?? null;
    imported.delete(record.id);
    return describeRuntimeSource(record, source);
  });
  descriptors.push(...[...imported.values()].map(describeImportedSource));
  return descriptors;
}
