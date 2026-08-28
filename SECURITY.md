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

## Scope boundary

Reports must not use the project to bypass third-party authentication, membership, licensing, device binding, or rate limits. Do not test against a map server without authorization.
