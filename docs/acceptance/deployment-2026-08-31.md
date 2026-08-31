# Tencent private deployment acceptance — 2026-08-31

## Scope and stage

This receipt covers the initial technical deployment of GitHub main `62ab11494ae5e27b7bd8250fddf3e88d1c21c170` and the later FIX-BATCH-011 runtime update `94e42b1e270541399fc8ff70d6657255567b0195` to the approved Tencent host. It proves `deployed` for the application artifacts and records a synthetic technical browser verification. It does **not** prove an authorized Ovi source is ready, real historical imagery renders, or the user has accepted AC-001/AC-011.

## Verified facts

| Check | Result |
|---|---|
| Pre-install target state | OpenMapBridge account/directories absent; ports 4174/8080 free |
| Capacity | Tencent root filesystem had 368 GiB free at installation |
| Artifact integrity | gateway `63e8ed6e…fd6`; Web index `82c87ad6…0572`, equal before/after transfer |
| Initial release/runtime | initial current `62ab114`, retained rollback `33f7f06`; project-scoped Node `v24.19.0` |
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

## FIX-BATCH-011 runtime update

At 2026-08-31 18:19 Asia/Shanghai, the workstation had about 8.62 GiB available and the 8 GiB gate permitted one build/deploy cycle. `npm run build && npm run test:production` passed. The resulting gateway SHA-256 was `08635f54f8e07bb51a889a4a8eb29c6014da93fafad6cbd9f71815193af5a9ef`; the Web index SHA-256 remained `82c87ad622055cbff03b7f5a4b3f23d790b2647b87c9e1312a265f78f1690572`.

The artifact was installed without overwriting earlier releases at `/opt/open-map-bridge/releases/94e42b1`, and `current` was atomically switched to it. The server hashes matched the local build manifest; the service returned active, nginx/gateway remained limited to `127.0.0.1:8080` and `127.0.0.1:4174`, and health returned `{"ok":true,"persistence":"atomic-json"}`. The first health call during the restart window returned 502 before the bounded retry succeeded. The persistent state SHA-256 remained `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2` before and after restart. No real Ovi source, credential, or upstream host was requested or recorded.

## Remaining acceptance boundary

- No secret is recorded in this receipt, Git, UI assets, or command output.
- Synthetic imagery proves the deployed product shell, four-panel synchronization, and playback only.
- Real-source acceptance still requires the same imported source UUID to pass vault, request-time DNS/IP/rebinding policy, minimal decoded probe, ready promotion, real date catalog, real tile rendering, refresh recovery, and user sign-off.
- The prior release and current release are both preserved; the rollback/forward rehearsal passed without changing persistent state.

## FIX-BATCH-012 main advance without deployment

At 2026-08-31 19:30 Asia/Shanghai, PR #23 had merged the encrypted credential vault and automatic 8 GiB root-command preflight into main `3d1ddf2`. The first two PR runs `33386547512` and `33386726268` failed on a hook spelling error and an incorrect credential-ready branch; both failures remain part of the audit trail. The third PR run `33386874683` and main run `33387017311` passed unit tests, all workspace type checks, production build/smoke, and four Chrome journeys.

This is `main`, not `deployed`: the workstation had about 7.14 GiB free, so no new local artifact, Tencent release, or vault master key was created. Tencent current therefore remains the verified FIX-BATCH-011 release `94e42b1`; all real-source acceptance boundaries above remain unchanged.
