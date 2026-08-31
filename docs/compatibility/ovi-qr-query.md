# Ovi `ovobj` QR query compatibility

The V0 adapter accepts at most 4096 UTF-8 bytes, requires the `ovobj?` head, and permits the observed structural keys `t,id,na,po,he,oy,df,hn,ul`, the user-authorized credential variant `at,ad,al`, and the public-sample extension keys `hs,mf,ml,ms,mt,pn,pt`. It maps only the behaviorally verified fields `id`, `na`, `hn`, and `ul`; the codes `t/po/he/oy/df` remain opaque compatibility values. Values of `at/ad/al` are never returned, previewed, persisted, or logged; their presence only marks the candidate `needs-credential`.

The extension values `hs/mf/ml/ms/mt/pn/pt` are also never returned or persisted because their semantics and sensitivity are not yet established. Only their field names are retained as `observedOpaqueFields` so later adapters can distinguish a known dialect without guessing projection, transport, time semantics, credentials, or map type. Duplicate fields and any still-unobserved key fail closed.

The authorized historical-source sample uses `ul` as an opaque 72-character protocol value, not a `/...{$z}...` tile template. V0 therefore stores only a safe `/` placeholder plus `opaqueTemplate/needsOviBridge` flags and marks the source as needing companion bridge data. The opaque value itself is not returned or persisted until a dedicated local vault exists.

Core duplicates, missing fields, malformed percent encoding, URL userinfo, unsafe host syntax, oversized values, and unknown keys are rejected before any network access. Projection remains `unknown`. Query material inside `ul` is not returned by the safe preview; its presence becomes a `needs-credential` warning until a local credential vault exists.

The adapter also accepts the independent open `oms1:` base64url JSON QR format, validated against `MapSourceDefinition` v1. Inline secret keys remain forbidden.
