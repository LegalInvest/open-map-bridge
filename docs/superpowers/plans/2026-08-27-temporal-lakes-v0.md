# Temporal Lakes V0 Implementation Plan

> **2026-08-28 真值纠偏：** 下文历史步骤中关于 `annual-catalog` 的内容已被 OMB-AUD-004 取代。生产 Ovi 适配器只能公开经授权来源核验并注入的日期；没有已验证目录时，`listDates` 必须明确失败，未知 `dateId` 必须在零网络请求下返回未找到。操作者选择的 probe 日期只是测试输入，不是日期目录。已删除的年度目录生成器不得重建。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull up a localhost Web application that compares aligned 2006–2025 imagery for user-confirmed Baoying Lake and Gaoyou Lake AOIs, first against a deterministic synthetic temporal source and then through a loopback-only official Ovital Web-tile bridge.

**Architecture:** A Fastify gateway exposes registered temporal sources, AOI versions, comparison receipts, and same-origin dated tiles. Pure TypeScript packages own date truth and GeoJSON rules. A React/OpenLayers UI renders four independent maps driven by one shared `ViewState`, supports a two-layer swipe mode and timeline playback, and never receives upstream credentials or arbitrary tile URLs.

**Tech Stack:** Node.js 24–26, npm workspaces, TypeScript 7.0.2, React 19.2.8, Vite 8.2.2, OpenLayers 10.10.0, Fastify 5.12.1, Zod 4.4.3, Vitest 4.1.11, Testing Library, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-27-temporal-lakes-v0-design.md`, implementing `goal.md` JRN-007–JRN-010 and AC-011–AC-016.

## Global Constraints

- Read `goal.md`, `research.md`, `PROGRESS.md`, `BLOCKED.md`, and the temporal design before every task.
- Work in an isolated Git worktree. Do not edit or overwrite the official Ovital application or its map data.
- Bind every OpenMapBridge HTTP listener to `127.0.0.1`; an Ovital listener reachable on non-loopback addresses fails the compatibility gate.
- Never commit the user QR, Ovital host/key/auth data, real tiles, caches, app databases, or screenshots containing licensed imagery.
- Synthetic tiles prove UI behavior only. `local-verified` for the real-source path requires AC-011 and both AOIs must be confirmed by the user before `accepted`.
- Preserve `requestDate`, `captureDate`, and `availability` separately. A missing `captureDate` remains `null` and is displayed as unknown.
- Use TDD for every behavior: write the test, observe the expected failure, implement the minimum, rerun the focused test, then run the package suite.
- Do not bulk-download 20 years of lake tiles. The browser requests only visible tiles; the compatibility probe requests one tile per tested date.
- Stop installs/builds below 5 GiB free disk and stop adding cache entries below 2 GiB. The V0 cache ceiling is 256 MiB.
- Pollution, overfishing/aquaculture, and overdevelopment remain hypotheses until an observation is linked to an independent source.

---

## File Structure

```text
open-map-bridge/
├── apps/
│   ├── gateway/src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── temporal/{registry,synthetic-adapter,ovi-bridge}.ts
│   │   ├── aois/repository.ts
│   │   ├── comparisons/repository.ts
│   │   └── routes/{temporal,aois,comparisons}.ts
│   └── web/src/
│       ├── App.tsx
│       ├── api/client.ts
│       └── history/{HistoryWorkspace,MapGrid,MapPane,AoiEditor,Timeline,ObservationPanel}.tsx
├── packages/
│   ├── temporal-source/src/
│   └── aois/src/
├── fixtures/synthetic/temporal-manifest.json
├── e2e/temporal-lakes.spec.ts
├── scripts/{verify-environment,probe-ovi-bridge}.mjs
└── docs/acceptance/temporal-lakes-local.md
```

## Interface Ledger

```ts
export interface TemporalDateEntry {
  id: string;
  requestDate: string;
  captureDate: string | null;
  precision: 'capture-date' | 'request-date-only';
  availability: 'available' | 'missing' | 'unknown' | 'failed';
  provenance: string;
}

export interface TemporalSourceAdapter {
  probe(): Promise<{ ok: boolean; detail: string }>;
  listDates(input: { aoiId: string; from: string; to: string }): Promise<TemporalDateEntry[]>;
  tile(input: { dateId: string; z: number; x: number; y: number }): Promise<{
    status: number;
    contentType: string;
    body: Uint8Array;
  }>;
}

