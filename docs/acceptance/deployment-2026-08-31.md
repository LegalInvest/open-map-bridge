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

## FIX-BATCH-012 deployment — 22:44 Asia/Shanghai

After workstation capacity recovered above the 8 GiB gate, exact docs-only main `3bbcbfabd2d61ba645c0be136ba8ac07c3816c15` passed 198 Vitest tests, 3 Node tests, all 8 workspace typechecks, production build, and isolated production smoke. The artifact gateway SHA-256 was `5827328217ead191356508c4a5e6a15e311b25f3138de8b257dd332d56ddd361`; Web index SHA-256 was `75495f47770bcf9655d12cda37cf83b5ed26b99524e1e22b748d8f7788c4de42`.

The artifact was copied to the new immutable release `/opt/open-map-bridge/releases/3bbcbfa`, template and artifact hashes matched locally, and `current` was atomically switched. A distinct vault key was generated only in the root-owned `0600` server environment without being printed or persisted elsewhere; the service created an empty `0600` `/var/lib/open-map-bridge/credential-vault.json`. Health returned `{"ok":true,"persistence":"atomic-json","credentialVault":"encrypted-local"}`, direct unauthenticated gateway access remained 401, listeners remained `127.0.0.1:4174` and `127.0.0.1:8080`, and the persistent state SHA-256 stayed `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2`.

This advances FIX-BATCH-012 to `deployed` only. The vault contains no real credential, no real Ovi or third-party request was sent, no ProbeResult was persisted, and real-source `ready/rendered/accepted` remains unmet.

## FIX-BATCH-013 main advance without a new release

PR #25 CI `33406940553` and main CI `33407144250` fully verified request-time DNS/IP authorization and pinned-connection transport at main `32cb36d`. The new module is not imported by the server, probe, or tile production entry graph, so it does not change reachable runtime behavior and no new Tencent release was created. Tencent current remains the verified `3bbcbfa` vault release. This is `main / not wired / not deployed`, and no real upstream request or real-source acceptance occurred.

## FIX-BATCH-014A main advance without deployment

PR #29 merged the strict redacted ProbeResult schema, atomic source/fingerprint deduplication, OviBridge success/failure evidence, and restart reuse into main `67ea901`. The first PR run `33416353555` failed while collecting one new test file because a `vi.fn` call missed its closing parenthesis; 234 already executed tests passed and later gates did not run. The corrected PR run `33416581636` and main run `33417146165` then passed technical-disclosure freshness, 3 Node tests, 241 Vitest tests, all 8 workspace typechecks, production build/smoke, and four Chrome journeys.

This is `main`, not `deployed`: at 01:01 Asia/Shanghai the workstation had only `8,452,588 KiB` available, about 62 MiB above the 8 GiB gate, so no local artifact or Tencent release was produced. Tencent current remains `3bbcbfa`. No authorized Ovi interface was enabled, no real probe was sent or persisted, and real-source `ready/rendered/accepted` remains unmet.

## FIX-BATCH-014A deployment — 01:15 Asia/Shanghai

After evidence main `16e805d` and CI `33417916800` passed, the exact source was streamed without a local artifact into `/opt/open-map-bridge/builds/16e805d` on the approved Tencent host. Node 24.19/npm 11.17 completed `npm ci` with zero vulnerabilities, the environment gate, 3 Node tests, 241 Vitest tests, all 8 workspace typechecks, production build, and isolated production smoke. The build emitted the existing Web chunk-size warning but no failed gate.

The immutable release `/opt/open-map-bridge/releases/16e805d` was installed with gateway SHA-256 `4a8fc8a7a4224cf9b3c024639a142e217446ad1914857891b4591e157eb478d6` and Web index SHA-256 `5eb4f674b4274a98075278e6bc35fe849aa233121212b309d4633244c9685a8b`, both equal to its manifest. `current` switched atomically from `3bbcbfa`; the service is active, health returns `atomic-json/encrypted-local`, direct unauthenticated health is 401, and 4174/8080 remain loopback-only. State SHA-256 stayed `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2`; vault SHA-256 stayed `89c8d70d93f879eaa3ad187302c4d706e34673d7e5da226bd40bbd9d5ca7db42`. The temporary build directory was deleted after release verification; `3bbcbfa` remains for rollback.

This advances FIX-BATCH-014A to `deployed` only. The official Ovi third-party interface remains disabled, no real source was requested, no real ProbeResult exists, and `rendered/accepted` remain unmet.

## FIX-BATCH-014B deployment — 03:18 Asia/Shanghai

PR #32 first run `33428136462` retained one public QR E2E failure after the new policy correctly moved a relative, scheme-unknown fixture from runtime binding to network-policy intervention. The fixture was changed to a short same-authority HTTPS template without weakening the policy. PR runs `33428818544` and `33429142239`, followed by main run `33429336750`, passed technical-disclosure freshness, 3 Node tests, 252 Vitest tests, all 8 workspace typechecks, production build/smoke, and four Chrome journeys. The squash main is `ccd3cd88a713492aff309c28e48b42cec1122f82`.

