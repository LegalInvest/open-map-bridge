# Contributing

Contributions are welcome when they preserve the clean-room and evidence-first boundaries.

1. Read `goal.md`, `research.md`, `PROGRESS.md`, and `BLOCKED.md` before changing behavior.
2. Open an issue for a new format family or public API change. Describe the user journey, legal fixture source, capability boundary, and rollback path.
3. Add a failing test before the implementation. Unknown formats, permissions, and capabilities must fail closed.
4. Use synthetic, public-domain, or explicitly authorized fixtures. Never commit real credentials, QR payloads, private source URLs, tile caches, or user imagery.
5. For a material technical change, run `npm run disclosure:update -- "change summary"`; CI rejects a stale `docs/技术交底书.md` fingerprint.
6. Run `npm test`, `npm run typecheck`, `npm run build`, and the affected browser journey.
7. Report `local`, `main`, `deployed`, and user `accepted` separately.

Protocol adapters may produce the versioned open source definition; renderers and plugins must not depend on private Ovi byte layouts.
