import { z } from 'zod';
import {
  parseTemporalDateEntry,
  temporalDateWindowSchema,
  temporalTileRequestSchema,
  type TemporalDateEntry,
} from '@omb/temporal-source';
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
  gatewayToken?: string;
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
  private readonly gatewayToken: string | null;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenMapBridgeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? '');
    this.manifest = parseDeveloperAppManifest(options.manifest);
    if (
      options.gatewayToken !== undefined &&
      (options.gatewayToken.length < 32 || options.gatewayToken.length > 256 || /\s/.test(options.gatewayToken))
    ) {
      throw new DeveloperSdkError('invalid-gateway-token');
    }
    if (this.baseUrl !== '' && options.gatewayToken === undefined) {
      throw new DeveloperSdkError('gateway-token-required');
    }
    this.gatewayToken = options.gatewayToken ?? null;
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
    const parsed = temporalDateWindowSchema.safeParse(input);
    if (!parsed.success) {
      const invalidAoi = parsed.error.issues.some((issue) => issue.path[0] === 'aoiId');
      throw new DeveloperSdkError(invalidAoi ? 'invalid-aoi-id' : 'invalid-date-window');
    }
    const query = new URLSearchParams(parsed.data);
    const raw = await this.readJson(`${source.links.dates}?${query.toString()}`);
    return z.array(z.unknown()).parse(raw).map(parseTemporalDateEntry);
  }

  tileUrl(
    source: DeveloperSourceDescriptor,
    input: { dateId: string; z: number; x: number; y: number },
  ): string {
    this.assertPermission('tiles');
    assertSourceCapability(source, 'tiles');
    const parsed = temporalTileRequestSchema.safeParse(input);
    if (!parsed.success) {
      const invalidDateId = parsed.error.issues.some((issue) => issue.path[0] === 'dateId');
      throw new DeveloperSdkError(invalidDateId ? 'invalid-date-id' : 'invalid-coordinate');
    }
    const template = source.links.tileTemplate;
    if (!template) throw new DeveloperSdkError('capability-not-available');
    const path = template
      .replace('{dateId}', encodeURIComponent(parsed.data.dateId))
      .replace('{z}', String(parsed.data.z))
      .replace('{x}', String(parsed.data.x))
      .replace('{y}', String(parsed.data.y));
    return `${this.baseUrl}${path}`;
  }

  async fetchTile(
    source: DeveloperSourceDescriptor,
    input: { dateId: string; z: number; x: number; y: number },
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const response = await this.fetcher(this.tileUrl(source, input), { headers: this.requestHeaders('*/*') });
    if (!response.ok) throw new DeveloperSdkError('gateway-error', 'gateway-error', response.status);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!contentType.startsWith('image/')) {
      throw new DeveloperSdkError('invalid-tile-response', 'invalid-tile-response', response.status);
    }
    return { body: new Uint8Array(await response.arrayBuffer()), contentType };
  }

  mapTileUrl(
    source: DeveloperSourceDescriptor,
    input: { z: number; x: number; y: number },
  ): string {
    this.assertPermission('map-tiles');
    assertSourceCapability(source, 'map-tiles');
    const parsed = temporalTileRequestSchema.safeParse({ dateId: 'map-tile', ...input });
    if (!parsed.success) throw new DeveloperSdkError('invalid-coordinate');
    const template = source.links.mapTileTemplate;
    if (!template) throw new DeveloperSdkError('capability-not-available');
    const path = template
      .replace('{z}', String(parsed.data.z))
      .replace('{x}', String(parsed.data.x))
      .replace('{y}', String(parsed.data.y));
    return `${this.baseUrl}${path}`;
  }

  async fetchMapTile(
    source: DeveloperSourceDescriptor,
    input: { z: number; x: number; y: number },
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const response = await this.fetcher(this.mapTileUrl(source, input), { headers: this.requestHeaders('*/*') });
    if (!response.ok) throw new DeveloperSdkError('gateway-error', 'gateway-error', response.status);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!contentType.startsWith('image/')) {
      throw new DeveloperSdkError('invalid-tile-response', 'invalid-tile-response', response.status);
    }
    return { body: new Uint8Array(await response.arrayBuffer()), contentType };
  }

  private assertPermission(capability: DeveloperCapability): void {
    const permission = permissionForCapability(capability);
    if (!this.manifest.permissions.includes(permission)) {
      throw new DeveloperSdkError('permission-not-granted', `permission-not-granted: ${permission}`);
    }
  }

  private async readJson(path: string): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, { headers: this.requestHeaders('application/json') });
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

  private requestHeaders(accept: string): Record<string, string> {
    return {
      accept,
      'x-omb-app-id': this.manifest.id,
      ...(this.gatewayToken ? { authorization: `Bearer ${this.gatewayToken}` } : {}),
    };
  }
}