Exact main was rebuilt locally after the main CI passed. The immutable release `/opt/open-map-bridge/releases/ccd3cd8` was installed with gateway SHA-256 `273207ccf65f8398cb56efd98075ad3ffa76bca69b1a551ef28fac16f489b826` and Web index SHA-256 `42368f3e17c37b54db9910e5e106afaf959f362be5a5943b0784b2b10fd504ad`, both equal to the local and remote manifests. `current` switched atomically from `16e805d`; service health and nginx-proxied health both returned `atomic-json/encrypted-local`, direct unauthenticated health remained 401, and 4174/8080 remained loopback-only. State SHA-256 stayed `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2`; vault SHA-256 stayed `89c8d70d93f879eaa3ad187302c4d706e34673d7e5da226bd40bbd9d5ca7db42`. Release `16e805d` remains available for rollback.

## 2026-09-01 04:19 FIX-BATCH-014C release `7da03c3`

PR #35 CI `33434618444`/`33434979533` and main CI `33435153343` passed before deployment. Exact main `7da03c3` was rebuilt locally and passed production smoke. The immutable release `/opt/open-map-bridge/releases/7da03c3` was installed with gateway SHA-256 `a3d69a0e3510510c005561af6487d8ec1a17a9621ddc2f8fc075908336656a1d` and Web index SHA-256 `42368f3e17c37b54db9910e5e106afaf959f362be5a5943b0784b2b10fd504ad`, both equal to the local manifest and remote files before the switch. `current` switched atomically from `ccd3cd8`. The first nginx health check during restart returned 502; the bounded retry recovered to `atomic-json/encrypted-local`. Direct unauthenticated health remained 401, 4174/8080 remained loopback-only, and service was active. State SHA-256 remained `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2`; vault SHA-256 remained `89c8d70d93f879eaa3ad187302c4d706e34673d7e5da226bd40bbd9d5ca7db42`; both files remained `0600 openmapbridge:openmapbridge`. Earlier releases remain available for rollback.

This is `deployed-code`, not real-source acceptance. No user QR payload, real credential, Ovi interface, third-party host, or real tile was used during deployment. No real ProbeResult exists, the generic source is not bound into the tile/temporal runtime, and `ready/rendered/accepted` remain unmet.

This advances only the 014B request-plan truth subset to `deployed`: scheme, public query constants, field provenance, OMS fact preservation, and fail-closed static readiness are present. Generic vault injection, pinned upstream transport, generic ProbeResult, authorized real requests, `ready`, rendering, and user acceptance remain open.

## 2026-09-01 05:10 FIX-BATCH-014D release `d350ac3`

PR #38 function/evidence CI `33439198444`/`33439507170` and squash-main CI `33439685686` passed before deployment. Exact main `d350ac3` was rebuilt locally and passed production smoke. The immutable release `/opt/open-map-bridge/releases/d350ac3` was installed with gateway SHA-256 `73808e31d2154aec2a9d0ffc8e270acccf04c5bd3b252054b8fcfc5f26f4eb8d` and Web index SHA-256 `42368f3e17c37b54db9910e5e106afaf959f362be5a5943b0784b2b10fd504ad`, equal to the local manifest and remote files. `current` switched atomically from `7da03c3`; the prior release remains available for rollback. The first nginx health request in the restart window returned 502, then bounded retry recovered to `atomic-json/encrypted-local`; direct unauthenticated health remained 401, systemd remained active, and 4174/8080 remained loopback-only. State SHA-256 stayed `07648ee28f9e50bdc581ae99a9c08d83b5a4b22bfd9e4fe8f1acd542b0c6d6e2`; vault SHA-256 stayed `89c8d70d93f879eaa3ad187302c4d706e34673d7e5da226bd40bbd9d5ca7db42`; both remained `0600 openmapbridge:openmapbridge`.

This advances 014D code to `deployed-code`. No authorized real Ovi or generic upstream was requested, no real ProbeResult or runtime binding was created, and no browser map canvas rendered a real imported source. Therefore `real-probed`, `rendered`, historical temporal capability, and user `accepted` remain unmet.

## 2026-09-01 07:49 FIX-BATCH-016 main advance without deployment

PR #44 CI `33450167879`/`33450368931` and squash-main CI `33450486867` passed before runtime packaging. Exact main `3cf763a` built successfully; gateway/Web index SHA-256 are `fcc835ecac27894d95d885b3b45f6ed13a38f71e3c33601e438ff2afd46d0762` and `9f2aa734c246a27f6360d6cd1727108645aded9dc2e9e7977f4e86d47423ee90`, equal to the build manifest. The current local execution sandbox rejected both the production-smoke loopback bind and Tencent SSH. The former is recorded as an environment restriction because the same main CI smoke and pre-merge local smoke passed; the latter means no server read, write, restart, symlink switch, state change, or release installation occurred.

FIX-BATCH-016 is therefore `main / not deployed / not real-rendered / not accepted`. Tencent current `67a6a0e` is the last verified value, not a live check from this run. Deployment must resume with an exact immutable `3cf763a` artifact and preserve the state/vault files and rollback release; synthetic or HTTP health evidence still cannot establish a real Ovi source or user acceptance.

## 2026-09-01 08:46 capacity-gated continuation

The docs-only local and origin tips are both `31a1047`; the runtime source awaiting deployment remains `3cf763a`. The local root filesystem had only `7,657,624 KiB` available, about 7.30 GiB and below the mandatory 8 GiB gate. GitHub API access failed and the approved Tencent SSH alias was rejected by the execution sandbox with `Operation not permitted`. No build, test, browser, download, imagery operation, remote write, restart, symlink switch, or release installation was performed. Tencent `67a6a0e` remains only the last trusted observation, so FIX-BATCH-016 stays `main / not deployed / not real-rendered / not accepted`.
