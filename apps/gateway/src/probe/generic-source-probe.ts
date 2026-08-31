import { createHash } from 'node:crypto';
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import {
  isSafeNonSecretQueryParameter,
  parseProbeResult,
  type CredentialBundle,
  type MapSourceDefinition,
  type ProbeResult,
} from '@omb/source-schema';
import { parseTemporalTileRequest } from '@omb/temporal-source';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import type { CredentialVault } from '../security/credential-vault.js';
import { inspectSourceNetworkPolicy, type SourcePolicyResult } from '../security/source-policy.js';
import {
  authorizeUpstreamRequest,
  requestPinnedUpstream,
  UpstreamNetworkPolicyError,
  type DnsResolver,
} from '../security/upstream-network.js';
import { validateDecodedTile } from '../temporal/image-validation.js';

const MAX_TILE_BYTES = 5 * 1024 * 1024;
const probeEligibleStatuses = new Set(['confirmed', 'probed', 'rendered', 'saved']);
const supportedProtocols = new Set(['xyz', 'tms', 'ovi-template']);

export interface GenericProbeCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface GenericSourceProbeDependencies {
  inspectPolicy?: (source: MapSourceDefinition) => SourcePolicyResult;
  resolver?: DnsResolver;
  allowedNonPublicAddresses?: (sourceId: string, hostname: string) => readonly string[];
  now?: () => Date;
}

export interface GenericProbeExecution {
  result: ProbeResult;
  created: boolean;
  externalRequest: boolean;
}

export class GenericProbePreconditionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'GenericProbePreconditionError';
  }
}

interface PreparedRequest {
  url: URL;
  headers: OutgoingHttpHeaders;
  credentialFingerprint: string | null;
}

interface ProbeObservation {
  category: ProbeResult['category'];
  httpStatus: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  errorCode: string | null;
}

function precondition(code: string): never {
  throw new GenericProbePreconditionError(code);
}

function parseCoordinate(input: GenericProbeCoordinate): GenericProbeCoordinate {
  try {
    const parsed = parseTemporalTileRequest({ dateId: 'generic-probe', ...input });
    return { z: parsed.z, x: parsed.x, y: parsed.y };
  } catch {
    return precondition('PROBE_COORDINATE_INVALID');
  }
}

function replaceTileVariables(
  template: string,
  coordinate: GenericProbeCoordinate,
  used: Set<'z' | 'x' | 'y'>,
): string {
  const replacements: Record<'z' | 'x' | 'y', string> = {
    z: String(coordinate.z),
    x: String(coordinate.x),
    y: String(coordinate.y),
  };
  const replaced = template.replace(/\{\$(z|x|y)\}/g, (_match, name: 'z' | 'x' | 'y') => {
    used.add(name);
    return replacements[name];
  });
  if (/\{\$[^}]+\}/.test(replaced)) return precondition('PROBE_TEMPLATE_UNSUPPORTED');
  return replaced;
}

function originFor(source: MapSourceDefinition): URL {
  const host = source.hosts[0];
  if (!host || source.hosts.length > 32 || source.transportScheme === 'unknown') {
    return precondition('PROBE_REQUEST_PLAN_INCOMPLETE');
  }
  let origin: URL;
  try {
    origin = new URL(`${source.transportScheme}://${host}/`);
  } catch {
    return precondition('PROBE_REQUEST_PLAN_INCOMPLETE');
  }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    return precondition('PROBE_REQUEST_PLAN_INCOMPLETE');
  }
  return origin;
}

function credentialParts(
  source: MapSourceDefinition,
  vault: CredentialVault | null,
): { bundle: CredentialBundle | null; fingerprint: string | null } {
  if (source.credentialRef === null) {
    if (source.compatibilityExtension.credentialRequired === true) return precondition('PROBE_CREDENTIAL_REQUIRED');
    if (source.compatibilityExtension.credentialRequired !== false) {
      return precondition('PROBE_CREDENTIAL_REQUIREMENT_UNKNOWN');
    }
    return { bundle: null, fingerprint: null };
  }
  if (!vault || !vault.has(source.credentialRef)) return precondition('PROBE_CREDENTIAL_UNAVAILABLE');
  try {
    return { bundle: vault.resolve(source.credentialRef), fingerprint: vault.fingerprint(source.credentialRef) };
  } catch {
    return precondition('PROBE_CREDENTIAL_UNAVAILABLE');
  }
}

