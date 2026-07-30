# Changelog — to-aws-dynamo

## 0.3.0-pre.3

### Test-only: wired into the shared adapter-conformance suite ([#26](https://github.com/vLannaAi/noy-db-to/issues/26))

- No runtime changes — lockstep version bump. The store now runs the vendored `@noy-db/test-adapter-conformance` contract in CI.

## 0.3.0-pre.1

### BREAKING: factory renamed to `toAwsDynamo()` ([#18](https://github.com/vLannaAi/noy-db-to/pull/18))

- `dynamo()` → `toAwsDynamo()` — every extended store now exports a `to<Backend>()`-named factory matching the package-prefix grammar. Import sites change; options and behavior are identical.

### Hub 0.4.0 pre line adopted ([#20](https://github.com/vLannaAi/noy-db-to/issues/20))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0-pre.10`, dev pin → `0.4.0-pre.10`. The `@noy-db/hub/to` store contract is byte-identical between hub `0.3.0` and `0.4.0-pre.10` (seam types and runtime verified), so the range spans both lines; the full suite runs against `0.4.0-pre.10`.

## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.
- Supersedes the interim `^0.3.0-pre.11` floor introduced for the #479 credentials adoption.

## 0.2.0-pre.33

### Feature: credentials refresh-hook option

- `DynamoOptions.credentials?: StoreCredentialSource` — an optional functional AWS credential provider threaded into `getClient()`'s SDK client config as `config.credentials = async () => mapAws(await options.credentials!())`. Exercises the hub's #479 credential-broker seam for rolling/short-lived store auth. The pre-built `client?` short-circuit path is unchanged; omitting `credentials` preserves the ambient AWS SDK credential chain exactly as before.
- Exports a pure `mapAws(creds: StoreCredentials): AwsCredentialIdentityLike` mapper.

### Hub floor bump

- `peerDependencies["@noy-db/hub"]`: `^0.3.0-pre.1` → `^0.3.0-pre.11` (the minimum publishing `StoreCredentials`/`StoreCredentialSource` from `@noy-db/hub/to`).

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
