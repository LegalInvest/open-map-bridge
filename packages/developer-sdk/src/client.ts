import { z } from 'zod';
import { parseTemporalDateEntry, type TemporalDateEntry } from '@omb/temporal-source';
import {
  developerSourceDescriptorSchema,
  parseDeveloperAppManifest,
  permissionForCapability,
  type DeveloperAppManifest,
  type DeveloperCapability,
  type DeveloperSourceDescriptor,
} from './schema.js';

export class DeveloperSdkError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message = code, status: number | null = null) {
    super(message);
    this.name = 'DeveloperSdkError';
    this.code = code;
    this.status = status;
  }
}

interface OpenMapBridgeClientOptions {
  baseUrl?: string;
  manifest: DeveloperAppManifest;
  fetcher?: typeof fetch;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.replace(/\/$/, '');
  if (trimmed === '') return '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DeveloperSdkError('invalid-base-url');
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (!loopback || !['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new DeveloperSdkError('non-loopback-base-url');
  }
  return trimmed;
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DeveloperSdkError('invalid-date');
}

function assertCoordinate(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new DeveloperSdkError('invalid-coordinate');
}

function assertTileCoordinate(z: number, x: number, y: number): void {
  assertCoordinate(z);
  assertCoordinate(x);
  assertCoordinate(y);
  if (z > 30 || x >= 2 ** z || y >= 2 ** z) throw new DeveloperSdkError('invalid-coordinate');
}

export function assertSourceCapability(
  source: DeveloperSourceDescriptor,
  capability: DeveloperCapability,
): void {
  if (!source.capabilities.includes(capability)) {
    throw new DeveloperSdkError('capability-not-available', `capability-not-available: ${capability}`);
  }
}

export class OpenMapBridgeClient {
  private readonly baseUrl: string;
  private readonly manifest: DeveloperAppManifest;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenMapBridgeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? '');
    this.manifest = parseDeveloperAppManifest(options.manifest);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async listSources(): Promise<DeveloperSourceDescriptor[]> {
    this.assertPermission('metadata');
    const raw = await this.readJson('/api/v1/developer/sources');
    return z.array(developerSourceDescriptorSchema).parse(raw);
  }

  async getSource(sourceId: string): Promise<DeveloperSourceDescriptor> {
    this.assertPermission('metadata');
    const raw = await this.readJson(`/api/v1/developer/sources/${encodeURIComponent(sourceId)}`);
    return developerSourceDescriptorSchema.parse(raw);
  }

  async listDates(
    source: DeveloperSourceDescriptor,
    input: { aoiId: string; from: string; to: string },
  ): Promise<TemporalDateEntry[]> {
    this.assertPermission('temporal-catalog');
    assertSourceCapability(source, 'temporal-catalog');
    if (!input.aoiId || input.aoiId.length > 160) throw new DeveloperSdkError('invalid-aoi-id');
    assertDate(input.from);
    assertDate(input.to);
    if (input.from > input.to) throw new DeveloperSdkError('invalid-date-window');
    const query = new URLSearchParams({ aoiId: input.aoiId, from: input.from, to: input.to });
    const raw = await this.readJson(`${source.links.dates}?${query.toString()}`);
    return z.array(z.unknown()).parse(raw).map(parseTemporalDateEntry);
  }

  tileUrl(
    source: DeveloperSourceDescriptor,
    input: { dateId: string; z: number; x: number; y: number },
  ): string {
    this.assertPermission('tiles');
    assertSourceCapability(source, 'tiles');
    if (!input.dateId || input.dateId.length > 160) throw new DeveloperSdkError('invalid-date-id');
    assertTileCoordinate(input.z, input.x, input.y);
    const template = source.links.tileTemplate;
    if (!template) throw new DeveloperSdkError('capability-not-available');
    const path = template
      .replace('{dateId}', encodeURIComponent(input.dateId))
      .replace('{z}', String(input.z))
      .replace('{x}', String(input.x))
      .replace('{y}', String(input.y));
    return `${this.baseUrl}${path}`;
  }

  private assertPermission(capability: DeveloperCapability): void {
    const permission = permissionForCapability(capability);
    if (!this.manifest.permissions.includes(permission)) {
      throw new DeveloperSdkError('permission-not-granted', `permission-not-granted: ${permission}`);
    }
  }

  private async readJson(path: string): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { headers: { accept: 'application/json' } });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new DeveloperSdkError('invalid-json-response', 'invalid-json-response', response.status);
    }
    if (!response.ok) {
      const code =
        typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
          ? ((body as { error: string }).error)
          : 'gateway-error';
      throw new DeveloperSdkError(code, code, response.status);
    }
    return body;
  }
}
