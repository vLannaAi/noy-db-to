# Changelog — to-aws-s3

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
