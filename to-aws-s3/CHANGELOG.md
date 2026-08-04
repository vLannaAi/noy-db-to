# Changelog — to-aws-s3

## 0.4.0

### Store-locator descriptor adopted ([#56](https://github.com/vLannaAi/noy-db-to/issues/56), noy-db#945 first slice)

- New `s3StoreDescriptor()` / `s3StoreFactory` / `registerS3Store()` — a credentialless, JSON-serializable `StoreDescriptor` (`kind: 'aws-s3'`, `class: 'cloud'`) reconstructs the store via `createStoreLocator()`. Credentials arrive via `StoreCredentialSource` at `resolve()` time; device-local transport overrides (a pre-built S3Client) ride the `binding` slot. Verified by a descriptor→resolve→full-conformance round-trip.
- Hub peer range widened to admit `^0.6.0-pre.0` (the locator seam's first release); dev pin → `0.6.0-pre.0`.

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

### BREAKING: factory renamed to `toAwsS3()` ([#18](https://github.com/vLannaAi/noy-db-to/pull/18))

- `s3()` → `toAwsS3()` — every extended store now exports a `to<Backend>()`-named factory matching the package-prefix grammar. Import sites change; options and behavior are identical.

### Hub 0.4.0 pre line adopted ([#20](https://github.com/vLannaAi/noy-db-to/issues/20))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0-pre.10`, dev pin → `0.4.0-pre.10`. The `@noy-db/hub/to` store contract is byte-identical between hub `0.3.0` and `0.4.0-pre.10` (seam types and runtime verified), so the range spans both lines; the full suite runs against `0.4.0-pre.10`.

## 0.2.1-pre.1

### Public surface: `mapAws` re-exported from the barrel

- `mapAws` + `AwsCredentialIdentityLike` are now exported from the package root so S3-compatible sibling stores (`to-cloudflare-r2`) share one credential mapper instead of duplicating it. No behavior change.

## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.
- Supersedes the interim `^0.3.0-pre.11` floor introduced for the #479 credentials adoption.

## 0.2.0-pre.33

### Feature: credentials refresh-hook option

- `S3Options.credentials?: StoreCredentialSource` (`s3()`) and `S3BundleOptions.credentials?: StoreCredentialSource` (`s3Bundle()`) — an optional functional AWS credential provider threaded into each `S3Client` construction site, sharing one `mapAws` helper (`src/credentials.ts`). Exercises the hub's #479 credential-broker seam for rolling/short-lived store auth. The pre-built `client?` short-circuit is unchanged at both sites; omitting `credentials` preserves the ambient AWS SDK credential chain exactly as before.

### Hub floor bump

- `peerDependencies["@noy-db/hub"]`: `^0.3.0-pre.1` → `^0.3.0-pre.11` (the minimum publishing `StoreCredentials`/`StoreCredentialSource` from `@noy-db/hub/to`).

## 0.2.0-pre.9

### Feature: s3Bundle bundle-mode adapter ([#272](https://github.com/vLannaAi/noy-db/issues/272))

- `s3Bundle()` implements the `NoydbBundleStore` contract (whole-vault `.noydb` blobs) — a snapshot/bundle destination distinct from the per-record `s3()` adapter. OCC via S3 conditional writes (`IfMatch`/ETag) → `BundleVersionConflictError`; `listBundles()` derives metadata from one `ListObjectsV2` (no per-object GET). Requires `@aws-sdk/client-s3` ≥ 3.696.

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
