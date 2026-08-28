# Generic Four-Frame Historical Imagery Implementation Plan

> **2026-08-28 真值纠偏：** 本计划只保留四期选择算法；Ovi 年度请求目录已被 OMB-AUD-004 删除。操作者选择的 probe 日期不是源日期目录，生产 Ovi 适配器只能使用经授权来源核验并注入的日期。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user draw and save any map area, automatically select four requestable dates across the most recent 20 complete years, and render those dates in the existing aligned four-pane workspace before attempting the real Ovi bridge acceptance gate.

**Architecture:** Keep the existing source-agnostic `TemporalSourceAdapter`, Fastify gateway, OpenLayers web app, and atomic JSON state. Add a server-owned AOI creation contract, pure time-window/four-frame selection functions, geometry-driven map fitting, and a draw interaction. Ovi remains a removable loopback-only adapter; dual-lake presets become regression fixtures rather than core routing assumptions.

**Tech Stack:** TypeScript 7, React 19, OpenLayers 10, Fastify 5, Zod 4, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-08-27-generic-four-frame-design.md`

## Global Constraints

- Do not expose or persist QR payloads, upstream hosts, tokens, real tiles, or credentials.
- Ovi bridge configuration must remain process-owned and loopback-only; the browser cannot submit URL, host, token, port, or map type.
- The default range is the 20 most recent complete UTC calendar years.
- Four-frame selection must never duplicate one date to pretend four periods exist.
- Baoying and Gaoyou remain presets/fixtures and receive no core branching behavior.
- Stop build, tests, screenshots, and new cache writes if free space falls below 8 GiB.
- No cloud deployment, GitHub push, bulk imagery crawl, or production mutation is part of this plan.

---

### Task 1: Pure 20-year and four-frame date policy

**Files:**
- Create: `packages/temporal-source/src/four-frame.ts`
- Create: `packages/temporal-source/src/four-frame.test.ts`
- Modify: `packages/temporal-source/src/index.ts`

**Interfaces:**
- Produces: `completeYearWindow(currentYear: number): { from: string; to: string; fromYear: number; toYear: number }`
- Produces: `selectFourFrameDates(entries: readonly TemporalDateEntry[]): TemporalDateEntry[]`

- [ ] **Step 1: Write failing policy tests**

```ts
expect(completeYearWindow(2026)).toEqual({
  from: '2006-01-01', to: '2025-12-31', fromYear: 2006, toYear: 2025,
});
expect(selectFourFrameDates(catalog).map((entry) => entry.requestDate.slice(0, 4)))
  .toEqual(['2006', '2012', '2019', '2025']);
expect(selectFourFrameDates(threeEntries)).toHaveLength(3);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run packages/temporal-source/src/four-frame.test.ts`
Expected: FAIL because the module/exports do not exist.

- [ ] **Step 3: Implement the minimum pure policy**

Filter out `missing` and `failed`, prefer `available` to `unknown`, create four inclusive evenly spaced year anchors, and choose unique nearest candidates with deterministic earlier-date ties.

- [ ] **Step 4: Run focused and package tests**

Run: `npx vitest run packages/temporal-source/src/four-frame.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/temporal-source/src
git commit -m "feat: select four historical frames"
```

### Task 2: Server-owned arbitrary AOI creation

**Files:**
- Modify: `packages/aois/src/schema.ts`
- Modify: `packages/aois/src/schema.test.ts`
- Modify: `packages/aois/src/index.ts`
- Modify: `apps/gateway/src/routes/aois.ts`
- Modify: `apps/gateway/src/routes/aois.test.ts`
- Modify: `apps/gateway/src/storage/temporal-state.ts`

**Interfaces:**
- Produces: `createConfirmedAoi(input: { id: string; name: string; geometry: AoiGeometry; confirmedAt: string; provenance: string }): AreaOfInterest`
- Produces: `POST /api/aois` with body `{ name, geometry }`, returning a server-owned confirmed version 1 AOI.

- [ ] **Step 1: Write failing model and route tests**

```ts
expect(createConfirmedAoi({ id: 'area-1', name: '实验区域', geometry, confirmedAt, provenance: 'user-drawn-web' }))
  .toMatchObject({ id: 'area-1', version: 1, status: 'confirmed' });

const response = await app.inject({ method: 'POST', url: '/api/aois', payload: { name: '实验区域', geometry } });
expect(response.statusCode).toBe(201);
expect(response.json()).toMatchObject({ name: '实验区域', version: 1, status: 'confirmed' });
```

Also assert that missing names, invalid geometry, and client-supplied `id/version/status` cannot override server fields.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run packages/aois/src/schema.test.ts apps/gateway/src/routes/aois.test.ts`
Expected: FAIL because creation API/function is missing.

- [ ] **Step 3: Implement minimal creation path**

Use `randomUUID()` in the route, prefix IDs with `area-`, validate via `createConfirmedAoi`, append atomically, and return HTTP 201. Do not accept user-owned identifiers or metadata.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run packages/aois/src/schema.test.ts apps/gateway/src/routes/aois.test.ts apps/gateway/src/storage/temporal-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/aois/src apps/gateway/src/routes/aois.ts apps/gateway/src/routes/aois.test.ts apps/gateway/src/storage/temporal-state.ts
git commit -m "feat: create arbitrary map areas"
```

### Task 3: Generic API window and geometry-driven views

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/history/aoi-view.ts`
- Create: `apps/web/src/history/aoi-view.test.ts`
- Modify: `apps/web/src/history/MapPane.tsx`
- Modify: `apps/web/src/history/AoiEditor.tsx`
- Modify: `apps/web/src/history/SwipeCompare.tsx`

