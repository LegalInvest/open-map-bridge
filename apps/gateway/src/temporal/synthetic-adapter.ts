import {
  parseTemporalDateEntry,
  type TemporalDateEntry,
  type TemporalSourceAdapter,
  type TemporalTileResponse,
} from '@omb/temporal-source';

interface SyntheticTemporalAdapterOptions {
  missingYears?: readonly number[];
}

function parseSceneYear(dateId: string): number | null {
  const match = /^scene-(\d{4})$/.exec(dateId);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return year >= 2006 && year <= 2025 ? year : null;
}

function validTileCoordinate(value: number, zoom: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 2 ** zoom;
}

export class SyntheticTemporalAdapter implements TemporalSourceAdapter {
  private readonly missingYears: ReadonlySet<number>;

  constructor(options: SyntheticTemporalAdapterOptions = {}) {
    this.missingYears = new Set(options.missingYears ?? []);
  }

  async probe(): Promise<{ ok: boolean; detail: string }> {
    return { ok: true, detail: 'deterministic local synthetic source' };
  }

  async listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]> {
    if (!input.aoiId) throw new Error('aoiId is required');
    return Array.from({ length: 20 }, (_, offset) => {
      const year = 2006 + offset;
      const date = `${year}-07-15`;
      return parseTemporalDateEntry({
        id: `scene-${year}`,
        requestDate: date,
        captureDate: date,
        precision: 'capture-date',
        availability: this.missingYears.has(year) ? 'missing' : 'available',
        provenance: 'synthetic-temporal-v1',
      });
    }).filter((entry) => entry.requestDate >= input.from && entry.requestDate <= input.to);
  }

  async tile(input: { dateId: string; z: number; x: number; y: number }): Promise<TemporalTileResponse> {
    const year = parseSceneYear(input.dateId);
    if (year === null || this.missingYears.has(year)) {
      return { status: 404, contentType: 'application/json', body: new TextEncoder().encode('{"error":"missing"}') };
    }
    if (!Number.isInteger(input.z) || input.z < 0 || input.z > 22) {
      return { status: 400, contentType: 'application/json', body: new TextEncoder().encode('{"error":"bad-z"}') };
    }
    if (!validTileCoordinate(input.x, input.z) || !validTileCoordinate(input.y, input.z)) {
      return { status: 400, contentType: 'application/json', body: new TextEncoder().encode('{"error":"bad-coordinate"}') };
    }

    const progress = (year - 2006) / 19;
    const hue = Math.round(205 - progress * 95);
    const landWidth = Math.round(42 + progress * 88);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<rect width="256" height="256" fill="hsl(${hue} 55% 38%)"/>
<path d="M0 42 C52 18 83 76 128 49 S211 32 256 61 V0 H0Z" fill="#7da66c"/>
<path d="M0 188 C58 153 110 214 169 174 S224 160 256 181 V256 H0Z" fill="#83aa72"/>
<rect x="22" y="102" width="${landWidth}" height="54" rx="7" fill="#c7aa6a" opacity="0.88"/>
<path d="M28 82 L222 196 M16 160 L198 56" stroke="#e9e1bd" stroke-width="3" opacity="0.6"/>
<rect x="8" y="8" width="240" height="44" rx="6" fill="#071a2e" opacity="0.78"/>
<text x="18" y="29" font-family="system-ui,sans-serif" font-size="15" fill="white">SYNTHETIC · ${year}</text>
<text x="18" y="46" font-family="monospace" font-size="11" fill="#d5e8ff">z${input.z} / x${input.x} / y${input.y}</text>
</svg>`;
    return { status: 200, contentType: 'image/svg+xml', body: new TextEncoder().encode(svg) };
  }
}
