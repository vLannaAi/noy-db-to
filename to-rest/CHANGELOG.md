# @noy-db/to-rest

## 0.5.0

### Store-locator descriptor + credential-broker auth ([#58](https://github.com/vLannaAi/noy-db-to/issues/58), noy-db#945)

- New `restStoreDescriptor()` / `restStoreFactory` / `registerRestStore()` — a credentialless, JSON-serializable `StoreDescriptor` (`kind: 'rest'`, `class: 'cloud'`) reconstructs the store via `createStoreLocator()`. `to-rest`'s options violate the credentialless rule twice, so they are partitioned rather than forwarded: the serializable `address` is `{ baseUrl }` and `options` is `{ timeoutMs? }`, while the device-local `fetch` and non-auth `headers` (tenant routing, tracing) ride the `binding` slot and auth rides the broker. Verified by a descriptor→resolve→full-conformance round-trip.
- New `RestStoreOptions.credentials` — a `StoreCredentialSource` of `kind: 'token'` becomes `Authorization: Bearer <token>`. **Behavioural change:** header assembly moves from construct-once to **per-request**, so an expiring token refreshes without rebuilding the store. The source is invoked once per store operation and `expiresAt` is not consulted — unlike `to-webdav`/`to-turso`, which cache within a refresh-skew window; a source backed by a remote token endpoint therefore costs one round-trip per operation. A credential of any other kind throws an error naming the kind received rather than silently sending no authorization.
- Header precedence is now case-insensitive. Header names merged into a request object are matched by exact key, so a caller-supplied `Authorization` used to survive alongside the broker's `authorization`; `fetch` then concatenated the two into `Bearer A, Bearer B` and the server answered `401`. All header keys are normalized to lowercase before merging, so credentials genuinely override any spelling of `authorization` — and a supplied `Content-Type` no longer duplicates the default.

## 0.4.0

### Hub 0.6.0-pre.1 adopted, conformance suite de-vendored ([#19](https://github.com/vLannaAi/noy-db-to/issues/19))

- `peerDependencies["@noy-db/hub"]` widened with `|| ^0.6.0-pre.0`; dev pin → `0.6.0-pre.1`. The `/to` store contract is unchanged.
- The adapter-conformance suite is no longer vendored in this repo — every store now runs the published `@noy-db/test-adapter-conformance`, so the store contract has one definition instead of two that could drift. Full conformance re-validated.

### New package: NoydbStore client for the in-rest ciphertext RPC proxy ([#55](https://github.com/vLannaAi/noy-db-to/issues/55))

- `toRest({ baseUrl, headers?, timeoutMs?, fetch? })` — the HTTP mirror of `by-peer`'s `peerStore()`: every store method POSTs `{ method, args }` to `{baseUrl}/rpc` for an `@noy-db/in-rest` (≥ 0.6.0-pre.0) `createRestHandler` on the other end. The server sees ciphertext only.
- `ConflictError` is re-hydrated from `409` envelopes (`version` preserved), so CAS semantics survive the wire hop; `401`/`403`/`501`/`5xx` map to clear auth / capability / not-implemented / server errors.
- Trailing optional args (`expectedVersion`, `cursor`, `limit`) are trimmed before serialization — JSON has no `undefined`, and `null` must not masquerade as a real value server-side.
- Passes the shared adapter-conformance suite against a live `createRestHandler` over an in-memory backing store — the real wire contract, not a mock of it.
