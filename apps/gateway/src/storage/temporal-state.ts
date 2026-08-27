import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeViewState, type ViewState } from '@omb/temporal-source';
import { parseAreaOfInterest, type AreaOfInterest } from '@omb/aois';

export interface FrameReceipt {
  dateId: string;
  status: 'loading' | 'loaded' | 'partial' | 'missing' | 'failed';
  loadedTileCount: number;
  failedTileCount: number;
}

export interface ComparisonReceipt {
  id: string;
  sourceId: string;
  aoiId: string;
  aoiVersion: number;
  dateIds: string[];
  viewState: ViewState;
  frames: FrameReceipt[];
}

interface TemporalState {
  aois: AreaOfInterest[];
  comparisons: ComparisonReceipt[];
}

function parseComparison(value: unknown): ComparisonReceipt {
  if (typeof value !== 'object' || value === null) throw new Error('comparison must be an object');
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.sourceId !== 'string' || typeof raw.aoiId !== 'string') {
    throw new Error('comparison identifiers are required');
  }
  if (!Number.isInteger(raw.aoiVersion) || (raw.aoiVersion as number) <= 0) throw new Error('invalid AOI version');
  if (!Array.isArray(raw.dateIds) || raw.dateIds.some((id) => typeof id !== 'string')) throw new Error('invalid dateIds');
  if (!Array.isArray(raw.frames)) throw new Error('invalid frames');
  return {
    id: raw.id,
    sourceId: raw.sourceId,
    aoiId: raw.aoiId,
    aoiVersion: raw.aoiVersion as number,
    dateIds: [...(raw.dateIds as string[])],
    viewState: normalizeViewState(raw.viewState),
    frames: structuredClone(raw.frames as FrameReceipt[]),
  };
}

export class TemporalStateRepository {
  private readonly path: string | null;
  private state: TemporalState;

  private constructor(path: string | null, state: TemporalState) {
    this.path = path;
    this.state = state;
  }

  static async open(path: string | null, presets: readonly AreaOfInterest[]): Promise<TemporalStateRepository> {
    if (path === null) {
      return new TemporalStateRepository(null, { aois: presets.map((aoi) => structuredClone(aoi)), comparisons: [] });
    }
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as { aois?: unknown; comparisons?: unknown };
      if (!Array.isArray(parsed.aois) || !Array.isArray(parsed.comparisons)) throw new Error('invalid temporal state');
      return new TemporalStateRepository(path, {
        aois: parsed.aois.map(parseAreaOfInterest),
        comparisons: parsed.comparisons.map(parseComparison),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const repository = new TemporalStateRepository(path, {
        aois: presets.map((aoi) => structuredClone(aoi)),
        comparisons: [],
      });
      await repository.persist();
      return repository;
    }
  }

  listAoIs(): AreaOfInterest[] {
    return structuredClone(this.state.aois);
  }

  listComparisons(): ComparisonReceipt[] {
    return structuredClone(this.state.comparisons);
  }

  async appendAoi(aoi: AreaOfInterest): Promise<void> {
    const parsed = parseAreaOfInterest(aoi);
    const latest = this.state.aois.filter((entry) => entry.id === parsed.id).sort((a, b) => b.version - a.version)[0];
    if (latest && parsed.version !== latest.version + 1) throw new Error('AOI version must append exactly one version');
    this.state.aois.push(parsed);
    await this.persist();
  }

  async appendComparison(comparison: ComparisonReceipt): Promise<void> {
    if (this.state.comparisons.some((entry) => entry.id === comparison.id)) throw new Error('duplicate comparison');
    this.state.comparisons.push(parseComparison(comparison));
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (this.path === null) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const handle = await open(temporary, 'w', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, this.path);
  }
}
