# Open map source schema v1

`MapSourceDefinition` is the only contract consumed by the renderer and downstream temporal tools. QR and `.ovmap` bytes remain boundary inputs; they are never the internal source of truth.

Core fields cover stable identity, optional Ovi legacy ID, name, input kind, protocol, projection, zoom range, tile size and format, explicit `http/https/unknown` transport scheme, bounded hosts, path template, secret-free query parameters, request-plan field provenance, an opaque credential reference, attribution/license, input hash and parser provenance, compatibility extensions, explicit lifecycle status, and timestamps.

`requestPlanProvenance` records whether scheme, hosts, path, and each retained public query field was parsed, inferred, user-corrected, not provided, redacted, or inherited from a legacy record. Old v1 JSON remains readable with `unknown/legacy-unknown`, but that compatibility default is not evidence for a network request. Known schemes require explicit provenance, and static readiness fails closed for unknown or unproven generic request plans. Plain HTTP requires source-level intervention.

Inline keys matching token/key/secret/cookie/authorization are forbidden. Tile variables and a bounded allowlist of public constants such as style/layers/format/time may remain in the open request plan; unknown fixed values are removed and treated as possible credentials. Real query/header secrets live only in the encrypted local vault behind `vault://source/<same UUID>` and must not enter previews, logs, receipts, exports, URLs, or the JSON registry. Ovi-private `at/ad/al` and opaque `ul` are not interpreted by this generic vault.

Import adapters currently place only boolean readiness evidence in `compatibilityExtension`: `credentialRequired` says that sensitive or fixed query material was removed, while `needsOviBridge` says that an opaque Ovi template must be handled by the controlled local bridge. These flags are internal compatibility facts, not credentials, and are never exposed through the developer API. Older saved definitions without `credentialRequired` remain unknown and must be re-inspected instead of being assumed credential-free.

The lifecycle is explicit: `received → parsed → confirmed → probed → rendered → saved`. Failure/attention states include `invalid`, `unsupported`, `blocked`, `needs-credential`, `needs-data`, `probe-failed`, `render-failed`, `stale`, and `disabled`. Persisting a user-confirmed configuration does not imply probe, rendering, or business acceptance.

The 014B additive fields keep `schemaVersion: 1` because the parser supplies a deterministic fail-closed compatibility value for already persisted v1 records; no network consumer may interpret that default as verified. A future incompatible shape change requires a new `schemaVersion`, and readers must reject unknown versions rather than guessing.