export interface ViewState {
  center: [number, number];
  zoom: number;
  rotation: number;
  projection: 'EPSG:3857';
}
```

---

### Task 0: Isolated Workspace and Reproducible Skeleton

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `scripts/verify-environment.mjs`
- Create: `scripts/verify-environment.test.mjs`
- Create: `packages/temporal-source/package.json`
- Create: `packages/temporal-source/tsconfig.json`
- Create: `packages/aois/package.json`
- Create: `packages/aois/tsconfig.json`
- Create: `apps/gateway/package.json`
- Create: `apps/gateway/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`

**Interfaces:**
- Consumes: approved docs and current machine state.
- Produces: `npm run env:check`, exact dependency lock, and resolvable workspaces for all later tasks.

- [ ] **Step 1: Write the failing environment test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEnvironment } from './verify-environment.mjs';

test('requires supported Node and five GiB free', () => {
  assert.equal(evaluateEnvironment({ nodeMajor: 23, freeBytes: 9n * 1024n ** 3n }).ok, false);
  assert.equal(evaluateEnvironment({ nodeMajor: 26, freeBytes: 4n * 1024n ** 3n }).ok, false);
  assert.deepEqual(evaluateEnvironment({ nodeMajor: 26, freeBytes: 5n * 1024n ** 3n }), { ok: true, errors: [] });
});
```

- [ ] **Step 2: Run the test and observe `ERR_MODULE_NOT_FOUND`**

Run: `node --test scripts/verify-environment.test.mjs`

- [ ] **Step 3: Implement the checker**

```js
export function evaluateEnvironment({ nodeMajor, freeBytes }) {
  const errors = [];
  if (nodeMajor < 24 || nodeMajor > 26) errors.push(`unsupported Node ${nodeMajor}`);
  if (freeBytes < 5n * 1024n ** 3n) errors.push('at least 5 GiB free disk is required');
  return { ok: errors.length === 0, errors };
}
```

The executable branch reads `df -k /`, evaluates the current Node major, prints `environment-ok` on success, and exits 1 with the errors otherwise.

- [ ] **Step 4: Add exact root dependencies**

Root scripts are `env:check`, `test`, `typecheck`, `dev`, `build`, and `test:e2e`. Pin: TypeScript `7.0.2`, Vitest `4.1.11`, Vite `8.2.2`, React/ReactDOM `19.2.8`, OpenLayers `10.10.0`, Fastify `5.12.1`, Zod `4.4.3`, Testing Library React `16.3.2`, user-event `14.6.6`, jsdom `30.0.1`, Playwright `1.62.1`, tsx `4.23.12`, and `@types/node` `26.4.0`.

- [ ] **Step 5: Install and verify**

Run: `npm install && npm run env:check && npm test && npm run typecheck`

Expected: environment test passes; empty package typechecks pass; no skipped tests.

- [ ] **Step 6: Commit the skeleton**

```bash
git add .gitignore .nvmrc package.json package-lock.json tsconfig.base.json vitest.config.ts scripts packages/*/package.json packages/*/tsconfig.json apps/*/package.json apps/*/tsconfig.json
git commit -m "chore: scaffold temporal lakes workspace"
```

---

### Task 1: Temporal Date Truth and Adapter Contract

**Files:**
- Create: `packages/temporal-source/src/index.ts`
- Create: `packages/temporal-source/src/schema.ts`
- Create: `packages/temporal-source/src/annual-catalog.ts`
- Create: `packages/temporal-source/src/annual-catalog.test.ts`
- Create: `packages/temporal-source/src/view-state.ts`
- Create: `packages/temporal-source/src/view-state.test.ts`

**Interfaces:**
- Produces: `TemporalDateEntry`, `TemporalSourceAdapter`, `buildAnnualRequestCatalog()`, `parseTemporalDateEntry()`, `normalizeViewState()`.

- [ ] **Step 1: Write the date-truth test**

