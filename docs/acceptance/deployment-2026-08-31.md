# Tencent private deployment acceptance — 2026-08-31

## Scope and stage

This receipt covers technical deployment of GitHub main `62ab11494ae5e27b7bd8250fddf3e88d1c21c170` to the approved Tencent host. It proves `deployed` for the application artifact and records a synthetic technical browser verification. It does **not** prove an authorized Ovi source is ready, real historical imagery renders, or the user has accepted AC-001/AC-011.

## Verified facts

| Check | Result |
|---|---|
| Pre-install target state | OpenMapBridge account/directories absent; ports 4174/8080 free |
| Capacity | Tencent root filesystem had 368 GiB free at installation |
| Artifact integrity | gateway `63e8ed6e…fd6`; Web index `82c87ad6…0572`, equal before/after transfer |
| Release/runtime | current `62ab114`, retained rollback `33f7f06`; project-scoped Node `v24.19.0` |
| Isolation | service user/group `openmapbridge`; persistent directory owned by that account |
| Hardening | `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes` |
| Network | gateway `127.0.0.1:4174`; nginx `127.0.0.1:8080`; no public listener |
| UI and API | tunneled UI 200 with OpenMapBridge marker; health 200 `atomic-json`; AOI API 200 |
| Gateway boundary | direct unauthenticated health request returned 401 |
| Persistence | `temporal-state.json` owner/mode `openmapbridge:openmapbridge 600`; SHA-256 unchanged across restart |
| Lifecycle | restart returned active; logs contain `gateway.started`, `gateway.stopped`, and SIGTERM shutdown |
| Rollback/forward | `62ab114 → 33f7f06 → 62ab114`; health passed at each switch and state hash stayed unchanged |
| Browser journey | server UI loaded with zero console warnings/errors; four distinct panels 2006/2011/2019/2025 loaded; playback advanced 2006→2007 |

## Failed-first evidence

The first nginx configuration was installed to `/etc/nginx/conf.d`, but the host's BaoTa nginx reads `/www/server/panel/vhost/nginx/*.conf`; therefore port 8080 remained closed and the first UI curl failed. The active include path was resolved from `nginx -T`, the same versioned template was installed there, `nginx -t` passed, nginx was reloaded, and the unused OpenMapBridge file in the inactive directory was removed. No unrelated nginx file was changed.

## Remaining acceptance boundary

- No secret is recorded in this receipt, Git, UI assets, or command output.
- Synthetic imagery proves the deployed product shell, four-panel synchronization, and playback only.
- Real-source acceptance still requires the same imported source UUID to pass vault, request-time DNS/IP/rebinding policy, minimal decoded probe, ready promotion, real date catalog, real tile rendering, refresh recovery, and user sign-off.
- The prior release and current release are both preserved; the rollback/forward rehearsal passed without changing persistent state.