function prepareRequest(
  source: MapSourceDefinition,
  input: GenericProbeCoordinate,
  vault: CredentialVault | null,
): PreparedRequest {
  if (!supportedProtocols.has(source.protocol)) return precondition('PROBE_PROTOCOL_UNSUPPORTED');
  const coordinate = source.protocol === 'tms'
    ? { ...input, y: (2 ** input.z) - 1 - input.y }
    : input;
  const used = new Set<'z' | 'x' | 'y'>();
  const origin = originFor(source);
  const path = replaceTileVariables(source.pathTemplate, coordinate, used);
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) return precondition('PROBE_REQUEST_PLAN_INCOMPLETE');

  const publicQuery = new URLSearchParams();
  for (const key of Object.keys(source.queryParameters).sort()) {
    const value = source.queryParameters[key];
    if (value === undefined) continue;
    if (!isSafeNonSecretQueryParameter(key, value)) return precondition('PROBE_REQUEST_PLAN_INCOMPLETE');
    publicQuery.set(key, replaceTileVariables(value, coordinate, used));
  }
  if (!['z', 'x', 'y'].every((name) => used.has(name as 'z' | 'x' | 'y'))) {
    return precondition('PROBE_TEMPLATE_UNSUPPORTED');
  }

  const credentials = credentialParts(source, vault);
  const headers: OutgoingHttpHeaders = {};
  for (const field of credentials.bundle?.fields ?? []) {
    if (field.placement === 'query') {
      if (publicQuery.has(field.name)) return precondition('PROBE_CREDENTIAL_CONFLICT');
      publicQuery.set(field.name, field.value);
    } else {
      headers[field.name] = field.value;
    }
  }
  url.search = publicQuery.toString();
  return { url, headers, credentialFingerprint: credentials.fingerprint };
}

function requestFingerprint(
  source: MapSourceDefinition,
  coordinate: GenericProbeCoordinate,
  prepared: PreparedRequest,
): string {
  const evidence = {
    probeVersion: 1,
    sourceId: source.id,
    inputSha256: source.sourceProvenance.inputSha256,
    protocol: source.protocol,
    projection: source.projection,
    transportScheme: source.transportScheme,
    hosts: source.hosts,
    pathTemplate: source.pathTemplate,
    queryParameters: source.queryParameters,
    requestPlanProvenance: source.requestPlanProvenance,
    coordinate,
    selectedAuthority: prepared.url.origin,
    credentialFingerprint: prepared.credentialFingerprint,
  };
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function statusObservation(status: number): ProbeObservation {
  const category: ProbeResult['category'] = status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 404
        ? 'not-found'
        : status === 408
          ? 'timeout'
          : status === 429
            ? 'rate-limited'
            : 'upstream';
  return {
    category,
    httpStatus: status,
    contentType: null,
    width: null,
    height: null,
    errorCode: `PROBE_HTTP_${status}`,
  };
}

function failureObservation(error: unknown): ProbeObservation {
  if (error instanceof UpstreamNetworkPolicyError) {
    const category = error.code.includes('DNS') || error.code.includes('ADDRESS') || error.code.includes('METADATA')
      ? 'dns'
      : error.code.includes('TIMEOUT')
        ? 'timeout'
        : 'upstream';
    return { category, httpStatus: null, contentType: null, width: null, height: null, errorCode: error.code };
  }
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const tls = /CERT|TLS|SSL/.test(code);
  const timeout = code === 'ETIMEDOUT';
  const invalidContent = error instanceof Error && error.name === 'GenericProbeContentError';
  return {
    category: invalidContent ? 'invalid-content' : tls ? 'tls' : timeout ? 'timeout' : 'upstream',
    httpStatus: null,
    contentType: null,
    width: null,
    height: null,
    errorCode: invalidContent ? 'PROBE_INVALID_CONTENT' : tls ? 'PROBE_TLS' : timeout ? 'PROBE_TIMEOUT' : 'PROBE_TRANSPORT',
  };
}

class GenericProbeContentError extends Error {
  override name = 'GenericProbeContentError';
}

function contentType(response: IncomingMessage): string {
  const raw = response.headers['content-type'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? 'application/octet-stream';
}

async function readCappedBody(response: IncomingMessage): Promise<Uint8Array> {
  const declaredRaw = response.headers['content-length'];
  const declaredText = Array.isArray(declaredRaw) ? declaredRaw[0] : declaredRaw;
  if (declaredText !== undefined) {
    const declared = Number(declaredText);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_TILE_BYTES) {
      response.destroy();
      throw new GenericProbeContentError('invalid or excessive image length');
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of response) {
      const bytes = Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > MAX_TILE_BYTES) {
        response.destroy();
        throw new GenericProbeContentError('image exceeds 5 MiB');
      }
      chunks.push(bytes);
    }
  } catch (error) {
    if (error instanceof GenericProbeContentError) throw error;
    throw new GenericProbeContentError('image stream failed');
  }
  if (total === 0) throw new GenericProbeContentError('empty image response');
  return Buffer.concat(chunks, total);
}

