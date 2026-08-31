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
4. Create `/etc/open-map-bridge/gateway.env` and `/etc/open-map-bridge/nginx-gateway-secret.conf` from the examples; use the same generated token in both files, keep both `0600`, and never paste the value into Git, issue text, or logs.
5. Create `/var/lib/open-map-bridge` owned by the `openmapbridge` service account. Preserve it across releases.
6. Atomically point `/opt/open-map-bridge/current` at the new release, reload nginx, restart the service, and verify the tunneled UI plus authenticated `/api/health`.

The exact host, service account, nginx layout, Node path, and release SHA must be read-only verified before installation. The templates are not authority to deploy to an arbitrary SSH alias. The first verified target is the Tencent host behind SSH alias `tencent-shuangying`; `/opt/open-map-bridge`, `/etc/open-map-bridge`, `/var/lib/open-map-bridge`, ports 4174/8080, and the `openmapbridge` account were absent before installation. Other project directories and system runtimes are out of scope.

## Verified Tencent release (2026-08-31)

- GitHub main and deployed source tree: `33f7f06725cdce172c5c3bd070c7c91538cea646`;
- release: `/opt/open-map-bridge/releases/33f7f06`;
- project runtime: `/opt/open-map-bridge/runtime/node-v24.19.0`, `v24.19.0`;
- active nginx include: `/www/server/panel/vhost/nginx/open-map-bridge.conf`;
- gateway bundle SHA-256: `63e8ed6eb09ec747bb941a25beff872f0bb895d8544d3cee517af565b4abbfd6`;
- Web index SHA-256: `82c87ad622055cbff03b7f5a4b3f23d790b2647b87c9e1312a265f78f1690572`.

The service is active as `openmapbridge`, with `NoNewPrivileges=yes`, `ProtectSystem=strict`, and `ProtectHome=yes`. Nginx and the gateway listen only on `127.0.0.1:8080` and `127.0.0.1:4174`. The tunneled UI, `/api/health`, `/api/aois`, direct unauthenticated rejection, state-file ownership/mode, graceful restart, lifecycle logs, and state hash across restart were verified. The first attempted nginx install into `/etc/nginx/conf.d` did not create the 8080 listener because BaoTa nginx does not include that path; the active include was then discovered from `nginx -T`, installed, tested, and the unused project-created file removed.

## Rollback

Keep the previous release directory and the persistent state file. To roll back, stop the service, copy `/var/lib/open-map-bridge/temporal-state.json` to a timestamped protected backup, repoint `current` to the previous verified release, start the service, and verify source/receipt counts and health. Never delete the state file or earlier release as part of rollback. The first deployment has no earlier OpenMapBridge release, so the rollback procedure is documented and the current symlink is atomic, but a release-to-release rollback rehearsal remains unavailable until the second release exists.

## Acceptance boundary

A healthy service proves only artifact installation and process health. Deployment reaches `accepted` only after the operator can use the tunneled Web UI and an authorized source completes import, confirmation, controlled probe, real rendering, refresh recovery, and four-frame comparison without exposing credentials.
