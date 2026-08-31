import { createHash } from 'node:crypto';
import { parseProbeResult, type ProbeResult } from '@omb/source-schema';
import {
  parseTemporalDateEntry,
  parseTemporalDateWindow,
  parseTemporalTileRequest,
  type TemporalDateEntry,
  type TemporalDateWindow,
  type TemporalSourceAdapter,
  type TemporalTileRequest,
  type TemporalTileResponse,
} from '@omb/temporal-source';
import { validateDecodedTile } from './image-validation.js';

export interface OviBridgeOptions {
  baseUrl: string;
  mapType: number;
  verifiedDates?: readonly TemporalDateEntry[];
  probeRequest?: TemporalTileRequest;
  fetchImpl?: typeof fetch;
}

interface OviPathInput {
  requestDate: string;
  z: number;
  x: number;
  y: number;
}

const MAX_TILE_BYTES = 5 * 1024 * 1024;
const SAFE_UPSTREAM_ERROR_STATUSES = new Set([400, 401, 403, 404, 408, 409, 410, 422, 429, 500, 502, 503, 504]);

interface OviProbeObservation {
  category: ProbeResult['category'];
  httpStatus: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  errorCode: string | null;
}

function statusObservation(status: number): OviProbeObservation {
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

function failureObservation(error: unknown): OviProbeObservation {
  if (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return {
      category: 'timeout',
      httpStatus: null,
      contentType: null,
      width: null,
      height: null,
      errorCode: 'PROBE_TIMEOUT',
    };
  }
  const invalidContent = error instanceof Error && /^Ovi bridge (?:returned|response|tile|image|decoder)/.test(error.message);
  return {
    category: invalidContent ? 'invalid-content' : 'upstream',
    httpStatus: null,
    contentType: null,
    width: null,
    height: null,
    errorCode: invalidContent ? 'PROBE_INVALID_CONTENT' : 'PROBE_TRANSPORT',
  };
}

async function readCappedBody(response: Response): Promise<Uint8Array> {
  if (!response.body) throw new Error('Ovi bridge returned an empty image response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TILE_BYTES) {
        await reader.cancel('Ovi bridge tile exceeds 5 MiB');
        throw new Error('Ovi bridge tile exceeds 5 MiB');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function requireTileInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}

export class OviBridgeAdapter implements TemporalSourceAdapter {
  private readonly baseUrl: URL;
  private readonly mapType: number;
  private readonly verifiedDates: Map<string, TemporalDateEntry>;
  private readonly probeRequest: TemporalTileRequest | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OviBridgeOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(baseUrl.hostname)) {
      throw new Error('Ovi bridge must use an HTTP loopback address');
    }
    if (baseUrl.username || baseUrl.password || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
      throw new Error('Ovi bridge base URL must contain only loopback origin and port');
    }
    if (!Number.isInteger(options.mapType) || options.mapType <= 0) throw new Error('mapType must be a positive integer');
    this.baseUrl = baseUrl;
    this.mapType = options.mapType;
    const verifiedDates = (options.verifiedDates ?? []).map(parseTemporalDateEntry);
    this.verifiedDates = new Map(verifiedDates.map((entry) => [entry.id, entry]));
    if (this.verifiedDates.size !== verifiedDates.length) throw new Error('Ovi verified date IDs must be unique');
    this.probeRequest = options.probeRequest ? parseTemporalTileRequest(options.probeRequest) : null;
    if (this.probeRequest) {
      const probeDate = this.verifiedDates.get(this.probeRequest.dateId);
      if (!probeDate || ['missing', 'failed'].includes(probeDate.availability)) {
        throw new Error('Ovi probe date must reference a requestable verified date');
      }
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  hasProbeRequest(): boolean {
    return this.probeRequest !== null;
  }

  probeInputFingerprint(sourceId: string, inputSha256: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(sourceId) || !/^[a-f0-9]{64}$/.test(inputSha256)) {
      throw new Error('Ovi probe fingerprint requires a source UUID and input SHA-256');
    }
    const canonicalInput = {
      schemaVersion: 1,
      sourceId: sourceId.toLowerCase(),
      inputSha256,
      loopbackOrigin: this.baseUrl.origin,
      mapType: this.mapType,
      verifiedDates: [...this.verifiedDates.values()].sort((left, right) => left.id.localeCompare(right.id)),
      probeRequest: this.probeRequest,
    };
    return createHash('sha256').update(JSON.stringify(canonicalInput)).digest('hex');
  }

  async createProbeResult(sourceId: string, inputFingerprint: string): Promise<ProbeResult> {
    if (!this.probeRequest) throw new Error('Ovi probe result requires a configured probe request');
    const startedAt = new Date().toISOString();
    const observation = await this.observeProbe();
    const endedAt = new Date().toISOString();
    return parseProbeResult({
      schemaVersion: 1,
      sourceId,
      inputFingerprint,
      startedAt,
      endedAt,
      ...observation,
    });
  }

  async probe(): Promise<{ ok: boolean; detail: string }> {
    if (!this.probeRequest) {
      return { ok: false, detail: 'loopback configuration accepted; no tile has been verified' };
    }
    const observation = await this.observeProbe();
    if (observation.category === 'success') {
      return { ok: true, detail: 'authorized loopback tile probe passed image validation' };
    }
    if (observation.httpStatus !== null) {
      return { ok: false, detail: `authorized loopback tile probe returned status ${observation.httpStatus}` };
    }
    return { ok: false, detail: 'authorized loopback tile probe failed image validation or transport checks' };
  }

  private async observeProbe(): Promise<OviProbeObservation> {
    if (!this.probeRequest) throw new Error('Ovi probe request is not configured');
    try {
      const response = await this.tile(this.probeRequest);
      if (response.status !== 200 || response.body.byteLength === 0) return statusObservation(response.status);
      const image = validateDecodedTile(response.body, response.contentType);
      return {
        category: 'success',
        httpStatus: 200,
        contentType: response.contentType,
        width: image.width,
        height: image.height,
        errorCode: null,
      };
    } catch (error) {
      return failureObservation(error);
    }
  }

  async listDates(input: TemporalDateWindow): Promise<TemporalDateEntry[]> {
    const parsed = parseTemporalDateWindow(input);
    if (this.verifiedDates.size === 0) throw new Error('Ovi bridge has no verified date catalog');
    return [...this.verifiedDates.values()]
      .filter((entry) => entry.requestDate >= parsed.from && entry.requestDate <= parsed.to)
      .map((entry) => structuredClone(entry));
  }

  pathFor(input: OviPathInput): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.requestDate)) throw new Error('requestDate must be YYYY-MM-DD');
    requireTileInteger(input.z, 'z');
    requireTileInteger(input.x, 'x');
    requireTileInteger(input.y, 'y');
    const compactDate = input.requestDate.replaceAll('-', '');
    return `/getomap_${this.mapType}_${input.z}_${input.x}_${input.y}_jpg_${compactDate}.jpg`;
  }

  async tile(input: TemporalTileRequest): Promise<TemporalTileResponse> {
    const parsed = parseTemporalTileRequest(input);
    const date = this.verifiedDates.get(parsed.dateId);
    if (!date || ['missing', 'failed'].includes(date.availability)) {
      return { status: 404, contentType: 'application/json', body: new Uint8Array() };
    }
    const requestDate = date.requestDate;
    const url = new URL(this.pathFor({ requestDate, z: parsed.z, x: parsed.x, y: parsed.y }), this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(url, { redirect: 'error', signal: controller.signal });
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream';
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        return {
          status: SAFE_UPSTREAM_ERROR_STATUSES.has(response.status) ? response.status : 502,
          contentType: 'application/json',
          body: new Uint8Array(),
        };
      }
      if (!['image/png', 'image/jpeg'].includes(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('Ovi bridge returned unsupported content');
      }
      const declaredHeader = response.headers.get('content-length');
      const declaredLength = declaredHeader === null ? null : Number(declaredHeader);
      if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) || declaredLength < 0)) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('Ovi bridge returned an invalid content length');
      }
      if (declaredLength !== null && declaredLength > MAX_TILE_BYTES) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('Ovi bridge tile exceeds 5 MiB');
      }
      const body = await readCappedBody(response);
      validateDecodedTile(body, contentType);
      return { status: response.status, contentType, body };
    } finally {
      clearTimeout(timeout);
    }
  }
}