**Interfaces:**
- `HistoryApi.listDates(sourceId, aoiId, window?)`
- `HistoryApi.createAoi(input: { name: string; geometry: AoiGeometry })`
- `aoiExtent3857(aoi): [number, number, number, number]`

- [ ] **Step 1: Write failing extent and API tests**

Use a hand-derived non-lake polygon and assert the projected extent has finite increasing bounds. Extend the workspace API fixture so `listDates` receives the 2006–2025 window for current year 2026 and `createAoi` is callable.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run apps/web/src/history/aoi-view.test.ts apps/web/src/history/history-workspace.test.tsx`
Expected: FAIL because the helper and API contract are missing.

- [ ] **Step 3: Implement view fitting and API contract**

Use OpenLayers geometry transform/extent, call `view.fit(extent, { padding, maxZoom })` after map size is known, and remove all `aoi.id === 'baoying-lake'` zoom branches.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run apps/web/src/history/aoi-view.test.ts apps/web/src/history/history-workspace.test.tsx apps/web/src/history/SwipeCompare.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api apps/web/src/history
git commit -m "refactor: fit maps to arbitrary areas"
```

### Task 4: Draw-and-save UI plus automatic four frames

**Files:**
- Create: `apps/web/src/history/AoiCreator.tsx`
- Modify: `apps/web/src/history/HistoryWorkspace.tsx`
- Modify: `apps/web/src/history/history-workspace.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `e2e/temporal-lakes.spec.ts`

**Interfaces:**
- `AoiCreator` consumes `sourceId`, `dateId`, optional seed AOI, and `onCreate(name, geometry)`.
- `HistoryWorkspace` consumes `selectFourFrameDates` and switches to the returned newly created AOI.

- [ ] **Step 1: Write failing component test**

Inject a lightweight creator component in the workspace test, click “新建框选区域”, submit a non-lake polygon named “实验区”, and assert the new AOI becomes selected and four unique automatic date IDs render.

- [ ] **Step 2: Run component test and verify RED**

Run: `npx vitest run apps/web/src/history/history-workspace.test.tsx`
Expected: FAIL because the generic create flow and title do not exist.

- [ ] **Step 3: Implement minimal draw flow**

Add rectangle and polygon OpenLayers Draw interactions, a required name, cancel, and “使用此范围”. Keep the existing modify editor for version updates. Replace lake-specific title/copy/counts with generic source, area, 20-year window, and actual comparable-period facts.

- [ ] **Step 4: Add and run browser journey**

The E2E creates a non-lake rectangle through `POST /api/aois`, selects it in the UI, verifies four unique dates and four maps, then repeats the dual-lake preset checks as regression.

Run: `npm run test:e2e`
Expected: PASS in local synthetic mode without network.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src e2e/temporal-lakes.spec.ts
git commit -m "feat: draw any historical comparison area"
```

### Task 5: Ovi real-source compatibility gate

**Files:**
- Modify: `scripts/probe-ovi-bridge.mjs`
- Modify: `scripts/probe-ovi-bridge.test.mjs`
- Modify: `docs/runbook.md`
- Modify: `BLOCKED.md`
- Modify: `PROGRESS.md`
- Modify: `research.md`

**Interfaces:**
- Probe accepts optional `OMB_PROBE_LONGITUDE`, `OMB_PROBE_LATITUDE`, and four comma-separated `OMB_PROBE_DATES`; defaults stay non-secret and safe.
- Probe output contains only requested date, dimensions, normalized hash, and observed time.

- [ ] **Step 1: Write failing script test**

Prove four distinct requested dates are required for the four-frame acceptance mode, invalid coordinates fail before fetch, and identical normalized hashes fail the gate.

- [ ] **Step 2: Run script test and verify RED**

Run: `node --test scripts/probe-ovi-bridge.test.mjs`
Expected: FAIL because configurable four-date probing is missing.

- [ ] **Step 3: Implement configurable safe probe**

Validate longitude/latitude and exactly four ISO dates; fetch one tile coordinate per date; never print URLs, ports, map type, upstream details, or image bytes.

- [ ] **Step 4: Perform reversible local interface check**

Record the pre-state, enable the official client third-party interface, inspect listening sockets, and immediately disable it if not loopback-only. If loopback-safe, run the four-date probe against the already authorized source. Do not save tiles.

- [ ] **Step 5: Record truthful outcome and commit**

Update `PROGRESS.md`, `BLOCKED.md`, and `research.md` with `real-source passed` or the exact blocked gate. Do not promote synthetic evidence.

```bash
git add scripts docs/runbook.md PROGRESS.md BLOCKED.md research.md
git commit -m "test: gate real historical imagery"
```

### Task 6: Full verification and local experience

**Files:**
- Modify: `goal.md`
- Modify: `research.md`
- Modify: `PROGRESS.md`
- Modify: `BLOCKED.md`

- [ ] **Step 1: Run full gates**

```bash
df -h /System/Volumes/Data
npm run env:check
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Expected: all commands exit 0 and free space remains at least 8 GiB.

- [ ] **Step 2: Review the approved design line by line**

Record what is `local-verified`, what remains `real-source blocked`, and what has not reached `main/deployed/accepted`.

- [ ] **Step 3: Start the loopback-only experience server**

Run `npm run dev` with Ovi environment only when the real bridge gate passed; otherwise start synthetic mode and label it explicitly.

- [ ] **Step 4: Final commit**

```bash
git add goal.md research.md PROGRESS.md BLOCKED.md docs/superpowers
git commit -m "docs: define generic four-frame journey"
```
