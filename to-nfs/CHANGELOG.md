# Changelog — to-nfs

## 0.6.0-pre.2

### Hub 0.6.0-pre.11 adopted ([#83](https://github.com/vLannaAi/noy-db-to/pull/83))

- Dev pins → `0.6.0-pre.11` for `@noy-db/hub` and `@noy-db/test-adapter-conformance`. `peerDependencies` are **unchanged**: `^0.6.0-pre.0` already admits later pre-releases on the same `major.minor.patch`, so a same-line hub release does not force a rebuild on consumers. Eight hub releases landed since `pre.3` (pre.4, 5, 7, 8, 9, 10, 11 — pre.6 was never published) and **the store contract did not move**: `kernel/types` and `kernel/errors` are byte-identical between the two, and the hub's exports map neither gained nor lost a subpath. The `/to` seam gained `AnyNoydbStore`, `isPodStore()`, a generic `StoreFactory<S>` and `resolveAny()` — all additive. Full conformance re-validated.

## 0.6.0-pre.1

### `server:/export` is now cross-checked against the actual mount ([#70](https://github.com/vLannaAi/noy-db-to/issues/70))

- `MountInfo` gains `device`; `detectMount()` returns the mount's device string, which for an NFS mount is exactly `server:/export` — it was already being parsed out of `/proc/mounts` and discarded.
- `runMountDiagnostics()` compares the descriptor's `server`/`export` against that device and adds a risk on mismatch, so a pod claiming `nas.local:/exports/vaults` resolved against a `mountPath` pointing elsewhere no longer writes to the wrong place silently. **This changes `diagnostics()` output.**
- New `onDeviceMismatch: 'warn' | 'error'` on `NfsStoreOptions` and `NfsDescriptorOptions`, following the `onNolock` precedent and **defaulting to `'warn'`** — an existing consumer whose descriptor is merely imprecise must not break on upgrade.
- The check is gated on **both** address halves *and* a device from the detector, so a detector that cannot report one (every pre-#70 implementation, including any a consumer injected) never manufactures a mismatch. Only trailing slashes are normalized; host case is left alone.
- `nfsStoreFactory` now forwards `address.server` / `address.export`. The address still does not *open* anything — `binding.mountPath` remains what the store opens.
- Fixed alongside: the `onNolock` escalation selected its message by `risks[0]`, which would have thrown the *device* message once a second escalating risk existed. Both escalations now select by predicate.

### Descriptors may only set declared keys ([#69](https://github.com/vLannaAi/noy-db-to/issues/69))

- `to-nfs` descriptors can no longer set anything the store's `DescriptorOptions` / `Address` types declare no field for. The factory destructures named fields instead of spreading the descriptor's unchecked `options` (and, where applicable, `address`) bag into the store options. Where the winning key was applied *conditionally*, a matching key in that bag previously survived and won — here: `mountDetector` — a binding-owned slot applied only when `binding.mountDetector` was absent, silently disabling the `nolock` / `noac` / fstype safety diagnostics. New `#69` tests assert an undeclared key cannot reach the store.

### Hub 0.6.0-pre.3 adopted ([#74](https://github.com/vLannaAi/noy-db-to/pull/74))

- Dev pins → `0.6.0-pre.3` for `@noy-db/hub` and `@noy-db/test-adapter-conformance`. `peerDependencies` are **unchanged**: the existing `^0.6.0-pre.0` already admits later pre-releases on the same `major.minor.patch`, which is the ranged peer doing its job — a same-line hub release must not force a rebuild on consumers. The `/to` store contract is unchanged (hub `pre.2` was comment-only; `pre.3` covers pod-write strictness, a barrel re-export, and a codemod asset). Full conformance re-validated.

## 0.5.0

### Store-locator descriptor adopted ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

- New `nfsStoreDescriptor()` / `nfsStoreFactory` / `registerNfsStore()` (plus the `NfsAddress`, `NfsDescriptorOptions`, `NfsBinding` types) — a credentialless, JSON-serializable `StoreDescriptor` (`kind: 'nfs'`, `class: 'lan'`) reconstructs the store via `createStoreLocator()`. `address` is `{ server?, export? }`, the logical `server:/export` identity — identity-only, not consumed by the factory. `options` is `{ onNolock? }`, the serializable `'warn'`/`'error'` tuning. `opts.binding.mountPath` is required because where an export is mounted is device-local and never travels in a descriptor — `toNfs()` fails fast without it; resolving without it throws a clear error naming the missing slot. `binding.mountDetector` carries the existing test-injection seam through unchanged. Verified by a descriptor→resolve→full-conformance round-trip.

## 0.4.0

### Hub 0.6.0-pre.1 adopted, conformance suite de-vendored ([#19](https://github.com/vLannaAi/noy-db-to/issues/19))

- `peerDependencies["@noy-db/hub"]` widened with `|| ^0.6.0-pre.0`; dev pin → `0.6.0-pre.1`. The `/to` store contract is unchanged.
- The adapter-conformance suite is no longer vendored in this repo — every store now runs the published `@noy-db/test-adapter-conformance`, so the store contract has one definition instead of two that could drift. Full conformance re-validated.


## 0.3.1

### Hub 0.5.0 stable adopted ([#52](https://github.com/vLannaAi/noy-db-to/issues/52))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0 || ^0.5.0`, dev pin → `0.5.0`. Full conformance re-validated against the published hub 0.5.0 stable (`@latest`); the `/to` store contract is unchanged. Hub 0.5.0 exports `isConflictError` from its root (noy-db#935), making the store-error identity contract (`name === 'ConflictError'`) load-bearing engine-side — this store already satisfies it via the shared error class.

## 0.3.0

### Hub 0.4.0 stable adopted ([#38](https://github.com/vLannaAi/noy-db-to/issues/38))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0`, dev pin → `0.4.0`. Full conformance re-validated against the published hub 0.4.0 stable (`@latest`), whose `db.transaction(fn)` now genuinely delegates to `store.tx()` on `txAtomic` stores (noy-db#906).

## 0.3.0-pre.3

### Test-only: wired into the shared adapter-conformance suite ([#26](https://github.com/vLannaAi/noy-db-to/issues/26))

- No runtime changes — lockstep version bump. The store now runs the vendored `@noy-db/test-adapter-conformance` contract in CI.

## 0.3.0-pre.1

### BREAKING: factory renamed to `toNfs()` ([#18](https://github.com/vLannaAi/noy-db-to/pull/18))

- `nfs()` → `toNfs()` — every extended store now exports a `to<Backend>()`-named factory matching the package-prefix grammar. Import sites change; options and behavior are identical.

### Hub 0.4.0 pre line adopted ([#20](https://github.com/vLannaAi/noy-db-to/issues/20))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0-pre.10`, dev pin → `0.4.0-pre.10`. The `@noy-db/hub/to` store contract is byte-identical between hub `0.3.0` and `0.4.0-pre.10` (seam types and runtime verified), so the range spans both lines; the full suite runs against `0.4.0-pre.10`.

## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.

