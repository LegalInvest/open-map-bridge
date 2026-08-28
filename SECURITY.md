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

High-priority areas include secret disclosure, SSRF or DNS rebinding, open-proxy behavior, unsafe decompression, path traversal, credential-boundary bypass, and a false capability upgrade from `metadata-only` to `ready`.

## Scope boundary

Reports must not use the project to bypass third-party authentication, membership, licensing, device binding, or rate limits. Do not test against a map server without authorization.
