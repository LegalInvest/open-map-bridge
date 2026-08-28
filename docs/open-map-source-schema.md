# Open map source schema v1

`MapSourceDefinition` is the only contract consumed by the renderer and downstream temporal tools. QR and `.ovmap` bytes remain boundary inputs; they are never the internal source of truth.

Core fields cover stable identity, optional Ovi legacy ID, name, input kind, protocol, projection, zoom range, tile size and format, bounded hosts, path template, secret-free query parameters, a credential reference, attribution/license, input hash and parser provenance, compatibility extensions, explicit lifecycle status, and timestamps.

Inline keys matching token/key/secret/cookie/authorization are forbidden. Real secret material belongs in a future local vault and must not enter previews, logs, receipts, exports, URLs, or the JSON registry.

Import adapters currently place only boolean readiness evidence in `compatibilityExtension`: `credentialRequired` says that sensitive or fixed query material was removed, while `needsOviBridge` says that an opaque Ovi template must be handled by the controlled local bridge. These flags are internal compatibility facts, not credentials, and are never exposed through the developer API. Older saved definitions without `credentialRequired` remain unknown and must be re-inspected instead of being assumed credential-free.

The lifecycle is explicit: `received → parsed → confirmed → probed → rendered → saved`. Failure/attention states include `invalid`, `unsupported`, `blocked`, `needs-credential`, `needs-data`, `probe-failed`, `render-failed`, `stale`, and `disabled`. Persisting a user-confirmed configuration does not imply probe, rendering, or business acceptance.

Schema changes require a new `schemaVersion` and a deterministic migration. Readers must reject unknown versions rather than guessing.
