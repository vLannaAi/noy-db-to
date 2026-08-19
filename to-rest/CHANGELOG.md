# @noy-db/to-rest

## 0.6.0-pre.6

### Hub dev pin moved to `0.6.0-pre.23`

- **The peer range is unchanged**, and that is the important part: `^0.6.0-pre.0` (`^0.6.0-pre.11` for `to-drive`/`to-icloud`). A consumer's floor is the peer range, never this package's dev pin.
- **Existing installs:** adding or upgrading `@noy-db/to-*` alone does **not** move your hub. If you are already on an earlier `0.6.0-pre`, you keep it, and you meet no format change.
- **Fresh installs differ.** npm auto-installs peers at the newest satisfying version, and `^0.6.0-pre.0` admits `0.6.0-pre.23` — so installing from nothing gets you the current hub. With no existing data that is a non-event.

  ```
  FRESH     npm i @noy-db/to-postgres@next                    -> hub 0.6.0-pre.23
  EXISTING  npm i @noy-db/hub@0.6.0-pre.16 ; then the store   -> hub 0.6.0-pre.16
  ```

- **No functional change to this package.** Its `dist` is byte-identical to `0.6.0-pre.5`; only the development pin and the repo's own docs moved.
- Every store was verified to compile against the oldest hub its declared range admits, at both distinct floors.

### The ciphertext this store holds is unaffected by the 0.6 format changes

Two format changes landed upstream between `0.6.0-pre.18` and `0.6.0-pre.23`, and they have opposite shapes. Neither is a defect in this package, and neither touches the bytes a store holds — a store never decrypts.

- `pre.18` bound record identity into the AEAD. Records written before it cannot be opened by `pre.18` or later.
- `pre.21` authenticated the keyring roster. This fails at **unlock**, not at a record read, and travels with the vault rather than the payload.

The AEAD scheme is byte-identical across `pre.18 … pre.23`, so records remain cross-readable within that range. See `README.md` — *What a passing test suite here does and does not prove*.

## 0.6.0-pre.5

### The release path refuses to route a pre-release to `@latest`

