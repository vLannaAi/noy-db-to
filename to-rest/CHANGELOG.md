# @noy-db/to-rest

## 0.4.0

### New package: NoydbStore client for the in-rest ciphertext RPC proxy ([#55](https://github.com/vLannaAi/noy-db-to/issues/55))

- `toRest({ baseUrl, headers?, timeoutMs?, fetch? })` — the HTTP mirror of `by-peer`'s `peerStore()`: every store method POSTs `{ method, args }` to `{baseUrl}/rpc` for an `@noy-db/in-rest` (≥ 0.6.0-pre.0) `createRestHandler` on the other end. The server sees ciphertext only.
- `ConflictError` is re-hydrated from `409` envelopes (`version` preserved), so CAS semantics survive the wire hop; `401`/`403`/`501`/`5xx` map to clear auth / capability / not-implemented / server errors.
- Trailing optional args (`expectedVersion`, `cursor`, `limit`) are trimmed before serialization — JSON has no `undefined`, and `null` must not masquerade as a real value server-side.
- Passes the shared adapter-conformance suite against a live `createRestHandler` over an in-memory backing store — the real wire contract, not a mock of it.
