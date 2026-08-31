import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeViewState, type ViewState } from '@omb/temporal-source';
import { parseAreaOfInterest, type AreaOfInterest } from '@omb/aois';
import {
  parseAutomationRun,
  parseMapSourceDefinition,
  parseProbeResult,
  type AutomationRun,
  type ImportReceipt,
  type MapSourceDefinition,
  type ProbeResult,
} from '@omb/source-schema';

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
  importSources: MapSourceDefinition[];
  importReceipts: ImportReceipt[];
  automationRuns: AutomationRun[];
  probeResults: ProbeResult[];
}

function parseImportReceipt(value: unknown): ImportReceipt {
  if (typeof value !== 'object' || value === null) throw new Error('import receipt must be an object');
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.receiptId !== 'string' ||
    typeof raw.batchId !== 'string' ||
    typeof raw.inputSha256 !== 'string' ||
    typeof raw.parser !== 'string' ||
    !Array.isArray(raw.results)
  ) {
    throw new Error('invalid import receipt');
  }
  return structuredClone(value) as ImportReceipt;
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
  private writeTail: Promise<void> = Promise.resolve();

  private constructor(path: string | null, state: TemporalState) {
    this.path = path;
    this.state = state;
  }

  static async open(path: string | null, presets: readonly AreaOfInterest[]): Promise<TemporalStateRepository> {
    if (path === null) {
      return new TemporalStateRepository(null, {
        aois: presets.map((aoi) => structuredClone(aoi)),
        comparisons: [],
        importSources: [],
        importReceipts: [],
        automationRuns: [],
        probeResults: [],
      });
    }
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as {
        aois?: unknown;
        comparisons?: unknown;
        importSources?: unknown;
        importReceipts?: unknown;
        automationRuns?: unknown;
        probeResults?: unknown;
      };
      if (!Array.isArray(parsed.aois) || !Array.isArray(parsed.comparisons)) throw new Error('invalid temporal state');
      return new TemporalStateRepository(path, {
        aois: parsed.aois.map(parseAreaOfInterest),
        comparisons: parsed.comparisons.map(parseComparison),
        importSources: Array.isArray(parsed.importSources) ? parsed.importSources.map(parseMapSourceDefinition) : [],
        importReceipts: Array.isArray(parsed.importReceipts) ? parsed.importReceipts.map(parseImportReceipt) : [],
        automationRuns: Array.isArray(parsed.automationRuns) ? parsed.automationRuns.map(parseAutomationRun) : [],
        probeResults: Array.isArray(parsed.probeResults) ? parsed.probeResults.map(parseProbeResult) : [],
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const repository = new TemporalStateRepository(path, {
        aois: presets.map((aoi) => structuredClone(aoi)),
        comparisons: [],
        importSources: [],
        importReceipts: [],
        automationRuns: [],
        probeResults: [],
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

  listImportSources(): MapSourceDefinition[] {
    return structuredClone(this.state.importSources);
  }

  listImportReceipts(): ImportReceipt[] {
    return structuredClone(this.state.importReceipts);
  }

  listAutomationRuns(): AutomationRun[] {
    return structuredClone(this.state.automationRuns).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  listProbeResults(): ProbeResult[] {
    return structuredClone(this.state.probeResults);
  }

  findProbeResult(sourceId: string, inputFingerprint: string): ProbeResult | null {
    const result = this.state.probeResults.find(
      (entry) => entry.sourceId === sourceId && entry.inputFingerprint === inputFingerprint,
    );
    return result ? structuredClone(result) : null;
  }

  getAutomationRun(id: string): AutomationRun | null {
    const run = this.state.automationRuns.find((entry) => entry.id === id);
    return run ? structuredClone(run) : null;
  }

  findAutomationRunByFingerprint(inputFingerprint: string): AutomationRun | null {
    const run = this.state.automationRuns.find((entry) => entry.inputFingerprint === inputFingerprint);
    return run ? structuredClone(run) : null;
  }

  async appendAoi(aoi: AreaOfInterest): Promise<void> {
    const parsed = parseAreaOfInterest(aoi);
    await this.mutate((state) => {
      const latest = state.aois.filter((entry) => entry.id === parsed.id).sort((a, b) => b.version - a.version)[0];
      if (latest && parsed.version !== latest.version + 1) throw new Error('AOI version must append exactly one version');
      return { ...state, aois: [...state.aois, parsed] };
    });
  }

  async appendComparison(comparison: ComparisonReceipt): Promise<void> {
    const parsed = parseComparison(comparison);
    await this.mutate((state) => {
      if (state.comparisons.some((entry) => entry.id === parsed.id)) throw new Error('duplicate comparison');
      return { ...state, comparisons: [...state.comparisons, parsed] };
    });
  }

  async appendConfirmedImport(input: { sources: MapSourceDefinition[]; receipt: ImportReceipt }): Promise<void> {
    const sources = input.sources.map(parseMapSourceDefinition);
    if (sources.some((source) => source.status !== 'confirmed')) throw new Error('import source must be confirmed');
    const receipt = parseImportReceipt(input.receipt);
    await this.mutate((state) => {
      if (sources.some((source) => state.importSources.some((existing) => existing.id === source.id))) {
        throw new Error('duplicate import source');
      }
      if (state.importReceipts.some((existing) => existing.receiptId === receipt.receiptId)) {
        throw new Error('duplicate import receipt');
      }
      return {
        ...state,
        importSources: [...state.importSources, ...sources],
        importReceipts: [...state.importReceipts, receipt],
      };
    });
  }

  async setImportSourceCredentialRef(sourceId: string, credentialRef: string | null): Promise<MapSourceDefinition> {
    let result: MapSourceDefinition | null = null;
    await this.mutate((state) => {
      const index = state.importSources.findIndex((source) => source.id === sourceId);
      if (index < 0) throw new Error('source-not-found');
      const current = state.importSources[index];
      if (!current) throw new Error('source-not-found');
      const updated = parseMapSourceDefinition({
        ...current,
        credentialRef,
        updatedAt: new Date().toISOString(),
      });
      const importSources = [...state.importSources];
      importSources[index] = updated;
      result = structuredClone(updated);
      return { ...state, importSources };
    });
    if (!result) throw new Error('source-not-found');
    return result;
  }

  async markImportSourceProbed(sourceId: string, verifiedAt: string): Promise<MapSourceDefinition> {
    let result: MapSourceDefinition | null = null;
    await this.mutate((state) => {
      const index = state.importSources.findIndex((source) => source.id === sourceId);
      if (index < 0) throw new Error('source-not-found');
      const current = state.importSources[index];
      if (!current || !['confirmed', 'probed', 'rendered', 'saved'].includes(current.status)) {
        throw new Error('source-not-probe-eligible');
      }
      const updated = parseMapSourceDefinition({
        ...current,
        status: current.status === 'confirmed' ? 'probed' : current.status,
        updatedAt: verifiedAt,
        lastVerifiedAt: verifiedAt,
      });
      const importSources = [...state.importSources];
      importSources[index] = updated;
      result = structuredClone(updated);
      return { ...state, importSources };
    });
    if (!result) throw new Error('source-not-found');
    return result;
  }

  async ensureAutomationRun(input: AutomationRun): Promise<{ run: AutomationRun; created: boolean }> {
    const parsed = parseAutomationRun(input);
    let result: { run: AutomationRun; created: boolean } = { run: structuredClone(parsed), created: true };
    await this.mutate((state) => {
      const existing = state.automationRuns.find((entry) => entry.inputFingerprint === parsed.inputFingerprint);
      if (existing) {
        result = { run: structuredClone(existing), created: false };
        return state;
      }
      result = { run: structuredClone(parsed), created: true };
      return { ...state, automationRuns: [...state.automationRuns, parsed] };
    });
    return result;
  }

  async ensureProbeResult(input: ProbeResult): Promise<{ result: ProbeResult; created: boolean }> {
    const parsed = parseProbeResult(input);
    let result: { result: ProbeResult; created: boolean } = { result: structuredClone(parsed), created: true };
    await this.mutate((state) => {
      const existing = state.probeResults.find(
        (entry) => entry.sourceId === parsed.sourceId && entry.inputFingerprint === parsed.inputFingerprint,
      );
      if (existing) {
        result = { result: structuredClone(existing), created: false };
        return state;
      }
      result = { result: structuredClone(parsed), created: true };
      return { ...state, probeResults: [...state.probeResults, parsed] };
    });
    return result;
  }

  private async mutate(update: (state: TemporalState) => TemporalState): Promise<void> {
    const operation = this.writeTail.then(async () => {
      const next = update(this.state);
      if (next === this.state) return;
      await this.persist(next);
      this.state = next;
    });
    this.writeTail = operation.catch(() => undefined);
    await operation;
  }

  private async persist(state: TemporalState = this.state): Promise<void> {
    if (this.path === null) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const handle = await open(temporary, 'w', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, this.path);
  }
}