```ts
it('builds exactly 2006–2025 as request-date-only without inventing capture dates', () => {
  const dates = buildAnnualRequestCatalog(2006, 2025);
  expect(dates).toHaveLength(20);
  expect(dates[0]).toMatchObject({ requestDate: '2006-06-30', captureDate: null, precision: 'request-date-only' });
  expect(dates[19]).toMatchObject({ requestDate: '2025-06-30', captureDate: null, precision: 'request-date-only' });
});

it('preserves a real capture date independently', () => {
  expect(parseTemporalDateEntry({
    id: 'scene-2018-07-13', requestDate: '2018-07-15', captureDate: '2018-07-13',
    precision: 'capture-date', availability: 'available', provenance: 'fixture',
  }).captureDate).toBe('2018-07-13');
});
```

- [ ] **Step 2: Run and observe missing exports**

Run: `npm exec vitest -- run packages/temporal-source/src/annual-catalog.test.ts`

- [ ] **Step 3: Implement the schema and annual catalog**

Use Zod ISO date strings, non-empty IDs/provenance, and the exact availability/precision enums. `buildAnnualRequestCatalog(from, to)` rejects `from > to`, ranges longer than 100 years, and emits June 30 entries with stable IDs `annual-YYYY`.

- [ ] **Step 4: Write and implement ViewState validation**

```ts
it('normalizes finite Web Mercator state and rejects NaN', () => {
  expect(normalizeViewState({ center: [13270000, 3890000], zoom: 10, rotation: 0, projection: 'EPSG:3857' })).toEqual({
    center: [13270000, 3890000], zoom: 10, rotation: 0, projection: 'EPSG:3857',
  });
  expect(() => normalizeViewState({ center: [NaN, 0], zoom: 10, rotation: 0, projection: 'EPSG:3857' })).toThrow();
});
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/temporal-source && npm run typecheck`

```bash
git add packages/temporal-source
git commit -m "feat: define temporal source truth"
```

---

### Task 2: Versioned Lake AOIs

**Files:**
- Create: `packages/aois/src/index.ts`
- Create: `packages/aois/src/schema.ts`
- Create: `packages/aois/src/presets.ts`
- Create: `packages/aois/src/schema.test.ts`
- Create: `packages/aois/src/presets.test.ts`

**Interfaces:**
- Produces: `AreaOfInterest`, `parseAreaOfInterest()`, `createNextAoiVersion()`, `lakeAoiPresets`.

- [ ] **Step 1: Write polygon and version tests**

```ts
it('rejects an unclosed polygon and preserves the old version', () => {
  expect(() => parseAreaOfInterest({
    id: 'baoying-lake', version: 1, name: '宝应湖', status: 'approximate', crs: 'EPSG:4326',
    geometry: { type: 'Polygon', coordinates: [[[119.1, 33.0], [119.4, 33.0], [119.4, 33.3]]] },
    provenance: 'user-screenshot-2026-08-27', confirmedAt: null,
  })).toThrow(/closed/i);
});

it('creates a confirmed version without mutating the approximate source', () => {
  const next = createNextAoiVersion(lakeAoiPresets[0], lakeAoiPresets[0].geometry, '2026-08-27T12:00:00.000Z');
  expect(next).toMatchObject({ version: 2, status: 'confirmed', confirmedAt: '2026-08-27T12:00:00.000Z' });
  expect(lakeAoiPresets[0].version).toBe(1);
});
```

- [ ] **Step 2: Run and observe missing AOI implementation**

Run: `npm exec vitest -- run packages/aois/src`

- [ ] **Step 3: Implement strict EPSG:4326 GeoJSON validation**

Require Polygon/MultiPolygon, closed rings, at least four positions per ring, finite longitude `[-180,180]`, latitude `[-90,90]`, no consecutive duplicate positions, and an upper bound of 2,000 positions. Preserve provenance and never accept screenshot pixels as coordinates.

- [ ] **Step 4: Add two clearly approximate presets**

