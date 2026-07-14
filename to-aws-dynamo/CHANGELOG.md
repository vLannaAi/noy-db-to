# Changelog — to-aws-dynamo

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