- **No functional change to this package.** Its `dist` is byte-identical to `0.6.0-pre.4`; this release carries a repo-level release-integrity guard.
- **Added the pre-release routing guard** ([#97](https://github.com/vLannaAi/noy-db-to/pull/97)). The npm dist-tag was routed entirely by the "Set as a pre-release" checkbox on the GitHub Release form, with nothing refusing a mismatch — so a forgotten tick would publish a pre-release to `@latest`, which is not self-healing (`npm dist-tag` is an account-changing write needing an interactive 2FA OTP, so CI can never repair it). `release.yml` now fails the release when a semver pre-release version is published from a Release not marked as a pre-release. Only that direction is blocked — a stable version on `@next` is recoverable and stays allowed.

  This repo needed it most and had it last: its `@latest` is already broken (all 17 `to-*@0.5.0` versions are deprecated), and a pre-release landing there would add a second, independent defect to the same tag. noy-db-ui, noy-db and klum-db adopted the guard earlier.

Peer range is unchanged: `^0.6.0-pre.0` (`^0.6.0-pre.11` for `to-drive`/`to-icloud`).

## 0.6.0-pre.4

### Release-integrity work — no change to published code

- **No functional change to this package.** Its `dist` is byte-identical to `0.6.0-pre.3`; this release carries repo-level release-integrity work and exists to bring the registry back in step with `main`.
- **The peer-floor guard now gates releases** ([#94](https://github.com/vLannaAi/noy-db-to/pull/94)). It was triggered only on `pull_request`/`push`, which a `release` event never matches — so a release could publish a peer range the guard would have rejected. It is now a `workflow_call` from `release.yml`, checked out at the release tag, and `publish` depends on it.
- **Three defects fixed in the guard's range analysis** ([#95](https://github.com/vLannaAi/noy-db-to/pull/95)). `semver.minVersion` throws on a malformed range, returns null on an unsatisfiable one, and floors an unbounded range (`*`, `x`, blank) at `0.0.0` — a version no `@noy-db` package has published. Only the null case was handled. All three now fail fast and name the package.
- **The docs-bridge store table is derived, not counted** ([#93](https://github.com/vLannaAi/noy-db-to/pull/93), [#94](https://github.com/vLannaAi/noy-db-to/pull/94)). A missing entry previously made the bridge throw while the release still reported success; the expected set is now read from the `to-*` directories, and a bridge failure writes a loud block to the run summary.

Peer range is unchanged: `^0.6.0-pre.0` (`^0.6.0-pre.11` for `to-drive`/`to-icloud`, which need a generic `StoreLocator.register()`).

## 0.6.0-pre.3

### Peer range narrowed to the versions that actually work ([#89](https://github.com/vLannaAi/noy-db-to/issues/89), [#90](https://github.com/vLannaAi/noy-db-to/pull/90))

- `peerDependencies["@noy-db/hub"]` → **`^0.6.0-pre.0`**, replacing `^0.3.0 || ^0.4.0 || ^0.5.0 || ^0.6.0-pre.0`. The old range was a false promise: `StoreDescriptor`, `StoreFactory` and `StoreLocator` exist on `@noy-db/hub/to` only from `0.6.0-pre`, so `npm i` with an older hub satisfied the peer check and then failed to typecheck. The new floor was verified by compiling this package's `src/` against it.

  The family rule is *widen by appending*, which assumes compatibility only grows. It does not: adopting a symbol that exists only from a given upstream version silently retracts the older branches, and no gate notices. **Narrowing is the honest correction.**

### Hub 0.6.0-pre.16 adopted ([#87](https://github.com/vLannaAi/noy-db-to/pull/87), [#88](https://github.com/vLannaAi/noy-db-to/pull/88))

- Dev pins → `0.6.0-pre.16` for `@noy-db/hub`, `@noy-db/in-rest` and `@noy-db/test-adapter-conformance`, moved as a **unit** — a hub-only bump leaves siblings behind and invites the tree to resolve two copies of the same lockstep line.

## 0.6.0-pre.2

### Hub 0.6.0-pre.11 adopted ([#83](https://github.com/vLannaAi/noy-db-to/pull/83))

- Dev pins → `0.6.0-pre.11` for `@noy-db/hub`, `@noy-db/in-rest` and `@noy-db/test-adapter-conformance`. `peerDependencies` are **unchanged**: `^0.6.0-pre.0` already admits later pre-releases on the same `major.minor.patch`, so a same-line hub release does not force a rebuild on consumers. Eight hub releases landed since `pre.3` (pre.4, 5, 7, 8, 9, 10, 11 — pre.6 was never published) and **the store contract did not move**: `kernel/types` and `kernel/errors` are byte-identical between the two, and the hub's exports map neither gained nor lost a subpath. The `/to` seam gained `AnyNoydbStore`, `isPodStore()`, a generic `StoreFactory<S>` and `resolveAny()` — all additive. Full conformance re-validated.

## 0.6.0-pre.1

### Descriptors may only set declared keys ([#69](https://github.com/vLannaAi/noy-db-to/issues/69))

- `to-rest` descriptors can no longer set anything the store's `DescriptorOptions` / `Address` types declare no field for. The factory destructures named fields instead of spreading the descriptor's unchecked `options` (and, where applicable, `address`) bag into the store options. Where the winning key was applied *conditionally*, a matching key in that bag previously survived and won — here: `headers` — a binding-owned slot applied only when `binding.headers` was absent. Plain JSON, so unlike a `fetch` function it survives a pod round-trip. New `#69` tests assert an undeclared key cannot reach the store.

### Hub 0.6.0-pre.3 adopted ([#74](https://github.com/vLannaAi/noy-db-to/pull/74))

- Dev pins → `0.6.0-pre.3` for `@noy-db/hub` and `@noy-db/test-adapter-conformance`. `peerDependencies` are **unchanged**: the existing `^0.6.0-pre.0` already admits later pre-releases on the same `major.minor.patch`, which is the ranged peer doing its job — a same-line hub release must not force a rebuild on consumers. The `/to` store contract is unchanged (hub `pre.2` was comment-only; `pre.3` covers pod-write strictness, a barrel re-export, and a codemod asset). Full conformance re-validated.

### Docs: 0.1-era vocabulary corrected ([#73](https://github.com/vLannaAi/noy-db-to/pull/73))

- Finished the `passphrase` → `secret` rename in prose (source docblock, README, package description). No API change.

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