`baoying-lake` uses a conservative reference envelope around longitude `119.10–119.47`, latitude `33.02–33.33`; `gaoyou-lake` uses `118.95–119.52`, `32.45–33.08`. Both are `approximate`, source `user-screenshot-2026-08-27`, and must be edited/confirmed before accepted. These envelopes are navigation aids, not claimed lake boundaries.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- packages/aois && npm run typecheck`

```bash
git add packages/aois
git commit -m "feat: add versioned lake AOIs"
```

---

### Task 3: Synthetic Temporal Gateway and Safe Ovi Bridge

**Files:**
- Create: `apps/gateway/src/app.ts`
- Create: `apps/gateway/src/server.ts`
- Create: `apps/gateway/src/temporal/registry.ts`
- Create: `apps/gateway/src/temporal/synthetic-adapter.ts`
- Create: `apps/gateway/src/temporal/synthetic-adapter.test.ts`
- Create: `apps/gateway/src/temporal/ovi-bridge.ts`
- Create: `apps/gateway/src/temporal/ovi-bridge.test.ts`
- Create: `apps/gateway/src/routes/temporal.ts`
- Create: `apps/gateway/src/routes/temporal.test.ts`
- Create: `apps/gateway/src/routes/aois.ts`
- Create: `apps/gateway/src/routes/comparisons.ts`
- Create: `scripts/probe-ovi-bridge.mjs`

**Interfaces:**
- Produces: `/api/health`, `/api/temporal/sources`, `/api/temporal/sources/:id/dates`, `/api/temporal/tiles/:sourceId/:dateId/:z/:x/:y`, `/api/aois`, and comparison frame-event routes.

- [ ] **Step 1: Write the synthetic adapter test**

```ts
it('serves distinct same-origin SVG tiles for two years', async () => {
  const adapter = new SyntheticTemporalAdapter();
  const a = await adapter.tile({ dateId: 'scene-2006', z: 8, x: 212, y: 102 });
  const b = await adapter.tile({ dateId: 'scene-2025', z: 8, x: 212, y: 102 });
  expect(a.status).toBe(200);
  expect(a.contentType).toBe('image/svg+xml');
  expect(Buffer.from(a.body).equals(Buffer.from(b.body))).toBe(false);
});
```

- [ ] **Step 2: Implement deterministic synthetic dates and tiles**

Return 20 exact capture dates on July 15 from 2006–2025. The SVG includes the year, z/x/y, a year-derived color, a fixed shoreline curve, and a visibly growing synthetic land polygon. It is labeled `SYNTHETIC` inside the image so screenshots cannot be mistaken for real evidence.

- [ ] **Step 3: Write Ovi loopback and URL tests**

```ts
it.each(['http://0.0.0.0:19991', 'http://192.168.1.9:19991', 'https://example.com'])('rejects non-loopback %s', (baseUrl) => {
  expect(() => new OviBridgeAdapter({ baseUrl, mapType: 200 })).toThrow(/loopback/i);
});

it('builds the documented dated tile path without exposing auth', () => {
  const adapter = new OviBridgeAdapter({ baseUrl: 'http://127.0.0.1:19991', mapType: 200 });
  expect(adapter.pathFor({ requestDate: '2018-06-30', z: 8, x: 212, y: 102 }))
    .toBe('/getomap_200_8_212_102_jpg_20180630.jpg');
});
```

- [ ] **Step 4: Implement OviBridge with request-date-only catalog**

Allow only `127.0.0.1` and `[::1]`, integer map type, integer tile coordinates, and known `annual-YYYY` IDs. Use injected `fetch`, 10-second abort, `redirect:'error'`, 5 MiB response cap, and image content types only. Never accept base URL or map type from a browser request.

- [ ] **Step 5: Write route open-proxy tests**

Fastify `inject()` proves unknown source/date IDs return 404, arbitrary `url`, `host`, `token`, and `mapType` query parameters return 400, synthetic tiles work, and source listing says `synthetic` or `ovi-bridge` explicitly.

- [ ] **Step 6: Implement routes, atomic local persistence, and frame receipts**

`AoiRepository` and `ComparisonRepository` load versioned JSON arrays from `data/temporal-state.json`, write a complete temporary file with mode `0600`, `fsync`, then rename atomically. Tests reopen a new repository instance and prove AOI versions, selected dates, ViewState, and frame receipts survive; corrupt JSON fails closed and preserves the original file. These repositories contain no QR payload, host, key, tile body, or credential. The later SQLite task may migrate this documented JSON schema, but restart recovery is already required in this slice.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- apps/gateway && npm run typecheck`

```bash
git add apps/gateway scripts/probe-ovi-bridge.mjs
git commit -m "feat: serve safe temporal sources"
```

