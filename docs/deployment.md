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
2. Install `deploy/systemd/open-map-bridge.service` and `deploy/nginx/open-map-bridge.conf` from that release.
3. Create `/etc/open-map-bridge/gateway.env` and `/etc/open-map-bridge/nginx-gateway-secret.conf` from the examples; use the same generated token in both files, keep both `0600`, and never paste the value into Git, issue text, or logs.
4. Create `/var/lib/open-map-bridge` owned by the `openmapbridge` service account. Preserve it across releases.
5. Atomically point `/opt/open-map-bridge/current` at the new release, reload nginx, restart the service, and verify the tunneled UI plus authenticated `/api/health`.

The exact host, service account, nginx layout, Node path, and release SHA must be read-only verified before installation. The templates are not authority to deploy to an arbitrary SSH alias.

## Rollback

Keep the previous release directory and the persistent state file. To roll back, stop the service, copy `/var/lib/open-map-bridge/temporal-state.json` to a timestamped protected backup, repoint `current` to the previous verified release, start the service, and verify source/receipt counts and health. Never delete the state file or earlier release as part of rollback.

## Acceptance boundary

A healthy service proves only artifact installation and process health. Deployment reaches `accepted` only after the operator can use the tunneled Web UI and an authorized source completes import, confirmation, controlled probe, real rendering, refresh recovery, and four-frame comparison without exposing credentials.
