# Changelog — to-nfs

## 0.3.0-pre.1

### BREAKING: factory renamed to `toNfs()` ([#18](https://github.com/vLannaAi/noy-db-to/pull/18))

- `nfs()` → `toNfs()` — every extended store now exports a `to<Backend>()`-named factory matching the package-prefix grammar. Import sites change; options and behavior are identical.

### Hub 0.4.0 pre line adopted ([#20](https://github.com/vLannaAi/noy-db-to/issues/20))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0-pre.10`, dev pin → `0.4.0-pre.10`. The `@noy-db/hub/to` store contract is byte-identical between hub `0.3.0` and `0.4.0-pre.10` (seam types and runtime verified), so the range spans both lines; the full suite runs against `0.4.0-pre.10`.

## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.