---

### Task 4: Four-Pane History Workspace and AOI Editing

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/history/HistoryWorkspace.tsx`
- Create: `apps/web/src/history/MapGrid.tsx`
- Create: `apps/web/src/history/MapPane.tsx`
- Create: `apps/web/src/history/AoiEditor.tsx`
- Create: `apps/web/src/history/history-workspace.test.tsx`
- Create: `apps/web/src/history/view-sync.ts`
- Create: `apps/web/src/history/view-sync.test.ts`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Produces: UI-005/006 and browser implementation of AC-012–AC-014 against the synthetic source.

- [ ] **Step 1: Write the visible-state component test**

```tsx
it('shows four independent dates and does not call a missing frame loaded', async () => {
  render(<HistoryWorkspace api={fakeApi({ failedPane: 2 })} />);
  expect(await screen.findByRole('heading', { name: '双湖历史影像' })).toBeVisible();
  expect(screen.getAllByLabelText('面板日期')).toHaveLength(4);
  expect(await screen.findByText('面板 3：加载失败')).toBeVisible();
  expect(screen.getByText('面板 1：已加载')).toBeVisible();
});
```

- [ ] **Step 2: Implement summary-first layout and source truth labels**

Top controls show AOI, 2006–2025, source kind, date precision, 1/2/4 panes, swipe, and play. Each pane shows request date, capture date or `实际拍摄日期未知`, source, loaded/failed tile counts, and independent state.

- [ ] **Step 3: Write shared ViewState coordinator tests**

```ts
it('broadcasts one normalized state without feeding the origin back', () => {
  const sync = createViewSync();
  const a: ViewState[] = [];
  const b: ViewState[] = [];
  sync.subscribe('a', (state) => a.push(state));
  sync.subscribe('b', (state) => b.push(state));
  sync.publish('a', { center: [13270000, 3890000], zoom: 9, rotation: 0, projection: 'EPSG:3857' });
  expect(a).toHaveLength(0);
  expect(b).toHaveLength(1);
});
```

- [ ] **Step 4: Implement four OpenLayers maps**

Each `MapPane` owns its `ol/Map` and `ol/View`, but publishes `moveend` ViewState through the coordinator. Subscribers apply center/zoom/rotation with a suppression flag. Tile URLs contain only registered source/date IDs. Add AOI vector/mask layers and fit the selected approximate preset on first selection.

- [ ] **Step 5: Implement AOI edit/confirm flow**

Use OpenLayers `Modify` and `Draw`. Save is disabled for invalid geometry. Confirm calls `PUT /api/aois/:id`, receives version +1 and `confirmed`, and updates every pane. Cancel restores the last server version.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- apps/web && npm run typecheck && npm run build`

```bash
git add apps/web
git commit -m "feat: compare aligned lake imagery"
```

---

### Task 5: Swipe, Timeline Playback, and Evidence Levels

**Files:**
- Create: `apps/web/src/history/Timeline.tsx`
- Create: `apps/web/src/history/Timeline.test.tsx`
- Create: `apps/web/src/history/SwipeCompare.tsx`
- Create: `apps/web/src/history/ObservationPanel.tsx`
- Create: `apps/web/src/history/ObservationPanel.test.tsx`
- Modify: `apps/web/src/history/HistoryWorkspace.tsx`
- Modify: `apps/web/src/history/MapGrid.tsx`

**Interfaces:**
- Produces: AC-015/016 behavior and two-layer swipe.

- [ ] **Step 1: Write playback failure-truth tests**

```tsx
it('keeps a missing year visible and resumes at the next available frame', async () => {
  const user = userEvent.setup();
  render(<Timeline dates={datesWith2012Missing} intervalMs={10} onFrame={onFrame} />);
  await user.click(screen.getByRole('button', { name: '播放变化' }));
  expect(await screen.findByText('2012：缺失')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '下一可用帧' }));
  expect(onFrame).toHaveBeenLastCalledWith('scene-2013');
});
```

- [ ] **Step 2: Implement deterministic playback state**

Use one timer, explicit `stopped|playing|paused`, 0.5×/1×/2× speeds, and cleanup on unmount. A frame is recorded loaded only after its pane reports at least one non-empty tile; timer progression alone never creates a loaded receipt.

