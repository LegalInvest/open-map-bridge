# Production deployment contract

The production artifact is `dist/open-map-bridge/`. It contains a standalone Node gateway bundle, the built Web assets, a deterministic build manifest, legal notices, and loopback-only systemd/nginx templates. It does not require repository TypeScript sources at runtime.

## Trust boundary

The supported first deployment is private and loopback-only:

- gateway: `127.0.0.1:4174`;
- nginx UI: `127.0.0.1:8080`;
- operator access: SSH tunnel such as `ssh -L 8080:127.0.0.1:8080 <approved-host-alias>`;
- nginx injects the gateway bearer token from a root-owned `0600` include; the token never enters Web assets;
- a public domain is not authorized by this contract. It requires an outer identity layer and a separate threat-model review before changing listeners.

## Build and local artifact acceptance

```bash
npm ci
npm run env:check
npm run test
npm run typecheck
npm run build
npm run test:production
```

`test:production` copies the artifact to an isolated temporary release directory, starts only `server.mjs`, verifies authenticated health plus unauthenticated rejection and atomic persistence, sends `SIGTERM`, requires exit code 0 and structured lifecycle logs, then removes the temporary state. It does not access any map-source host.

## Versioned installation

1. Copy the artifact into `/opt/open-map-bridge/releases/<git-sha>/` without overwriting earlier releases.
2. Provision a dedicated Node 24–26 runtime under `/opt/open-map-bridge/runtime/<exact-version>/` and point `/opt/open-map-bridge/runtime/current` at it. Do not replace the server-wide `/usr/bin/node` or another project's runtime.
3. Install `deploy/systemd/open-map-bridge.service` and `deploy/nginx/open-map-bridge.conf` from that release. The service always executes the project-scoped runtime symlink. Resolve the active nginx include directory from `nginx -T` before installation: distro nginx commonly reads `/etc/nginx/conf.d`, while the verified Tencent host uses the BaoTa include `/www/server/panel/vhost/nginx/*.conf`. A config copied into an unread include directory is not deployed even when `nginx -t` succeeds.
4. Create `/etc/open-map-bridge/gateway.env` and `/etc/open-map-bridge/nginx-gateway-secret.conf` from the examples; use the same generated gateway token in both files, keep both `0600`, and never paste any token or optional vault key into Git, issue text, command output, or logs. If the encrypted credential vault is enabled, generate its distinct 32-byte base64url key directly on the host without echoing it and configure both `OMB_VAULT_PATH` and `OMB_VAULT_KEY`.
5. Create `/var/lib/open-map-bridge` owned by the `openmapbridge` service account. Preserve the main state and optional `credential-vault.json` across releases; both must remain `0600` and must never be copied into a Web artifact.
6. Atomically point `/opt/open-map-bridge/current` at the new release, reload nginx, restart the service, and verify the tunneled UI plus authenticated `/api/health`.

The exact host, service account, nginx layout, Node path, and release SHA must be read-only verified before installation. The templates are not authority to deploy to an arbitrary SSH alias. The first verified target is the Tencent host behind SSH alias `tencent-shuangying`; `/opt/open-map-bridge`, `/etc/open-map-bridge`, `/var/lib/open-map-bridge`, ports 4174/8080, and the `openmapbridge` account were absent before installation. Other project directories and system runtimes are out of scope.

## Verified Tencent release (2026-08-31)

Deployment evidence commit `a92ff8c` records FIX-BATCH-011 runtime source `94e42b1`; main CI `33382682547` passed. On 2026-08-31 18:19 the verified Tencent current release was atomically switched to `94e42b1`. Report `runtime source=94e42b1`, `deployed=94e42b1`; obtain the exact docs-only main tip from live Git because later evidence-only descendants do not change the runtime. Do not infer a real Ovi source is ready because no authorized real probe was run and no ProbeResult was persisted.

- GitHub docs-only main: `f21fefe109b6d6faaba12871ca7d80c6910a304f`;
- deployed runtime source tree: `94e42b1e270541399fc8ff70d6657255567b0195`;
- current release: `/opt/open-map-bridge/releases/94e42b1`;
- retained releases: `/opt/open-map-bridge/releases/62ab114` and `/opt/open-map-bridge/releases/33f7f06`;
- project runtime: `/opt/open-map-bridge/runtime/node-v24.19.0`, `v24.19.0`;
- active nginx include: `/www/server/panel/vhost/nginx/open-map-bridge.conf`;
- gateway bundle SHA-256: `08635f54f8e07bb51a889a4a8eb29c6014da93fafad6cbd9f71815193af5a9ef`;
- Web index SHA-256: `82c87ad622055cbff03b7f5a4b3f23d790b2647b87c9e1312a265f78f1690572`.

