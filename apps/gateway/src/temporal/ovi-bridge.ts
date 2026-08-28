import {
  parseTemporalDateEntry,
  type TemporalDateEntry,
  type TemporalSourceAdapter,
  type TemporalTileResponse,
} from '@omb/temporal-source';
import { validateDecodedTile } from './image-validation.js';

interface OviBridgeOptions {
  baseUrl: string;
  mapType: number;
  verifiedDates?: readonly TemporalDateEntry[];
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
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async probe(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: 'loopback configuration accepted; no tile has been verified' };
  }

  async listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]> {
    if (!input.aoiId) throw new Error('aoiId is required');
    if (this.verifiedDates.size === 0) throw new Error('Ovi bridge has no verified date catalog');
    return [...this.verifiedDates.values()]
      .filter((entry) => entry.requestDate >= input.from && entry.requestDate <= input.to)
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

  async tile(input: { dateId: string; z: number; x: number; y: number }): Promise<TemporalTileResponse> {
    const date = this.verifiedDates.get(input.dateId);
    if (!date || ['missing', 'failed'].includes(date.availability)) {
      return { status: 404, contentType: 'application/json', body: new Uint8Array() };
    }
    const requestDate = date.requestDate;
    const url = new URL(this.pathFor({ requestDate, z: input.z, x: input.x, y: input.y }), this.baseUrl);
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
