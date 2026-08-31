# Security policy

## Supported version

Security fixes currently target the latest commit on `main`. The project is pre-release; no older release line is guaranteed support.

## Reporting a vulnerability

Use the repository's private GitHub security-advisory reporting flow. Do not open a public issue containing QR payloads, tokens, cookies, private map-source URLs, `.ovmap` files, tile data, or credentials.

Include only the minimum reproducible information:

- affected commit and local environment;
- vulnerability class and expected impact;
- a synthetic or revoked test fixture;
- reproduction steps that do not contact an unauthorized upstream service.

High-priority areas include secret disclosure, inbound Host/Origin/Bearer/CSRF/app-permission bypass, SSRF or DNS rebinding, open-proxy behavior, unsafe decompression, path traversal, credential-boundary bypass, and a false capability upgrade from `metadata-only` to `ready`.

The supported local gateway is bound to `127.0.0.1`, accepts only configured loopback Host/Origin values, and requires scoped Bearer authentication on every API request. State-changing requests also require the local proxy/CLI CSRF header. Developer app tokens must remain distinct from the Web process token and receive only the declared read permissions. Do not place either token in URLs, repository files, screenshots, bug reports, or browser bundles.

The optional credential vault requires a distinct unpadded base64url 32-byte master key and an absolute vault path. Keep the key only in a protected process environment or `0600` deployment environment file; keep the authenticated-encryption vault file `0600` and outside Web assets. Never attach either to an issue or trace. A missing/wrong key, tampered envelope, dangling reference, or disabled vault must fail closed. The current vault does not yet provide key rotation, backup recovery, or safe upstream injection, and it must not be used to reconstruct opaque Ovi-private fields.

## Scope boundary

Reports must not use the project to bypass third-party authentication, membership, licensing, device binding, or rate limits. Do not test against a map server without authorization.
