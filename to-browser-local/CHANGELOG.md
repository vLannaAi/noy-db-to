# Changelog — to-browser-local

## 0.6.0-pre.1

### Descriptors may only set declared keys ([#69](https://github.com/vLannaAi/noy-db-to/issues/69))

- `to-browser-local` descriptors can no longer set anything the store's `DescriptorOptions` / `Address` types declare no field for. The factory destructures named fields instead of spreading the descriptor's unchecked `options` (and, where applicable, `address`) bag into the store options. Where the winning key was applied *conditionally*, a matching key in that bag previously survived and won — here: `prefix` — the factory spread `{ ...address, ...options }`, so an `options` key beat the same key in `address`. New `#69` tests assert an undeclared key cannot reach the store.

### Hub 0.6.0-pre.3 adopted ([#74](https://github.com/vLannaAi/noy-db-to/pull/74))

- Dev pins → `0.6.0-pre.3` for `@noy-db/hub` and `@noy-db/test-adapter-conformance`. `peerDependencies` are **unchanged**: the existing `^0.6.0-pre.0` already admits later pre-releases on the same `major.minor.patch`, which is the ranged peer doing its job — a same-line hub release must not force a rebuild on consumers. The `/to` store contract is unchanged (hub `pre.2` was comment-only; `pre.3` covers pod-write strictness, a barrel re-export, and a codemod asset). Full conformance re-validated.

## 0.5.0

### Store-locator descriptor adopted ([#58](https://github.com/vLannaAi/noy-db-to/issues/58), noy-db#945)

- New `browserLocalStoreDescriptor()` / `browserLocalStoreFactory` / `registerBrowserLocalStore()` — a credentialless, JSON-serializable `StoreDescriptor` (`kind: 'browser-local'`, `class: 'browser'`) reconstructs the store via `createStoreLocator()`. The simplest citizen of the tier: `localStorage` needs no credentials and no transport, so both the `binding` and `credentials` slots are ignored at resolve time; `address` is `{ prefix? }` and `options` carries `{ obfuscate?, clockUncertaintyMs? }`. Verified by a descriptor→resolve→full-conformance round-trip, plus a behavioural check that a descriptor's `obfuscate: true` really reaches the store (the resolved store's `localStorage` keys are hashed).

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

### BREAKING: factory renamed to `toBrowserLocal()` ([#18](https://github.com/vLannaAi/noy-db-to/pull/18))

- `browserLocalStore()` → `toBrowserLocal()` — every extended store now exports a `to<Backend>()`-named factory matching the package-prefix grammar. Import sites change; options and behavior are identical.

### Hub 0.4.0 pre line adopted ([#20](https://github.com/vLannaAi/noy-db-to/issues/20))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0-pre.10`, dev pin → `0.4.0-pre.10`. The `@noy-db/hub/to` store contract is byte-identical between hub `0.3.0` and `0.4.0-pre.10` (seam types and runtime verified), so the range spans both lines; the full suite runs against `0.4.0-pre.10`.

## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.

## 0.2.0-pre.5

Version-only lockstep bump; no source changes since pre.4.

## 0.2.0-pre.4

Version-only lockstep bump; no source changes since pre.3.

## 0.2.0-pre.3

Version-only lockstep bump; no source changes since pre.2.

## 0.2.0-pre.2

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.2.0-pre.2

## 0.2.0-pre.1

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.2.0-pre.1

## 0.1.0-pre.16

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0-pre.16

## 0.1.0-pre.15

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0-pre.15
## 0.1.0-pre.14

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0-pre.14

## 0.1.0-pre.12

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0-pre.12


## 0.1.0-pre.11

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0-pre.11


## 0.1.0-pre.9

### Patch Changes

- Updated dependencies — @noy-db/hub@0.1.0-pre.9


## 0.1.0-pre.8

### Patch Changes

- Updated dependencies — @noy-db/hub@0.1.0-pre.8

## 0.1.0-pre.7

### Patch Changes

- Updated dependencies
  - @noy-db/hub@0.1.0

## 0.1.0-pre.1 — Initial pre-release