- [ ] **Step 3: Implement OpenLayers swipe**

Render two dated tile layers in one map. Clip the top layer in `prerender`/`postrender` using a keyboard-accessible range control. The same source/date truth labels remain visible outside the canvas.

- [ ] **Step 4: Write and implement causality guardrail**

```tsx
it('cannot save a definite pollution cause without an independent source', async () => {
  const user = userEvent.setup();
  render(<ObservationPanel />);
  await user.selectOptions(screen.getByLabelText('可能原因'), 'pollution');
  expect(screen.getByText('假设：影像不能单独证明污染')).toBeVisible();
  expect(screen.getByRole('button', { name: '标记为有证据支持' })).toBeDisabled();
});
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- apps/web/src/history && npm run typecheck && npm run build`

```bash
git add apps/web/src/history
git commit -m "feat: play and review temporal evidence"
```

---

### Task 6: Browser E2E, Local Pull-Up, and Real Ovi Compatibility Gate

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/temporal-lakes.spec.ts`
- Create: `scripts/dev.mjs`
- Create: `docs/runbook.md`
- Create: `docs/acceptance/temporal-lakes-local.md`
- Modify: `PROGRESS.md`
- Modify: `BLOCKED.md`
- Modify: `research.md`

**Interfaces:**
- Produces: one-command localhost runtime and truthful `local-candidate` or `local-verified` evidence.

- [ ] **Step 1: Write E2E against the synthetic source**

The test selects each lake, observes `approximate`, chooses four years, waits for four non-empty `SYNTHETIC` tiles, pans one map, asserts all four ViewState receipts match, forces one date to 404, and verifies only that pane fails. It then plays across a missing year and checks the missing marker remains visible.

- [ ] **Step 2: Implement dev orchestration**

`npm run dev` starts Fastify on `127.0.0.1:4174` and Vite on `127.0.0.1:5173`, forwards termination signals, and exits nonzero if either child dies. Vite proxies `/api` to the gateway.

- [ ] **Step 3: Run the full synthetic gate**

Run:

```bash
npm run env:check
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Expected: all commands pass, no skips, and the browser journey records both lake presets separately. This reaches at most `local-candidate`.

- [ ] **Step 4: Inspect and enable the official listener only if loopback-only**

Record listening sockets before/after. If the official app exposes `0.0.0.0` or a LAN address, immediately turn the service back off and write AC-011 blocked. If it exposes only `127.0.0.1`/`::1`, run `node scripts/probe-ovi-bridge.mjs` for one tile in two dates at one AOI center.

- [ ] **Step 5: Verify real response truth**

AC-011 requires both responses to be decodable non-empty images and have different SHA-256 hashes. A 200 with identical/blank bodies, a client import screen, or a date slider is insufficient. Store only status category, dimensions, hashes, requested dates, and timestamp in `docs/acceptance/temporal-lakes-local.md`.

- [ ] **Step 6: Pull up and open the experience**

Leave `npm run dev` running on localhost, open `http://127.0.0.1:5173`, and run the real Baoying and Gaoyou journeys when AC-011 passes. Keep AOIs approximate until the user edits and confirms them.

- [ ] **Step 7: Update stages and commit**

```bash
git add playwright.config.ts e2e scripts/dev.mjs docs/runbook.md docs/acceptance/temporal-lakes-local.md PROGRESS.md BLOCKED.md research.md
git commit -m "feat: pull up temporal lakes V0"
```

---

## Plan Self-Review

- Spec coverage: Task 1 covers date truth; Task 2 AOI versions; Task 3 adapters and safe gateway; Task 4 four-pane alignment; Task 5 swipe/playback/causality; Task 6 synthetic and real acceptance.
- No placeholder source or secret is committed. The Ovi base URL and map type are local operator configuration, never browser input.
- `requestDate` and `captureDate` names match the design in every task.
- Synthetic E2E and real Ovi acceptance are separate gates.
- MP4/GIF export is deliberately after AC-011–015 stability in `goal.md` SLICE-TEMPORAL-005; the first runnable V0 provides real-time playback without bulk fetching.
- Stop immediately on non-loopback listener, secret exposure, arbitrary URL proxy, fake capture dates, fake loaded frames, or AOI version drift.
