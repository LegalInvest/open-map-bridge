# OpenMapBridge

OpenMapBridge is an open-source, clean-room map-source bridge. It imports legally held Ovi-compatible QR codes and `.ovmap` files into an inspectable open definition, then exposes capability-gated local APIs for map rendering, temporal imagery comparison, and secondary development.

> This project is independent and is not affiliated with, endorsed by, or distributed by Beijing Ovital Technology or the Ovi application. “Ovi” is used only to describe compatibility boundaries.

## What works today

- Browser QR image upload and camera scanning.
- Bounded parsing for the verified `ovobj` query family and `OviO + record37-zlib` `.ovmap` family.
- Secret-safe previews, explicit authorization, confirmed-source persistence, and import receipts.
- An optional AES-256-GCM local credential vault: the main state stores only a same-source opaque reference, while the Web UI can add or remove bounded query/header credentials without echoing values.
- A persisted, deduplicated, zero-network source-readiness job with a four-step operator dashboard and explicit blockers.
- A source-agnostic temporal adapter, arbitrary AOI drawing, aligned 1/2/4-panel comparison, swipe mode, and playback.
- A V1 developer API and TypeScript SDK with server-enforced app tokens/permissions, strict manifests, capability negotiation, and authenticated local tile fetches.

Current truth matters: a parsed or confirmed source is not automatically reachable or rendered. Imported sources remain `metadata-only` until URL/IP policy, credentials, probing, and a runtime adapter have all passed.

The current readiness job performs static checks only. When the vault is enabled, its credential step verifies that the referenced encrypted entry actually exists; it never reads a non-empty reference as proof by itself. The job still makes no DNS or HTTP request, so a completed static job does not prove that upstream tiles work.

## Quick start

Requirements: Node.js 24–26, npm 11, and at least 8 GiB free disk space.

```bash
npm install
npm run env:check
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The local gateway listens on `127.0.0.1:4174`. `npm run dev` generates an ephemeral process token when none is supplied and shares it only with the gateway and the local Vite proxy; it is not bundled into browser JavaScript. Set `OMB_GATEWAY_TOKEN` explicitly before startup only when direct CLI access is required.

The credential vault is disabled unless both `OMB_VAULT_PATH` and an unpadded base64url 32-byte `OMB_VAULT_KEY` are configured. Keep the key outside Git and ordinary state files; losing it intentionally makes existing encrypted entries unreadable. See [`docs/runbook.md`](docs/runbook.md) for the local setup and recovery boundary.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Build and smoke-test the standalone production artifact:

```bash
npm run build
npm run test:production
```

The output is `dist/open-map-bridge/`; it runs without repository TypeScript sources. The supported deployment is loopback-only behind the supplied nginx token-injection boundary. See [`docs/deployment.md`](docs/deployment.md) before installing it on a server.

The authorized QR gate is local-only and requires a user-controlled image path:

```bash
OMB_ACCEPTANCE_QR=/absolute/path/to/authorized-qr.png npm run test:e2e:authorized-qr
```

Do not commit real QR payloads, credentials, private `.ovmap` files, tile caches, or generated imagery. `fixtures/local/` is ignored except for its README.

## Secondary development

The public V1 contract intentionally does not expose upstream hosts, URL templates, query parameters, credential references, provenance hashes, compatibility extensions, or original import bytes.

Direct SDK access requires a separate app ID/token entry in `OMB_DEVELOPER_TOKENS_JSON`. The gateway binds that token to server-side read permissions; a client manifest cannot grant itself additional access. Never reuse or publish the Web process token.

- Guide: [`docs/developer-sdk.md`](docs/developer-sdk.md)
- TypeScript example: [`packages/developer-sdk/examples/history-consumer.ts`](packages/developer-sdk/examples/history-consumer.ts)
- Source directory: `GET /api/v1/developer/sources`
- Date catalog: `GET /api/v1/developer/sources/:id/dates`
- Tiles: `GET /api/v1/developer/sources/:id/tiles/:dateId/:z/:x/:y`

## Automation API

- Process directory: `GET /api/v1/processes`
- Start/deduplicate readiness: `POST /api/v1/processes/source-readiness/execution`
- Job list/detail: `GET /api/v1/jobs`, `GET /api/v1/jobs/:id`

Execution accepts only `{ "sourceId": "..." }`; it never accepts an upstream URL, host, token, or bypass flag. Resume, cancel, real probing, and one-click four-frame generation are not implemented yet.

## Project truth and handoff

- [`HANDOFF.md`](HANDOFF.md): zero-context GitHub handoff, exact evidence stages, merge boundary, and safest next action.
- [`goal.md`](goal.md): approved product and acceptance truth.
- [`research.md`](research.md): evidence, implementation map, and stage ledger.
- [`PROGRESS.md`](PROGRESS.md): current checkpoint and safest next action.
- [`BLOCKED.md`](BLOCKED.md): unresolved real-source and safety gates.
- [`docs/问题账本.md`](docs/问题账本.md): prioritized audit findings, per-issue acceptance, repair batches, and evidence stages.
- [`docs/技术交底书.md`](docs/技术交底书.md): timestamped technical disclosure, architecture, technical features, embodiments, and evidence boundary.
- [`docs/可视化与自动化路线图.md`](docs/可视化与自动化路线图.md): observable workflow, one-click four-frame automation, human gates, and staged acceptance plan.
- [`docs/automation-api.md`](docs/automation-api.md): the implemented zero-network readiness job contract and its explicit non-goals.
- [`docs/runbook.md`](docs/runbook.md): local operations.
- [`docs/merge-readiness.md`](docs/merge-readiness.md): capability ownership matrix for the future cross-project integration.

Stages are reported separately: `discovered → local-candidate → local-verified → main → deployed → accepted`. A passing test, HTTP 200, or synthetic source does not prove a real Ovi source has rendered.

After a material architecture, protocol, security, data-contract, or runtime-capability change, update the disclosure and its append-only log:

```bash
npm run disclosure:update -- "describe the technical change"
npm run disclosure:check
```

CI rejects a stale source fingerprint.

## Safety and legal boundary

- Use only map sources and data you are authorized to access.
- Do not bypass memberships, device binding, authentication, licensing, or rate limits.
- Do not publish shared tokens, private source URLs, or offline tile databases.
- The gateway is local-only, accepts exact loopback Host/Origin values, requires scoped Bearer authentication and CSRF evidence, and must never become an arbitrary URL proxy.
- Unknown formats and capabilities fail closed.

See [`SECURITY.md`](SECURITY.md) before reporting a source-import or proxy vulnerability.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
