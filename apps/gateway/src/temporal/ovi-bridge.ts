import {
  buildAnnualRequestCatalog,
  type TemporalDateEntry,
  type TemporalSourceAdapter,
  type TemporalTileResponse,
} from '@omb/temporal-source';

interface OviBridgeOptions {
  baseUrl: string;
  mapType: number;
  fetchImpl?: typeof fetch;
}

interface OviPathInput {
  requestDate: string;
  z: number;
  x: number;
  y: number;
}

const MAX_TILE_BYTES = 5 * 1024 * 1024;

function requireTileInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}

export class OviBridgeAdapter implements TemporalSourceAdapter {
  private readonly baseUrl: URL;
  private readonly mapType: number;
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
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async probe(): Promise<{ ok: boolean; detail: string }> {
    return { ok: true, detail: 'loopback configuration accepted; tile not yet verified' };
  }

  async listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]> {
    if (!input.aoiId) throw new Error('aoiId is required');
    const fromYear = Number(input.from.slice(0, 4));
    const toYear = Number(input.to.slice(0, 4));
    return buildAnnualRequestCatalog(fromYear, toYear);
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
    const yearMatch = /^annual-(\d{4})$/.exec(input.dateId);
    if (!yearMatch?.[1]) return { status: 404, contentType: 'application/json', body: new Uint8Array() };
    const requestDate = `${yearMatch[1]}-06-30`;
    const url = new URL(this.pathFor({ requestDate, z: input.z, x: input.x, y: input.y }), this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(url, { redirect: 'error', signal: controller.signal });
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream';
      if (response.ok && !contentType.startsWith('image/')) throw new Error('Ovi bridge returned non-image content');
      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > MAX_TILE_BYTES) throw new Error('Ovi bridge tile exceeds 5 MiB');
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength > MAX_TILE_BYTES) throw new Error('Ovi bridge tile exceeds 5 MiB');
      return { status: response.status, contentType, body };
    } finally {
      clearTimeout(timeout);
    }
  }
}