The service is active as `openmapbridge`, with `NoNewPrivileges=yes`, `ProtectSystem=strict`, and `ProtectHome=yes`. Nginx and the gateway listen only on `127.0.0.1:8080` and `127.0.0.1:4174`. The tunneled UI, `/api/health`, `/api/aois`, direct unauthenticated rejection, state-file ownership/mode, graceful restart, lifecycle logs, and state hash across restart were verified. The first attempted nginx install into `/etc/nginx/conf.d` did not create the 8080 listener because BaoTa nginx does not include that path; the active include was then discovered from `nginx -T`, installed, tested, and the unused project-created file removed. During the `94e42b1` restart, the first health request returned a transient 502; the bounded retry then returned `{"ok":true,"persistence":"atomic-json"}`, and the state SHA-256 was unchanged before and after restart.

FIX-BATCH-012 credential-vault and the OMB-AUD-040 automatic preflight guard reached main `3d1ddf2` after PR CI `33386874683` and main CI `33387017311` passed. At 22:44, exact docs-only main `3bbcbfa` passed local test/typecheck/build/production smoke and was installed as `/opt/open-map-bridge/releases/3bbcbfa`; current was atomically switched. The server generated a distinct vault key without printing it, created an empty `0600` vault, returned `credentialVault=encrypted-local`, preserved direct 401 and loopback-only listeners, and kept the persistent state hash unchanged. This is deployed vault infrastructure, not a real credential or real-source acceptance.

FIX-BATCH-014A reached runtime source main `67ea901`; evidence main `16e805d` passed CI `33417916800`. Because the workstation had only about 36 MiB above its 8 GiB gate, exact `16e805d` was streamed to the approved Tencent project build directory and verified there with Node 24.19/npm 11.17: 3 Node tests, 241 Vitest tests, all 8 workspace typechecks, production build, and isolated smoke passed. Release `/opt/open-map-bridge/releases/16e805d` was installed and current atomically switched from `3bbcbfa`. Gateway/Web SHA-256 are `4a8fc8a7a4224cf9b3c024639a142e217446ad1914857891b4591e157eb478d6` and `5eb4f674b4274a98075278e6bc35fe849aa233121212b309d4633244c9685a8b`; health, direct 401, loopback listeners, and unchanged state/vault hashes passed. The temporary remote build directory was removed after the immutable release was verified; `3bbcbfa` remains available for rollback. No real Ovi interface or source was requested.

FIX-BATCH-014B was squash merged by PR #32 as main `ccd3cd8`; PR CI `33429142239` and main CI `33429336750` passed the full gates after retaining and correcting the earlier QR E2E red run `33428136462`. Exact main was locally built and smoke-tested, then installed as release `/opt/open-map-bridge/releases/ccd3cd8`. Current switched atomically from `16e805d`. Gateway/Web SHA-256 are `273207ccf65f8398cb56efd98075ad3ffa76bca69b1a551ef28fac16f489b826` and `42368f3e17c37b54db9910e5e106afaf959f362be5a5943b0784b2b10fd504ad`; health, direct 401, loopback listeners, and unchanged state/vault hashes passed. This deploys request-plan truth only; it does not wire or execute a generic upstream probe.

FIX-BATCH-014C was squash merged by PR #35 as main `7da03c3`; PR CI `33434618444`/`33434979533` and main CI `33435153343` passed the full gates. Exact main was rebuilt locally and passed production smoke, then copied to immutable release `/opt/open-map-bridge/releases/7da03c3`; the release manifest and remote artifact hashes matched before `current` switched atomically from `ccd3cd8`. Gateway/Web SHA-256 are `a3d69a0e3510510c005561af6487d8ec1a17a9621ddc2f8fc075908336656a1d` and `42368f3e17c37b54db9910e5e106afaf959f362be5a5943b0784b2b10fd504ad`. The first nginx health check in the restart window returned 502, then the bounded retry succeeded; service active, health=`atomic-json/encrypted-local`, direct unauthenticated 401, loopback-only 4174/8080, state/vault hashes and 0600 ownership all passed. Releases `ccd3cd8` and `16e805d` remain for rollback. This deploys an explicit generic probe route and its safety gates, but no real source or credential was configured or requested; generic tile/temporal runtime, rendered, and accepted remain unmet.

## Rollback

Keep the previous release directory and the persistent state file. To roll back, stop the service, copy `/var/lib/open-map-bridge/temporal-state.json` to a timestamped protected backup, repoint `current` to the previous verified release, start the service, and verify source/receipt counts and health. Never delete the state file or earlier release as part of rollback. On 2026-08-31 the project exercised `62ab114 → 33f7f06 → 62ab114`; every switch used an atomic symlink replacement plus service restart, health stayed successful, and the persistent-state hash did not change.

## Acceptance boundary

A healthy service proves only artifact installation and process health. Deployment reaches `accepted` only after the operator can use the tunneled Web UI and an authorized source completes import, confirmation, controlled probe, real rendering, refresh recovery, and four-frame comparison without exposing credentials.
