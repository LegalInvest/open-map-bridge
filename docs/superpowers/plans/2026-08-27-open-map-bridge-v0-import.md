# OpenMapBridge V0 Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a localhost Web UI and gateway that inspect real Ovital QR payloads and `.ovmap` files without network access, show a secret-safe preview, obtain user confirmation, render an authorized real tile source, persist it, and export an open source definition.

**Architecture:** A React/OpenLayers Web UI talks only to a localhost Fastify gateway. Versioned QR and `.ovmap` adapters normalize untrusted input into `MapSourceDefinition`; the gateway owns URL policy, credentials, probing, tile proxying, SQLite persistence, receipts, and bounded cache. Ovi compatibility remains at adapters, while the renderer and future plugins depend only on the open schema.

**Tech Stack:** Node.js 24 LTS target (local Node 26 may run development checks), npm workspaces, TypeScript 7.0.2, React 19.2.8, Vite 8.2.2, OpenLayers 10.10.0, ZXing Browser 0.2.1, Fastify 5.12.1, SQLite via better-sqlite3 13.0.3, Zod 4.4.3, Vitest 4.1.11, Playwright 1.62.1, Docker/Compose.

**Spec:** `docs/superpowers/specs/2026-08-27-open-map-bridge-v0-design.md` implements the product truth in `goal.md`; current evidence and stage live in `research.md`.

## Global Constraints

- Read `goal.md`, `research.md`, `PROGRESS.md`, `BLOCKED.md`, and the design before every task; never reduce an AC to fit current code.
- The target runtime is Node.js `24.20.0` LTS; `package.json` permits `>=24 <27`. Docker uses `node:24.20.0-bookworm-slim`.
- Pin the package versions listed in this plan exactly; do not use `latest`, caret, or tilde ranges.
- Every workspace `tsconfig.json` extends `../../tsconfig.base.json`, sets `noEmit:true`, and includes `src/**/*.ts`; Web also includes `src/**/*.tsx` with `jsx:"react-jsx"`, while Gateway adds `types:["node"]`.
- Bind the V0 gateway to localhost only. Docker publishes `127.0.0.1:4173:4173`; no public deployment is part of this plan.
- Inspecting QR or `.ovmap` must perform zero DNS/HTTP calls. Only the confirm/probe and tile routes may contact an approved upstream.
- Never commit real tokens, cookies, private keys, user QR images, unlicensed `.ovmap` resources, tile caches, SQLite data, or credential keys.
- Public no-license Ovital samples may be acquired into gitignored `fixtures/local/` for local clean-room compatibility tests; CI uses synthetic fixtures and must not download third-party map data.
- A synthetic fixture can prove parser safety, not real Ovital compatibility. `local-verified` requires the mandatory local compatibility command and one user-authorized real rendering journey.
- Keep `parsed`, `confirmed`, `probed`, `rendered`, and `saved` separate. HTTP 200, a decoded QR, or a parsed file is not a successful map.
- Use TDD for every behavior. No skipped tests, network-dependent default tests, swallowed failures, weakened limits, or arbitrary `eval`/`Function` template execution.
- Update `research.md` and `PROGRESS.md` with actual commands and stages after each task; product behavior changes require `goal.md` approval first.

---

## File Structure Locked by This Plan

```text
open-map-bridge/
├── apps/
│   ├── gateway/
│   │   ├── package.json
│   │   └── src/
│   │       ├── app.ts
│   │       ├── server.ts
│   │       ├── config.ts
│   │       ├── import/
│   │       ├── security/
│   │       ├── storage/
│   │       ├── probe/
│   │       ├── tiles/
│   │       └── routes/
│   └── web/
│       ├── package.json
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/
│           ├── import/
│           ├── map/
│           └── styles.css
├── packages/
│   ├── source-schema/src/
│   ├── ovmap-codec/src/
│   ├── qr-import/src/
│   ├── protocols/src/
│   └── security/src/
├── fixtures/
│   ├── synthetic/
│   └── local/                 # gitignored, mandatory for compatibility gate
├── scripts/
├── e2e/
├── docs/compatibility/
├── Dockerfile
├── compose.yaml
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── vitest.config.ts
└── playwright.config.ts
```

## Interface Ledger

These signatures are frozen for this plan. If evidence requires a change, update this plan and the design before implementing downstream tasks.

```ts
export type SourceStatus =
  | 'received' | 'parsed' | 'confirmed' | 'probed' | 'rendered' | 'saved'
  | 'invalid' | 'unsupported' | 'blocked' | 'needs-credential'
  | 'needs-data' | 'probe-failed' | 'render-failed' | 'stale' | 'disabled';

export interface MapSourceDefinition { /* Task 1 exact fields */ }
export interface ImportLayerCandidate { /* Task 1 exact fields */ }
export interface ImportPreview { /* Task 1 exact fields */ }
export interface ImportReceipt { /* Task 1 exact fields */ }
export interface ProbeResult { /* Task 1 exact fields */ }

export function decodeOviMap(input: Uint8Array, limits?: OvMapLimits): DecodedOvMapBundle;
export function decodeQrPayload(payload: string): RawQrCandidate[];
export function normalizeCandidate(candidate: RawImportCandidate): ImportLayerCandidate;
export function renderTileTemplate(template: string, vars: TileVariables): string;
export function validateUrlSyntax(url: URL): PolicyDecision;
export async function authorizeResolvedUrl(url: URL, policy: NetworkPolicy): Promise<AuthorizedUrl>;

export interface SecretVault {
  put(value: string): Promise<string>;
  get(ref: string): Promise<string>;
  delete(ref: string): Promise<void>;
}
```

---

### Task 0: Reproducible Workspace and Mandatory Fixture Gate

**Files:**
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `.prettierignore`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `scripts/verify-environment.mjs`
- Create: `scripts/verify-environment.test.mjs`
- Create: `scripts/acquire-research-fixtures.mjs`
- Create: `scripts/verify-local-fixtures.mjs`
- Create: `fixtures/local/README.md`
- Create: `docs/compatibility/fixture-policy.md`
- Create: `THIRD_PARTY.md`
- Modify: `PROGRESS.md`
- Modify: `research.md`

**Interfaces:**
- Consumes: the approved spec and current machine state.
- Produces: `npm run env:check`, `npm run fixtures:acquire`, and `npm run fixtures:verify`; exact dependency lock; a local-only fixture contract used by Tasks 2, 3, and 9.

- [ ] **Step 1: Write the environment test before the checker**

```js
// scripts/verify-environment.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEnvironment } from './verify-environment.mjs';

test('rejects unsupported Node and unsafe disk space', () => {
  assert.deepEqual(evaluateEnvironment({ nodeMajor: 23, freeBytes: 20n * 1024n ** 3n }), {
    ok: false,
    errors: ['Node.js major must be 24, 25, or 26; received 23'],
  });
  assert.equal(evaluateEnvironment({ nodeMajor: 24, freeBytes: 4n * 1024n ** 3n }).ok, false);
});

test('accepts supported Node with at least 5 GiB free', () => {
  assert.deepEqual(evaluateEnvironment({ nodeMajor: 24, freeBytes: 5n * 1024n ** 3n }), {
    ok: true,
    errors: [],
  });
});
```

- [ ] **Step 2: Run the test and verify the import fails**

Run: `node --test scripts/verify-environment.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/verify-environment.mjs`.

- [ ] **Step 3: Add the root manifests with exact versions**