export class GenericSourceProbeService {
  private readonly inFlight = new Map<string, Promise<GenericProbeExecution>>();
  private readonly inspectPolicy: (source: MapSourceDefinition) => SourcePolicyResult;
  private readonly now: () => Date;

  constructor(
    private readonly repository: TemporalStateRepository,
    private readonly vault: CredentialVault | null,
    private readonly dependencies: GenericSourceProbeDependencies = {},
  ) {
    this.inspectPolicy = dependencies.inspectPolicy ?? inspectSourceNetworkPolicy;
    this.now = dependencies.now ?? (() => new Date());
  }

  async probe(sourceId: string, input: GenericProbeCoordinate): Promise<GenericProbeExecution> {
    const source = this.repository.listImportSources().find((candidate) => candidate.id === sourceId);
    if (!source) return precondition('PROBE_SOURCE_NOT_FOUND');
    if (!probeEligibleStatuses.has(source.status)) return precondition('PROBE_SOURCE_NOT_CONFIRMED');
    if (source.compatibilityExtension.needsOviBridge === true) return precondition('PROBE_OVI_BRIDGE_REQUIRED');
    const policy = this.inspectPolicy(source);
    if (policy.decision !== 'allowed') return precondition(policy.code ?? 'PROBE_NETWORK_POLICY');

    const coordinate = parseCoordinate(input);
    const prepared = prepareRequest(source, coordinate, this.vault);
    const fingerprint = requestFingerprint(source, coordinate, prepared);
    const existing = this.repository.findProbeResult(source.id, fingerprint);
    if (existing) {
      if (existing.category === 'success') await this.repository.markImportSourceProbed(source.id, existing.endedAt);
      return { result: existing, created: false, externalRequest: false };
    }

    const running = this.inFlight.get(fingerprint);
    if (running) {
      const shared = await running;
      return { result: shared.result, created: false, externalRequest: false };
    }
    const operation = this.execute(source, coordinate, prepared, fingerprint);
    this.inFlight.set(fingerprint, operation);
    try {
      return await operation;
    } finally {
      this.inFlight.delete(fingerprint);
    }
  }

  private async execute(
    source: MapSourceDefinition,
    _coordinate: GenericProbeCoordinate,
    prepared: PreparedRequest,
    fingerprint: string,
  ): Promise<GenericProbeExecution> {
    const startedAt = this.now().toISOString();
    let observation: ProbeObservation;
    let externalRequest = false;
    try {
      const url = prepared.url;
      const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
      const target = await authorizeUpstreamRequest(
        url,
        {
          protocol: url.protocol as 'http:' | 'https:',
          hostname: url.hostname,
          port,
          allowedNonPublicAddresses: this.dependencies.allowedNonPublicAddresses?.(source.id, url.hostname) ?? [],
        },
        this.dependencies.resolver,
      );
      externalRequest = true;
      const response = await requestPinnedUpstream(url, target, { headers: prepared.headers, timeoutMs: 10_000 });
      const status = response.statusCode ?? 502;
      if (status !== 200) {
        response.destroy();
        observation = statusObservation(status);
      } else {
        const mime = contentType(response);
        if (!['image/png', 'image/jpeg'].includes(mime)) {
          response.destroy();
          throw new GenericProbeContentError('unsupported image content type');
        }
        const body = await readCappedBody(response);
        let image;
        try {
          image = validateDecodedTile(body, mime);
        } catch {
          throw new GenericProbeContentError('image validation failed');
        }
        observation = {
          category: 'success',
          httpStatus: 200,
          contentType: mime,
          width: image.width,
          height: image.height,
          errorCode: null,
        };
      }
    } catch (error) {
      observation = failureObservation(error);
    }
    const result = parseProbeResult({
      schemaVersion: 1,
      sourceId: source.id,
      inputFingerprint: fingerprint,
      startedAt,
      endedAt: this.now().toISOString(),
      ...observation,
    });
    const persisted = await this.repository.ensureProbeResult(result);
    if (persisted.result.category === 'success') {
      await this.repository.markImportSourceProbed(source.id, persisted.result.endedAt);
    }
    return { result: persisted.result, created: persisted.created, externalRequest };
  }
}