```json
{
  "name": "open-map-bridge",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24 <27", "npm": ">=11 <12" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "env:check": "node scripts/verify-environment.mjs",
    "fixtures:acquire": "node scripts/acquire-research-fixtures.mjs",
    "fixtures:verify": "node scripts/verify-local-fixtures.mjs",
    "test": "vitest run --exclude '**/*.compat.test.ts'",
    "test:compat": "vitest run '**/*.compat.test.ts'",
    "test:e2e": "playwright test",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "dev": "node scripts/dev.mjs",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "@types/node": "26.4.0",
    "eslint": "10.9.1",
    "jsdom": "30.0.1",
    "prettier": "3.9.6",
    "tsup": "8.5.1",
    "tsx": "4.23.12",
    "typescript": "7.0.2",
    "typescript-eslint": "8.68.0",
    "vite": "8.2.2",
    "vitest": "4.1.11"
  }
}
```

Set `.nvmrc` to `24.20.0`. Set `tsconfig.base.json` to `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `module: NodeNext`, `moduleResolution: NodeNext`, and `target: ES2023`. Configure Vitest for Node by default and a 10-second test timeout.

`eslint.config.js` imports `typescript-eslint`, ignores generated/data/fixture-local paths, and applies `tseslint.configs.recommended` to `**/*.ts` and `**/*.tsx`. `.prettierignore` contains `node_modules`, `dist`, `data`, `cache`, `fixtures/local`, `playwright-report`, and `test-results`.

Add to `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
data/
cache/
fixtures/local/*
!fixtures/local/README.md
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.key
.env
```

- [ ] **Step 4: Implement the environment checker**

```js
// scripts/verify-environment.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function evaluateEnvironment({ nodeMajor, freeBytes }) {
  const errors = [];
  if (nodeMajor < 24 || nodeMajor > 26) {
    errors.push(`Node.js major must be 24, 25, or 26; received ${nodeMajor}`);
  }
  if (freeBytes < 5n * 1024n ** 3n) errors.push('At least 5 GiB free disk is required');
  return { ok: errors.length === 0, errors };
}

function currentFreeBytes() {
  const line = execFileSync('df', ['-k', '/'], { encoding: 'utf8' }).trim().split('\n').at(-1);
  const availableKiB = BigInt(line.trim().split(/\s+/)[3]);
  return availableKiB * 1024n;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = evaluateEnvironment({
    nodeMajor: Number(process.versions.node.split('.')[0]),
    freeBytes: currentFreeBytes(),
  });
  if (!result.ok) { console.error(result.errors.join('\n')); process.exit(1); }
  console.log('environment-ok');
}
```

- [ ] **Step 5: Run the environment tests**

Run: `node --test scripts/verify-environment.test.mjs && node scripts/verify-environment.mjs`

Expected: two passing tests and `environment-ok`. If local Node 26 passes, Docker still freezes Node 24.20.0 later.

- [ ] **Step 6: Implement local-only public fixture acquisition and verification**

`scripts/acquire-research-fixtures.mjs` must download exactly these two research samples into `fixtures/local/`, verify hashes before rename, and refuse overwrites with a different hash:

```js
const fixtures = [
  {
    file: 'tencent-5.ovmap',
    sha256: 'a3de20dd1830e81697950bc13d93dba0d67dfc7d2f91651a86c79f04db750128',
    url: 'https://raw.githubusercontent.com/soneverdance/ovital/main/%E8%85%BE%E8%AE%AF%E5%9C%B0%E5%9B%BE5%E7%A7%8D.ovmap',
  },
  {
    file: 'tianditu-402.png',
    sha256: 'e570ba7120598235fb5333490cee1556bbb0ede09daf6480dd498518f5d93cc8',
    url: 'https://raw.githubusercontent.com/soneverdance/ovital/main/402_%E5%A4%A9%E5%9C%B0%E5%9B%BE%E7%9F%A2%E9%87%8F%E5%BA%95%E5%9B%BE%E7%90%83%E9%9D%A2%E5%A2%A8%E5%8D%A1%E6%89%98%E6%8A%95%E5%BD%B1.png',
  },
];
```

The script prints the repository URL and the warning `local research only; not redistributable by this project`. `verify-local-fixtures.mjs` fails if either file is missing or mismatched. `fixtures/local/README.md` explains that these files remain untracked because the source repository has no verified license.

- [ ] **Step 7: Acquire and verify without committing the binaries**

Run: `node scripts/acquire-research-fixtures.mjs && node scripts/verify-local-fixtures.mjs && git status --short`

Expected: `fixtures-ok`; `git status` does not list the two binary files.

- [ ] **Step 8: Lock the dependency metadata and provenance**

Run: `npm install --package-lock-only --ignore-scripts`

Expected: a new `package-lock.json`; no runtime package code installed yet. Record Node 24 as LTS, local Node/Docker versions, current dependency versions/licenses, and the two fixture hashes in `research.md` and `THIRD_PARTY.md`.

- [ ] **Step 9: Commit the reproducibility gate**

```bash
git add .nvmrc .gitignore .prettierignore eslint.config.js package.json package-lock.json tsconfig.base.json vitest.config.ts scripts fixtures/local/README.md docs/compatibility/fixture-policy.md THIRD_PARTY.md PROGRESS.md research.md
git commit -m "chore: establish reproducible V0 workspace"
```

---

### Task 1: Open Source Schema, State Machine, and Error Contract

**Files:**
- Create: `packages/source-schema/package.json`
- Create: `packages/source-schema/tsconfig.json`
- Create: `packages/source-schema/src/index.ts`
- Create: `packages/source-schema/src/schema.ts`
- Create: `packages/source-schema/src/state.ts`
- Create: `packages/source-schema/src/errors.ts`
- Create: `packages/source-schema/src/schema.test.ts`
- Create: `packages/source-schema/src/state.test.ts`
- Create: `docs/open-map-source-schema.md`
- Modify: `package-lock.json`
- Modify: `research.md`

**Interfaces:**
- Consumes: no application code.
- Produces: `MapSourceDefinition`, `ImportLayerCandidate`, `ImportPreview`, `ProbeResult`, `ImportReceipt`, `AppError`, `parseMapSourceDefinition()`, and `transitionSource()` for every later task.

- [ ] **Step 1: Add the package manifest and failing schema test**

```json
{
  "name": "@omb/source-schema",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "zod": "4.4.3" }
}
```

```ts
// packages/source-schema/src/schema.test.ts
import { describe, expect, it } from 'vitest';
import { parseMapSourceDefinition } from './index.js';

describe('MapSourceDefinition', () => {
  it('accepts a secret-free XYZ definition and rejects inline secrets', () => {
    const source = parseMapSourceDefinition({
      schemaVersion: 1,
      id: '018f4d39-32f1-7a31-9f60-81c6b453b886',
      legacyId: 402,
      name: 'Fixture XYZ',
      sourceKind: 'ovmap',
      protocol: 'ovi-template',
      projection: 'EPSG:3857',
      minZoom: 0,
      maxZoom: 18,
      tileSize: 256,
      format: 'png',
      hosts: ['tiles.example.invalid'],
      pathTemplate: '/{$z}/{$x}/{$y}.png',
      queryParameters: {},
      credentialRef: null,
      attribution: null,
      license: null,
      sourceProvenance: { inputSha256: 'a'.repeat(64), adapter: 'synthetic-v1' },
      compatibilityExtension: {},
      status: 'parsed',
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
      lastVerifiedAt: null,
    });
    expect(source.name).toBe('Fixture XYZ');
    expect(() => parseMapSourceDefinition({ ...source, queryParameters: { token: 'secret' } })).toThrow(/secret/i);
  });
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run: `npm install && npm exec vitest -- run packages/source-schema/src/schema.test.ts`

Expected: FAIL because `parseMapSourceDefinition` does not exist.

- [ ] **Step 3: Implement the exact model**

```ts
export type SourceKind = 'qr' | 'ovmap' | 'oms' | 'manual';
export type MapProtocol = 'xyz' | 'tms' | 'wmts' | 'wms' | 'arcgis' | 'ovi-template';
export type ProjectionId = 'EPSG:3857' | 'EPSG:4326' | `EPSG:${number}` | 'unknown';
export type TileFormat = 'png' | 'jpg' | 'webp' | 'unknown';
export type SourceStatus =
  | 'received' | 'parsed' | 'confirmed' | 'probed' | 'rendered' | 'saved'
  | 'invalid' | 'unsupported' | 'blocked' | 'needs-credential'
  | 'needs-data' | 'probe-failed' | 'render-failed' | 'stale' | 'disabled';

export interface MapSourceDefinition {
  schemaVersion: 1;
  id: string;
  legacyId: number | null;
  name: string;
  sourceKind: SourceKind;
  protocol: MapProtocol;
  projection: ProjectionId;
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
  format: TileFormat;
  hosts: string[];
  pathTemplate: string;
  queryParameters: Record<string, string>;
  credentialRef: string | null;
  attribution: string | null;
  license: string | null;
  sourceProvenance: { inputSha256: string; adapter: string };
  compatibilityExtension: Record<string, unknown>;
  status: SourceStatus;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface ImportLayerCandidate {
  candidateId: string;
  source: MapSourceDefinition;
  selectable: boolean;
  warnings: AppError[];
  requiresCredential: boolean;
  requiresCompanionData: boolean;
}

export interface ImportPreview {
  previewId: string;
  inputType: 'qr' | 'ovmap' | 'oms';
  inputSha256: string;
  parser: string;
  layers: ImportLayerCandidate[];
  warnings: AppError[];
  expiresAt: string;
}

export interface ProbeResult {
  sourceId: string;
  startedAt: string;
  endedAt: string;
  category: 'success' | 'dns' | 'tls' | 'timeout' | 'unauthorized' | 'forbidden' | 'not-found' | 'rate-limited' | 'upstream' | 'invalid-content';
  httpStatus: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  errorCode: string | null;
}

export interface ImportReceipt {
  receiptId: string;
  batchId: string;
  inputSha256: string;
  parser: string;
  confirmedAt: string | null;
  results: Array<{ candidateId: string; sourceId: string | null; status: SourceStatus; errorCode: string | null }>;
  undoneAt: string | null;
}
```

Use Zod to enforce lengths, zoom ordering, UUID, SHA-256, host count, safe query keys, and absence of keys matching `/token|key|secret|cookie|authorization/i` in `queryParameters`.

- [ ] **Step 4: Write and run the failing transition tests**

```ts
// packages/source-schema/src/state.test.ts
import { expect, it } from 'vitest';
import { transitionSource } from './index.js';

it('allows parsed to confirmed but rejects parsed to saved', () => {
  expect(transitionSource('parsed', 'confirmed')).toBe('confirmed');
  expect(() => transitionSource('parsed', 'saved')).toThrow(/invalid source transition/i);
});

it('allows a failed probe to be confirmed for an explicit retry', () => {
  expect(transitionSource('probe-failed', 'confirmed')).toBe('confirmed');
});
```

Run: `npm exec vitest -- run packages/source-schema/src/state.test.ts`

Expected: FAIL because `transitionSource` does not exist.

- [ ] **Step 5: Implement the transition table and stable errors**

`state.ts` must use an explicit `Record<SourceStatus, readonly SourceStatus[]>`; no arithmetic or broad wildcard transitions. `errors.ts` exports:

```ts
export interface AppError {
  code: `${'INPUT'|'FORMAT'|'POLICY'|'CREDENTIAL'|'PROBE'|'PROJECTION'|'DATA'|'RENDER'|'STORAGE'}_${string}`;
  message: string;
  retryable: boolean;
  nextAction: string;
  detail: Record<string, string | number | boolean | null>;
}
```

- [ ] **Step 6: Run package verification**

Run: `npm test -- packages/source-schema && npm run typecheck`

Expected: PASS; no test skip output.

- [ ] **Step 7: Document the open schema and commit**

Document every field, state transition, secret exclusion, and schema version migration rule in `docs/open-map-source-schema.md`.

```bash
git add packages/source-schema docs/open-map-source-schema.md package-lock.json research.md
git commit -m "feat: define the open map source contract"
```

---

### Task 2: Conservative `.ovmap` Container and Five-Layer Codec

**Files:**
- Create: `packages/ovmap-codec/package.json`
- Create: `packages/ovmap-codec/tsconfig.json`
- Create: `packages/ovmap-codec/src/index.ts`
- Create: `packages/ovmap-codec/src/container.ts`
- Create: `packages/ovmap-codec/src/record37.ts`
- Create: `packages/ovmap-codec/src/reader.ts`
- Create: `packages/ovmap-codec/src/synthetic.ts`
- Create: `packages/ovmap-codec/src/container.test.ts`
- Create: `packages/ovmap-codec/src/record37.test.ts`
- Create: `packages/ovmap-codec/src/tencent37.compat.test.ts`
- Create: `docs/compatibility/ovmap-record37.md`
- Modify: `research.md`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: `MapSourceDefinition`, `ImportLayerCandidate`, and `AppError` from Task 1; local fixture gate from Task 0.
- Produces: `decodeOviMap(input, limits)`, `DecodedOvMapBundle`, and a codec registry. Task 5 uses this decoder inside import inspection.

- [ ] **Step 1: Create the codec package and write strict container failures first**

```json
{
  "name": "@omb/ovmap-codec",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@omb/source-schema": "0.0.0" }
}
```

```ts
import { describe, expect, it } from 'vitest';
import { decodeOviContainer } from './container.js';

describe('OviO container', () => {
  it('rejects a false extension payload before decompression', () => {
    expect(() => decodeOviContainer(new Uint8Array([0, 1, 2]), { maxInput: 1_048_576, maxOutput: 8_388_608, maxRatio: 32 })).toThrow(/FORMAT_MAGIC/);
  });

  it('rejects a declared output larger than the limit', () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x4f, 0x76, 0x69, 0x4f]);
    new DataView(bytes.buffer).setUint32(8, 9_000_000, true);
    expect(() => decodeOviContainer(bytes, { maxInput: 1_048_576, maxOutput: 8_388_608, maxRatio: 32 })).toThrow(/FORMAT_DECOMPRESS_LIMIT/);
  });
});
```

- [ ] **Step 2: Run and observe the missing decoder**

Run: `npm install && npm exec vitest -- run packages/ovmap-codec/src/container.test.ts`

Expected: FAIL with missing `container.js`.

- [ ] **Step 3: Implement the verified container facts only**

`decodeOviContainer()` must:

1. require at least 24 bytes and magic `OviO`;
2. read little-endian declared file size at offset 4 and declared output size at offset 8;
3. require declared file size to equal actual input size for the `record37-zlib` family;
4. require zlib bytes at offset 24 to start with a valid zlib CMF/FLG pair;
5. use `inflateSync(input.subarray(24), { maxOutputLength })`;
6. require actual output length to equal declared output size;
7. enforce `maxInput`, `maxOutput`, and `maxRatio` before returning;
8. return `{ magic: 'OviO', family: 'record37-zlib', payload, header: Uint8Array }`.

Unknown headers return `FORMAT_UNSUPPORTED_CONTAINER`; do not try arbitrary offsets.

- [ ] **Step 4: Write the five-record synthetic test**

```ts
it('decodes five bounded record37 layers', () => {
  const file = buildSyntheticRecord37Ovmap([
    { mapId: 204, maxZoom: 18, name: 'A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    { mapId: 205, maxZoom: 18, name: 'B', host: 'b.example.invalid', path: '/{$z}/{$x}/{$y}.png', group: 'G' },
    { mapId: 209, maxZoom: 18, name: 'C', host: 'c.example.invalid', path: '/tile?z={$z}&x={$x}&y={$y}', group: 'G' },
    { mapId: 213, maxZoom: 18, name: 'D', host: 'd.example.invalid', path: '/{$z}/{$x/16}/{$y/16}.jpg', group: 'G' },
    { mapId: 214, maxZoom: 18, name: 'E', host: 'e.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
  ]);
  const result = decodeOviMap(file);
  expect(result.layers.map((layer) => [layer.legacyId, layer.name])).toEqual([[204, 'A'], [205, 'B'], [209, 'C'], [213, 'D'], [214, 'E']]);
});
```

The synthetic builder is test-only and emits the observed record family: total record bytes equal `recordLength + 8`; verified integers are `mapId` at record offset 24 and `maxZoom` at offset 32; four length-prefixed UTF-8 strings begin at offset 128 in order `name`, `host`, `path`, `group`.

- [ ] **Step 5: Implement `record37` with strict boundaries**

```ts
export interface RawOviLayer37 {
  legacyId: number;
  maxZoom: number;
  name: string;
  host: string;
  pathTemplate: string;
  group: string;
  projectionCode: number;
  imageKindCode: number;
  unknownHeaderWords: number[];
}
```

`decodeRecord37Payload()` loops until payload end, requires each record to fit exactly, caps records at 1,000, caps every UTF-8 string at 8,192 bytes, rejects invalid UTF-8, and leaves projection as `unknown` until a documented differential fixture maps its code. It derives `jpg/png/unknown` only from a literal terminal extension and never activates a source with unknown projection without user correction.

- [ ] **Step 6: Run synthetic and malicious record tests**

Add tests for truncated record, record length overflow, 1,001 records, invalid UTF-8, string length overflow, and trailing bytes.

Run: `npm exec vitest -- run packages/ovmap-codec/src/container.test.ts packages/ovmap-codec/src/record37.test.ts`

Expected: PASS.

- [ ] **Step 7: Add the mandatory local compatibility test**

```ts
// packages/ovmap-codec/src/tencent37.compat.test.ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { decodeOviMap } from './index.js';

it('decodes the locally acquired five-map record37 fixture', () => {
  const result = decodeOviMap(readFileSync('fixtures/local/tencent-5.ovmap'));
  expect(result.layers.map((x) => [x.legacyId, x.name])).toEqual([
    [204, '腾讯卫星地图'],
    [205, '腾讯路网小字体'],
    [209, '腾讯地图'],
    [213, '腾讯地形图'],
    [214, '腾讯地形图小字体'],
  ]);
  expect(result.layers.every((x) => x.host.length > 0 && x.pathTemplate.length > 0)).toBe(true);
});
```

Run: `npm run fixtures:verify && npm run test:compat -- packages/ovmap-codec/src/tencent37.compat.test.ts`

Expected: PASS and exactly five decoded layers. This test must fail, not skip, if the local fixture is absent.

- [ ] **Step 8: Record the compatibility evidence and limitations**

`docs/compatibility/ovmap-record37.md` records offsets, sample hash, record totals, verified fields, unknown fields, and the rule that projection remains unverified. It must say the fixture URL does not confer tile-use authorization.

- [ ] **Step 9: Commit the conservative codec**

```bash
git add packages/ovmap-codec docs/compatibility/ovmap-record37.md research.md PROGRESS.md package-lock.json
git commit -m "feat: decode verified ovmap record37 fields"
```

---

### Task 3: QR Image Decode and Ovital Payload Adapter

**Files:**
- Create: `packages/qr-import/package.json`
- Create: `packages/qr-import/tsconfig.json`
- Create: `packages/qr-import/src/index.ts`
- Create: `packages/qr-import/src/ovi-query.ts`
- Create: `packages/qr-import/src/oms.ts`
- Create: `packages/qr-import/src/ovi-query.test.ts`
- Create: `packages/qr-import/src/oms.test.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/import/qr-reader.ts`
- Create: `apps/web/src/import/qr-reader.test.ts`
- Create: `docs/compatibility/ovi-qr-query.md`
- Modify: `package-lock.json`
- Modify: `research.md`

**Interfaces:**
- Consumes: Task 1 schema; Task 0 local QR fixture.
- Produces: `decodeQrPayload(payload)`, `decodeQrImage(image)`, and raw candidates for Task 5. It does not perform network calls.

- [ ] **Step 1: Create the QR package and write a redacted Ovital payload test**

```json
{
  "name": "@omb/qr-import",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@omb/source-schema": "0.0.0" }
}
```

```ts
import { expect, it } from 'vitest';
import { decodeQrPayload } from './index.js';

it('parses verified ovobj query keys without inventing unknown meanings', () => {
  const payload = 'ovobj?t=1&id=402&na=Fixture%20Map&po=1&he=18&oy=3&df=0&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png';
  const [result] = decodeQrPayload(payload);
  expect(result).toMatchObject({
    adapter: 'ovi-query-v1', legacyId: 402, name: 'Fixture Map', host: 'tiles.example.invalid',
    pathTemplate: '/{$z}/{$x}/{$y}.png', rawCodes: { t: '1', po: '1', he: '18', oy: '3', df: '0' },
  });
  expect(result.projection).toBe('unknown');
});
```

- [ ] **Step 2: Run and verify the missing adapter**

Run: `npm install && npm exec vitest -- run packages/qr-import/src/ovi-query.test.ts`

Expected: FAIL because `decodeQrPayload` does not exist.

- [ ] **Step 3: Implement strict query parsing**

`decodeQrPayload()` accepts at most 4,096 UTF-8 bytes, requires head `ovobj`, allows only keys `t,id,na,po,he,oy,df,hn,ul`, rejects duplicate `id/na/hn/ul`, rejects missing core fields, decodes percent-encoding once, and preserves `t/po/he/oy/df` as raw codes. It maps `id`, `na`, `hn`, and `ul` because their behavior is verified; it must not treat `he` as zoom or `po` as a projection until differential evidence is recorded.

An open OMS QR begins with `oms1:` followed by base64url JSON. `decodeOmsQr()` validates the Task 1 schema and rejects any inline secret.

- [ ] **Step 4: Add malformed and secret tests**

Test payload overflow, duplicate key, malformed percent encoding, unexpected scheme, missing host, URL userinfo, and an OMS payload containing `token`. All must fail before network access.

Run: `npm exec vitest -- run packages/qr-import/src`

Expected: PASS.

- [ ] **Step 5: Add browser image and camera decoding**

Pin Web dependencies:

```json
{
  "name": "@omb/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@omb/source-schema": "0.0.0",
    "@zxing/browser": "0.2.1",
    "ol": "10.10.0",
    "proj4": "2.21.0",
    "qrcode": "1.5.4",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.6",
    "@types/qrcode": "1.5.6",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.5",
    "@vitejs/plugin-react": "6.1.0"
  }
}
```

```ts
export interface QrReader {
  decodeFile(file: File): Promise<string>;
  startCamera(video: HTMLVideoElement, onResult: (payload: string) => void): Promise<{ stop(): void }>;
}
```

Implement with `BrowserQRCodeReader.decodeFromImageElement()` and `decodeFromVideoDevice()`. Always stop camera tracks after first success, cancel, unmount, or error. Never fetch image URLs; create an object URL from the local file and revoke it in `finally`.

- [ ] **Step 6: Add a mandatory local QR compatibility receipt**

Create a Playwright-free Node/macOS-independent check by committing only a redacted receipt derived from the local PNG: expected symbology `QR`, payload head `ovobj`, payload length 271, and query keys `t,id,na,po,he,oy,df,hn,ul`. The PNG remains untracked. Browser E2E in Task 9 will upload the local file and assert those structural facts without printing values.

- [ ] **Step 7: Verify, document, and commit**

Run: `npm test -- packages/qr-import apps/web/src/import && npm run typecheck`

Expected: PASS.

```bash
git add packages/qr-import apps/web/package.json apps/web/src/import docs/compatibility/ovi-qr-query.md package-lock.json research.md
git commit -m "feat: inspect ovital and open QR payloads"
```

---

### Task 4: URL Policy, SSRF Defense, Secret Redaction, and Local Vault

**Files:**
- Create: `packages/security/package.json`
- Create: `packages/security/tsconfig.json`
- Create: `packages/security/src/index.ts`
- Create: `packages/security/src/url-policy.ts`
- Create: `packages/security/src/redact.ts`
- Create: `packages/security/src/url-policy.test.ts`
- Create: `packages/security/src/redact.test.ts`
- Create: `apps/gateway/package.json`
- Create: `apps/gateway/tsconfig.json`
- Create: `apps/gateway/src/security/secret-vault.ts`
- Create: `apps/gateway/src/security/secret-vault.test.ts`
- Create: `apps/gateway/src/config.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `AppError` and source types.
- Produces: `validateUrlSyntax`, `authorizeResolvedUrl`, `redactSecrets`, `SecretVault`, and `GatewayConfig` for Tasks 5–9.

- [ ] **Step 1: Create the security package and write SSRF table tests**

```json
{
  "name": "@omb/security",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@omb/source-schema": "0.0.0", "ipaddr.js": "2.5.0" }
}
```

Create the initial gateway manifest in the same step so vault tests have a workspace without unresolved future dependencies:

```json
{
  "name": "@omb/gateway",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@omb/security": "0.0.0", "@omb/source-schema": "0.0.0" }
}
```

```ts
it.each([
  ['file:///etc/passwd', 'POLICY_SCHEME'],
  ['http://user:pass@example.com/x', 'POLICY_USERINFO'],
  ['http://127.0.0.1/x', 'POLICY_PRIVATE_ADDRESS'],
  ['http://169.254.169.254/latest/meta-data', 'POLICY_METADATA_ADDRESS'],
  ['http://[::1]/x', 'POLICY_PRIVATE_ADDRESS'],
])('blocks %s', (value, code) => {
  expect(validateUrlSyntax(new URL(value)).error?.code).toBe(code);
});

it('allows a syntactically valid public HTTPS host before DNS resolution', () => {
  expect(validateUrlSyntax(new URL('https://tiles.example.com/1/2/3.png')).allowed).toBe(true);
});
```

- [ ] **Step 2: Run and verify failures**

Run: `npm install && npm exec vitest -- run packages/security/src/url-policy.test.ts`

Expected: FAIL because policy functions do not exist.

- [ ] **Step 3: Implement syntax and resolved-address policy**

Use `ipaddr.js` 2.5.0. Allow only `https:` by default; `http:` requires an explicit per-host local policy flag. Reject userinfo, empty host, control characters, ports outside the configured allowlist, loopback, private, link-local, multicast, reserved, carrier-grade NAT, IPv4-mapped IPv6 private addresses, and metadata endpoints. `authorizeResolvedUrl()` uses injected DNS lookup, checks every answer, and returns an opaque `AuthorizedUrl` only if all addresses pass. Redirect handling in Task 6 must call it again for every hop.

- [ ] **Step 4: Implement and test deterministic redaction**

```ts
expect(redactSecrets('https://x.test/tile?token=abcdef&x=1')).toBe('https://x.test/tile?token=%5BREDACTED%5D&x=1');
expect(redactSecrets('Authorization: Bearer abcdef')).toBe('Authorization: [REDACTED]');
```

Recognize keys matching `/token|tk|key|api[_-]?key|secret|cookie|authorization|signature|sig/i` and high-entropy bearer values. Redaction runs before structured logging serialization.

- [ ] **Step 5: Write the vault failure test**

```ts
it('encrypts at rest and deletes by reference', async () => {
  const vault = await FileKeySecretVault.open(tempDir);
  const ref = await vault.put('canary-secret-7f44');
  expect(await vault.get(ref)).toBe('canary-secret-7f44');
  expect(readAllFiles(tempDir)).not.toContain('canary-secret-7f44');
  await vault.delete(ref);
  await expect(vault.get(ref)).rejects.toThrow(/not found/i);
});
```

- [ ] **Step 6: Implement AES-256-GCM local vault**

On first run, generate 32 random bytes into `data/master.key` using exclusive create and mode `0600`. Encrypt each secret with a fresh 12-byte IV and 16-byte auth tag; store `{version:1, iv, tag, ciphertext}` in `data/secrets/<uuid>.json` with mode `0600`. Refuse symlinked key/data paths and key files with group/other permissions. This is a localhost V0 vault; no secret appears in SQLite or logs.

- [ ] **Step 7: Run security verification and commit**

Run: `npm test -- packages/security apps/gateway/src/security && npm run typecheck`

Expected: PASS, including the canary-not-on-disk assertion.

```bash
git add packages/security apps/gateway/package.json apps/gateway/src/security apps/gateway/src/config.ts package-lock.json
git commit -m "feat: enforce local source security policy"
```

---

### Task 5: Zero-Network Import Inspector, Preview Store, SQLite Registry, and Receipts

**Files:**
- Modify: `apps/gateway/tsconfig.json`
- Create: `apps/gateway/tsup.config.ts`
- Create: `apps/gateway/src/app.ts`
- Create: `apps/gateway/src/server.ts`
- Create: `apps/gateway/src/import/inspector.ts`
- Create: `apps/gateway/src/import/normalizer.ts`
- Create: `apps/gateway/src/import/preview-store.ts`
- Create: `apps/gateway/src/import/inspector.test.ts`
- Create: `apps/gateway/src/storage/database.ts`
- Create: `apps/gateway/src/storage/migrations/001_initial.sql`
- Create: `apps/gateway/src/storage/source-repository.ts`
- Create: `apps/gateway/src/storage/receipt-repository.ts`
- Create: `apps/gateway/src/storage/repository.test.ts`
- Create: `apps/gateway/src/routes/import.ts`
- Create: `apps/gateway/src/routes/sources.ts`
- Create: `apps/gateway/src/routes/receipts.ts`
- Create: `packages/protocols/package.json`
- Create: `packages/protocols/tsconfig.json`
- Modify: `apps/gateway/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `buildApp()`, import inspect routes, preview token storage, source/receipt repositories, and source list routes. Task 6 adds confirmation/probing and tiles.

- [ ] **Step 1: Pin gateway dependencies**

```json
{
  "name": "@omb/gateway",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup --config tsup.config.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fastify/cors": "11.3.0",
    "@fastify/multipart": "10.1.1",
    "@fastify/static": "10.1.3",
    "@omb/ovmap-codec": "0.0.0",
    "@omb/protocols": "0.0.0",
    "@omb/qr-import": "0.0.0",
    "@omb/security": "0.0.0",
    "@omb/source-schema": "0.0.0",
    "better-sqlite3": "13.0.3",
    "fastify": "5.12.1",
    "ipaddr.js": "2.5.0",
    "pino": "10.3.1",
    "sharp": "0.35.4",
    "undici": "8.10.0"
  },
  "devDependencies": { "@types/better-sqlite3": "9.6.0" }
}
```

`apps/gateway/tsup.config.ts` bundles all `@omb/*` workspaces into one ESM entry, targets `node24`, disables splitting, emits source maps, and keeps only `better-sqlite3` and `sharp` external so their native binaries resolve from `node_modules`:

```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts'], format: ['esm'], platform: 'node', target: 'node24',
  bundle: true, splitting: false, sourcemap: true, clean: true,
  noExternal: [/^@omb\//], external: ['better-sqlite3', 'sharp'],
});
```

Create `packages/protocols/package.json` now with the exact manifest shown in Task 6 and an empty `src/index.ts` exporting no values. This satisfies workspace resolution for the gateway; Task 6 replaces the empty module with tested behavior. The package's `typecheck` command must pass before continuing.

- [ ] **Step 2: Write the zero-network inspector test**

```ts
it('inspects an ovmap bundle without calling network dependencies', async () => {
  let calls = 0;
  const inspector = createInspector({
    now: () => new Date('2026-08-27T00:00:00Z'),
    networkAttempt: () => { calls += 1; throw new Error('network forbidden'); },
  });
  const preview = await inspector.inspect({ type: 'ovmap', bytes: syntheticFiveMapFile() });
  expect(preview.layers).toHaveLength(5);
  expect(calls).toBe(0);
  expect(preview.layers.every((x) => x.source.status === 'parsed')).toBe(true);
});
```

- [ ] **Step 3: Run and verify failure**

Run: `npm install && npm exec vitest -- run apps/gateway/src/import/inspector.test.ts`

Expected: FAIL because inspector modules do not exist.

- [ ] **Step 4: Implement normalization and preview TTL**

`normalizeCandidate()` maps verified fields only. Unknown projection makes the candidate selectable only after user correction; missing host/path yields `needs-data`. Preview IDs are random UUIDs, live for 15 minutes, are stored only in memory, and contain raw parse results; API responses contain normalized candidates and masked values. `consume(previewId)` is single-use at confirmation, while `get(previewId)` supports preview display without extending TTL.

- [ ] **Step 5: Add route tests for QR and multipart `.ovmap`**

Use Fastify `inject()` to assert:

- `POST /api/import/inspect/qr` accepts `{payload}` and returns preview.
- `POST /api/import/inspect/ovmap` accepts one multipart file capped at 1 MiB.
- malformed input returns stable `AppError` JSON.
- logs do not contain a canary token.
- no DNS/fetch mock is called during either route.

- [ ] **Step 6: Write repository tests before migrations**

```ts
it('atomically saves a source and receipt and survives reopen', async () => {
  const db1 = openDatabase(tempDbPath);
  await saveConfirmedBatch(db1, { source, receipt });
  db1.close();
  const db2 = openDatabase(tempDbPath);
  expect(findSource(db2, source.id)?.status).toBe('saved');
  expect(findReceipt(db2, receipt.receiptId)?.inputSha256).toBe(receipt.inputSha256);
});
```

- [ ] **Step 7: Implement SQLite schema and atomic repositories**

Tables: `schema_migrations`, `sources`, `source_events`, `receipts`, `receipt_results`, and `tile_cache_entries`. Store the full secret-free source JSON plus indexed ID/status/name fields. Use WAL, foreign keys, busy timeout, and transactions. A source event is append-only. Deleting a source first removes its secret via `SecretVault`, then its source/cache rows in a transaction; a vault failure aborts deletion.

- [ ] **Step 8: Run gateway unit/integration verification**

Run: `npm test -- apps/gateway/src/import apps/gateway/src/storage && npm run typecheck`

Expected: PASS; reopening the DB preserves data; canary secrets are absent.

- [ ] **Step 9: Commit import inspection and persistence**

```bash
git add apps/gateway package-lock.json research.md PROGRESS.md
git commit -m "feat: inspect and persist map source imports"
```

---

### Task 6: Safe Confirmation, Protocol Templates, Probe, Tile Proxy, and Bounded Cache

**Files:**
- Modify: `packages/protocols/package.json`
- Modify: `packages/protocols/tsconfig.json`
- Create: `packages/protocols/src/index.ts`
- Create: `packages/protocols/src/ovi-template.ts`
- Create: `packages/protocols/src/tile-request.ts`
- Create: `packages/protocols/src/ovi-template.test.ts`
- Create: `apps/gateway/src/probe/http-client.ts`
- Create: `apps/gateway/src/probe/probe-source.ts`
- Create: `apps/gateway/src/probe/probe-source.test.ts`
- Create: `apps/gateway/src/tiles/tile-cache.ts`
- Create: `apps/gateway/src/tiles/tile-service.ts`
- Create: `apps/gateway/src/tiles/tile-service.test.ts`
- Create: `apps/gateway/src/routes/confirm.ts`
- Create: `apps/gateway/src/routes/tiles.ts`
- Modify: `apps/gateway/src/app.ts`
- Modify: `research.md`

**Interfaces:**
- Consumes: preview store, policies, vault, schema, repositories.
- Produces: `renderTileTemplate`, `buildTileRequest`, `probeSource`, confirmation route, and registered-source-only tile route for Task 7 UI.

- [ ] **Step 1: Verify the protocol package manifest and write template tests that reject code execution**

```json
{
  "name": "@omb/protocols",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@omb/source-schema": "0.0.0" }
}
```

```ts
it('renders the verified Ovi arithmetic subset', () => {
  expect(renderTileTemplate('/{$z}/{$x/16}/{$y/16}/{$x}_{$y}.jpg', { z: 18, x: 1234, y: 5678, serverpart: '1' }))
    .toBe('/18/77/354/1234_5678.jpg');
});

it.each(['{$x*process.exit()}', '${process.env}', '{$x/0}', '{$unknown}'])('rejects %s', (template) => {
  expect(() => renderTileTemplate(template, { z: 1, x: 2, y: 3, serverpart: '0' })).toThrow(/FORMAT_TEMPLATE/);
});
```

- [ ] **Step 2: Implement a parser, not `eval`**

Allow only `{$z}`, `{$x}`, `{$y}`, `{$serverpart}`, and one integer operation `/`, `+`, or `-` with a non-negative integer literal. Division is floor division and divisor must be positive. Reject every other character inside braces. TMS transforms y before template rendering.

- [ ] **Step 3: Write probe behavior tests**

The injected local fixture server returns PNG, 401, 403, 404, 429, redirect-to-private, wrong MIME, and corrupt image. Tests assert exact `ProbeResult.category`, at most three redirects, URL policy on every redirect, timeout abort, and no automatic retry after 429.

- [ ] **Step 4: Implement the restricted HTTP client and image validation**

Use `undici` with redirects disabled. Resolve and authorize before every request; send `User-Agent: OpenMapBridge/0.0.0 (local)`; timeout after 10 seconds; cap headers and body at 5 MiB; validate image using `sharp().metadata()` and require width/height 1–1024. Do not log full query strings.

- [ ] **Step 5: Implement confirmation as an atomic, per-layer workflow**

`POST /api/import/:previewId/confirm` receives:

```ts
interface ConfirmImportRequest {
  authorizedUse: true;
  selections: Array<{
    candidateId: string;
    projection: Exclude<ProjectionId, 'unknown'>;
    credential: string | null;
    allowHttpHost: boolean;
    allowPrivateHost: boolean;
  }>;
}
```

For each selection: consume server-side preview data → revalidate → store credential → transition to confirmed → probe one center test tile from an explicit fixed z/x/y supplied by the candidate or user preview location → save success/needs-credential/probe-failed separately → generate batch receipt. One layer failure cannot relabel the batch as all failed.

- [ ] **Step 6: Write tile route open-proxy tests**

Assert `/api/tiles/:sourceId/:z/:x/:y` works only for saved, active sources; ignores and rejects arbitrary `url`, `host`, and `token` query parameters; enforces integer coordinate ranges; never returns upstream `Set-Cookie`; and uses the source's credential reference internally.

- [ ] **Step 7: Implement a 256 MiB bounded file cache**

Cache body files under `data/cache/<sha256-prefix>/<sha256>` and metadata in `tile_cache_entries`. Atomic write uses a temporary file and rename. Before insert, evict least-recently-accessed entries until total bytes plus new bytes are at most 256 MiB. If free disk is under 2 GiB, serve without inserting and emit the non-secret event `cache_bypassed_low_disk`.

- [ ] **Step 8: Run protocol and gateway verification**

Run:

```bash
npm test -- packages/protocols apps/gateway/src/probe apps/gateway/src/tiles apps/gateway/src/routes
npm run typecheck
```

Expected: PASS; redirect-to-private and arbitrary URL proxy tests are red-to-green; no external network is used.

- [ ] **Step 9: Commit the controlled network path**

```bash
git add packages/protocols apps/gateway/src/probe apps/gateway/src/tiles apps/gateway/src/routes apps/gateway/src/app.ts research.md package-lock.json
git commit -m "feat: probe and proxy approved tile sources"
```

---

### Task 7: Responsive Import UI and Real OpenLayers Rendering

**Files:**
- Create: `apps/web/index.html`
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/types.ts`
- Create: `apps/web/src/import/ImportDialog.tsx`
- Create: `apps/web/src/import/InputStep.tsx`
- Create: `apps/web/src/import/PreviewStep.tsx`
- Create: `apps/web/src/import/ResultStep.tsx`
- Create: `apps/web/src/import/import-flow.test.tsx`
- Create: `apps/web/src/map/MapCanvas.tsx`
- Create: `apps/web/src/map/LayerPanel.tsx`
- Create: `apps/web/src/map/map-source.ts`
- Create: `apps/web/src/map/map-source.test.ts`
- Create: `apps/web/src/styles.css`
- Create: `scripts/dev.mjs`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Task 5 and 6 HTTP APIs plus Task 1 types.
- Produces: UI-001–UI-004, desktop upload/drag, mobile camera/image, preview, confirmation, result receipt, layer reopening, and real map display.

- [ ] **Step 1: Write the import state-machine component test**

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('does not show confirm until preview succeeds and authorization is checked', async () => {
  const user = userEvent.setup();
  render(<ImportDialog api={fakeApiWithOneParsedLayer()} open onClose={() => {}} />);
  await user.upload(screen.getByLabelText('选择 .ovmap 文件'), ovmapFile);
  expect(await screen.findByText('Fixture Map')).toBeVisible();
  const confirm = screen.getByRole('button', { name: '测试并导入' });
  expect(confirm).toBeDisabled();
  await user.click(screen.getByLabelText('我确认有权使用所选图源'));
  expect(confirm).toBeEnabled();
});
```

- [ ] **Step 2: Run and verify missing UI**

Run: `npm exec vitest -- run --environment jsdom apps/web/src/import/import-flow.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the four UI states**

`ImportDialog` has `input | inspecting | preview | confirming | result | error`. Input tabs are camera, QR image, `.ovmap`, and manual standard source. Inspecting shows local-only text. Preview displays input hash short code, parser, layer rows, host, protocol, projection, zoom, format, credential presence, authorization/HTTP/private warnings, and selectable state. Result counts rendered/saved/needs-credential/needs-data/failed/unselected separately.

Camera refusal moves to a visible QR image upload action; cancel stops camera and discards preview. Never print raw QR payload or full URL query.

- [ ] **Step 4: Write map source tests**

```ts
it('builds an OpenLayers source against the registered gateway id only', () => {
  const source = createOlSource(savedSource);
  expect(source.getUrls()).toEqual(['/api/tiles/018f4d39-32f1-7a31-9f60-81c6b453b886/{z}/{x}/{y}']);
});
```

The test must prove the browser does not receive upstream host, token, or path template.

- [ ] **Step 5: Implement OpenLayers rendering and source status panel**

Use `ol/Map`, `ol/View`, `ol/layer/Tile`, and `ol/source/XYZ`. The browser URL is always the local source-ID route. Register `proj4` only for an explicitly known EPSG definition; unknown projection cannot render. The layer panel displays state, domain, last verification time, revalidate, disable, receipt, and export actions. An empty canvas is not enough: `tileloadend` for at least one non-zero image transitions the client observation to rendered through a gateway event endpoint.

- [ ] **Step 6: Implement dev orchestration**

`scripts/dev.mjs` spawns `npm -w apps/gateway run dev` on 4174 and `npm -w apps/web run dev` on 5173, forwards SIGINT/SIGTERM, and exits nonzero if either child exits unexpectedly. Vite proxies `/api` to 4174.

- [ ] **Step 7: Verify responsive and accessible behavior**

Run:

```bash
npm test -- apps/web/src
npm run typecheck
npm run dev
```

Manual observations: desktop drag/drop reaches preview; mobile responsive mode exposes camera and image alternatives; keyboard reaches every primary action; status is expressed in text, not color only.

- [ ] **Step 8: Commit the runnable Web UI**

```bash
git add apps/web scripts/dev.mjs package-lock.json research.md PROGRESS.md
git commit -m "feat: add the map source import workspace"
```

---

### Task 8: Partial Success, Retry, Undo, Restart Recovery, and Open Export

**Files:**
- Create: `apps/gateway/src/import/batch-service.ts`
- Create: `apps/gateway/src/import/batch-service.test.ts`
- Create: `apps/gateway/src/routes/events.ts`
- Create: `apps/gateway/src/routes/export.ts`
- Create: `apps/gateway/src/export/oms.ts`
- Create: `apps/gateway/src/export/oms.test.ts`
- Create: `apps/web/src/import/ReceiptView.tsx`
- Create: `apps/web/src/sources/SourceActions.tsx`
- Create: `apps/web/src/export/ExportDialog.tsx`
- Create: `apps/web/src/export/export-flow.test.tsx`
- Modify: `apps/gateway/src/app.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `research.md`

**Interfaces:**
- Consumes: all implemented source, receipt, vault, probe, and UI APIs.
- Produces: AC-006, AC-009, and AC-010 behavior plus reliable JRN-003/JRN-004/JRN-006.

- [ ] **Step 1: Write partial-success and undo tests**

```ts
it('keeps per-layer truth and undoes only the current batch', async () => {
  const existing = await seedExistingSource();
  const receipt = await importBatch([successfulCandidate, missingCredentialCandidate, unsupportedCandidate]);
  expect(receipt.results.map((x) => x.status)).toEqual(['saved', 'needs-credential', 'unsupported']);
  await undoBatch(receipt.batchId);
  expect(await findSource(existing.id)).not.toBeNull();
  expect(await findSource(receipt.results[0].sourceId!)).toBeNull();
});
```

- [ ] **Step 2: Implement batch transactions and retry semantics**

Undo only sources created by the batch; append `undoneAt`; delete their secrets and cache; do not touch pre-existing sources. Retrying creates a new event and receipt result linked to the original candidate; it does not overwrite the failure. After three consecutive failures of the same category, return `retryable:false` and require user action.

- [ ] **Step 3: Write open export secret tests**

```ts
it('round-trips all non-secret fields and strips credentials', async () => {
  const exported = exportOms(sourceWithCredentialRef);
  expect(exported).not.toContain(sourceWithCredentialRef.credentialRef!);
  expect(exported).not.toMatch(/token|authorization/i);
  expect(parseOms(exported)).toMatchObject({ name: sourceWithCredentialRef.name, credentialRef: null });
});
```

- [ ] **Step 4: Implement `.oms.json` and QR export**

Export `{format:'OpenMapSource', formatVersion:1, source:<secret-free definition>, credentialRequired:boolean}`. QR text is `oms1:` plus base64url UTF-8 JSON and must fit 2,400 bytes; larger definitions offer file export only with the message that the QR capacity is exceeded. Use `qrcode` only in the browser to render the already secret-free text.

- [ ] **Step 5: Add restart recovery test**

Start gateway against a temp data directory, import/save a source, close app and DB, rebuild the app against the same directory, and assert source/receipt survive while the vault can still resolve the secret reference. Delete the source and assert the secret file is gone.

- [ ] **Step 6: Implement UI recovery and export actions**

Receipt view shows each state and next action. Revalidate starts from confirmed, not received. Delete displays exact affected source/cache/secret scope. Export defaults to secret-free file and QR; no checkbox can include raw credentials in V0.

- [ ] **Step 7: Run the recovery suite and commit**

Run: `npm test -- apps/gateway/src/import apps/gateway/src/export apps/web/src/export && npm run typecheck`

Expected: PASS.

```bash
git add apps/gateway apps/web research.md PROGRESS.md
git commit -m "feat: recover and export imported map sources"
```

---

### Task 9: Docker Pull-Up, Browser E2E, Compatibility Gate, and Local Acceptance

**Files:**
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.dockerignore`
- Create: `playwright.config.ts`
- Create: `e2e/import-ovmap.spec.ts`
- Create: `e2e/import-qr.spec.ts`
- Create: `e2e/security.spec.ts`
- Create: `e2e/restart.spec.ts`
- Create: `scripts/verify-v0.mjs`
- Create: `docs/runbook.md`
- Create: `docs/acceptance/v0-local.md`
- Modify: `apps/gateway/src/server.ts`
- Modify: `PROGRESS.md`
- Modify: `BLOCKED.md`
- Modify: `research.md`

**Interfaces:**
- Consumes: the complete V0 implementation.
- Produces: one-command localhost runtime, AC evidence, rollback/runbook, and a truthful `local-candidate` or `local-verified` decision.

- [ ] **Step 1: Write E2E tests against the controlled fixture server**

`import-ovmap.spec.ts` uploads a synthetic five-layer file, verifies zero fixture-server calls before confirmation, selects one layer, sets explicit EPSG:3857, confirms, observes a real colored fixture tile, refreshes, and sees the saved layer.

`security.spec.ts` imports configs for metadata IP, localhost, HTTP without approval, and a canary token. It asserts blocked state, zero upstream calls, and absence of the canary in downloaded receipts and captured logs.

`restart.spec.ts` uses the Docker volume, restarts the service, and verifies the layer and receipt survive.

- [ ] **Step 2: Add the real local compatibility E2E without skips**

`import-qr.spec.ts` reads `fixtures/local/tianditu-402.png`, uploads it, and asserts payload structure/preview fields without confirming or contacting the public source. A separate acceptance block reads a user-authorized QR path from `OMB_ACCEPTANCE_QR`; `scripts/verify-v0.mjs` fails with `AC-001 blocked: OMB_ACCEPTANCE_QR is required` when running the final acceptance command without it. Default CI does not invoke the real-source acceptance block; local-verified does.

- [ ] **Step 3: Create the production image**

```dockerfile
FROM node:24.20.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json vitest.config.ts ./
RUN npm ci
RUN npm run build

FROM node:24.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production OMB_HOST=0.0.0.0 OMB_PORT=4173 OMB_DATA_DIR=/app/data
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4173
CMD ["node", "apps/gateway/dist/server.js"]
```

The gateway serves `apps/web/dist` through `@fastify/static` only in production.

- [ ] **Step 4: Create localhost-only Compose**

```yaml
services:
  open-map-bridge:
    build: .
    ports:
      - "127.0.0.1:4173:4173"
    volumes:
      - omb-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4173/api/health').then(r=>{if(!r.ok)process.exit(1)})"]
      interval: 10s
      timeout: 3s
      retries: 6
volumes:
  omb-data:
```

- [ ] **Step 5: Run the full machine gate**

Run:

```bash
npm ci
npm run env:check
npm run fixtures:verify
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:compat
npm run build
npm run test:e2e
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:4173/api/health
```

Expected: every command succeeds; Compose health is healthy; no ignored or skipped tests. This is technical evidence, not AC-001 acceptance.

- [ ] **Step 6: Run the authorized real-source acceptance gate**

With a user-provided lawful QR stored outside Git and any required secret entered through the UI:

```bash
OMB_ACCEPTANCE_QR='/absolute/local/path/to/authorized-qr.png' node scripts/verify-v0.mjs
```

Expected observations: preview is secret-safe; user confirmation precedes network; at least one non-empty real tile renders; source becomes saved; browser refresh and container restart preserve it; receipt contains no secret. Save only screenshots/log excerpts that contain no secret or licensed tile redistribution.

- [ ] **Step 7: Test rollback and data preservation**

Document and execute: stop container → copy named volume to a timestamped local backup → start previous image tag → verify source list and receipt → restore current image. Do not delete the volume. Record exact image IDs and commands in `docs/acceptance/v0-local.md`.

- [ ] **Step 8: Update truthful stages**

If machine gates pass but `OMB_ACCEPTANCE_QR` is unavailable, mark implementation `local-candidate` and retain AC-001 in `BLOCKED.md`. Only mark `local-verified` after Step 6. Do not create/push a GitHub remote or deploy publicly in this task.

- [ ] **Step 9: Commit the runnable V0**

```bash
git add Dockerfile compose.yaml .dockerignore playwright.config.ts e2e scripts/verify-v0.mjs docs/runbook.md docs/acceptance/v0-local.md apps/gateway/src/server.ts PROGRESS.md BLOCKED.md research.md
git commit -m "feat: deliver the localhost V0 import journey"
```

---

## Plan Self-Review

### Spec coverage

| Spec/AC | Implemented by |
|---|---|
| QR camera/image and Ovi query parsing | Tasks 3, 7, 9 |
| `.ovmap` magic, bounded zlib, multi-layer parsing | Tasks 0, 2, 5, 9 |
| Unified open model and state truth | Task 1 |
| Zero-network preview and secret masking | Tasks 4, 5, 7, 9 |
| SSRF, redirect, open-proxy and decompression defenses | Tasks 2, 4, 6, 9 |
| User confirmation, minimal probe and real rendering | Tasks 6, 7, 9 |
| Persistence, receipts, retry, partial success and undo | Tasks 5, 8, 9 |
| Missing `.sdb` is `needs-data`, not success | Tasks 2, 5, 7 |
| Desktop/mobile equivalent paths | Tasks 3, 7, 9 |
| Open `.oms.json` and QR export | Tasks 1, 3, 8 |
| One-command localhost pull-up and rollback | Task 9 |

### Deliberate non-coverage

- Complete `.sdb` tile database import, enterprise collaboration, object formats, native shells, CAD, 3D, satellite change processing, and public deployment remain outside this approved V0 and require separate product specs.
- Unknown historical `.ovmap` families remain `unsupported` until a lawful differential fixture establishes their record layout. This plan implements one verified `record37-zlib` family and the adapter registry, not a false universal decoder.

### Type and naming consistency

- All import paths normalize to Task 1 `MapSourceDefinition` and `ImportLayerCandidate`.
- Gateway routes pass source UUIDs, never arbitrary upstream URLs.
- Credentials are referenced only through `credentialRef` and resolved by `SecretVault`.
- `decodeOviMap`, `decodeQrPayload`, `renderTileTemplate`, `validateUrlSyntax`, and `authorizeResolvedUrl` have one definition and one downstream meaning.
- The acceptance gate distinguishes synthetic CI, local compatibility, technical browser E2E, and authorized real-source acceptance.

### Stop conditions

- Any full secret in UI/log/receipt/export, pre-confirmation external request, private-address bypass, open proxy, decompression-limit bypass, fake rendered state, or loss of existing user data stops the task immediately.
- Three consecutive failures of the same acceptance cause the executor to preserve evidence in `BLOCKED.md`, revert or stop the affected slice, and continue only independent work.
